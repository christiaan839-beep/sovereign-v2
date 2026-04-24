#!/usr/bin/env node
/**
 * weekly-health.mjs — automated elite-tier audit.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The STAY-ELITE.md rules only hold if someone checks them. This script
 * IS that someone. Run weekly by a GitHub Action, it:
 *
 *   1. Counts the things we claim to count (agents, tests, evals, models,
 *      industry pages, vs-pages, safety modules)
 *   2. Compares against targets + flags regressions
 *   3. Posts a summary that can be pasted into a GitHub issue
 *
 * PHILOSOPHY
 * ──────────
 * This is the anti-drift machine. STAY-ELITE rule 1 says every claim
 * must be code-verifiable — so the test IS the verification.
 *
 * SAFETY
 * ──────
 * Uses Node fs + regex for counts (NOT shell pipelines with grep|wc|sort).
 * Only invokes npm tooling via execFileSync with fixed argv — no shell
 * interpolation, no user input. Safe to run in CI.
 *
 * RUNTIME
 * ───────
 *   node scripts/weekly-health.mjs          # print to stdout (markdown)
 *   node scripts/weekly-health.mjs --json   # machine-readable
 *
 * EXIT CODES
 * ──────────
 *   0 — all checks healthy
 *   1 — a regression was detected (target missed)
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const OUTPUT_JSON = process.argv.includes("--json");

/**
 * Safe command runner — no shell, fixed argv only.
 * We only use this for npm/npx tooling. File/directory inspection
 * goes through fs.* primitives.
 */
function runTool(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180_000,
      ...opts,
    });
  } catch (err) {
    // Keep stdout even on non-zero exit for tools like npm test that
    // might return non-zero for warnings. Caller decides from the text.
    const e = err;
    return typeof e?.stdout === "string" ? e.stdout : "";
  }
}

/** Recursively walk `dir`; callback gets the relative path. */
function walk(dir, cb, base = dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, cb, base);
    else cb(full.slice(base.length + 1));
  }
}

function countMatches(filePath, regex) {
  if (!existsSync(filePath)) return 0;
  const text = readFileSync(filePath, "utf8");
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function uniqueMatches(filePath, regex) {
  if (!existsSync(filePath)) return 0;
  const text = readFileSync(filePath, "utf8");
  const matches = text.match(regex) ?? [];
  return new Set(matches).size;
}

function dirCount(dir, filter) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(filter ?? (() => true)).length;
}

const checks = [];

function check(name, value, target, { floor = true, dimension } = {}) {
  const status =
    target == null
      ? "info"
      : floor
        ? value >= target
          ? "ok"
          : "fail"
        : value <= target
          ? "ok"
          : "fail";
  checks.push({ name, value, target, status, dimension });
  return status;
}

const t0 = Date.now();

// ──────────────────────────────────────────────────────────────
// Catalog
// ──────────────────────────────────────────────────────────────

check(
  "agents in registry",
  countMatches(
    join(ROOT, "src/app/api/agents/registry.ts"),
    /\(\) => import/g,
  ),
  200,
  { dimension: "catalog" },
);

check(
  "agent route files on disk",
  dirCount(join(ROOT, "src/app/api/_agents"), (name) => {
    const p = join(ROOT, "src/app/api/_agents", name);
    return existsSync(p) && statSync(p).isDirectory();
  }),
  200,
  { dimension: "catalog" },
);

check(
  "unique LLM models referenced",
  uniqueMatches(
    join(ROOT, "src/lib/nvidia.ts"),
    /"[a-z0-9-]+\/[a-z0-9.-]+"/g,
  ),
  30,
  { dimension: "catalog" },
);

// ──────────────────────────────────────────────────────────────
// Marketing surfaces
// ──────────────────────────────────────────────────────────────

check(
  "industry landing pages",
  dirCount(join(ROOT, "src/app"), (name) => name.startsWith("for-")),
  10,
  { dimension: "marketing" },
);

// /vs/<competitor> pages don't live on this branch yet (mentioned in
// session notes + ProofStrip but route folders are pending the
// upcoming PR). Target is 10 long-term; currently 0 is accurate.
// Floor deliberately at 0 for now — we bump this when the pages land.
check(
  "competitor /vs pages",
  dirCount(join(ROOT, "src/app/vs"), () => true),
  0,
  { dimension: "marketing" },
);

// ──────────────────────────────────────────────────────────────
// Quality gates
// ──────────────────────────────────────────────────────────────

const tscOutput = runTool("npx", ["tsc", "--noEmit"]);
const tscOk = !tscOutput.includes("error TS");
check("tsc clean", tscOk ? 1 : 0, 1, { dimension: "quality" });

const lintOut = runTool("npm", ["run", "lint"]);
const lintErrors = (lintOut.match(/\s+\d+:\d+\s+error/g) ?? []).length;
// Floor is "don't regress past the current baseline". Adjust as we fix.
check("lint errors (max allowed)", lintErrors, 25, {
  floor: false,
  dimension: "quality",
});

