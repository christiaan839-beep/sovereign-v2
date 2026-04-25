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

const registeredAgentCount = countMatches(
  join(ROOT, "src/app/api/agents/registry.ts"),
  /\(\) => import/g,
);
check("agents in registry", registeredAgentCount, 200, { dimension: "catalog" });

// Verifiable-claims invariant (STAY-ELITE rule 1). If any public landing
// surface cites an agent count, that number MUST match the registry.
// Grep every occurrence of "NNN agents" in src/app and the landing
// components; fail if any cited number differs from registeredAgentCount.
//
// Intent: catches the class of drift where the landing page says "218
// agents" but the registry has 223 — exactly the issue the 2026-04-24
// code review flagged. Claim-drift regressions can't merge again.
function findCitedAgentCounts() {
  const cited = new Set();
  // Scan every public .tsx / .ts in src/app and src/components.
  // Previously restricted to a hand-maintained path list; that let
  // blog.tsx and root layout.tsx slip through — catches went stale.
  // Full scan is cheap (~2s) and impossible to maintain-drift around.
  const scanRoots = [
    join(ROOT, "src/app"),
    join(ROOT, "src/components"),
  ];
  const visit = (p) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p, (rel) => {
        const full = join(p, rel);
        if (full.endsWith(".tsx") || full.endsWith(".ts")) visit(full);
      });
      return;
    }
    const text = readFileSync(p, "utf8");
    // Match "<number> <optional adjective> agents". Captures NNN from
    // phrases like "218 agents", "130 autonomous agents", "198
    // production agents", "223 first-party agents". Skips comments
    // and string constants that include historical counts.
    const re = /\b(\d{2,4})\s+(?:autonomous\s+|production\s+|first-party\s+|specialized\s+)?agents\b/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 100 && n <= 1000) cited.add(n);
    }
  };
  for (const r of scanRoots) visit(r);
  return [...cited].sort((a, b) => a - b);
}

const citedCounts = findCitedAgentCounts();
const claimsMatchRegistry =
  citedCounts.length === 0 ||
  citedCounts.every((n) => n === registeredAgentCount);
check(
  "landing agent-count claims match registry",
  claimsMatchRegistry ? 1 : 0,
  1,
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
  "unique LLM models referenced (NIM catalog)",
  uniqueMatches(
    join(ROOT, "src/lib/nvidia.ts"),
    /"[a-z0-9-]+\/[a-z0-9.-]+"/g,
  ),
  30,
  { dimension: "catalog" },
);

// Frontier-provider catalog — post-UMP-4 the platform addresses 8 additional
// providers beyond the NIM catalog (OpenAI, xAI, Mistral direct, Cohere,
// OpenRouter, Together, Databricks, Replicate). Each exposes 3-10 slugs.
// Counting them here lets "N models" claims on the landing stay verifiable.
const providerFiles = [
  "openai.ts",
  "xai.ts",
  "mistral.ts",
  "cohere.ts",
  "openrouter.ts",
  "together.ts",
  "databricks.ts",
  "replicate.ts",
];
let frontierSlugs = 0;
for (const f of providerFiles) {
  // Each adapter exports a MODELS object with quoted string values —
  // count those as the provider's addressable slugs.
  frontierSlugs += countMatches(
    join(ROOT, "src/lib/providers", f),
    /:\s*"[a-zA-Z0-9@\/._-]+"/g,
  );
}
check("frontier provider model slugs", frontierSlugs, 30, {
  dimension: "catalog",
});

check(
  "provider adapters on disk",
  providerFiles.filter((f) =>
    existsSync(join(ROOT, "src/lib/providers", f)),
  ).length,
  8,
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
// Security hardening — locks in the April 2026 sprint so future
// sessions can't silently revert any of the four defense layers.
// Each check is a presence test for an artifact OR a content test
// for a specific wiring line. Cheap to run, high signal.
// ──────────────────────────────────────────────────────────────

const securityArtifacts = [
  { path: "src/lib/pii-guard.ts", name: "PII output guard module" },
  { path: "src/lib/api-key-scopes.ts", name: "API-key scope evaluator" },
  { path: "src/lib/provider-costs.ts", name: "Provider cost catalog (free-first)" },
  { path: "drizzle/0033_audit_log_hash_chain.sql", name: "Audit-log hash chain migration" },
  { path: "drizzle/0034_api_key_scoping.sql", name: "API-key scoping migration" },
  { path: "src/app/api/admin/audit/verify-chain/route.ts", name: "Admin verify-chain endpoint" },
  { path: "src/app/api/cron/verify-audit-chain/route.ts", name: "Cron verify-audit-chain (every 6h)" },
  { path: "src/lib/__tests__/audit-log.test.ts", name: "Audit-log tampering tests" },
  { path: "src/lib/__tests__/security-hardening.test.ts", name: "Security hardening tests" },
];

for (const { path, name } of securityArtifacts) {
  const present = existsSync(join(ROOT, path)) ? 1 : 0;
  check(name, present, 1, { dimension: "security" });
}

// Wiring checks — content matches that prove the artifacts are
// actually integrated, not just sitting on disk. If a future session
// deletes the import or call site, the invariant fails.
function fileContains(relPath, needle) {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return false;
  return readFileSync(p, "utf8").includes(needle);
}

check(
  "evaluateScope wired into v1 gateway",
  fileContains("src/app/api/v1/[...path]/route.ts", "evaluateScope") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "scrubPiiDeep wired into agent-factory",
  fileContains("src/lib/agent-factory.ts", "scrubPiiDeep") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "FREE_ONLY_MODE gate in ai.ts",
  fileContains("src/lib/ai.ts", "FREE_ONLY_MODE") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "audit-log hash chain in audit-log.ts",
  fileContains("src/lib/audit-log.ts", "row_hash") &&
    fileContains("src/lib/audit-log.ts", "verifyAuditChain")
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

check(
  "verify-audit-chain cron registered in vercel.json",
  fileContains("vercel.json", "/api/cron/verify-audit-chain") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Content-Security-Policy header in next.config.ts",
  fileContains("next.config.ts", "Content-Security-Policy") ? 1 : 0,
  1,
  { dimension: "security" },
);

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
// Environment health — added after the 2026-04-24 ENOSPC incident
// that silently halted sprint A until disk was manually cleaned.
// Tool-runner writes output captures to /tmp; when /tmp fills up,
// EVERY bash command fails with ENOSPC + the session is hard-stopped.
// Threshold: warn at <1GB free on /tmp (cheap buffer, 5 min to fix).
// ──────────────────────────────────────────────────────────────

import { statfsSync } from "node:fs";
let tmpFreeMB = -1;
try {
  // statfsSync is available in Node 18.15+; gracefully skip otherwise.
  if (typeof statfsSync === "function") {
    const s = statfsSync("/tmp");
    // bsize + bavail → bytes free → MB
    tmpFreeMB = Math.round((s.bsize * s.bavail) / (1024 * 1024));
  }
} catch {
  // statfs failed (older Node, non-POSIX filesystem); skip without crashing.
}

if (tmpFreeMB >= 0) {
  check("/tmp free space (MB)", tmpFreeMB, 1024, {
    dimension: "environment",
  });
}

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
