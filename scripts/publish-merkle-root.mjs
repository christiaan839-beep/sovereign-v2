#!/usr/bin/env node
/**
 * SOVEREIGN MATRIX — Daily Merkle root publisher (Wave 141).
 *
 * Operator cron tool. Pulls the previous day's receipts, computes
 * the Merkle root, and emits a JSON file ready to publish:
 *   - to a GitHub Release as `merkle-roots/YYYY-MM-DD.json`
 *   - to IPFS via `ipfs add`
 *   - or just to stdout for piping into a tweet
 *
 * Usage:
 *   node scripts/publish-merkle-root.mjs                       # yesterday → stdout
 *   node scripts/publish-merkle-root.mjs --date 2026-05-22
 *   node scripts/publish-merkle-root.mjs --out roots/today.json
 *   node scripts/publish-merkle-root.mjs --since 7             # last 7 days as array
 *
 * Exit code:
 *   0 = root computed (even if 0 leaves on that day)
 *   1 = DB unavailable / setup error
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}
function leafHash(canonical) {
  return sha256(`00${canonical}`);
}
function hashPair(left, right) {
  return sha256(Buffer.from(`01${left}${right}`, "hex").toString("binary"));
}
function buildRoot(leaves) {
  if (leaves.length === 0) return "";
  let level = leaves.slice();
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(hashPair(level[i], i + 1 < level.length ? level[i + 1] : level[i]));
    }
    level = next;
  }
  return level[0];
}
function canonical(r) {
  return [
    r.id,
    r.agent_name,
    r.model_used,
    String(r.duration_ms),
    r.trust_decision,
    r.signature,
    r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  ].join("|");
}

function parseArgs(argv) {
  const out = { date: null, out: null, since: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--date") out.date = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--since") out.since = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: publish-merkle-root.mjs [--date YYYY-MM-DD] [--out file] [--since N]`);
      process.exit(0);
    }
  }
  return out;
}

function utcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function rootForDate(sql, day) {
  const start = utcDay(day);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const rows = await sql`
    SELECT id, agent_name, model_used, duration_ms, trust_decision, signature, created_at
    FROM agent_runs
    WHERE created_at >= ${start.toISOString()}
      AND created_at <  ${end.toISOString()}
    ORDER BY created_at ASC
  `;
  const leaves = rows.map((r) => leafHash(canonical(r)));
  return {
    date: start.toISOString().slice(0, 10),
    root: buildRoot(leaves),
    leafCount: rows.length,
    firstLeafId: rows[0]?.id,
    lastLeafId: rows[rows.length - 1]?.id,
    generatedAt: new Date().toISOString(),
    spec: "sovereign-merkle-v1 · sha256 · RFC9162-style leaf+node prefixes · last-leaf-pad",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgresql://")) {
    console.error("[publish-merkle-root] DATABASE_URL not set");
    process.exit(1);
  }
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);

  const baseDay = args.date
    ? new Date(`${args.date}T00:00:00Z`)
    : (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 1);
        return d;
      })();

  let payload;
  if (args.since && args.since > 1) {
    const days = Math.min(args.since, 60);
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(baseDay);
      d.setUTCDate(d.getUTCDate() - i);
      out.push(await rootForDate(sql, d));
    }
    payload = out;
  } else {
    payload = await rootForDate(sql, baseDay);
  }

  const json = JSON.stringify(payload, null, 2);
  if (args.out) {
    const outAbs = path.resolve(args.out);
    await fs.mkdir(path.dirname(outAbs), { recursive: true });
    await fs.writeFile(outAbs, json + "\n", "utf8");
    console.log(`[publish-merkle-root] wrote → ${outAbs}`);
  } else {
    process.stdout.write(json + "\n");
  }
}

main().catch((err) => {
  console.error(`[publish-merkle-root] fatal: ${err?.message ?? err}`);
  process.exit(1);
});