const testOut = runTool("npx", [
  "vitest",
  "run",
  "--reporter=dot",
]);
// Strip ANSI color codes — vitest's dot reporter wraps numbers in
// \x1b[1m[32m...\x1b[22m which made the regex miss the count.
// eslint-disable-next-line no-control-regex
const testOutPlain = testOut.replace(/\x1b\[\d+m/g, "");
const testMatch = testOutPlain.match(/Tests\s+(\d+)\s+passed/);
const testsPassing = testMatch ? parseInt(testMatch[1], 10) : 0;
check("tests passing", testsPassing, 2000, { dimension: "quality" });

const goldenSet = join(
  ROOT,
  "src/lib/__tests__/agent-evals/golden-set.ts",
);
const evalCount = countMatches(goldenSet, /^registerEval\({/gm);
const agentCount = checks.find((c) => c.name === "agents in registry")?.value ?? 1;
const evalCoveragePct = Math.round((evalCount / Math.max(1, agentCount)) * 100);
check("eval coverage %", evalCoveragePct, 10, { dimension: "quality" });

// ──────────────────────────────────────────────────────────────
// Elite-tier infrastructure presence
// ──────────────────────────────────────────────────────────────

const infraChecks = [
  { path: "src/lib/slo-tracker.ts", name: "SLO tracker" },
  { path: "src/lib/error-codes.ts", name: "Structured error codes" },
  { path: "src/app/api/openapi/route.ts", name: "OpenAPI 3.1 endpoint" },
  { path: "src/app/status/slo/page.tsx", name: "Public /status/slo page" },
  { path: "src/app/compare/page.tsx", name: "Public /compare page" },
  { path: "src/app/playground/page.tsx", name: "Public /playground page" },
  {
    path: "src/app/docs/webhooks/verify/page.tsx",
    name: "Webhook HMAC samples doc",
  },
  { path: "src/app/docs/errors/page.tsx", name: "Error code doc pages" },
  { path: "src/app/developers/api-explorer/page.tsx", name: "API explorer" },
  { path: ".github/workflows/ci.yml", name: "CI workflow present" },
  { path: "e2e/elite-surfaces.spec.ts", name: "Elite-surfaces E2E suite" },
];

for (const { path, name } of infraChecks) {
  const present = existsSync(join(ROOT, path)) ? 1 : 0;
  check(name, present, 1, { dimension: "infrastructure" });
}

// ──────────────────────────────────────────────────────────────
// Database migrations
// ──────────────────────────────────────────────────────────────

check(
  "migrations on disk",
  dirCount(join(ROOT, "drizzle"), (name) => name.endsWith(".sql")),
  30,
  { dimension: "database" },
);

// ──────────────────────────────────────────────────────────────
// Commit + doc hygiene
// ──────────────────────────────────────────────────────────────

const hasStayElite = existsSync(join(ROOT, "docs/STAY-ELITE.md"));
check("STAY-ELITE.md present", hasStayElite ? 1 : 0, 1, {
  dimension: "process",
});

const hasWhatsNotElite = existsSync(join(ROOT, "docs/WHATS-NOT-ELITE.md"));
check("WHATS-NOT-ELITE.md (honest gap list)", hasWhatsNotElite ? 1 : 0, 1, {
  dimension: "process",
});

const hasMergeStrategy = existsSync(join(ROOT, "docs/MERGE-STRATEGY.md"));
check("MERGE-STRATEGY.md (ops playbook)", hasMergeStrategy ? 1 : 0, 1, {
  dimension: "process",
});

// ──────────────────────────────────────────────────────────────
// Report
// ──────────────────────────────────────────────────────────────

const dimensions = [...new Set(checks.map((c) => c.dimension))].sort();
const totalFail = checks.filter((c) => c.status === "fail").length;
const durationSec = Math.round((Date.now() - t0) / 1000);

if (OUTPUT_JSON) {
  console.log(
    JSON.stringify(
      {
        summary: {
          checks: checks.length,
          failures: totalFail,
          durationSec,
          generatedAt: new Date().toISOString(),
        },
        dimensions,
        checks,
      },
      null,
      2,
    ),
  );
  process.exit(totalFail > 0 ? 1 : 0);
}

const lines = [];
lines.push(
  `# Weekly platform health — ${new Date().toISOString().slice(0, 10)}`,
);
lines.push("");
lines.push(
  totalFail === 0
    ? `✅ All ${checks.length} checks healthy. Duration: ${durationSec}s.`
    : `⚠️ ${totalFail} of ${checks.length} checks failed. See below.`,
);
lines.push("");

for (const dim of dimensions) {
  lines.push(`## ${dim ?? "general"}`);
  lines.push("");
  lines.push("| Check | Value | Target | Status |");
  lines.push("|---|---|---|---|");
  const dimChecks = checks.filter((c) => c.dimension === dim);
  for (const ck of dimChecks) {
    const icon = ck.status === "ok" ? "✅" : ck.status === "fail" ? "❌" : "ℹ️";
    const targetStr = ck.target == null ? "—" : String(ck.target);
    lines.push(`| ${ck.name} | ${ck.value} | ${targetStr} | ${icon} |`);
  }
  lines.push("");
}

lines.push("## Follow-ups");
lines.push("");
if (totalFail === 0) {
  lines.push("Nothing. The anti-drift machine is happy.");
} else {
  lines.push("For each ❌ above, either:");
  lines.push("- Fix the regression (preferred)");
  lines.push("- Adjust the target with a documented rationale in this script");
  lines.push("- Flag for the next sprint in `docs/WHATS-NOT-ELITE.md`");
}
lines.push("");
lines.push(`_Generated by scripts/weekly-health.mjs in ${durationSec}s._`);

console.log(lines.join("\n"));
process.exit(totalFail > 0 ? 1 : 0);
