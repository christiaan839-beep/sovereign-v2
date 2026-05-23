#!/usr/bin/env node
/**
 * SOVEREIGN MATRIX — Prompt compilation CLI (Wave 135).
 *
 * Operator-facing tool that drives `src/lib/prompt-optimizer.ts`
 * against an eval set pulled out of `agent_runs`. Stage-1 usage:
 *
 *   node scripts/compile-prompt.mjs \
 *     --agent audit \
 *     --seed "path/to/seed-system-prompt.txt" \
 *     --eval-size 10 \
 *     --candidates 5 \
 *     --out optimized/audit.system.txt
 *
 * What it does:
 *   1. Loads the seed system prompt from --seed
 *   2. Pulls --eval-size auto-approved rows for --agent from agent_runs
 *      via the same SQL the finetune-export.ts module uses
 *   3. Runs compilePrompt() with a heuristic candidate generator and
 *      a heuristic length-and-keyword scorer (no LLM calls — cheap)
 *   4. Writes the winning prompt to --out, prints the delta vs seed
 *
 * Cheap-path scoring rationale:
 *   The default scorer uses output length (penalises rambling) +
 *   keyword overlap with the reference. Operators with NIM/Anthropic
 *   keys can swap in an LLM-as-judge by editing this script.
 *
 * Stage-2 (TODO): swap heuristic scorer for LLM-as-judge once the
 * operator confirms the heuristic path produces useful candidates.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const out = {
    agent: null,
    seed: null,
    evalSize: 10,
    candidates: 5,
    outPath: null,
    sinceDays: 30,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--agent") out.agent = argv[++i];
    else if (a === "--seed") out.seed = argv[++i];
    else if (a === "--eval-size") out.evalSize = parseInt(argv[++i], 10);
    else if (a === "--candidates") out.candidates = parseInt(argv[++i], 10);
    else if (a === "--out") out.outPath = argv[++i];
    else if (a === "--since-days") out.sinceDays = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: compile-prompt.mjs --agent <name> --seed <file> [options]

Required:
  --agent <name>        agent_runs.agent_name to pull eval examples from
  --seed <file>         file containing the baseline system prompt

Options:
  --eval-size <N>       eval examples per candidate (default 10, max 50)
  --candidates <N>      candidate prompts to generate (default 5, max 12)
  --out <file>          where to write the winning prompt (default: stdout)
  --since-days <N>      window for pulling agent_runs (default 30)
  -h, --help            this message`);
}

/**
 * Heuristic generator — identical to the lib default but inline so
 * this script doesn't need to compile TS.
 */
async function generateCandidates(seed, _examples, n) {
  const directives = [
    "Be concise — never exceed 3 sentences unless asked.",
    "Structure your answer with clear sections and bullet points where helpful.",
    "Think step by step before answering.",
    "Cite specific evidence from the input. Avoid generic statements.",
    "Be specific and avoid filler phrases like 'I would be happy to'.",
    "Prioritize accuracy over thoroughness — say 'I don't know' when uncertain.",
  ];
  const prefixes = ["You are an expert. ", "Your task: ", "Important — ", ""];
  const out = [];
  for (let i = 0; i < n; i++) {
    const prefix = prefixes[i % prefixes.length];
    const directive = directives[i % directives.length];
    out.push(`${prefix}${seed}\n\n${directive}`);
  }
  return out;
}

/** Heuristic runner — returns a synthetic answer for offline scoring. */
async function heuristicRunner(systemPrompt, userInput) {
  // Cheap deterministic synthesis — score the SHAPE of the prompt,
  // not real-world output quality. Operator should swap this for a
  // real LLM call once they validate the loop end-to-end.
  return `[heuristic] Answer for "${userInput.slice(0, 60)}" using prompt of ${systemPrompt.length} chars.`;
}

/** Heuristic scorer — length penalty + keyword overlap (0-1). */
async function heuristicScorer(output, example, systemPrompt) {
  let score = 0.5;
  // Prefer prompts in the 200-1500 char band (most LLMs do best here)
  const promptLen = systemPrompt.length;
  if (promptLen >= 200 && promptLen <= 1500) score += 0.15;
  if (promptLen > 3000) score -= 0.2;
  // Prefer prompts that mention structure / specificity directives
  for (const kw of ["specific", "step", "structure", "evidence", "concise"]) {
    if (systemPrompt.toLowerCase().includes(kw)) score += 0.04;
  }
  // If reference is provided, give credit for keyword overlap
  if (example.reference) {
    const refWords = new Set(
      example.reference.toLowerCase().match(/\b\w{4,}\b/g) || [],
    );
    const outWords = new Set(
      String(output).toLowerCase().match(/\b\w{4,}\b/g) || [],
    );
    const overlap = [...refWords].filter((w) => outWords.has(w)).length;
    score += Math.min(0.25, overlap * 0.02);
  }
  return Math.max(0, Math.min(1, score));
}

