#!/usr/bin/env node
/**
 * SOVEREIGN MATRIX — Fine-tune dataset export CLI (Wave 136).
 *
 * Operator-facing tool that pulls auto-approved `agent_runs` rows
 * and writes JSONL ready for NeMo Customizer / OpenAI fine-tune /
 * any standard chat-completion trainer.
 *
 * Usage:
 *   node scripts/export-finetune.mjs \
 *     --since-days 90 \
 *     --max-rows 5000 \
 *     --include audit,competitor-scan,deep-think \
 *     --out training/sovereign-2026-05.jsonl
 *
 *   # Or by exclusion:
 *   node scripts/export-finetune.mjs --exclude pii-redactor,gliner-pii \
 *     --out training/all-but-pii.jsonl
 *
 * Without --out, writes to stdout (pipe to `gsutil cp - gs://bucket/file.jsonl`).
 *
 * Cap behaviour:
 *   - Defaults to 5000 rows (NeMo Customizer sweet spot)
 *   - 50-8000 char output length filter (rejects garbage + truncated runs)
 *   - Per-prompt-hash dedup (won't double-feed the trainer)
 *   - PII-redactor / gliner-pii / asr deliberately excluded by default
 *     because their outputs contain the data they're meant to redact
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";

const MIN_OUTPUT_LEN = 50;
const MAX_OUTPUT_LEN = 8_000;
const MAX_INPUT_LEN = 4_000;

const DEFAULT_EXCLUDE = ["pii-redactor", "gliner-pii", "asr", "pii-guard"];

function parseArgs(argv) {
  const out = {
    sinceDays: 90,
    maxRows: 5000,
    include: null,
    exclude: DEFAULT_EXCLUDE.slice(),
    outPath: null,
    systemPrompt: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--since-days") out.sinceDays = parseInt(argv[++i], 10);
    else if (a === "--max-rows") out.maxRows = parseInt(argv[++i], 10);
    else if (a === "--include")
      out.include = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--exclude")
      out.exclude = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--out") out.outPath = argv[++i];
    else if (a === "--system") out.systemPrompt = argv[++i];
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: export-finetune.mjs [options]

Options:
  --since-days <N>     window to pull from (default 90)
  --max-rows <N>       cap on emitted training examples (default 5000)
  --include <agents>   comma-separated agent allowlist (default: all)
  --exclude <agents>   comma-separated agent denylist
                       (default: pii-redactor,gliner-pii,asr,pii-guard)
  --system <text>      custom system prompt for every example
                       (default: per-agent "You are the {agent} agent.")
  --out <file>         where to write JSONL (default: stdout)
  -h, --help           this message

Without --out, writes to stdout so you can pipe directly:
  node scripts/export-finetune.mjs | gsutil cp - gs://sovereign-train/`);
}

function extractInputText(inputJson) {
  try {
    const parsed = JSON.parse(inputJson);
    if (typeof parsed === "string") return parsed.slice(0, MAX_INPUT_LEN);
    if (!parsed || typeof parsed !== "object") return null;
    const candidates = [
      "prompt",
      "text",
      "query",
      "message",
      "goal",
      "input",
      "problem",
      "topic",
      "question",
    ];
    for (const k of candidates) {
      const v = parsed[k];
      if (typeof v === "string" && v.trim().length > 0) {
        return v.slice(0, MAX_INPUT_LEN);
      }
    }
    const stringified = JSON.stringify(parsed);
    return stringified.slice(0, MAX_INPUT_LEN);
  } catch {
    return null;
  }
}

function extractOutputText(outputJson) {
  try {
    const parsed = JSON.parse(outputJson);
    if (typeof parsed === "string") return parsed.slice(0, MAX_OUTPUT_LEN);
    if (!parsed || typeof parsed !== "object") return null;
    const candidates = [
      "result",
      "output",
      "response",
      "text",
      "answer",
      "content",
      "analysis",
      "summary",
      "agentResponse",
      "final_answer",
    ];
    for (const k of candidates) {
      const v = parsed[k];
      if (typeof v === "string" && v.trim().length > 0) {
        return v.slice(0, MAX_OUTPUT_LEN);
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function pullRows(sinceDays) {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgresql://")) {
    return {
      rows: [],
      warning:
        "DATABASE_URL not set — nothing to export. Set it to a Neon postgresql:// URL.",
    };
  }
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const rows = await sql`
      SELECT id, agent_name, model_used, input_json, output_json,
             duration_ms, created_at
      FROM agent_runs
      WHERE trust_decision = 'auto-approved'
        AND duration_ms > 0
        AND created_at > ${since.toISOString()}
      ORDER BY created_at DESC
      LIMIT 50000
    `;
    return { rows };
  } catch (err) {
    return {
      rows: [],
      warning: `DB pull failed: ${err?.message ?? err}`,
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.maxRows < 1 || args.maxRows > 50_000) {
    console.error("--max-rows must be 1..50000");
    process.exit(1);
  }

  console.log(
    `[export-finetune] sinceDays=${args.sinceDays} maxRows=${args.maxRows} exclude=[${args.exclude.join(",")}]${args.include ? ` include=[${args.include.join(",")}]` : ""}`,
  );

  const { rows, warning } = await pullRows(args.sinceDays);
  if (warning) {
    console.error(`[export-finetune] ${warning}`);
    process.exit(1);
  }

  const includeSet = args.include ? new Set(args.include) : null;
  const excludeSet = new Set(args.exclude);

  const seen = new Set();
  const examples = [];

  for (const r of rows) {
    if (examples.length >= args.maxRows) break;
    if (excludeSet.has(r.agent_name)) continue;
    if (includeSet && !includeSet.has(r.agent_name)) continue;

    const inputText = extractInputText(r.input_json);
    if (!inputText || inputText.trim().length === 0) continue;
    const outputText = extractOutputText(r.output_json);
    if (!outputText) continue;
    if (outputText.length < MIN_OUTPUT_LEN) continue;
    if (outputText.length > MAX_OUTPUT_LEN) continue;

    const promptHash = createHash("sha256")
      .update(inputText)
      .update("|")
      .update(r.agent_name)
      .digest("hex")
      .slice(0, 24);
    if (seen.has(promptHash)) continue;
    seen.add(promptHash);

    const systemContent =
      args.systemPrompt && args.systemPrompt.trim().length > 0
        ? args.systemPrompt
        : `You are the Sovereign Matrix ${r.agent_name} agent.`;

    examples.push({
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: inputText },
        { role: "assistant", content: outputText },
      ],
    });
  }

  const ndjson = examples.map((e) => JSON.stringify(e)).join("\n");

  if (args.outPath) {
    const outAbs = path.resolve(args.outPath);
    await fs.mkdir(path.dirname(outAbs), { recursive: true });
    await fs.writeFile(outAbs, ndjson + (examples.length > 0 ? "\n" : ""), "utf8");
    const bytes = Buffer.byteLength(ndjson, "utf8");
    console.log(
      `[export-finetune] wrote ${examples.length} rows (${(bytes / 1024).toFixed(1)} KB) → ${outAbs}`,
    );
  } else {
    process.stdout.write(ndjson);
    if (examples.length > 0) process.stdout.write("\n");
    console.error(`[export-finetune] wrote ${examples.length} rows to stdout`);
  }
}

main().catch((err) => {
  console.error(`[export-finetune] fatal: ${err?.message ?? err}`);
  process.exit(1);
});
