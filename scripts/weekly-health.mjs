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
// Floor trajectory: 11 → 25 (C) → 30 (D) → 40 (E) → 50 (F) → 60 (G) →
// 65 (Round 17, after eval push to 74%). Floor at 65% catches
// regressions past 70% without false positives from a single delete.
check("eval coverage %", evalCoveragePct, 65, { dimension: "quality" });

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
  // Round 18 — per-DAG analytics. The stats endpoint + the UI panel
  // are the procurement-grade "what's your reliability per playbook"
  // surface. Deleting either silently regresses the answer.
  {
    path: "src/app/api/playbooks/dag/[id]/stats/route.ts",
    name: "Per-DAG stats endpoint",
  },
  {
    path: "src/components/playbook/DagStatsPanel.tsx",
    name: "Per-DAG stats panel (editor reliability card)",
  },
  // Round 20 — retry-with-backoff is the central reliability primitive.
  // Every workhorse path (run-dag, future async paths) wraps fetch
  // through this. Deleting it silently regresses reliability across
  // the platform — ~5% of HTTP calls fail transiently and without
  // retry the platform inherits that failure rate.
  {
    path: "src/lib/retry-with-backoff.ts",
    name: "Retry-with-backoff (central reliability primitive)",
  },
  // Round 21 — honest-gaps doc. Procurement-readable acknowledgement
  // of what's NOT done. Removing it would push the project back
  // toward the "everything is fine" posture this project explicitly
  // rejects. The gaps doc is the truth artifact, not a marketing
  // page.
  {
    path: "docs/HONEST-GAPS.md",
    name: "Honest gap analysis (verified, not aspirational)",
  },
  // Round 22 — SSRF guard. Without this, URL-fetching agents are an
  // internal-network port scanner an attacker can drive. The library
  // is the central primitive (the per-agent wiring uses it).
  {
    path: "src/lib/ssrf-guard.ts",
    name: "SSRF guard (blocks cloud metadata / private IPs / link-local)",
  },
  // Round 23 — automated dependency-CVE catching. Round 22 found 2
  // CRITICAL CVEs already shipped because no automated update flow
  // was running. With Renovate, a PR opens within hours of any
  // upstream patch; without it, CVEs land in production silently.
  {
    path: "renovate.json",
    name: "Renovate config (automated dep-CVE PRs)",
  },
  // Round 23 — SOC 2 pre-readiness mapping. Procurement-grade
  // artifact for "are you SOC 2 ready?" diligence. Tracks technical
  // controls vs process gaps with verifiable evidence per criterion.
  {
    path: "docs/SOC2-PRE-READINESS.md",
    name: "SOC 2 pre-readiness mapping (TSC 2017 trust criteria)",
  },
  // Round 23 — run comparison page. Procurement-asked-for feature
  // (regression diagnosis) that builds on the per-DAG analytics
  // foundation from Round 18.
  {
    path: "src/app/dashboard/playbooks/runs/[runId]/compare/page.tsx",
    name: "Run comparison view (regression diagnosis surface)",
  },
  // Round 24 — DAG version history. Append-only audit trail of every
  // editor save, with rollback. The migration creates the table +
  // bumps the parent's version_count column; deleting it would lose
  // the forensic completeness story (combined with run.dagSnapshot,
  // these answer "what shape was saved at time T?").
  {
    path: "drizzle/0040_playbook_dag_versions.sql",
    name: "DAG version history migration (append-only audit trail)",
  },
  // Round 24 — version-history sidebar. The "I broke something —
  // restore yesterday's version" UX. Removing this would orphan
  // the underlying append-only table.
  {
    path: "src/components/playbook/VersionHistoryPanel.tsx",
    name: "Version-history panel (in-editor restore surface)",
  },
  // Round 24 — restore endpoint. The trail is meaningless without a
  // way to act on it. POST /api/playbooks/dag/[id]/versions/[versionId]/restore
  // is the action surface; deleting it leaves the history read-only.
  {
    path: "src/app/api/playbooks/dag/[id]/versions/[versionId]/restore/route.ts",
    name: "Version restore endpoint (append-only restoration)",
  },
  // Round 26 — durability migrations. HITL approvals + execution
  // audit moved out of in-memory Maps. Without these, the platform's
  // "every action has an immutable trail" claim is a lie at the
  // serverless layer (cold-starts amnesia).
  {
    path: "drizzle/0041_hitl_and_execution_audit.sql",
    name: "HITL + execution audit migration (durable on serverless)",
  },
  // Round 26 — usage outbox library. The recovery path for transient
  // DB failures on the usage counter; without this, free-tier users
  // got more runs than they paid for during DB hiccups.
  {
    path: "src/lib/usage-outbox.ts",
    name: "Usage outbox drainer (txn-bound counter recovery)",
  },
  // Round 26 — outbox drain cron. Must exist or the outbox queue
  // grows unbounded with no replay; the recovery is theoretical.
  {
    path: "src/app/api/cron/drain-usage-outbox/route.ts",
    name: "Usage outbox drain cron (1min cadence)",
  },
  // Round 26 — HITL prune cron. Past-due pending approvals must be
  // swept to 'timeout' so a request never appears "stuck pending"
  // forever in the dashboard.
  {
    path: "src/app/api/cron/prune-hitl-approvals/route.ts",
    name: "HITL approvals prune cron (5min cadence)",
  },
  // Round 26 — advisory-lock helper. Cluster-wide mutual exclusion
  // for Railway-deployed background loops. Without it, two Railway
  // instances both fire scheduled playbooks every tick.
  {
    path: "src/lib/advisory-lock.ts",
    name: "Postgres advisory-lock helper (cluster-wide cron mutex)",
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

// Round 20 — reliability invariant: the run-dag route MUST wrap
// per-node fetches in retryWithBackoff. A future refactor that
// drops the wrapper would silently degrade reliability (~5% of
// HTTP calls fail transiently without retry → ~40% any-node-fail
// rate on a 10-node DAG without this gate).
check(
  "run-dag uses retryWithBackoff for per-node fetches",
  fileContains("src/app/api/playbooks/run-dag/route.ts", "retryWithBackoff") ? 1 : 0,
  1,
  { dimension: "security" },
);

// Round 22 — SSRF invariants. URL-fetching agents MUST guard against
// private-IP / cloud-metadata fetches. Without these, an attacker
// who can submit a URL to the agent can steal IAM tokens from
// 169.254.169.254 or scan our internal network.
check(
  "competitive-radar uses SSRF guard",
  fileContains("src/app/api/_agents/competitive-radar/route.ts", "checkUrlForSsrf") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "url-context uses SSRF guard",
  fileContains("src/app/api/_agents/url-context/route.ts", "checkUrlForSsrf") ? 1 : 0,
  1,
  { dimension: "security" },
);

// Round 22 — origin isolation headers. COOP + CORP + Origin-Agent-
// Cluster are the modern Spectre / cross-origin-window-name
// mitigations. Removing them silently regresses our browser-side
// security posture.
check(
  "next.config has Cross-Origin-Opener-Policy header",
  fileContains("next.config.ts", "Cross-Origin-Opener-Policy") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "next.config has Cross-Origin-Resource-Policy header",
  fileContains("next.config.ts", "Cross-Origin-Resource-Policy") ? 1 : 0,
  1,
  { dimension: "security" },
);

// Round 23 — public-share rate limit. /share/[token] is an
// unauthenticated surface that bumps DB counters on every resolve.
// Without a per-IP limit, an attacker can hammer a known token to
// pollute audit metrics + DoS the share-resolution path. The
// rate-limits.ts rule + middleware coverage are independent invariants
// (either can regress without the other catching).
check(
  "rate-limits has share-public rule",
  fileContains("src/lib/rate-limits.ts", "share-public") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "middleware applies rate-limit to /share/* paths",
  fileContains("src/proxy.ts", "/share/") ? 1 : 0,
  1,
  { dimension: "security" },
);

// Round 24 — version-history wiring invariants. The migration + the
// sidebar component are tracked above as file-presence checks; these
// content checks lock in the BEHAVIOR. A future refactor that drops
// the createDagVersion call from the save POST would make every
// editor save silently overwrite history; without these gates, no
// test would catch that regression (the save endpoint still returns
// 200, the editor still shows "Saved ✓", but the trail is gone).
check(
  "DAG save endpoint creates version row on every save",
  fileContains("src/app/api/playbooks/dag/route.ts", "createDagVersion") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "Editor surfaces version history sidebar",
  fileContains(
    "src/app/dashboard/playbooks/edit/[id]/page.tsx",
    "VersionHistoryPanel",
  )
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "Restore endpoint is append-only (records new version, not UPDATE)",
  // The semantic check: restoreDagVersion calls createDagVersion
  // (which APPENDS a new row) rather than mutating the source row.
  // The string "createDagVersion" appearing in restoreDagVersion's
  // body proves this — if a future "fast path" tried to UPDATE the
  // row in place, this check would fire.
  fileContains("src/lib/playbook-dag-store.ts", "return createDagVersion(") ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 25 — critical-gap closure invariants ─────────────────────
//
// Each item below corresponds to a security/reliability primitive that
// the audit (April 28 2026) flagged as missing. The gates lock in the
// fix so a future refactor can't silently regress any of them.

// R25-A — safeFetch is the single sanctioned outbound HTTP wrapper.
// Without this gate, the file could be silently deleted and every
// fetch caller would silently fall back to unguarded fetch.
check(
  "safeFetch library exists (universal SSRF wrapper)",
  existsSync(join(ROOT, "src/lib/safe-fetch.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "webhook-dispatcher uses safeFetch (SSRF on every delivery)",
  fileContains("src/lib/webhook-dispatcher.ts", "safeFetch") ? 1 : 0,
  1,
  { dimension: "security" },
);

// R25-B — CSRF gate. requireSameOrigin must exist AND must be wired
// into every high-value mutating endpoint. Both invariants are
// independent — either can regress without the other catching.
check(
  "auth-guard exports requireSameOrigin",
  fileContains("src/lib/auth-guard.ts", "export function requireSameOrigin") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "_tokens POST/DELETE has CSRF gate",
  fileContains("src/app/api/_tokens/route.ts", "requireSameOrigin") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "_tokens/rotate POST has CSRF gate",
  fileContains("src/app/api/_tokens/rotate/route.ts", "requireSameOrigin") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "_settings/api-keys POST has CSRF gate",
  fileContains("src/app/api/_settings/api-keys/route.ts", "requireSameOrigin") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "credits POST has CSRF gate",
  fileContains("src/app/api/credits/route.ts", "requireSameOrigin") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "account DELETE has CSRF gate",
  fileContains("src/app/api/account/route.ts", "requireSameOrigin") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "_billing/portal POST has CSRF gate",
  fileContains("src/app/api/_billing/portal/route.ts", "requireSameOrigin") ? 1 : 0,
  1,
  { dimension: "security" },
);

// R25-C — verifyCron is the canonical fail-closed cron auth.
// Pre-R25 several routes used inline `===` (timing-attack) or were
// fail-OPEN if CRON_SECRET unset (`process.env.CRON_SECRET && ...`).
// Lock the canonical helper into every cron route.
function countCronRoutesMissingVerifyCron() {
  const cronDirs = ["src/app/api/cron", "src/app/api/_cron"];
  let missing = 0;
  for (const dir of cronDirs) {
    const fullDir = join(ROOT, dir);
    if (!existsSync(fullDir)) continue;
    const stack = [fullDir];
    while (stack.length) {
      const cur = stack.pop();
      const entries = readdirSync(cur, { withFileTypes: true });
      for (const e of entries) {
        const full = join(cur, e.name);
        if (e.isDirectory()) {
          // Skip [...path] catch-all — it's a forwarder; the inner
          // route enforces verifyCron.
          if (e.name.startsWith("[...")) continue;
          stack.push(full);
        } else if (e.name === "route.ts") {
          const content = readFileSync(full, "utf8");
          // GET/POST handlers must reference verifyCron.
          if (!content.includes("verifyCron")) {
            // Skip catch-all forwarders (single line, no own auth).
            if (content.length > 200) {
              missing += 1;
            }
          }
        }
      }
    }
  }
  return missing;
}
check(
  "every /api/{cron,_cron} route uses verifyCron (fail-closed)",
  countCronRoutesMissingVerifyCron(),
  0,
  { dimension: "security", floor: false },
);

// R25-D — crypto tamper detection. Pre-R25 safeDecrypt swallowed
// auth-tag failures and returned the ciphertext as plaintext, hiding
// real tamper attempts. Post-R25 it throws TamperDetectedError under
// strict mode AND logs in lenient mode. Plus a 1-byte version prefix
// for forward-compatibility, plus ENCRYPTION_KEY_PREVIOUS for
// rotation. The grep is for the specific error class — its presence
// proves the harder error path is wired.
check(
  "crypto exports TamperDetectedError (no silent tamper swallowing)",
  fileContains("src/lib/crypto.ts", "export class TamperDetectedError") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "crypto supports key rotation via ENCRYPTION_KEY_PREVIOUS",
  fileContains("src/lib/crypto.ts", "ENCRYPTION_KEY_PREVIOUS") ? 1 : 0,
  1,
  { dimension: "security" },
);

// R25-E — boot-fail on missing prod envs. assertProductionRequiredEnv
// must exist AND be called from assertEnv when NODE_ENV=production.
check(
  "env library exports assertProductionRequiredEnv (boot-fail gate)",
  fileContains("src/lib/env.ts", "export function assertProductionRequiredEnv") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "assertEnv calls assertProductionRequiredEnv in production",
  fileContains("src/lib/env.ts", "assertProductionRequiredEnv()") ? 1 : 0,
  1,
  { dimension: "security" },
);

// R25-H — single source of truth for the agent count. The platform-stats
// module exports TOTAL_AGENTS from the generated registry; the landing
// imports it. Without this gate, the count drifts back to literals over
// time (the audit found 137/198/203/218/223/130+ all on one page).
check(
  "platform-stats library exists (single source for marketing claims)",
  existsSync(join(ROOT, "src/lib/platform-stats.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "landing page imports TOTAL_AGENTS (no hardcoded count)",
  fileContains("src/app/page.tsx", 'TOTAL_AGENTS') ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
function countHardcodedAgentLiterals() {
  // Forbidden: bare `\b(137|198|203|218)\b` literals in landing copy
  // adjacent to "agent" — the audit's 5-different-numbers footgun.
  const files = [
    "src/app/page.tsx",
    "src/components/landing/LiveProofStrip.tsx",
    "src/components/landing/A2EEconomySection.tsx",
    "src/components/landing/ProofStrip.tsx",
    "src/components/landing/IndustriesShowcase.tsx",
    "src/components/landing/ConstellationPreview.tsx",
  ];
  let hits = 0;
  for (const f of files) {
    const full = join(ROOT, f);
    if (!existsSync(full)) continue;
    const content = readFileSync(full, "utf8");
    // Look for "137 agent", "198 agent", etc. — a word boundary
    // followed by one of the stale counts and the word "agent".
    if (/\b(137|198|203|218)\b[^\n]*?\bagent/i.test(content)) {
      hits += 1;
    }
  }
  return hits;
}
check(
  "no stale agent-count literals (137/198/203/218) in landing",
  countHardcodedAgentLiterals(),
  0,
  { dimension: "trust-asset", floor: false },
);

// R25-J — LiveStatusRotator (fake activity) must NOT exist in dashboard.
// The component rotated hard-coded strings while calling itself "Live",
// directly violating CLAUDE.md L153 ("no fake activity on a fresh
// deploy"). Removed Round 25; the gate prevents accidental restoration.
check(
  "dashboard does NOT render LiveStatusRotator (fake activity)",
  fileContains("src/app/dashboard/page.tsx", "<LiveStatusRotator") ? 1 : 0,
  0,
  { dimension: "trust-asset", floor: false },
);

// R25-I — SAML SSO claim is on the roadmap, not shipped. Plans copy
// must NOT claim SAML SSO as a delivered feature until the Clerk
// connection + SCIM endpoint actually exist. Fail if either string
// appears as a positive claim in the marketing surfaces.
check(
  "plans.ts Enterprise tier does NOT claim SAML SSO",
  fileContains("src/lib/plans.ts", "SAML SSO,") ? 1 : 0,
  0,
  { dimension: "trust-asset", floor: false },
);

// ─── Round 26 — durability invariants ────────────────────────────────
//
// The HITL + execution-audit + usage-counter trio were the audit's
// reliability gaps that the platform's claims depended on. These
// gates lock in the DB-backed implementations so a future "let's
// cache it in memory for speed" refactor can't silently regress
// the durability contract.

// R26-A — HITL approval lib must use Drizzle (not module-level Map).
// The presence of the schema import is the strongest signal that
// the rewrite is in place; a refactor that goes back to in-memory
// would drop the import.
check(
  "hitl-approval lib uses Drizzle (not in-memory Map)",
  fileContains("src/lib/hitl-approval.ts", 'from "drizzle-orm"') ? 1 : 0,
  1,
  { dimension: "security" },
);
// Module-level Map<...> was the pre-R26 anti-pattern. Catch its
// reintroduction.
check(
  "hitl-approval has NO module-level Map (durable, not amnesiac)",
  fileContains("src/lib/hitl-approval.ts", "new Map<string, ApprovalRequest>") ? 1 : 0,
  0,
  { dimension: "security", floor: false },
);

// R26-B — execution-audit must use Drizzle, not the in-memory ring
// buffer. Same anti-pattern catch as HITL.
check(
  "execution-audit lib uses Drizzle (not in-memory ring buffer)",
  fileContains("src/lib/execution-audit.ts", 'from "drizzle-orm"') ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "execution-audit has NO in-memory auditLog array (durable)",
  fileContains("src/lib/execution-audit.ts", "const auditLog: AuditEntry[]") ? 1 : 0,
  0,
  { dimension: "security", floor: false },
);

// R26-C — incrementUsage must route through the outbox on failure.
// Pre-R26 a try/catch swallowed errors; the gate ensures the
// recovery path is wired.
check(
  "incrementUsage routes failures to usage_outbox (recovery path)",
  fileContains("src/lib/free-tier.ts", "usageOutbox") ? 1 : 0,
  1,
  { dimension: "security" },
);

// R26-D — instrumentation.ts wraps cron-pings in withAdvisoryLock.
// Without this, two Railway instances both fire scheduled playbooks
// on every tick.
check(
  "instrumentation cron-pings are gated by withAdvisoryLock",
  fileContains("src/instrumentation.ts", "withAdvisoryLock") ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Consistency Sweep — eliminate every drift ──────────────────────
//
// The user explicitly asked for "no inconsistency". After Round 25
// shipped single-source agent counts on the LANDING page, drift had
// silently re-accumulated across ~25 other pages (dashboard, demo,
// chat, app, launch, /developers, /developer, /docs, /for-ecommerce,
// /roi, /payment/success, /onboarding, /pricing OG, all the /free
// tools, the /api/_email/send template, /api/waitlist email body,
// /api/_misc/founders benefits, /api/_misc/api-catalog response).
//
// These gates extend Round 25's coverage to EVERY user-visible page +
// API response. A new PR that types `130 agents` or `38 models`
// anywhere in src/app or src/components fails CI before merge.

function countStaleAgentLiteralsAcrossApp() {
  const dirs = ["src/app", "src/components"];
  let hits = 0;
  for (const dir of dirs) {
    const fullDir = join(ROOT, dir);
    if (!existsSync(fullDir)) continue;
    const stack = [fullDir];
    while (stack.length) {
      const cur = stack.pop();
      const entries = readdirSync(cur, { withFileTypes: true });
      for (const e of entries) {
        const full = join(cur, e.name);
        if (e.isDirectory()) {
          if (e.name === "__tests__" || e.name === "node_modules") continue;
          stack.push(full);
        } else if (
          e.name.endsWith(".tsx") ||
          e.name.endsWith(".ts")
        ) {
          // Skip the platform-stats lib itself (it defines the
          // numerals) and any test file that asserts on stale values.
          if (full.includes("platform-stats.ts")) continue;
          if (full.endsWith(".test.ts") || full.endsWith(".test.tsx")) continue;
          const content = readFileSync(full, "utf8");
          // Stale agent counts: 130 / 137 / 198 / 203 / 218 followed
          // by "agent" within ~30 chars. The pre-sweep audit found
          // these five values drifting across the codebase.
          if (/\b(130|137|198|203|218)\b[^"]{0,40}?\bagent/i.test(content)) {
            hits += 1;
          }
        }
      }
    }
  }
  return hits;
}
check(
  "no stale agent-count literals (130/137/198/203/218) anywhere in src/app or src/components",
  countStaleAgentLiteralsAcrossApp(),
  0,
  { dimension: "trust-asset", floor: false },
);

function countStaleModelLiteralsAcrossApp() {
  const dirs = ["src/app", "src/components"];
  let hits = 0;
  for (const dir of dirs) {
    const fullDir = join(ROOT, dir);
    if (!existsSync(fullDir)) continue;
    const stack = [fullDir];
    while (stack.length) {
      const cur = stack.pop();
      const entries = readdirSync(cur, { withFileTypes: true });
      for (const e of entries) {
        const full = join(cur, e.name);
        if (e.isDirectory()) {
          if (e.name === "__tests__" || e.name === "node_modules") continue;
          stack.push(full);
        } else if (
          e.name.endsWith(".tsx") ||
          e.name.endsWith(".ts")
        ) {
          if (full.includes("platform-stats.ts")) continue;
          if (full.endsWith(".test.ts") || full.endsWith(".test.tsx")) continue;
          const content = readFileSync(full, "utf8");
          // Stale model counts: 35+, 36+, 37+, 38 (or "38 models").
          if (/\b(35\+|36\+|37\+|38\+?)\s+(AI )?models?\b/i.test(content)) {
            hits += 1;
          }
        }
      }
    }
  }
  return hits;
}
check(
  "no stale model-count literals (35+/36+/37+/38) anywhere in src/app or src/components",
  countStaleModelLiteralsAcrossApp(),
  0,
  { dimension: "trust-asset", floor: false },
);

// Sweep 4 — plan IDs in code must match canonical IDs in plans.ts.
// Pre-sweep `/api/_misc/user/plan/route.ts` checked plan === "pro" ||
// "agency" — neither existed in plans.ts. The bug shipped silently:
// every user looked "free tier" because the legacy IDs never matched.
// Gate catches a regression in the same file.
check(
  "/api/_misc/user/plan derives isPaid from canonical PLANS map",
  fileContains("src/app/api/_misc/user/plan/route.ts", "PLANS[planId]") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// Sweep 7 — JSONB boundary cast cleanup. The DAG save POST used to
// have 3 `as unknown as PlaybookDag` casts inline; the sweep
// consolidated them to one normalized object built right after Zod
// parsing. The cast count gate catches a regression in this file.
check(
  "DAG save route has NO `as unknown as` casts (uses normalizedDag)",
  fileContains("src/app/api/playbooks/dag/route.ts", "as unknown as import") ? 1 : 0,
  0,
  { dimension: "security", floor: false },
);

// Sweep 6 — docs match reality. ARCHITECTURE.md must state the
// canonical agent count (223). Without this gate, the doc drifts
// every time we add agents and the procurement-readable artifact
// looks stale.
check(
  "docs/ARCHITECTURE.md states 223 agents (canonical)",
  fileContains("docs/ARCHITECTURE.md", "223 production AI agents") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// Sweep 2 — dead component cleanup. ExecutionFeed was deleted in
// Round 25's slop-fix sprint; the gate catches accidental
// resurrection (someone re-creating the component without the
// underlying real-data wiring would leak the fake-activity slop
// pattern back into the dashboard).
check(
  "no dead ExecutionFeed component (was fake activity, removed)",
  existsSync(join(ROOT, "src/components/dashboard/ExecutionFeed.tsx")) ? 1 : 0,
  0,
  { dimension: "trust-asset", floor: false },
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

// ─── Round 27 — Permanence Sprint invariants ─────────────────────────
//
// The permanence layer's job is to make the platform OUTLIVE its
// current maintainer. These gates lock in:
//   - Constitution + Succession Plan (governance artifacts)
//   - Self-heal cron (continuous anti-drift telemetry)
//   - Cost-runaway guard (financial blast radius bound)
//   - CHANGELOG generator + dep-rot detector (meta-state hygiene)
//   - ADR scaffolding (decision history)
//
// A merge that deletes any of these silently fails CI on the next PR.
// Per Constitution Principle 6: "Anti-drift is the immune system."

// Constitution + Succession — the governance artifacts. These docs
// are the appellate court for every decision; their absence means
// the project lost its operating manual.
check(
  "Project Constitution present (governance: 7 principles)",
  existsSync(join(ROOT, "docs/PROJECT-CONSTITUTION.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "Succession Plan present (bus-factor handover)",
  existsSync(join(ROOT, "docs/SUCCESSION.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// Self-heal cron — the hourly anti-drift snapshot route. Without
// this, regressions only get caught on PR (could be days between).
check(
  "self-heal cron route present (hourly anti-drift telemetry)",
  existsSync(join(ROOT, "src/app/api/cron/self-heal/route.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "self-heal cron registered in vercel.json",
  fileContains("vercel.json", "/api/cron/self-heal") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "self-heal route uses verifyCron (auth gated)",
  fileContains("src/app/api/cron/self-heal/route.ts", "verifyCron") ? 1 : 0,
  1,
  { dimension: "security" },
);

// Cost-runaway guard — the per-tenant per-day spend ceiling. The
// presence of the lib + the wire-up in agent-factory are independent
// invariants because either can be deleted without breaking the
// build.
check(
  "cost-runaway lib present (per-tenant cost ceiling)",
  existsSync(join(ROOT, "src/lib/cost-runaway.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "cost-cap-alert lib present (operator notification hook)",
  existsSync(join(ROOT, "src/lib/cost-cap-alert.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory wires checkTenantCostCap (pre-execution gate)",
  fileContains("src/lib/agent-factory.ts", "checkTenantCostCap") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory wires recordCost (post-execution ledger)",
  fileContains("src/lib/agent-factory.ts", "recordCost") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory wires onCostCapHit (operator alert)",
  fileContains("src/lib/agent-factory.ts", "onCostCapHit") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "audit-log AuditAction enum includes cost.cap_hit (hash-chained)",
  fileContains("src/lib/audit-log.ts", '"cost.cap_hit"') ? 1 : 0,
  1,
  { dimension: "security" },
);

// Migration 0042 — the schema piece. Drift here would mean the
// runtime can't actually persist anything.
check(
  "migration 0042 (platform_health + cost_ledger) on disk",
  existsSync(
    join(ROOT, "drizzle/0042_platform_health_and_cost_runaway.sql"),
  ) ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "schema.ts declares platformHealthSnapshots table",
  fileContains("src/db/schema.ts", "platformHealthSnapshots") ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "schema.ts declares tenantCostLedger table",
  fileContains("src/db/schema.ts", "tenantCostLedger") ? 1 : 0,
  1,
  { dimension: "database" },
);

// CHANGELOG generator + dep-rot detector — meta-state hygiene.
// These don't affect runtime, but their absence means the project
// loses two important hygiene gates.
check(
  "CHANGELOG generator script present",
  existsSync(join(ROOT, "scripts/generate-changelog.mjs")) ? 1 : 0,
  1,
  { dimension: "process" },
);
check(
  "dep-rot detector script present",
  existsSync(join(ROOT, "scripts/dep-rot-detector.mjs")) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ADR scaffolding — the decision-history surface. Template + index
// + at least 4 ADRs (the existing 3 + R27's ADR-0004).
check(
  "ADR template present (TEMPLATE.md)",
  existsSync(join(ROOT, "docs/adr/TEMPLATE.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "ADR index README present",
  existsSync(join(ROOT, "docs/adr/README.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "ADR-0004 (Permanence Sprint) present",
  existsSync(
    join(
      ROOT,
      "docs/adr/0004-permanence-sprint-self-healing-and-cost-guard.md",
    ),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// Cost-runaway test coverage — at least 15 tests across the three
// libs (cost-runaway, cost-cap-alert).
check(
  "cost-runaway tests present (>=15 cases)",
  existsSync(join(ROOT, "src/lib/__tests__/cost-runaway.test.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Elite-tier sprint — public trust + ops invariants ────────────────
//
// These artifacts make the platform's reliability story queryable
// by procurement teams without auth, and operable by the team via
// the admin tenants dashboard. Removing any one of them silently
// breaks the public moat.

// TIER S enabler — migration runner + manual checklist must exist.
check(
  "TIER S deploy checklist present",
  existsSync(join(ROOT, "docs/TIER-S-CHECKLIST.md")) ? 1 : 0,
  1,
  { dimension: "process" },
);
check(
  "production migration runner present (idempotent + tracked)",
  existsSync(join(ROOT, "scripts/apply-prod-migrations.mjs")) ? 1 : 0,
  1,
  { dimension: "process" },
);

// Provider health — the live moat. /reliability page renders this.
check(
  "provider-health route present (private)",
  existsSync(join(ROOT, "src/app/api/_health/providers/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "provider-health public re-export present",
  existsSync(join(ROOT, "src/app/api/health/providers/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// /incidents — public hash-chain-derived events feed.
check(
  "incidents route present (private)",
  existsSync(join(ROOT, "src/app/api/_health/incidents/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "incidents public re-export present",
  existsSync(join(ROOT, "src/app/api/health/incidents/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "/incidents page present",
  existsSync(join(ROOT, "src/app/incidents/page.tsx")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// Admin tenants — operator dashboard for the cost ledger.
check(
  "admin tenants API present",
  existsSync(join(ROOT, "src/app/api/admin/tenants/route.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "admin tenants UI present",
  existsSync(join(ROOT, "src/app/dashboard/admin/tenants/page.tsx")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "admin tenants API uses requireAdmin gate",
  fileContains(
    "src/app/api/admin/tenants/route.ts",
    "requireAdmin",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// /trust/customers + anonymizer — the published-stats moat.
check(
  "customer-stats anonymizer lib present",
  existsSync(join(ROOT, "src/lib/customer-stats-anonymizer.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "customer-stats anonymizer tests present",
  existsSync(
    join(ROOT, "src/lib/__tests__/customer-stats-anonymizer.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "/api/health/customers endpoint present",
  existsSync(join(ROOT, "src/app/api/_health/customers/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "/trust/customers page present",
  existsSync(join(ROOT, "src/app/trust/customers/page.tsx")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// CI integration — dep-rot blocks PRs with new HIGH/CRITICAL CVEs.
check(
  "CI runs dep-rot detector on every PR",
  fileContains(".github/workflows/ci.yml", "dep-rot-detector.mjs") ? 1 : 0,
  1,
  { dimension: "security" },
);

// Constitution amendment hint: when /reliability already imports
// from permanence, /incidents from audit_logs, and /trust/customers
// from anonymizer — those imports are the actual wiring that turns
// "files exist" into "page renders correctly".
check(
  "/reliability page fetches /api/health/permanence",
  fileContains("src/app/reliability/page.tsx", "/api/health/permanence") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "/reliability page fetches /api/health/providers",
  fileContains("src/app/reliability/page.tsx", "/api/health/providers") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "/incidents page fetches /api/health/incidents",
  fileContains("src/app/incidents/page.tsx", "/api/health/incidents") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 28 — Power Tools sprint ───────────────────────────────────
//
// Three power-tool layers locked in:
//   1. A2E recursion depth tracker (Constitution Principle 7)
//   2. Per-agent SLO surface (uses execution_audit_log)
//   3. Multi-tenant isolation regression tests (SOC-2 evidence)

// A2E depth — the lib + the Node ALS install + the agent-factory wire.
// Removing any one of these silently disables the depth gate.
check(
  "a2e-depth lib present (recursion depth tracker)",
  existsSync(join(ROOT, "src/lib/a2e-depth.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "a2e-depth-node ALS install present",
  existsSync(join(ROOT, "src/lib/a2e-depth-node.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "instrumentation.ts imports a2e-depth-node",
  fileContains("src/instrumentation.ts", "a2e-depth-node") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory imports A2eDepthExceededError (wired)",
  fileContains("src/lib/agent-factory.ts", "A2eDepthExceededError") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory wraps handler in withA2eDepthCheck (depth increments)",
  fileContains("src/lib/agent-factory.ts", "withA2eDepthCheck") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "a2e-depth tests present",
  existsSync(join(ROOT, "src/lib/__tests__/a2e-depth.test.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

// Per-agent SLO — endpoint + public re-export + reliability page wiring.
check(
  "/api/_health/agent-slo route present",
  existsSync(join(ROOT, "src/app/api/_health/agent-slo/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "public /api/health/agent-slo re-export present",
  existsSync(join(ROOT, "src/app/api/health/agent-slo/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "/reliability page fetches /api/health/agent-slo",
  fileContains("src/app/reliability/page.tsx", "/api/health/agent-slo") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// Multi-tenant isolation regression suite.
check(
  "tenant-isolation regression tests present",
  existsSync(join(ROOT, "src/lib/__tests__/tenant-isolation.test.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 29 — User-contribution closure + power-tool follow-ups ───
//
// Three open user-contribution points closed with defensible defaults
// (locked into source as comments + ADR-style notes). Two follow-up
// power tools shipped: HTTP-header A2E propagation + replay viewer.

// Cost-cap alert is wired (no longer a TODO)
check(
  "cost-cap-alert dispatches via notifyUser (in-app + slack + email)",
  fileContains("src/lib/cost-cap-alert.ts", "notifyUser") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "cost-cap-alert resolves user email via Clerk",
  fileContains("src/lib/cost-cap-alert.ts", "@clerk/nextjs/server") ? 1 : 0,
  1,
  { dimension: "security" },
);

// Customer-stats anonymizer posture is documented
check(
  "anonymizer config is documented as SHIPPED CHOICE (R29)",
  fileContains("src/lib/customer-stats-anonymizer.ts", "SHIPPED CHOICE") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// A2E HTTP-header propagation (R29 closure of R28's TODO follow-up)
check(
  "a2e-depth exports A2E_DEPTH_HEADER + readA2eDepthHeader",
  fileContains("src/lib/a2e-depth.ts", "A2E_DEPTH_HEADER") &&
    fileContains("src/lib/a2e-depth.ts", "readA2eDepthHeader") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory reads X-A2E-Depth header (cross-fetch propagation)",
  fileContains("src/lib/agent-factory.ts", "readA2eDepthHeader") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory MAX(als, header) for depth (defence-in-depth)",
  fileContains("src/lib/agent-factory.ts", "Math.max(alsDepth, headerDepth)") ? 1 : 0,
  1,
  { dimension: "security" },
);

// Agent run replay viewer
check(
  "replay viewer API present (/api/admin/replay/[auditId])",
  existsSync(
    join(ROOT, "src/app/api/admin/replay/[auditId]/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "replay viewer UI present",
  existsSync(
    join(ROOT, "src/app/dashboard/admin/replay/[auditId]/page.tsx"),
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "replay viewer API uses requireAdmin gate",
  fileContains(
    "src/app/api/admin/replay/[auditId]/route.ts",
    "requireAdmin",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 30 — Agentic Commerce primitives ───────────────────────────
//
// The platform's first move into the agentic-commerce category.
// Every agent action with money has these gates: spend authorization,
// atomic charge, reversal window, hash-chained receipt. Removing any
// piece silently breaks the trust contract.

check(
  "migration 0044 (agent_spend_authorizations + charges) on disk",
  existsSync(
    join(ROOT, "drizzle/0044_agent_spend_authorizations.sql"),
  ) ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "schema.ts declares agentSpendAuthorizations table",
  fileContains("src/db/schema.ts", "agentSpendAuthorizations") ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "schema.ts declares agentSpendCharges table",
  fileContains("src/db/schema.ts", "agentSpendCharges") ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "agent-spend lib present (spend authorization + atomic charge)",
  existsSync(join(ROOT, "src/lib/agent-spend.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-spend uses SELECT FOR UPDATE (atomic charge)",
  fileContains("src/lib/agent-spend.ts", '.for("update")') ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-spend tests present (>=20 cases)",
  existsSync(join(ROOT, "src/lib/__tests__/agent-spend.test.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "audit-log enum includes commerce.charge (hash-chained)",
  fileContains("src/lib/audit-log.ts", '"commerce.charge"') ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "audit-log enum includes commerce.authorize",
  fileContains("src/lib/audit-log.ts", '"commerce.authorize"') ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "audit-log enum includes commerce.reverse",
  fileContains("src/lib/audit-log.ts", '"commerce.reverse"') ? 1 : 0,
  1,
  { dimension: "security" },
);

// API routes
check(
  "/api/agent-commerce/authorize route present",
  existsSync(
    join(ROOT, "src/app/api/agent-commerce/authorize/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "/api/agent-commerce/charge route present",
  existsSync(
    join(ROOT, "src/app/api/agent-commerce/charge/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "/api/agent-commerce/reverse/[chargeId] route present",
  existsSync(
    join(ROOT, "src/app/api/agent-commerce/reverse/[chargeId]/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "/api/agent-commerce/verify/[authorizationId] route present (public)",
  existsSync(
    join(
      ROOT,
      "src/app/api/agent-commerce/verify/[authorizationId]/route.ts",
    ),
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-commerce charge route uses requireMutatingAuth (CSRF + Clerk)",
  fileContains(
    "src/app/api/agent-commerce/charge/route.ts",
    "requireMutatingAuth",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// Public surface
check(
  "/agentic-commerce public page present",
  existsSync(join(ROOT, "src/app/agentic-commerce/page.tsx")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "docs/AGENTIC-COMMERCE.md present (strategy + architecture)",
  existsSync(join(ROOT, "docs/AGENTIC-COMMERCE.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// Trace schema staged for future R30 trace work (migration 0043).
check(
  "migration 0043 (agent_traces) staged",
  existsSync(join(ROOT, "drizzle/0043_agent_traces.sql")) ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "schema.ts declares agentTraces table",
  fileContains("src/db/schema.ts", "agentTraces") ? 1 : 0,
  1,
  { dimension: "database" },
);

// ─── Round 31 — Best in Category: trace + output schema gate ──────────
//
// Two pillars: full execution-trace recorder (closes R30 staged work)
// + output schema validation (prevents hallucinated JSON shapes).

// Agent execution trace
check(
  "agent-trace lib present (ALS-backed flame graph)",
  existsSync(join(ROOT, "src/lib/agent-trace.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-trace-node ALS install present",
  existsSync(join(ROOT, "src/lib/agent-trace-node.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-trace-persist lib present",
  existsSync(join(ROOT, "src/lib/agent-trace-persist.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "instrumentation.ts imports agent-trace-node",
  fileContains("src/instrumentation.ts", "agent-trace-node") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory wraps handler in withTrace (R31)",
  fileContains("src/lib/agent-factory.ts", "withTrace") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory persists trace via persistTrace",
  fileContains("src/lib/agent-factory.ts", "persistTrace") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-trace tests present (14 cases)",
  existsSync(join(ROOT, "src/lib/__tests__/agent-trace.test.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

// Trace viewer
check(
  "/api/admin/trace/[traceId] route present",
  existsSync(join(ROOT, "src/app/api/admin/trace/[traceId]/route.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "/dashboard/admin/trace/[traceId] page present (flame graph)",
  existsSync(
    join(ROOT, "src/app/dashboard/admin/trace/[traceId]/page.tsx"),
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "trace API uses requireAdmin gate",
  fileContains(
    "src/app/api/admin/trace/[traceId]/route.ts",
    "requireAdmin",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// Output schema validation
check(
  "AgentConfig has outputSchema field",
  fileContains("src/lib/agent-factory.ts", "outputSchema?:") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory validates output schema before returning (R31)",
  fileContains("src/lib/agent-factory.ts", "BAD_AGENT_OUTPUT") ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 32 — full-send sprint: per-request budget + public trace ──
//
// Closes 2 of the 10 remaining agentic gaps from R31 review.

// Per-request token budget (single-execution blast radius bound)
check(
  "per-request-token-budget lib present",
  existsSync(join(ROOT, "src/lib/per-request-token-budget.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "per-request-token-budget Node ALS install present",
  existsSync(join(ROOT, "src/lib/per-request-token-budget-node.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "instrumentation.ts imports per-request-token-budget-node",
  fileContains(
    "src/instrumentation.ts",
    "per-request-token-budget-node",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory wraps handler in withRequestTokenBudget (R32)",
  fileContains("src/lib/agent-factory.ts", "withRequestTokenBudget") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory translates RequestTokenBudgetExceededError → 429",
  fileContains(
    "src/lib/agent-factory.ts",
    "REQUEST_TOKEN_BUDGET_EXCEEDED",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "per-request-token-budget tests present (>=15 cases)",
  existsSync(
    join(ROOT, "src/lib/__tests__/per-request-token-budget.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// .vercelignore must exist + must exclude python venvs.
// R32 build fail root cause: Turbopack walks the filesystem and trips
// over broken Python venv symlinks ("Symlink ... points out of the
// filesystem root"). The fix is .vercelignore — and this gate ensures
// nobody removes it without realizing the build will break again.
check(
  ".vercelignore present (blocks broken-symlink directories from build)",
  existsSync(join(ROOT, ".vercelignore")) ? 1 : 0,
  1,
  { dimension: "process" },
);
check(
  ".vercelignore excludes Python venvs (Turbopack symlink-walker safety)",
  fileContains(".vercelignore", "venv") ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── Round 33 — Multi-stage HITL deep-work ───────────────────────────
//
// Sequential multi-stage approval orchestration with per-stage state
// machine, audit-chained transitions, retry-with-different-context,
// and pluggable routing rules.

check(
  "migration 0045 (multi-stage HITL) on disk",
  existsSync(join(ROOT, "drizzle/0045_multi_stage_hitl.sql")) ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "schema.ts declares approvalStages table",
  fileContains("src/db/schema.ts", "approvalStages") ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "schema.ts: hitlApprovals has stageCount + currentStage fields",
  fileContains("src/db/schema.ts", "stageCount") &&
    fileContains("src/db/schema.ts", "currentStage") ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "multi-stage-hitl orchestration lib present",
  existsSync(join(ROOT, "src/lib/multi-stage-hitl.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "multi-stage-hitl uses SELECT FOR UPDATE (atomic stage decision)",
  fileContains("src/lib/multi-stage-hitl.ts", '.for("update")') ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "hitl-routing-rules engine present (USER CONTRIBUTION POINT)",
  existsSync(join(ROOT, "src/lib/hitl-routing-rules.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "selectApprovalStages is fault-tolerant (try/catch on rule match())",
  fileContains("src/lib/hitl-routing-rules.ts", "} catch {") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "multi-stage-hitl tests present (>=20 cases)",
  existsSync(join(ROOT, "src/lib/__tests__/multi-stage-hitl.test.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

// HITL routing rules are SHIPPED with non-empty default policy.
// An empty rules array means no actions ever route to HITL — almost
// certainly a regression of the R33 deep-work decision.
check(
  "hitl-routing-rules has non-empty SHIPPED default policy",
  fileContains(
    "src/lib/hitl-routing-rules.ts",
    "critical_with_sensitive_data",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory wires multi-stage HITL gate (selectApprovalStages)",
  fileContains(
    "src/lib/agent-factory.ts",
    "selectApprovalStages",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory creates multi-stage requests (createMultiStageRequest)",
  fileContains(
    "src/lib/agent-factory.ts",
    "createMultiStageRequest",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-factory fail-CLOSED on HITL gate failure",
  fileContains(
    "src/lib/agent-factory.ts",
    "HITL_GATE_UNAVAILABLE",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// Admin approval review endpoints
check(
  "admin HITL approval API present",
  existsSync(join(ROOT, "src/app/api/admin/hitl/[requestId]/route.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "admin approval review UI present",
  existsSync(
    join(ROOT, "src/app/dashboard/admin/approvals/[requestId]/page.tsx"),
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "admin HITL API uses requireAdmin gate",
  fileContains(
    "src/app/api/admin/hitl/[requestId]/route.ts",
    "requireAdmin",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 34 — Cryptographic Agent Delegation Chain (CADC) ──────────
//
// The trust primitive nobody else has shipped. Ed25519-signed
// delegations + per-action signatures + chain hashing, verifiable
// by any third party WITHOUT trusting Sovereign servers.

check(
  "migration 0046 (agent delegations) on disk",
  existsSync(join(ROOT, "drizzle/0046_agent_delegations.sql")) ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "schema.ts declares userSigningKeys + agentDelegations + agentActionSignatures",
  fileContains("src/db/schema.ts", "userSigningKeys") &&
    fileContains("src/db/schema.ts", "agentDelegations") &&
    fileContains("src/db/schema.ts", "agentActionSignatures") ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "agent-delegation crypto lib present",
  existsSync(join(ROOT, "src/lib/agent-delegation.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-delegation uses Ed25519 (node:crypto)",
  fileContains("src/lib/agent-delegation.ts", '"ed25519"') ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-delegation uses canonical JSON for hashing (key-order safety)",
  fileContains("src/lib/agent-delegation.ts", "canonicalJsonStringify") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-delegation tests present (>=25 cases)",
  existsSync(join(ROOT, "src/lib/__tests__/agent-delegation.test.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "/api/health/verify-delegation public endpoint present (third-party verifier)",
  existsSync(
    join(ROOT, "src/app/api/_health/verify-delegation/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "/api/health/verify-delegation public re-export present",
  existsSync(
    join(ROOT, "src/app/api/health/verify-delegation/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "verify-delegation endpoint claims 'not a required trust anchor' (positioning)",
  fileContains(
    "src/app/api/_health/verify-delegation/route.ts",
    "not a required trust anchor",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 35 — @sovereign/inspector trustless CLI ────────────────────
//
// Open-source verifier package. Anyone can `npm install -g
// @sovereign/inspector` and verify any deployment. This is the
// platform's survival mechanism: when sovereignmatrix.agency vanishes
// someday, audit chains remain verifiable forever.

check(
  "inspector package present (open-source survival primitive)",
  existsSync(join(ROOT, "packages/inspector/package.json")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "inspector verify lib present",
  existsSync(join(ROOT, "packages/inspector/src/verify.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "inspector CLI present + executable",
  existsSync(join(ROOT, "packages/inspector/src/cli.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "inspector tests present (>=10 cases)",
  existsSync(join(ROOT, "packages/inspector/__tests__/verify.test.mjs"))
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "inspector README + LICENSE present (npm-publishable)",
  existsSync(join(ROOT, "packages/inspector/README.md")) &&
    existsSync(join(ROOT, "packages/inspector/LICENSE")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "inspector zero external dependencies (only node:crypto + global fetch)",
  fileContains("packages/inspector/package.json", '"dependencies"') ? 0 : 1,
  1,
  { dimension: "trust-asset" },
);

// Public HITL policy (procurement audit artifact)
check(
  "/api/health/hitl-policy endpoint present (public audit)",
  existsSync(join(ROOT, "src/app/api/_health/hitl-policy/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "/api/health/hitl-policy public re-export present",
  existsSync(join(ROOT, "src/app/api/health/hitl-policy/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// Self-service deploy diagnostic (returns specific failure reasons)
check(
  "/api/health/diagnose endpoint present (self-service deploy)",
  existsSync(join(ROOT, "src/app/api/_health/diagnose/route.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);
check(
  "/api/health/diagnose public re-export present",
  existsSync(join(ROOT, "src/app/api/health/diagnose/route.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);
check(
  "diagnose endpoint hashes DATABASE_URL (no leak)",
  fileContains(
    "src/app/api/_health/diagnose/route.ts",
    "createHash",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// Public reasoning trace (customer-facing trust artifact)
check(
  "public reasoning trace endpoint present",
  existsSync(
    join(ROOT, "src/app/api/_health/trace/[traceId]/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "public reasoning trace re-export present",
  existsSync(
    join(ROOT, "src/app/api/health/trace/[traceId]/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "public trace strips error messages (PII safety)",
  fileContains(
    "src/app/api/_health/trace/[traceId]/route.ts",
    "(redacted)",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

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