/**
 * Pull eval examples from agent_runs via direct PG. Falls back to a
 * synthetic 3-example set when DATABASE_URL is unset (so the script
 * runs in dev / CI without a DB).
 */
async function pullEvalExamples(agent, n, sinceDays) {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgresql://")) {
    console.log(
      "[compile-prompt] DATABASE_URL not set — using synthetic eval set.",
    );
    return [
      { input: "Analyze https://example.com" },
      { input: "Summarize the trends in this market." },
      { input: "What are 3 risks of this approach?" },
    ].slice(0, n);
  }
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const rows = await sql`
      SELECT input_json, output_json
      FROM agent_runs
      WHERE agent_name = ${agent}
        AND trust_decision = 'auto-approved'
        AND duration_ms > 0
        AND created_at > ${since.toISOString()}
      ORDER BY created_at DESC
      LIMIT ${Math.min(n, 50)}
    `;
    const out = [];
    for (const r of rows) {
      try {
        const inp = JSON.parse(r.input_json);
        const text =
          (typeof inp === "string" ? inp : null) ||
          inp?.prompt ||
          inp?.text ||
          inp?.query ||
          inp?.message ||
          inp?.goal ||
          inp?.problem ||
          JSON.stringify(inp).slice(0, 400);
        if (text) out.push({ input: text });
      } catch {
        // skip malformed rows
      }
    }
    return out;
  } catch (err) {
    console.log(
      `[compile-prompt] DB pull failed (${err?.message ?? "err"}) — using synthetic set.`,
    );
    return [
      { input: "Analyze https://example.com" },
      { input: "Summarize the trends in this market." },
    ];
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.agent || !args.seed) {
    printHelp();
    process.exit(1);
  }
  if (args.evalSize > 50 || args.evalSize < 2) {
    console.error("--eval-size must be 2..50");
    process.exit(1);
  }
  if (args.candidates > 12 || args.candidates < 2) {
    console.error("--candidates must be 2..12");
    process.exit(1);
  }

  const seedAbs = path.resolve(args.seed);
  const seed = (await fs.readFile(seedAbs, "utf8")).trim();
  if (!seed) {
    console.error(`Seed file ${seedAbs} is empty`);
    process.exit(1);
  }

  console.log(
    `[compile-prompt] agent=${args.agent} seedChars=${seed.length} evalSize=${args.evalSize} candidates=${args.candidates}`,
  );

  const evalSet = await pullEvalExamples(
    args.agent,
    args.evalSize,
    args.sinceDays,
  );
  if (evalSet.length < 2) {
    console.error(
      `[compile-prompt] Only ${evalSet.length} eval examples found — need at least 2.`,
    );
    process.exit(1);
  }
  console.log(`[compile-prompt] eval examples: ${evalSet.length}`);

  // Score the seed
  const seedScores = [];
  for (const ex of evalSet) {
    const out = await heuristicRunner(seed, ex.input);
    seedScores.push(await heuristicScorer(out, ex, seed));
  }
  const seedAvg = seedScores.reduce((s, n) => s + n, 0) / seedScores.length;

  // Score candidates
  const candidates = await generateCandidates(seed, evalSet, args.candidates);
  const scored = [];
  for (const cand of candidates) {
    const ps = [];
    for (const ex of evalSet) {
      const out = await heuristicRunner(cand, ex.input);
      ps.push(await heuristicScorer(out, ex, cand));
    }
    const avg = ps.reduce((s, n) => s + n, 0) / ps.length;
    scored.push({ prompt: cand, score: avg });
  }
  scored.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.prompt.length - b.prompt.length,
  );
  const winner = scored[0];

  const delta = winner.score - seedAvg;
  const improved = delta > 0.01;

  console.log(
    `[compile-prompt] seed score: ${seedAvg.toFixed(4)} · winner score: ${winner.score.toFixed(4)} · delta: ${delta >= 0 ? "+" : ""}${delta.toFixed(4)} · ${improved ? "IMPROVED" : "no improvement"}`,
  );

  const outPrompt = improved ? winner.prompt : seed;
  if (args.outPath) {
    const outAbs = path.resolve(args.outPath);
    await fs.mkdir(path.dirname(outAbs), { recursive: true });
    await fs.writeFile(outAbs, outPrompt + "\n", "utf8");
    console.log(`[compile-prompt] wrote ${outAbs}`);
  } else {
    console.log("\n=== WINNING PROMPT ===\n");
    console.log(outPrompt);
  }
}

main().catch((err) => {
  console.error(`[compile-prompt] fatal: ${err?.message ?? err}`);
  process.exit(1);
});
