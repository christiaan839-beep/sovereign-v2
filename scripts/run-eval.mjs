#!/usr/bin/env node
/**
 * SOVEREIGN MATRIX — Eval harness CLI (Wave 138).
 *
 * Operator-facing closed-loop tool. Pulls recent agent_runs, scores
 * them with the heuristic rubric, optionally diffs against a stored
 * baseline file (eval-baseline.json), and exits non-zero on regression.
 *
 * Use cases:
 *   - Weekly cron: pipe to Slack on regression
 *   - Pre-deploy gate: refuse to deploy if quality dropped > 5%
 *   - Post-fine-tune: confirm new adapter beats old baseline
 *
 * Usage:
 *   node scripts/run-eval.mjs                                  # print report
 *   node scripts/run-eval.mjs --baseline eval-baseline.json    # diff vs baseline
 *   node scripts/run-eval.mjs --save eval-baseline.json        # write new baseline
 *   node scripts/run-eval.mjs --window-days 14 --samples 30    # custom window
 *   node scripts/run-eval.mjs --threshold 5 --baseline X.json  # fail at >5% drop
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{16}\b/, // credit card
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/, // email
];

const MIN_LEN = 50;
const MAX_LEN = 12_000;

function parseArgs(argv) {
  const out = {
    windowDays: 7,
    samples: 20,
    baseline: null,
    save: null,
    threshold: 5,
    agent: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--window-days") out.windowDays = parseInt(argv[++i], 10);
    else if (a === "--samples") out.samples = parseInt(argv[++i], 10);
    else if (a === "--baseline") out.baseline = argv[++i];
    else if (a === "--save") out.save = argv[++i];
    else if (a === "--threshold") out.threshold = parseFloat(argv[++i]);
    else if (a === "--agent") out.agent = argv[++i];
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: run-eval.mjs [options]

Options:
  --window-days <N>    days back to sample (default 7, max 90)
  --samples <N>        samples per agent (default 20, max 100)
  --baseline <file>    JSON baseline to diff against (exits 1 on regression)
  --save <file>        write current report as baseline JSON
  --threshold <PCT>    pct drop that counts as regression (default 5)
  --agent <name>       restrict to a single agent
  -h, --help           this message

Exit code:
  0 = clean run / no regression
  1 = regression detected (only when --baseline given)
  2 = setup / runtime error`);
}

function heuristicScore(input, output) {
  if (!output || output.trim().length < MIN_LEN) return 0.1;
  if (output.length > MAX_LEN) return 0.4;

  let score = 0.5;

  const fillerHits = [
    /i would be happy to/i,
    /certainly!/i,
    /great question/i,
    /as an ai/i,
  ].reduce((n, re) => (re.test(output) ? n + 1 : n), 0);
  score -= 0.05 * fillerHits;

  const numbers = (output.match(/\b\d+(?:\.\d+)?\b/g) ?? []).length;
  score += Math.min(0.2, numbers * 0.02);
  if (/https?:\/\//.test(output)) score += 0.05;
  if (/<source/i.test(output) || /\[\d+\]/.test(output)) score += 0.05;

  const words = output.toLowerCase().match(/\b\w{5,}\b/g) ?? [];
  if (words.length > 20) {
    const unique = new Set(words);
    const ratio = unique.size / words.length;
    if (ratio < 0.3) score -= 0.2;
    else if (ratio < 0.5) score -= 0.1;
  }

  for (const re of PII_PATTERNS) {
    if (re.test(output)) {
      score -= 0.25;
      break;
    }
  }

  const inputWords = new Set(
    (input.toLowerCase().match(/\b\w{4,}\b/g) ?? []).slice(0, 30),
  );
  const outputWords = new Set(
    (output.toLowerCase().match(/\b\w{4,}\b/g) ?? []).slice(0, 200),
  );
  let overlap = 0;
  for (const w of inputWords) if (outputWords.has(w)) overlap++;
  score += Math.min(0.15, overlap * 0.015);

  return Math.max(0, Math.min(1, score));
}

function extractInput(raw) {
  try {
    const p = JSON.parse(raw);
    if (typeof p === "string") return p;
    if (!p || typeof p !== "object") return "";
    for (const k of ["prompt", "text", "query", "message", "goal", "problem"]) {
      if (typeof p[k] === "string" && p[k].length > 0) return p[k];
    }
    return JSON.stringify(p).slice(0, 4_000);
  } catch {
    return "";
  }
}

function extractOutput(raw) {
  try {
    const p = JSON.parse(raw);
    if (typeof p === "string") return p;
    if (!p || typeof p !== "object") return "";
    for (const k of [
      "result",
      "output",
      "response",
      "text",
      "answer",
      "analysis",
      "summary",
      "final_answer",
      "agentResponse",
      "solution",
    ]) {
      if (typeof p[k] === "string" && p[k].length > 0) return p[k];
    }
    return "";
  } catch {
    return "";
  }
}

async function pullRows(args) {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgresql://")) {
    return { rows: [], warning: "DATABASE_URL not set" };
  }
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    const since = new Date(Date.now() - args.windowDays * 24 * 60 * 60 * 1000);
    const rows = args.agent
      ? await sql`
          SELECT id, agent_name, model_used, input_json, output_json,
                 trust_decision, duration_ms, created_at
          FROM agent_runs
          WHERE created_at > ${since.toISOString()}
            AND agent_name = ${args.agent}
          ORDER BY created_at DESC
          LIMIT 50000
        `
      : await sql`
          SELECT id, agent_name, model_used, input_json, output_json,
                 trust_decision, duration_ms, created_at
          FROM agent_runs
          WHERE created_at > ${since.toISOString()}
          ORDER BY created_at DESC
          LIMIT 50000
        `;
    return { rows };
  } catch (err) {
    return { rows: [], warning: err?.message ?? String(err) };
  }
}

function aggregate(rows, samplesPerAgent) {
  const perAgentSamples = new Map();
  for (const r of rows) {
    const bucket = perAgentSamples.get(r.agent_name);
    if (!bucket) perAgentSamples.set(r.agent_name, [r]);
    else if (bucket.length < samplesPerAgent) bucket.push(r);
  }

  const agentRows = [];
  let totalScoreSum = 0;
  let totalScoreN = 0;
  let totalApproved = 0;
  let totalSeen = 0;

  for (const [agentName, samples] of perAgentSamples.entries()) {
    let sumScore = 0;
    let approved = 0;
    let totalDur = 0;
    for (const r of samples) {
      const input = extractInput(r.input_json);
      const output = extractOutput(r.output_json);
      sumScore += heuristicScore(input, output);
      if (r.trust_decision === "auto-approved") approved++;
      totalDur += r.duration_ms ?? 0;
    }
    const n = samples.length;
    const avgScore = n === 0 ? 0 : sumScore / n;
    agentRows.push({
      agentName,
      samples: n,
      avgScore: Number(avgScore.toFixed(4)),
      autoApprovedRate: n === 0 ? 0 : Number((approved / n).toFixed(4)),
      avgDurationMs: n === 0 ? 0 : Math.round(totalDur / n),
    });
    totalScoreSum += avgScore * n;
    totalScoreN += n;
    totalApproved += approved;
    totalSeen += n;
  }
  agentRows.sort((a, b) => a.avgScore - b.avgScore);

  return {
    generatedAt: new Date().toISOString(),
    totalRowsScored: rows.length,
    perAgent: agentRows,
    overall: {
      avgScore:
        totalScoreN === 0 ? 0 : Number((totalScoreSum / totalScoreN).toFixed(4)),
      autoApprovedRate:
        totalSeen === 0 ? 0 : Number((totalApproved / totalSeen).toFixed(4)),
    },
  };
}

function detectRegressions(current, baseline, threshold) {
  const baseMap = new Map(
    baseline.perAgent.map((a) => [a.agentName, a.avgScore]),
  );
  const out = [];
  for (const a of current.perAgent) {
    const base = baseMap.get(a.agentName);
    if (base == null || base === 0) continue;
    const pctDrop = ((base - a.avgScore) / base) * 100;
    if (pctDrop >= threshold) {
      out.push({
        agentName: a.agentName,
        baselineScore: base,
        currentScore: a.avgScore,
        pctDrop: Number(pctDrop.toFixed(2)),
      });
    }
  }
  return out.sort((a, b) => b.pctDrop - a.pctDrop);
}

function printReport(report) {
  console.log(`\n=== EVAL REPORT (generated ${report.generatedAt}) ===\n`);
  console.log(
    `  Total rows scored: ${report.totalRowsScored}`,
  );
  console.log(`  Overall avg score: ${report.overall.avgScore}`);
  console.log(
    `  Overall auto-approved rate: ${(report.overall.autoApprovedRate * 100).toFixed(1)}%\n`,
  );
  console.log("  Worst-scoring agents:");
  for (const a of report.perAgent.slice(0, 10)) {
    console.log(
      `    ${a.agentName.padEnd(28)} score=${a.avgScore.toFixed(3)} samples=${a.samples} approved=${(a.autoApprovedRate * 100).toFixed(0)}%`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.windowDays < 1 || args.windowDays > 90) {
    console.error("--window-days must be 1..90");
    process.exit(2);
  }
  if (args.samples < 1 || args.samples > 100) {
    console.error("--samples must be 1..100");
    process.exit(2);
  }

  console.log(
    `[run-eval] windowDays=${args.windowDays} samples=${args.samples}${args.agent ? ` agent=${args.agent}` : ""}`,
  );

  const { rows, warning } = await pullRows(args);
  if (warning) {
    console.error(`[run-eval] ${warning}`);
    process.exit(2);
  }

  const report = aggregate(rows, args.samples);
  printReport(report);

  if (args.save) {
    const outAbs = path.resolve(args.save);
    await fs.mkdir(path.dirname(outAbs), { recursive: true });
    await fs.writeFile(outAbs, JSON.stringify(report, null, 2) + "\n", "utf8");
    console.log(`\n[run-eval] saved baseline → ${outAbs}`);
  }

  if (args.baseline) {
    const baselineAbs = path.resolve(args.baseline);
    let baseline;
    try {
      baseline = JSON.parse(await fs.readFile(baselineAbs, "utf8"));
    } catch (err) {
      console.error(`[run-eval] cannot read baseline ${baselineAbs}: ${err?.message ?? err}`);
      process.exit(2);
    }
    const regressions = detectRegressions(report, baseline, args.threshold);
    if (regressions.length === 0) {
      console.log(
        `\n[run-eval] no regressions vs ${baselineAbs} at ${args.threshold}% threshold ✓`,
      );
      process.exit(0);
    }
    console.log(
      `\n[run-eval] REGRESSIONS (${regressions.length}) vs ${baselineAbs}:`,
    );
    for (const r of regressions) {
      console.log(
        `    ${r.agentName.padEnd(28)} ${r.baselineScore.toFixed(3)} → ${r.currentScore.toFixed(3)} (-${r.pctDrop}%)`,
      );
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[run-eval] fatal: ${err?.message ?? err}`);
  process.exit(2);
});
