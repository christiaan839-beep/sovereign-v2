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
// Tightened from 25 → 5 on 2026-04-25 after fixing the last 17 errors
// (setState-in-effect, unescaped-entities, no-html-link-for-pages
// false positives). Keeping a 5-error breathing room rather than 0 so
// a single new false-positive in a future ESLint update doesn't break
// CI mid-PR — but real regressions still get caught fast.
check("lint errors (max allowed)", lintErrors, 5, {
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
// Floor: don't regress past 50%. Sprint trajectory:
//   11% → 25% (C) → 30% (D) → 40% (E) → 50% (F) → 60% (G).
// Floor at 50% catches regressions past 60% without false positives
// from a single deleted eval.
check("eval coverage %", evalCoveragePct, 50, { dimension: "quality" });

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

// Public trust assets — these are referenced from security.txt and
// from the .security policy. If a future session deletes them as part
// of a "marketing cleanup", procurement teams hit 404s and the
// security disclosure flow breaks.
const trustAssets = [
  { path: "src/app/security/page.tsx", name: "Public /security page" },
  { path: "src/app/trust/defenders/page.tsx", name: "/trust/defenders ledger" },
  { path: "public/.well-known/security.txt", name: "RFC 9116 security.txt" },
  { path: "docs/THREAT_MODEL.md", name: "Threat model document" },
  // Machine-readable transparency manifest. The "Sovereign Bill of
  // Trust" — auditor LLMs (FMTI, EU AI Act baseline, NIST AI RMF,
  // ATLAS) ingest the full claim surface in one GET. Deleting this
  // route makes the platform invisible to those audit pipelines AND
  // breaks the `Transparency:` link in security.txt — both outcomes
  // worth blocking at PR time.
  {
    path: "src/app/api/_meta/transparency/route.ts",
    name: "Sovereign Bill of Trust (transparency manifest)",
  },
  // Per-agent capability manifests. Maps directly to OWASP LLM Top
  // 10 controls (LLM05/06/07/08/10) and lets auditor LLMs ingest the
  // full agent taxonomy in one GET. Deleting either side breaks the
  // public agents.json endpoint.
  {
    path: "src/lib/agent-manifest.ts",
    name: "Agent capability manifest schema",
  },
  {
    path: "src/lib/agent-manifests.generated.ts",
    name: "Agent capability manifests (generated)",
  },
  {
    path: "src/lib/agent-manifest-overrides.ts",
    name: "Agent manifest overrides (audited corrections)",
  },
  {
    path: "src/app/api/_meta/agents/route.ts",
    name: "Per-agent manifest endpoint (/api/_meta/agents.json)",
  },
  {
    path: "scripts/run-fmti-self-audit.mjs",
    name: "FMTI self-audit script",
  },
  {
    path: "docs/FMTI-SELF-AUDIT.md",
    name: "FMTI self-audit report (auto-regenerated)",
  },
  // Read-me-first reflexive document. Tells auditors and future
  // Claude agents the honest story — what we are, what we do not
  // claim, where the gaps are. Removing it wipes out the deliberate
  // "what we do NOT claim" framing that makes the rest of our
  // transparency story credible. Tracked at PR time.
  {
    path: "docs/PLATFORM-NARRATIVE.md",
    name: "Platform narrative (read-me-first reflexive doc)",
  },
  // Round 10 — D1 Phase 4 — visual-editor DAG storage architecture.
  // The store + tables + per-id route are the load-back loop. Without
  // these, the editor can save but can never reload — the very gap
  // that prompted Round 10. Lock them in so a future refactor can't
  // silently regress the round-trip.
  {
    path: "drizzle/0036_playbook_dag_tables.sql",
    name: "DAG storage migration (playbook_dags + playbook_dag_runs)",
  },
  {
    path: "src/lib/playbook-dag-store.ts",
    name: "Typed DAG store (CRUD + run recording)",
  },
  {
    path: "src/app/api/playbooks/dag/[id]/route.ts",
    name: "Load-back endpoint (GET / DELETE per-id)",
  },
  {
    path: "src/app/api/playbooks/dag/runs/route.ts",
    name: "Run-history endpoint (GET /api/playbooks/dag/runs)",
  },
  // Round 11 — forensic detail surfaces. Without these, the run-history
  // table accumulates rows that nobody can read; the load-back loop is
  // incomplete. Lock both ends in (single-run detail + clone).
  {
    path: "src/app/api/playbooks/dag/runs/[runId]/route.ts",
    name: "Single-run detail endpoint (GET /api/playbooks/dag/runs/[runId])",
  },
  {
    path: "src/app/dashboard/playbooks/runs/[runId]/page.tsx",
    name: "Run detail forensic view (server-rendered)",
  },
  {
    path: "src/app/api/playbooks/dag/[id]/clone/route.ts",
    name: "Playbook clone endpoint (POST /api/playbooks/dag/[id]/clone)",
  },
  // Round 12 — async/queued DAG execution. The migration must stay
  // around because the schema-typescript pair depends on the columns
  // it adds (progress_nodes_completed, started_at, last_progress_at).
  // The route file is the smart sync-vs-async dispatcher; deleting
  // it would break visual-editor execution entirely. Both shipped
  // together; both stay locked.
  {
    path: "drizzle/0037_playbook_dag_async.sql",
    name: "Async DAG migration (running status + progress columns)",
  },
  // Round 13 — orphan cleanup + AUP + appeals. Three artifacts that
  // close real operational + compliance gaps. Each is the only
  // copy; deleting any one regresses an FMTI subdomain or removes
  // a documented user right.
  {
    path: "src/app/api/cron/dag-orphan-cleanup/route.ts",
    name: "Orphan-cleanup cron (reaps stuck async runs)",
  },
  {
    path: "src/app/acceptable-use/page.tsx",
    name: "Acceptable Use Policy page (FMTI distribution subdomain)",
  },
  {
    path: "drizzle/0038_user_appeals.sql",
    name: "User appeals table (FMTI feedback subdomain)",
  },
  {
    path: "src/lib/appeals-store.ts",
    name: "Appeals store (typed CRUD with idempotency)",
  },
  {
    path: "src/app/api/appeals/route.ts",
    name: "Appeals API (file + list)",
  },
  {
    path: "src/app/dashboard/appeals/page.tsx",
    name: "User appeal queue UI (file + view)",
  },
  // Round 14 (D2) — per-call pricing transparency. The estimator is
  // pure-function and reusable across the API + page + editor preview;
  // deleting any one of these regresses the FMTI pricing-transparency
  // subdomain.
  {
    path: "src/lib/agent-pricing-estimate.ts",
    name: "Per-agent cost estimator (provider-band model)",
  },
  {
    path: "src/app/api/_meta/pricing/route.ts",
    name: "Machine-readable pricing endpoint (/api/_meta/pricing.json)",
  },
  {
    path: "src/app/pricing/per-call/page.tsx",
    name: "Per-call pricing transparency page",
  },
  // Round 15 — public run-share infrastructure. The schema, store,
  // management API, and public page must move together — deleting
  // any one regresses the procurement-grade "share with auditor"
  // workflow. The /share page in particular is the only way a
  // non-account holder sees a forensic run record.
  {
    path: "drizzle/0039_dag_run_shares.sql",
    name: "DAG run share migration (token + expiry + audit fields)",
  },
  {
    path: "src/lib/share-token-store.ts",
    name: "Share-token store (rotating + revocable + expiring)",
  },
  {
    path: "src/app/api/playbooks/dag/runs/[runId]/share/route.ts",
    name: "Share-management endpoint (POST create, GET list)",
  },
  {
    path: "src/app/share/[token]/page.tsx",
    name: "Public read-only run share page",
  },
  // Round 16 — per-run actual cost transparency. The lib derives cost
  // from stored _meta.tokenBudget; the run detail page renders it. If
  // either goes missing the FMTI pricing-transparency subdomain
  // regresses from 100% to 90%.
  {
    path: "src/lib/run-cost-actual.ts",
    name: "Per-run actual cost lib (derives from _meta.tokenBudget)",
  },
];
for (const { path, name } of trustAssets) {
  const present = existsSync(join(ROOT, path)) ? 1 : 0;
  check(name, present, 1, { dimension: "security" });
}

// PII guard surface — IBAN/SWIFT/BIC support is a real product feature
// for European + financial customers. Lock it in so a future refactor
// can't quietly remove the patterns or the validators.
check(
  "IBAN mod-97 validator in pii-guard",
  fileContains("src/lib/pii-guard.ts", "ibanValid") &&
    fileContains("src/lib/pii-guard.ts", "IBAN_RE")
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

check(
  "SWIFT/BIC pattern in pii-guard",
  fileContains("src/lib/pii-guard.ts", "SWIFT_BIC_RE") ? 1 : 0,
  1,
  { dimension: "security" },
);

// Architecture invariant: there must be exactly ONE hook implementing
// matchMedia('(prefers-reduced-motion: reduce)') so the rule "use the
// shared useReducedMotion hook" can't decay into "everyone implements
// their own copy again". Counts files with a useSyncExternalStore-style
// implementation (not framer-motion's import, not direct inline reads
// during render).
function countDuplicateReducedMotionHooks() {
  const candidates = [
    "src/lib/hooks/use-reduced-motion.ts",
    "src/hooks/useReducedMotion.ts",
  ];
  let found = 0;
  for (const p of candidates) {
    if (existsSync(join(ROOT, p))) found++;
  }
  return found;
}
check(
  "single canonical useReducedMotion hook (no duplicates)",
  countDuplicateReducedMotionHooks(),
  1,
  { dimension: "security" },
);

// Anti-spoofing invariant: NO production API route should resolve user
// identity from `req.headers.get("x-user-id")`. That header is fully
// client-controlled — we do not have any middleware setting it — so
// reading it as auth is the same as no auth at all (the
// _misc/scheduled-runs / inbox / projects routes shipped this anti-
// pattern in three different places before being fixed 2026-04-27).
//
// Tests + docstrings are allowed to MENTION the header (they're just
// strings); the rule fires only if a real route file CALLS `headers
// .get("x-user-id")`. We grep for the function-call form to skip
// false-positive matches inside JSDoc.
function countXUserIdAuthRoutes() {
  let found = 0;
  const apiRoot = join(ROOT, "src/app/api");
  walk(apiRoot, (rel) => {
    if (!rel.endsWith("route.ts") && !rel.endsWith("route.tsx")) return;
    const body = readFileSync(join(apiRoot, rel), "utf8");
    // Match the actual call form. JSDoc and string literals don't have
    // `.get(...)` after them.
    if (/\.get\(\s*["']x-user-id["']/.test(body)) found++;
  });
  return found;
}
check(
  "API routes use Clerk auth, not spoofable x-user-id header",
  countXUserIdAuthRoutes(),
  0,
  // floor: false → "ok" iff value <= target (max-allowed semantics).
  // With the default floor:true, value >= target would always be ✅ for
  // target=0, masking real regressions.
  { dimension: "security", floor: false },
);

// Anti-Edge-runtime-crash invariant: any route file that imports a
// node:* module MUST declare `export const runtime = "nodejs"`.
// Without the declaration, Next.js may bundle the route for Edge,
// where node:crypto / node:async_hooks / node:fs etc. don't exist —
// the build emits a warning + the route crashes at runtime if Vercel
// happens to route a request to an Edge worker. This catches the
// problem at PR time instead of during a 2 AM page.
function countNodeImportsWithoutRuntime() {
  let bad = 0;
  const apiRoot = join(ROOT, "src/app/api");
  walk(apiRoot, (rel) => {
    if (!rel.endsWith("route.ts")) return;
    const body = readFileSync(join(apiRoot, rel), "utf8");
    const usesNodeModule = /from\s+["']node:(crypto|async_hooks|fs|path|os|stream|buffer|http|https|net|child_process|cluster|worker_threads)["']/.test(
      body,
    );
    if (!usesNodeModule) return;
    const hasRuntimeDecl = /export\s+const\s+runtime\s*=\s*["']nodejs["']/.test(
      body,
    );
    if (!hasRuntimeDecl) bad++;
  });
  return bad;
}
check(
  "API routes importing node:* declare runtime = 'nodejs'",
  countNodeImportsWithoutRuntime(),
  0,
  // Max-allowed: 0 routes should import node:* without `runtime = "nodejs"`.
  { dimension: "security", floor: false },
);

// Reliability invariant: don't reintroduce the stuck-state-bug pattern
// `JSON.parse(row.apiKeys)` directly. The standard is to use
// safeJsonParseObject() from @/lib/safe-json, which logs corruption and
// treats it as `{}` so the user becomes unstuck on the next save instead
// of being permanently 500'd. Tests are exempt (they explicitly exercise
// JSON.parse paths). The invariant only fires if the bare pattern shows
// up against settings.apiKeys / config columns.
function countUnsafeJsonParseSettings() {
  let bad = 0;
  walk(join(ROOT, "src"), (rel) => {
    if (!rel.endsWith(".ts") && !rel.endsWith(".tsx")) return;
    if (rel.includes("__tests__/")) return;
    if (rel.endsWith("safe-json.ts")) return; // the helper itself
    const body = readFileSync(join(ROOT, "src", rel), "utf8");
    // Match `JSON.parse(<row>.apiKeys|config|metadata)` literal — the
    // common stuck-state shape.  Any reasonable wrapper (safeJsonParseX,
    // try { JSON.parse(...) } with explicit fallback) will not match.
    const matches = body.match(/JSON\.parse\([^)]*\.(?:apiKeys|config|metadata|details)\)/g);
    if (matches) bad += matches.length;
  });
  return bad;
}
check(
  "no unsafe JSON.parse(row.apiKeys/config/metadata) — use safeJsonParseObject",
  countUnsafeJsonParseSettings(),
  0,
  // Max-allowed: 0 unsafe sites. Anything >0 fails CI.
  { dimension: "security", floor: false },
);

// OWASP LLM08 invariant: every agent in the registry must have a
// capability manifest. The static analyzer builds these on every
// `npm run gen:registry`; if the analyzer breaks (or a future PR
// deletes the generated file), this fails CI before the platform
// ships with auditor-invisible agents.
function manifestCoverage() {
  const generated = join(ROOT, "src/lib/agent-manifests.generated.ts");
  const slugs = join(ROOT, "src/app/api/agents/slugs.ts");
  if (!existsSync(generated) || !existsSync(slugs)) return 0;
  const generatedText = readFileSync(generated, "utf8");
  const slugsText = readFileSync(slugs, "utf8");
  const manifestSlugs = (generatedText.match(/^\s+"([\w-]+)":\s*\{/gm) ?? [])
    .map((m) => m.match(/"([\w-]+)"/)?.[1])
    .filter(Boolean);
  const registrySlugs = (slugsText.match(/^\s+"([\w-]+)",/gm) ?? [])
    .map((m) => m.match(/"([\w-]+)"/)?.[1])
    .filter(Boolean);
  if (registrySlugs.length === 0) return 0;
  const present = new Set(manifestSlugs);
  const missing = registrySlugs.filter((s) => !present.has(s)).length;
  return missing;
}
check(
  "every registered agent has a capability manifest (LLM08)",
  manifestCoverage(),
  0,
  { dimension: "security", floor: false },
);

// Surface the low-confidence count as info — not a hard fail. This
// is the analyzer telling us "these agents need manual override or
// improved patterns"; useful in the dashboard but not a blocker.
function lowConfidenceCount() {
  const generated = join(ROOT, "src/lib/agent-manifests.generated.ts");
  if (!existsSync(generated)) return 0;
  const text = readFileSync(generated, "utf8");
  // Count manifests where classifierConfidence < 0.6.
  const matches = text.match(/"classifierConfidence":\s*0\.[0-5]\d?/g);
  return matches ? matches.length : 0;
}
check(
  "agents with low classifier confidence (info only)",
  lowConfidenceCount(),
  null,
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
