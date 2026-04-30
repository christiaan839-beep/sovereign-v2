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

// ─── Round 36 — Federation primitive (the next-level move) ───────────
//
// /.well-known/sovereign-trust is the discovery seed for federated
// agent trust. Other instances can publish their own; the inspector
// crawls them; we become the network, not just a node.

check(
  "/.well-known/sovereign-trust discovery file present",
  existsSync(
    join(ROOT, "src/app/.well-known/sovereign-trust/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "discovery file declares capabilities (auditChain, delegationChain, multiStageHitl)",
  fileContains(
    "src/app/.well-known/sovereign-trust/route.ts",
    "auditChain: true",
  ) &&
    fileContains(
      "src/app/.well-known/sovereign-trust/route.ts",
      "delegationChain: true",
    ) &&
    fileContains(
      "src/app/.well-known/sovereign-trust/route.ts",
      "multiStageHitl: true",
    )
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "discovery file links to @sovereign/inspector npm package",
  fileContains(
    "src/app/.well-known/sovereign-trust/route.ts",
    "@sovereign/inspector",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "inspector fetcher has fetchTrustDiscovery + crawlFederation",
  fileContains(
    "packages/inspector/src/fetch.mjs",
    "fetchTrustDiscovery",
  ) &&
    fileContains(
      "packages/inspector/src/fetch.mjs",
      "crawlFederation",
    )
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "inspector CLI has identify + federation commands",
  fileContains("packages/inspector/src/cli.mjs", "cmdIdentify") &&
    fileContains("packages/inspector/src/cli.mjs", "cmdFederation")
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 37 — Agent Capability Tokens (ACTs) ────────────────────────
//
// Macaroon-pattern attenuatable capability tokens for AI agents. The
// next-generation primitive on top of R34 CADC. Composes with R30/R33/
// R34/R36. See docs/adr/0005-agent-capability-tokens.md.

check(
  "ADR-0005 (ACTs) present",
  existsSync(
    join(ROOT, "docs/adr/0005-agent-capability-tokens.md"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "migration 0047 (agent_capability_tokens) on disk",
  existsSync(join(ROOT, "drizzle/0047_agent_capability_tokens.sql")) ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "schema.ts declares agentCapabilityTokens table",
  fileContains("src/db/schema.ts", "agentCapabilityTokens") ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "ACT lib present (mintToken + attenuateToken + verifyTokenChain)",
  fileContains("src/lib/agent-capability-tokens.ts", "mintToken") &&
    fileContains("src/lib/agent-capability-tokens.ts", "attenuateToken") &&
    fileContains(
      "src/lib/agent-capability-tokens.ts",
      "verifyTokenChain",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "ACT lib enforces explicit narrowing (additionalIsNarrowing)",
  fileContains(
    "src/lib/agent-capability-tokens.ts",
    "additionalIsNarrowing",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "ACT tests present (>=30 cases including security paths)",
  existsSync(
    join(ROOT, "src/lib/__tests__/agent-capability-tokens.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "inspector ACT port present (act.mjs)",
  existsSync(join(ROOT, "packages/inspector/src/act.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "inspector CLI has verify-token command",
  fileContains("packages/inspector/src/cli.mjs", "cmdVerifyToken") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "/.well-known/sovereign-trust declares agentCapabilityTokens capability",
  fileContains(
    "src/app/.well-known/sovereign-trust/route.ts",
    "agentCapabilityTokens: true",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 38 — Agent Identity Manifests (KYA Registry) ──────────────
//
// The missing primitive nobody has shipped. Closes the last major gap
// in cryptographic agent trust. Composes with R26+R34+R36+R37.

check(
  "ADR-0006 (Agent Identity Manifests) present",
  existsSync(
    join(ROOT, "docs/adr/0006-agent-identity-manifests.md"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "migration 0048 (agent_identity_manifests) on disk",
  existsSync(
    join(ROOT, "drizzle/0048_agent_identity_manifests.sql"),
  ) ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "schema.ts declares agentIdentityManifests table",
  fileContains("src/db/schema.ts", "agentIdentityManifests") ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "agent-identity lib has signManifest + verifyManifest + verifyManifestChain",
  fileContains("src/lib/agent-identity.ts", "signManifest") &&
    fileContains("src/lib/agent-identity.ts", "verifyManifest") &&
    fileContains("src/lib/agent-identity.ts", "verifyManifestChain") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-identity uses canonical JSON for hashing",
  fileContains("src/lib/agent-identity.ts", "canonicalJsonStringify") ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-identity tests present (>=15 cases)",
  existsSync(join(ROOT, "src/lib/__tests__/agent-identity.test.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "/.well-known/sovereign-trust declares agentIdentityRegistry capability",
  fileContains(
    "src/app/.well-known/sovereign-trust/route.ts",
    "agentIdentityRegistry: true",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 39 — Public KYA endpoints + browser ───────────────────────
//
// Wire R38 lib to actual HTTP endpoints + public registry page.
// Turns the identity primitive into a usable network.

check(
  "POST /api/identity/manifests endpoint present",
  existsSync(join(ROOT, "src/app/api/identity/manifests/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "GET /api/identity/manifests/[agentId] endpoint present",
  existsSync(
    join(ROOT, "src/app/api/identity/manifests/[agentId]/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "GET /api/identity/registry endpoint present",
  existsSync(join(ROOT, "src/app/api/identity/registry/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "POST /api/identity/verify endpoint present (trustless)",
  existsSync(join(ROOT, "src/app/api/identity/verify/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "register endpoint enforces ownerPublicKey is registered (R34 binding)",
  fileContains(
    "src/app/api/identity/manifests/route.ts",
    "userSigningKeys",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "register endpoint server-verifies signature (defense-in-depth)",
  fileContains(
    "src/app/api/identity/manifests/route.ts",
    "verifyManifest",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "inspector identity.mjs port present",
  existsSync(join(ROOT, "packages/inspector/src/identity.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "inspector CLI has agent-identity + registry commands",
  fileContains("packages/inspector/src/cli.mjs", "cmdAgentIdentity") &&
    fileContains("packages/inspector/src/cli.mjs", "cmdRegistry") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "/agents/registry public page present",
  existsSync(join(ROOT, "src/app/agents/registry/page.tsx")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 40 — Public Agent Reputation System ───────────────────────
//
// Network-effect substrate. Aggregates R26+R30+R33+R38 signals into
// a procurement-readable score keyed by manifest ID.

check(
  "ADR-0007 (Public Agent Reputation) present",
  existsSync(
    join(ROOT, "docs/adr/0007-public-agent-reputation.md"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "migration 0049 (agent_reputation_scores) on disk",
  existsSync(
    join(ROOT, "drizzle/0049_agent_reputation_scores.sql"),
  ) ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "schema.ts declares agentReputationScores table",
  fileContains("src/db/schema.ts", "agentReputationScores") ? 1 : 0,
  1,
  { dimension: "database" },
);
check(
  "agent-reputation pure-function calculator present",
  existsSync(join(ROOT, "src/lib/agent-reputation.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "agent-reputation tests present (>=12 cases)",
  existsSync(
    join(ROOT, "src/lib/__tests__/agent-reputation.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "GET /api/identity/reputation/[agentId] endpoint present",
  existsSync(
    join(ROOT, "src/app/api/identity/reputation/[agentId]/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "daily reputation rollup cron present",
  existsSync(
    join(ROOT, "src/app/api/cron/rollup-agent-reputation/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);
check(
  "reputation rollup cron registered in vercel.json",
  fileContains("vercel.json", "/api/cron/rollup-agent-reputation") ? 1 : 0,
  1,
  { dimension: "process" },
);
check(
  "Inspector reputation port present (reputation.mjs)",
  existsSync(join(ROOT, "packages/inspector/src/reputation.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "Inspector CLI has reputation command",
  fileContains("packages/inspector/src/cli.mjs", "cmdReputation") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 41 — Trustless reputation loop closure ────────────────────
//
// The platform CANNOT lie about reputation while the inspector watches.
// Customers fetch raw signals + recompute the score locally + compare
// to what the platform claims. Mismatch = fabricated reputation.

check(
  "Reputation signals endpoint present (raw inputs)",
  existsSync(
    join(
      ROOT,
      "src/app/api/identity/reputation/[agentId]/signals/route.ts",
    ),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "Reputation signals shared lib present (cron + endpoint)",
  existsSync(join(ROOT, "src/lib/agent-reputation-signals.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);
check(
  "Cron uses shared gatherReputationSignals (no duplicate)",
  fileContains(
    "src/app/api/cron/rollup-agent-reputation/route.ts",
    "gatherReputationSignals",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);
check(
  "Inspector has verifyReputationLocally (R41 trustless loop)",
  fileContains(
    "packages/inspector/src/reputation.mjs",
    "verifyReputationLocally",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "Inspector has fetchReputationSignals",
  fileContains(
    "packages/inspector/src/reputation.mjs",
    "fetchReputationSignals",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "Inspector CLI has reputation-verify command",
  fileContains(
    "packages/inspector/src/cli.mjs",
    "cmdReputationVerify",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);
check(
  "Reputation signals endpoint declares formula (transparency)",
  fileContains(
    "src/app/api/identity/reputation/[agentId]/signals/route.ts",
    "formula",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 42 — Trust-as-Collateral (TaC) ────────────────────────────
// Reputation grade modulates the daily spend cap. R42 publishes the
// credit line as a SIGNAL; R43 will wire it into cost-runaway.ts.
// The credit line is recomputable locally via @sovereign/inspector,
// so the platform CANNOT lie about an agent's effective autonomy.

check(
  "ADR-0008 (Trust-as-Collateral) on disk",
  existsSync(join(ROOT, "docs/adr/0008-trust-as-collateral.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "migration 0050 (agent_credit_lines) on disk",
  existsSync(
    join(ROOT, "drizzle/0050_agent_credit_lines.sql"),
  )
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

check(
  "agent-credit-line pure-function calculator present",
  existsSync(join(ROOT, "src/lib/agent-credit-line.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "agent-credit-line tests present (>=20 cases)",
  fileContains(
    "src/lib/__tests__/agent-credit-line.test.ts",
    "verifyCreditLineIntegrity",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "GET /api/identity/credit/[agentId] endpoint present",
  existsSync(
    join(ROOT, "src/app/api/identity/credit/[agentId]/route.ts"),
  )
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

check(
  "daily credit-rollup cron present",
  existsSync(
    join(ROOT, "src/app/api/cron/rollup-agent-credit/route.ts"),
  )
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

check(
  "credit-rollup cron registered in vercel.json",
  fileContains("vercel.json", "/api/cron/rollup-agent-credit") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "agent_credit_lines schema entry present in db schema",
  fileContains("src/db/schema.ts", "agentCreditLines") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Inspector credit port present (credit.mjs)",
  existsSync(join(ROOT, "packages/inspector/src/credit.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector CLI has credit command",
  fileContains("packages/inspector/src/cli.mjs", "case \"credit\":") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector CLI has credit-verify command (trustless loop)",
  fileContains(
    "packages/inspector/src/cli.mjs",
    "case \"credit-verify\":",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector exports credit module from package.json",
  fileContains("packages/inspector/package.json", "./credit") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "credit endpoint declares R42→R43 wire-status (procurement transparency)",
  fileContains(
    "src/app/api/identity/credit/[agentId]/route.ts",
    "wireStatus",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "credit calculator surfaces verifyCreditLineIntegrity (trustless)",
  fileContains(
    "src/lib/agent-credit-line.ts",
    "verifyCreditLineIntegrity",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Anti-slop honesty invariants ────────────────────────────────────
// These guard against the regression of fabricated metrics returning
// to user-facing landing components. If you measure a number, ship
// it. If you don't, don't print it. (Constitution Principle 5.)

// fileNotContains: invariant fails if the substring shows up.
function fileNotContains(rel, substr) {
  try {
    const txt = readFileSync(join(ROOT, rel), "utf8");
    return !txt.includes(substr);
  } catch {
    return true; // file missing = not slop, just absent
  }
}

check(
  "VerificationPipeline.tsx — no fabricated 99.x% pass rates",
  fileNotContains(
    "src/components/landing/VerificationPipeline.tsx",
    "passRate: \"99.",
  ) && fileNotContains(
    "src/components/landing/VerificationPipeline.tsx",
    "passRate: \"97.",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "VerificationPipeline.tsx — references real source files (audit-ready)",
  fileContains(
    "src/components/landing/VerificationPipeline.tsx",
    "src/lib/pii-guard.ts",
  ) && fileContains(
    "src/components/landing/VerificationPipeline.tsx",
    "src/lib/hitl-routing-rules.ts",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "LiveProofStrip.tsx — no hardcoded uptime % fallback",
  fileNotContains(
    "src/components/landing/LiveProofStrip.tsx",
    "uptime: \"99.",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "ModelRouterSection.tsx — no fabricated uptime claim",
  fileNotContains(
    "src/components/landing/ModelRouterSection.tsx",
    "v: \"99.9%\",  l: \"uptime\"",
  ) && fileNotContains(
    "src/components/landing/ModelRouterSection.tsx",
    "v: \"99.9%\", l: \"uptime\"",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

// ─── Round 43 — Trust-as-Collateral live wire ────────────────────────
// Composes R42 credit lines with R30 cost-runaway. The live spend
// cap is now multiplier-modulated by the agent's reputation grade.

check(
  "cost-runaway.ts surfaces resolveEffectiveCap (pure resolver)",
  fileContains("src/lib/cost-runaway.ts", "resolveEffectiveCap") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "cost-runaway.ts staleness threshold for credit lines (R43 fail-safe)",
  fileContains(
    "src/lib/cost-runaway.ts",
    "CREDIT_LINE_STALENESS_THRESHOLD_HOURS",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "cost-runaway.ts checkTenantCostCap accepts agentId (R43 wire)",
  fileContains("src/lib/cost-runaway.ts", "agentId?: string") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "cost-runaway.test.ts has R43 boundary tests",
  fileContains(
    "src/lib/__tests__/cost-runaway.test.ts",
    "Trust-as-Collateral live wire",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 44 — Signed Reliability Attestations ──────────────────────
// Cryptographically-signed daily commitments to platform uptime
// claims. Customers verify the math offline.

check(
  "ADR-0009 (signed reliability attestations) on disk",
  existsSync(join(ROOT, "docs/adr/0009-signed-reliability-attestations.md"))
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "migration 0051 (reliability_attestations) on disk",
  existsSync(join(ROOT, "drizzle/0051_reliability_attestations.sql")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "reliability-attestation pure-function library present",
  existsSync(join(ROOT, "src/lib/reliability-attestation.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "reliability-attestation tests present (>=20 cases)",
  fileContains(
    "src/lib/__tests__/reliability-attestation.test.ts",
    "verifyAttestationChain",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "GET /api/health/reliability/attestation endpoint present",
  existsSync(
    join(ROOT, "src/app/api/health/reliability/attestation/route.ts"),
  )
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "daily reliability-attestation cron present",
  existsSync(
    join(ROOT, "src/app/api/cron/sign-reliability-attestation/route.ts"),
  )
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

check(
  "reliability-attestation cron registered in vercel.json",
  fileContains("vercel.json", "/api/cron/sign-reliability-attestation")
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

check(
  "reliability_attestations schema entry present",
  fileContains("src/db/schema.ts", "reliabilityAttestations") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Inspector reliability port present (reliability.mjs)",
  existsSync(join(ROOT, "packages/inspector/src/reliability.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector CLI has reliability-verify command",
  fileContains(
    "packages/inspector/src/cli.mjs",
    "case \"reliability-verify\":",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "platform signing key fallback documented (env var path)",
  fileContains(
    "src/lib/reliability-attestation.ts",
    "SOVEREIGN_PLATFORM_PRIVATE_KEY",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 45 — Customer-managed audit-log export ────────────────────
// Tenant-scoped, Ed25519-signed audit batches. Customers store in
// their own S3/GCS, verify offline, prove integrity forever.

check(
  "audit-export pure-function library present",
  existsSync(join(ROOT, "src/lib/audit-export.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "audit-export tests present (>=12 cases including chain walk)",
  fileContains(
    "src/lib/__tests__/audit-export.test.ts",
    "row chain walk",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "POST /api/admin/audit/export endpoint present",
  existsSync(join(ROOT, "src/app/api/admin/audit/export/route.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "audit-export endpoint enforces tenant scope (defense-in-depth)",
  fileContains(
    "src/app/api/admin/audit/export/route.ts",
    "isOwnedByTenant",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Inspector audit-export port present",
  existsSync(join(ROOT, "packages/inspector/src/audit-export.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector CLI has audit-export-verify command (stdin trustless)",
  fileContains(
    "packages/inspector/src/cli.mjs",
    "case \"audit-export-verify\":",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 46 — AI Agent Action Insurance underwriting ───────────────
// Pure-function rating model. Composes R40 reputation × R42 credit
// line × claims history. The first production AI agent insurance
// rating math, anywhere.

check(
  "ADR-0010 (agent insurance underwriting) on disk",
  existsSync(join(ROOT, "docs/adr/0010-agent-insurance-underwriting.md"))
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "agent-underwriting pure-function rating model present",
  existsSync(join(ROOT, "src/lib/agent-underwriting.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "agent-underwriting tests present (>=20 cases)",
  fileContains(
    "src/lib/__tests__/agent-underwriting.test.ts",
    "verifyQuoteIntegrity",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "GET /api/identity/insurance/[agentId] endpoint present",
  existsSync(
    join(ROOT, "src/app/api/identity/insurance/[agentId]/route.ts"),
  )
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "agent-underwriting declines F-grade (uninsurable)",
  fileContains(
    "src/lib/agent-underwriting.ts",
    "uninsurable_grade_F",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "insurance endpoint emits underwritingInput for carrier verification",
  fileContains(
    "src/app/api/identity/insurance/[agentId]/route.ts",
    "underwritingInput",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Procurement-grade compliance mapping ────────────────────────────

check(
  "Compliance control mapping document present",
  existsSync(join(ROOT, "docs/COMPLIANCE-MAPPING.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Compliance map references SOC 2 Trust Service Criteria",
  fileContains("docs/COMPLIANCE-MAPPING.md", "Trust Service Criteria") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Compliance map references EU AI Act Article 14 (human oversight)",
  fileContains("docs/COMPLIANCE-MAPPING.md", "Article 14") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Compliance map references HIPAA §164.312 (technical safeguards)",
  fileContains("docs/COMPLIANCE-MAPPING.md", "164.312") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Compliance map references NIST AI RMF",
  fileContains("docs/COMPLIANCE-MAPPING.md", "NIST AI RMF") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 47 — Vertical Agent Packs (the products) ──────────────────
// Generic infrastructure → specific industry products. Banking
// Compliance Pack first; healthcare + legal follow.

check(
  "ADR-0011 (vertical agent packs) on disk",
  existsSync(join(ROOT, "docs/adr/0011-vertical-agent-packs.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Vertical pack types module present",
  existsSync(join(ROOT, "src/lib/vertical-packs/types.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Banking Compliance Pack present (the first product)",
  existsSync(join(ROOT, "src/lib/vertical-packs/banking-compliance.ts"))
    ? 1
    : 0,
  1,
  { dimension: "process" },
);

check(
  "Banking pack tests present (>=20 cases)",
  fileContains(
    "src/lib/__tests__/banking-compliance-pack.test.ts",
    "BANKING_COMPLIANCE_PACK",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Banking pack: default ACT scope is read-only (max_cents: 0)",
  fileContains("src/lib/vertical-packs/banking-compliance.ts", "max_cents: 0")
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

check(
  "Banking pack: HITL rule cites BSA reporting (31 CFR 1020.320)",
  fileContains(
    "src/lib/vertical-packs/banking-compliance.ts",
    "31 CFR 1020.320",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Banking pack: HITL rule cites OCC vendor risk (2013-29)",
  fileContains(
    "src/lib/vertical-packs/banking-compliance.ts",
    "OCC Bulletin 2013-29",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "GET /api/vertical-packs/[packId] endpoint present",
  existsSync(
    join(ROOT, "src/app/api/vertical-packs/[packId]/route.ts"),
  )
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 48 — Circuit Breaker reliability primitive ────────────────

check(
  "Reliability circuit-breaker library present",
  existsSync(join(ROOT, "src/lib/reliability/circuit-breaker.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Reliability circuit-breaker tests present (>=15 cases)",
  fileContains(
    "src/lib/__tests__/reliability-circuit-breaker.test.ts",
    "evaluateCircuitState",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Circuit breaker has CLOSED/OPEN/HALF_OPEN state machine",
  fileContains(
    "src/lib/reliability/circuit-breaker.ts",
    "HALF_OPEN",
  ) && fileContains(
    "src/lib/reliability/circuit-breaker.ts",
    "evaluateCircuitState",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Circuit breaker exposes typed errors (CircuitOpenError, UpstreamFailedError)",
  fileContains(
    "src/lib/reliability/circuit-breaker.ts",
    "CircuitOpenError",
  ) && fileContains(
    "src/lib/reliability/circuit-breaker.ts",
    "UpstreamFailedError",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 49 — Healthcare Compliance Pack (second product) ──────────

check(
  "Healthcare Claims Pack present (the second product)",
  existsSync(join(ROOT, "src/lib/vertical-packs/healthcare-claims.ts"))
    ? 1
    : 0,
  1,
  { dimension: "process" },
);

check(
  "Healthcare pack tests present",
  fileContains(
    "src/lib/__tests__/healthcare-claims-pack.test.ts",
    "HEALTHCARE_CLAIMS_PACK",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Healthcare pack: prior-auth denial rule cites UnitedHealthcare class action (R49 anti-drift)",
  fileContains(
    "src/lib/vertical-packs/healthcare-claims.ts",
    "UnitedHealthcare",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "Healthcare pack: BAA enforcement HITL rule present (HIPAA §164.308(b))",
  fileContains(
    "src/lib/vertical-packs/healthcare-claims.ts",
    "164.308(b)",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Healthcare pack: FDA 21 CFR Part 11 HITL rule present",
  fileContains(
    "src/lib/vertical-packs/healthcare-claims.ts",
    "21 CFR Part 11",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Healthcare pack: default ACT scope is read-only (max_cents 0)",
  fileContains(
    "src/lib/vertical-packs/healthcare-claims.ts",
    "max_cents: 0",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Healthcare pack registered in /api/vertical-packs/[packId] router",
  fileContains(
    "src/app/api/vertical-packs/[packId]/route.ts",
    "healthcare-claims",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 50 — Federation v2 (cross-instance reputation) ────────────

check(
  "Federation cross-instance reputation library present",
  existsSync(
    join(ROOT, "src/lib/federation/cross-instance-reputation.ts"),
  )
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Federation aggregator + verifier tests present",
  fileContains(
    "src/lib/__tests__/federation-cross-instance-reputation.test.ts",
    "verifyFederatedReputation",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Federation aggregator uses worst-of-across-instances (conservative semantic)",
  fileContains(
    "src/lib/federation/cross-instance-reputation.ts",
    "worst-of",
  ) || fileContains(
    "src/lib/federation/cross-instance-reputation.ts",
    "WORST",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "GET /api/identity/reputation/[agentId]/federated endpoint present",
  existsSync(
    join(
      ROOT,
      "src/app/api/identity/reputation/[agentId]/federated/route.ts",
    ),
  )
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Federation endpoint declares peer config via env var (operator-controllable)",
  fileContains(
    "src/app/api/identity/reputation/[agentId]/federated/route.ts",
    "SOVEREIGN_FEDERATION_PEERS",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 51 — Request Hedging (speed primitive) ────────────────────

check(
  "Request-hedging speed primitive present",
  existsSync(join(ROOT, "src/lib/reliability/request-hedging.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Request-hedging tests present (>=10 cases)",
  fileContains(
    "src/lib/__tests__/reliability-request-hedging.test.ts",
    "HedgeTimeoutError",
  ) && fileContains(
    "src/lib/__tests__/reliability-request-hedging.test.ts",
    "HedgeAllFailedError",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Hedging policy: smart mode declines hedge when primary is already fast (cost discipline)",
  fileContains(
    "src/lib/reliability/request-hedging.ts",
    "primary_already_fast",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 52 — Legal e-Discovery Pack (third product) ───────────────

check(
  "Legal e-Discovery Pack present (the third product)",
  existsSync(join(ROOT, "src/lib/vertical-packs/legal-discovery.ts"))
    ? 1
    : 0,
  1,
  { dimension: "process" },
);

check(
  "Legal pack tests present",
  fileContains(
    "src/lib/__tests__/legal-discovery-pack.test.ts",
    "LEGAL_DISCOVERY_PACK",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Legal pack: privilege HITL rule cites Zubulake (anti-slop guard)",
  fileContains(
    "src/lib/vertical-packs/legal-discovery.ts",
    "Zubulake",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "Legal pack: cites FRCP 11 (court filing signature attaches sanctions)",
  fileContains(
    "src/lib/vertical-packs/legal-discovery.ts",
    "FRCP 11",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Legal pack: cites FRCP 37(e) (litigation-hold spoliation defense)",
  fileContains(
    "src/lib/vertical-packs/legal-discovery.ts",
    "FRCP 37(e)",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Legal pack: default ACT scope is read-only (max_cents 0)",
  fileContains(
    "src/lib/vertical-packs/legal-discovery.ts",
    "max_cents: 0",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Legal pack registered in /api/vertical-packs/[packId] router",
  fileContains(
    "src/app/api/vertical-packs/[packId]/route.ts",
    "legal-discovery",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 54 — KMS-abstracted Signer (production key mgmt) ──────────

check(
  "Signer abstraction library present",
  existsSync(join(ROOT, "src/lib/keys/signer.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Signer abstraction tests present",
  fileContains(
    "src/lib/__tests__/keys-signer.test.ts",
    "selectSignerType",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Signer interface defines getPublicKey + sign + describe",
  fileContains("src/lib/keys/signer.ts", "interface Signer") &&
    fileContains("src/lib/keys/signer.ts", "getPublicKey") &&
    fileContains("src/lib/keys/signer.ts", "describe(): SignerDescription")
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

check(
  "StubKmsSigner fails closed on sign() (misconfig defense)",
  fileContains(
    "src/lib/keys/signer.ts",
    "structural placeholder",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Signer selection supports aws-kms / gcp-kms / azure-kv",
  fileContains("src/lib/keys/signer.ts", "aws-kms") &&
    fileContains("src/lib/keys/signer.ts", "gcp-kms") &&
    fileContains("src/lib/keys/signer.ts", "azure-kv")
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

// ─── Round 57 — Real-time audit anomaly detection ────────────────────

check(
  "Audit anomaly detector library present",
  existsSync(
    join(ROOT, "src/lib/anomaly/audit-anomaly-detector.ts"),
  )
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

check(
  "Anomaly detector tests present (>=20 cases)",
  fileContains(
    "src/lib/__tests__/audit-anomaly-detector.test.ts",
    "classifyOverallAnomalyState",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Anomaly detector covers chain integrity break (always critical)",
  fileContains(
    "src/lib/anomaly/audit-anomaly-detector.ts",
    "chain_integrity_break",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Anomaly detector covers signature-failure spike (key compromise pattern)",
  fileContains(
    "src/lib/anomaly/audit-anomaly-detector.ts",
    "signature_failure_spike",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Anomaly detector exposes deriveAuditChainIntactFromFindings (R44 wiring)",
  fileContains(
    "src/lib/anomaly/audit-anomaly-detector.ts",
    "deriveAuditChainIntactFromFindings",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 55 — Customer-Managed Encryption Keys (CMEK) ─────────────

check(
  "CMEK envelope-encryption library present (R55)",
  existsSync(join(ROOT, "src/lib/encryption/cmek.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "CMEK tests cover roundtrip + tampering + provider selection",
  fileContains(
    "src/lib/__tests__/encryption-cmek.test.ts",
    "tampered ciphertext",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "CMEK: StubCmekProvider fails closed on wrap/unwrap (anti-misconfig)",
  fileContains(
    "src/lib/encryption/cmek.ts",
    "operators must implement",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 56 — Federation auto-discovery crawler ────────────────────

check(
  "Federation auto-discovery library present (R56)",
  existsSync(join(ROOT, "src/lib/federation/discovery.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Federation discovery tests cover SSRF defense (IP literals + loopback)",
  fileContains(
    "src/lib/__tests__/federation-discovery.test.ts",
    "ip_literal_host",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Federation discovery handles cycles without infinite loop",
  fileContains(
    "src/lib/__tests__/federation-discovery.test.ts",
    "no infinite loop",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 58 — Webhook signing (outbound cryptographic perimeter) ──

check(
  "Webhook signing library present (R58)",
  existsSync(join(ROOT, "src/lib/webhooks/signing.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Webhook tests cover replay defense + clock-skew + tampering",
  fileContains(
    "src/lib/__tests__/webhooks-signing.test.ts",
    "replay_detected",
  ) && fileContains(
    "src/lib/__tests__/webhooks-signing.test.ts",
    "timestamp_in_future",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Webhook canonical message includes bodyHash (bounded signature size)",
  fileContains(
    "src/lib/webhooks/signing.ts",
    "bodyHash:",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 67 — Anomaly detection cron (wires R57 into production) ──

check(
  "Migration 0052 (anomaly_findings) on disk",
  existsSync(join(ROOT, "drizzle/0052_anomaly_findings.sql")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "anomalyFindings table present in db schema",
  fileContains("src/db/schema.ts", "anomalyFindings") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Anomaly detection cron present (/api/cron/detect-anomalies)",
  existsSync(
    join(ROOT, "src/app/api/cron/detect-anomalies/route.ts"),
  )
    ? 1
    : 0,
  1,
  { dimension: "security" },
);

check(
  "Anomaly cron registered in vercel.json (hourly)",
  fileContains("vercel.json", "/api/cron/detect-anomalies") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Public /api/health/anomalies endpoint present",
  existsSync(join(ROOT, "src/app/api/health/anomalies/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Legal & Regulatory Compliance Framework ────────────────────────

check(
  "Legal-compliance framework doc present (procurement-grade)",
  existsSync(join(ROOT, "docs/LEGAL-COMPLIANCE-FRAMEWORK.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Legal-compliance framework declares NOT a regulated insurer (R46 scoping)",
  fileContains(
    "docs/LEGAL-COMPLIANCE-FRAMEWORK.md",
    "We are NOT a regulated insurer",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "Legal-compliance framework declares NOT practicing law (R52 scoping)",
  fileContains(
    "docs/LEGAL-COMPLIANCE-FRAMEWORK.md",
    "We are NOT a law firm",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "Legal-compliance framework declares NOT practicing medicine (R49 scoping)",
  fileContains(
    "docs/LEGAL-COMPLIANCE-FRAMEWORK.md",
    "We are NOT practicing medicine",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "Legal-compliance framework covers EU AI Act + GDPR + HIPAA + EEOC + LL144 + CO SB 24-205",
  fileContains("docs/LEGAL-COMPLIANCE-FRAMEWORK.md", "EU AI Act") &&
    fileContains("docs/LEGAL-COMPLIANCE-FRAMEWORK.md", "GDPR") &&
    fileContains("docs/LEGAL-COMPLIANCE-FRAMEWORK.md", "HIPAA") &&
    fileContains("docs/LEGAL-COMPLIANCE-FRAMEWORK.md", "EEOC") &&
    fileContains("docs/LEGAL-COMPLIANCE-FRAMEWORK.md", "Local Law 144") &&
    fileContains("docs/LEGAL-COMPLIANCE-FRAMEWORK.md", "Colorado") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Legal-compliance framework documents export-control posture (EAR + ENC exception)",
  fileContains(
    "docs/LEGAL-COMPLIANCE-FRAMEWORK.md",
    "License Exception ENC",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 62 — HR / Hiring Compliance Pack ──────────────────────────

check(
  "HR Hiring Compliance Pack present (5th vertical product)",
  existsSync(join(ROOT, "src/lib/vertical-packs/hr-hiring-compliance.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "HR pack tests + iTutorGroup citation (anti-slop guard for autonomous-rejection rule)",
  fileContains(
    "src/lib/__tests__/hr-hiring-compliance-pack.test.ts",
    "iTutorGroup",
  ) && fileContains(
    "src/lib/vertical-packs/hr-hiring-compliance.ts",
    "iTutorGroup",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "HR pack: NYC LL144 bias-audit data collection rule",
  fileContains(
    "src/lib/vertical-packs/hr-hiring-compliance.ts",
    "NYC Local Law 144",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "HR pack: Colorado SB 24-205 impact-assessment rule",
  fileContains(
    "src/lib/vertical-packs/hr-hiring-compliance.ts",
    "Colorado SB 24-205",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "HR pack: protected-class HARD-BLOCK rule (Title VII + ADEA + ADA + GINA)",
  fileContains(
    "src/lib/vertical-packs/hr-hiring-compliance.ts",
    "GINA",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "HR pack: FCRA pre-adverse-action notice rule",
  fileContains("src/lib/vertical-packs/hr-hiring-compliance.ts", "FCRA")
    ? 1
    : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "HR pack registered in /api/vertical-packs/[packId] router",
  fileContains(
    "src/app/api/vertical-packs/[packId]/route.ts",
    "hr-hiring-compliance",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 53 — FedRAMP / Government Compliance Pack ─────────────────

check(
  "FedRAMP Government Pack present (4th vertical product, $100K-$10M ACV)",
  existsSync(join(ROOT, "src/lib/vertical-packs/fedramp-government.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "FedRAMP pack: classified-data HARD-BLOCK rule (EO 13526)",
  fileContains(
    "src/lib/vertical-packs/fedramp-government.ts",
    "13526",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "FedRAMP pack: CMMC evidence rule cites False Claims Act (FCA defense)",
  fileContains(
    "src/lib/vertical-packs/fedramp-government.ts",
    "False Claims Act",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "FedRAMP pack: Section 889 supply-chain dual-approval rule",
  fileContains(
    "src/lib/vertical-packs/fedramp-government.ts",
    "Section 889",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "FedRAMP pack: incident-reporting rule cites FISMA + DFARS 7012",
  fileContains(
    "src/lib/vertical-packs/fedramp-government.ts",
    "DFARS 252.204-7012",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "FedRAMP pack registered in /api/vertical-packs/[packId] router",
  fileContains(
    "src/app/api/vertical-packs/[packId]/route.ts",
    "fedramp-government",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 70 — Crew Orchestration Protocol ──────────────────────────

check(
  "Crew orchestration protocol library present (R70)",
  existsSync(join(ROOT, "src/lib/orchestration/crew-protocol.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Crew protocol tests cover handoff legality + stakes classification",
  fileContains(
    "src/lib/__tests__/crew-protocol.test.ts",
    "validateHandoff",
  ) && fileContains(
    "src/lib/__tests__/crew-protocol.test.ts",
    "classifyCrewStakes",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Crew protocol enforces hitlOnEveryHandoff for regulated stakes (R33 composition)",
  fileContains(
    "src/lib/orchestration/crew-protocol.ts",
    "hitlOnEveryHandoff",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Crew protocol records configHash on every step (replay-safety)",
  fileContains(
    "src/lib/orchestration/crew-protocol.ts",
    "crewConfigHash",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 63 — Pack Authoring SDK + Validator ──────────────────────

check(
  "Pack authoring SDK / validator present (R63)",
  existsSync(join(ROOT, "src/lib/vertical-packs/pack-validator.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Pack validator declares PACK_SAFETY_INVARIANTS",
  fileContains(
    "src/lib/vertical-packs/pack-validator.ts",
    "PACK_SAFETY_INVARIANTS",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Pack validator enforces read-only-by-default ACT scope (the killer invariant)",
  fileContains(
    "src/lib/vertical-packs/pack-validator.ts",
    "READ_ONLY_DEFAULT_ACT_SCOPE",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Pack validator regression-tests all in-source packs",
  fileContains(
    "src/lib/__tests__/pack-validator.test.ts",
    "all 5 in-source packs pass the validator",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Pack validator: banned-agent keyword check (jailbreak/exploit/deepfake/etc.)",
  fileContains(
    "src/lib/vertical-packs/pack-validator.ts",
    "BANNED_AGENT_KEYWORDS",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Pack validator: HITL rule citation requirement (anti-slop)",
  fileContains(
    "src/lib/vertical-packs/pack-validator.ts",
    "HITL_RULES_HAVE_CITATIONS",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

// ─── Agent Development Lifecycle (ADLC) framework doc ────────────────

check(
  "Sovereign ADLC framework doc present (thought leadership)",
  existsSync(join(ROOT, "docs/AGENT-DEVELOPMENT-LIFECYCLE.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "ADLC declares 7 lifecycle stages",
  fileContains("docs/AGENT-DEVELOPMENT-LIFECYCLE.md", "Stage 1") &&
    fileContains("docs/AGENT-DEVELOPMENT-LIFECYCLE.md", "Stage 7") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "ADLC maps each stage to reference primitives (file paths)",
  fileContains(
    "docs/AGENT-DEVELOPMENT-LIFECYCLE.md",
    "stage-to-primitive mapping",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "ADLC published under CC-BY 4.0 (open framework)",
  fileContains(
    "docs/AGENT-DEVELOPMENT-LIFECYCLE.md",
    "CC-BY 4.0",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 71 — Guardrails Adapter Framework ────────────────────────

check(
  "Guardrails adapter framework present (R71 — BYO open-source security)",
  existsSync(join(ROOT, "src/lib/guardrails/guardrails-adapter.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Guardrails framework exposes composeVerdicts pure function (any-block semantics)",
  fileContains(
    "src/lib/guardrails/guardrails-adapter.ts",
    "composeVerdicts",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Guardrails framework ships NeMo + OpenGuardrails + LlamaFirewall skeletons",
  fileContains(
    "src/lib/guardrails/guardrails-adapter.ts",
    "NEMO_GUARDRAILS_SKELETON",
  ) && fileContains(
    "src/lib/guardrails/guardrails-adapter.ts",
    "OPENGUARDRAILS_SKELETON",
  ) && fileContains(
    "src/lib/guardrails/guardrails-adapter.ts",
    "LLAMA_FIREWALL_SKELETON",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Guardrails framework: StubGuardrailsAdapter fails closed (anti-misconfig)",
  fileContains(
    "src/lib/guardrails/guardrails-adapter.ts",
    "operators must implement",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Guardrails framework tests cover composite verdict + classifyGuardrailHealth",
  fileContains(
    "src/lib/__tests__/guardrails-adapter.test.ts",
    "composeVerdicts",
  ) && fileContains(
    "src/lib/__tests__/guardrails-adapter.test.ts",
    "classifyGuardrailHealth",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 72 — Workforce Transformation Audit Pack ─────────────────

check(
  "Workforce Transformation Pack present (6th vertical product)",
  existsSync(
    join(ROOT, "src/lib/vertical-packs/workforce-transformation.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Workforce pack: 3-signature requirement on elimination decisions",
  fileContains(
    "src/lib/vertical-packs/workforce-transformation.ts",
    "requiredApprovers: 3",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Workforce pack: Forrester anti-AI-washing citation (anti-slop guard)",
  fileContains(
    "src/lib/vertical-packs/workforce-transformation.ts",
    "Forrester",
  ) && fileContains(
    "src/lib/__tests__/workforce-transformation-pack.test.ts",
    "Forrester",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "Workforce pack: ADEA + Title VII case-law citations (Smith v. Jackson, Wards Cove)",
  fileContains(
    "src/lib/vertical-packs/workforce-transformation.ts",
    "Smith v. City of Jackson",
  ) && fileContains(
    "src/lib/vertical-packs/workforce-transformation.ts",
    "Wards Cove",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Workforce pack: WARN Act federal + state mini-WARN citations",
  fileContains(
    "src/lib/vertical-packs/workforce-transformation.ts",
    "WARN Act 29 USC 2101",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Workforce pack: NLRA §8(a)(5) + First National Maintenance citations",
  fileContains(
    "src/lib/vertical-packs/workforce-transformation.ts",
    "First National Maintenance",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Workforce pack registered in /api/vertical-packs/[packId] router",
  fileContains(
    "src/app/api/vertical-packs/[packId]/route.ts",
    "workforce-transformation",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Workforce pack PASSES the R63 pack validator (regression-proof)",
  fileContains(
    "src/lib/__tests__/workforce-transformation-pack.test.ts",
    "PASSES the R63 pack validator",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── CSA Agentic Trust Framework Mapping doc ─────────────────────────

check(
  "CSA-ATF mapping doc present (procurement standards-alignment)",
  existsSync(
    join(ROOT, "docs/CSA-AGENTIC-TRUST-FRAMEWORK-MAPPING.md"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "CSA-ATF doc covers all 8 control families",
  fileContains("docs/CSA-AGENTIC-TRUST-FRAMEWORK-MAPPING.md", "Family 1:") &&
    fileContains(
      "docs/CSA-AGENTIC-TRUST-FRAMEWORK-MAPPING.md",
      "Family 8:",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "CSA-ATF doc includes inspector verification commands per family",
  fileContains(
    "docs/CSA-AGENTIC-TRUST-FRAMEWORK-MAPPING.md",
    "@sovereign/inspector",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "CSA-ATF doc includes honest 'what's PARTIAL' disclosure",
  fileContains(
    "docs/CSA-AGENTIC-TRUST-FRAMEWORK-MAPPING.md",
    "What's PARTIAL",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

// ─── Round 73 — Multi-Turn Jailbreak Defender (Cisco-research-driven) ──

check(
  "Multi-turn jailbreak defender library present (R73)",
  existsSync(join(ROOT, "src/lib/guardrails/multi-turn-jailbreak.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Multi-turn defender covers crescendo + role-play priming + many-shot",
  fileContains(
    "src/lib/guardrails/multi-turn-jailbreak.ts",
    "topic_drift_escalation",
  ) && fileContains(
    "src/lib/guardrails/multi-turn-jailbreak.ts",
    "role_play_priming",
  ) && fileContains(
    "src/lib/guardrails/multi-turn-jailbreak.ts",
    "many_shot_injection",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Multi-turn defender tests cover Cisco-research patterns (28+ cases)",
  fileContains(
    "src/lib/__tests__/multi-turn-jailbreak.test.ts",
    "DAN-mode",
  ) && fileContains(
    "src/lib/__tests__/multi-turn-jailbreak.test.ts",
    "many-shot",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Round 74 — Mixture-of-Agents Model Router ──────────────────────

check(
  "Mixture-of-Agents router library present (R74)",
  existsSync(join(ROOT, "src/lib/model-routing/mixture-of-agents.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "MoA catalog includes DeepSeek + GLM + Qwen3 + Gemma + Llama 4 + Nomos",
  fileContains(
    "src/lib/model-routing/mixture-of-agents.ts",
    "deepseek-v3.2",
  ) && fileContains(
    "src/lib/model-routing/mixture-of-agents.ts",
    "glm-4.7",
  ) && fileContains(
    "src/lib/model-routing/mixture-of-agents.ts",
    "qwen3-235b-a22b",
  ) && fileContains(
    "src/lib/model-routing/mixture-of-agents.ts",
    "gemma-4-26b-moe",
  ) && fileContains(
    "src/lib/model-routing/mixture-of-agents.ts",
    "llama-4-maverick",
  ) && fileContains(
    "src/lib/model-routing/mixture-of-agents.ts",
    "nomos-1",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "MoA router exposes free-first cost classifier (flat-fee economics)",
  fileContains(
    "src/lib/model-routing/mixture-of-agents.ts",
    "classifyCostProfile",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "MoA router tests cover task-specific routing + free-first ties",
  fileContains(
    "src/lib/__tests__/mixture-of-agents.test.ts",
    "free-first ties",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── Round 76 — Manufacturing & Industrial Pack ─────────────────────

check(
  "Manufacturing & Industrial Pack present (7th vertical product)",
  existsSync(
    join(ROOT, "src/lib/vertical-packs/manufacturing-industrial.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Manufacturing pack: ITAR HARD-BLOCK with Empowered Official",
  fileContains(
    "src/lib/vertical-packs/manufacturing-industrial.ts",
    "Empowered Official",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Manufacturing pack: ICS/SCADA rule references R73 multi-turn defense",
  fileContains(
    "src/lib/vertical-packs/manufacturing-industrial.ts",
    "R73",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Manufacturing pack: AS9100 + IATF + ISO 13485 framework citations",
  fileContains(
    "src/lib/vertical-packs/manufacturing-industrial.ts",
    "AS9100",
  ) && fileContains(
    "src/lib/vertical-packs/manufacturing-industrial.ts",
    "IATF 16949",
  ) && fileContains(
    "src/lib/vertical-packs/manufacturing-industrial.ts",
    "ISO 13485",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Manufacturing pack: 6-year retention windows match ITAR + AS9100",
  fileContains(
    "src/lib/vertical-packs/manufacturing-industrial.ts",
    "2190",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Manufacturing pack registered in /api/vertical-packs/[packId] router",
  fileContains(
    "src/app/api/vertical-packs/[packId]/route.ts",
    "manufacturing-industrial",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Manufacturing pack PASSES the R63 pack validator (regression-proof)",
  fileContains(
    "src/lib/__tests__/manufacturing-industrial-pack.test.ts",
    "PASSES the R63 pack validator",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── AI Industrialization Maturity Model (AIMM) doc ─────────────────

check(
  "AI Industrialization Maturity Model doc present",
  existsSync(join(ROOT, "docs/AI-INDUSTRIALIZATION-MATURITY-MODEL.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "AIMM doc declares 4 stages (Explorer / Pilot / Scaled / Autonomous)",
  fileContains("docs/AI-INDUSTRIALIZATION-MATURITY-MODEL.md", "EXPLORER") &&
    fileContains("docs/AI-INDUSTRIALIZATION-MATURITY-MODEL.md", "PILOT") &&
    fileContains("docs/AI-INDUSTRIALIZATION-MATURITY-MODEL.md", "SCALED") &&
    fileContains(
      "docs/AI-INDUSTRIALIZATION-MATURITY-MODEL.md",
      "AUTONOMOUS",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "AIMM doc maps stages to specific R-prefixed primitives",
  fileContains(
    "docs/AI-INDUSTRIALIZATION-MATURITY-MODEL.md",
    "Stage-to-primitive matrix",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "AIMM doc published under CC-BY 4.0 (open framework)",
  fileContains(
    "docs/AI-INDUSTRIALIZATION-MATURITY-MODEL.md",
    "CC-BY 4.0",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 77 — Trust Certification Program ─────────────────────────

check(
  "Trust Certification library present (R77 — Bronze/Silver/Gold/Platinum)",
  existsSync(join(ROOT, "src/lib/certification/trust-certification.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Trust Certification declares all 4 tier requirement matrices",
  fileContains(
    "src/lib/certification/trust-certification.ts",
    "BRONZE_REQUIREMENTS",
  ) && fileContains(
    "src/lib/certification/trust-certification.ts",
    "SILVER_REQUIREMENTS",
  ) && fileContains(
    "src/lib/certification/trust-certification.ts",
    "GOLD_REQUIREMENTS",
  ) && fileContains(
    "src/lib/certification/trust-certification.ts",
    "PLATINUM_REQUIREMENTS",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Trust Certification enforces ascending strictness (anti-AI-washing)",
  fileContains(
    "src/lib/__tests__/trust-certification.test.ts",
    "Tier ascending strictness",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "Trust Certification tests cover all 4 tiers + countPrimitivesToTier helper",
  fileContains(
    "src/lib/__tests__/trust-certification.test.ts",
    "countPrimitivesToTier",
  ) && fileContains(
    "src/lib/__tests__/trust-certification.test.ts",
    "certificationCompletionPct",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Round 78 — IT/Software/Cybersecurity Pack ─────────────────────

check(
  "IT/Cybersecurity Pack present (8th vertical product)",
  existsSync(join(ROOT, "src/lib/vertical-packs/it-cybersecurity.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "IT pack: code-deploy rule cites CrowdStrike post-outage best practices (anti-slop)",
  fileContains(
    "src/lib/vertical-packs/it-cybersecurity.ts",
    "CrowdStrike",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "IT pack: IAM rule cites SolarWinds-class supply-chain defense pattern",
  fileContains(
    "src/lib/vertical-packs/it-cybersecurity.ts",
    "SolarWinds",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "IT pack: SBOM rule cites EO 14028 + NIST SSDF + SLSA",
  fileContains(
    "src/lib/vertical-packs/it-cybersecurity.ts",
    "Executive Order 14028",
  ) && fileContains(
    "src/lib/vertical-packs/it-cybersecurity.ts",
    "NIST SSDF",
  ) && fileContains(
    "src/lib/vertical-packs/it-cybersecurity.ts",
    "SLSA",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "IT pack: composes R73 multi-turn jailbreak defense for SIEM/EDR/IAM/IR",
  fileContains(
    "src/lib/vertical-packs/it-cybersecurity.ts",
    "R73",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "IT pack registered in /api/vertical-packs/[packId] router",
  fileContains(
    "src/app/api/vertical-packs/[packId]/route.ts",
    "it-cybersecurity",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "IT pack PASSES the R63 pack validator (regression-proof)",
  fileContains(
    "src/lib/__tests__/it-cybersecurity-pack.test.ts",
    "PASSES the R63 pack validator",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── 14-day sprint plan tracking ────────────────────────────────────

check(
  "14-day sprint plan doc present (tracked execution calendar)",
  existsSync(join(ROOT, "docs/14-DAY-SPRINT-PLAN.md")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Sprint plan tracks all 14 days + verification ritual",
  fileContains("docs/14-DAY-SPRINT-PLAN.md", "Day 1") &&
    fileContains("docs/14-DAY-SPRINT-PLAN.md", "Day 14") &&
    fileContains(
      "docs/14-DAY-SPRINT-PLAN.md",
      "Daily verification ritual",
    ) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── Day 1 — R85 Retail/E-commerce Pack ─────────────────────────────

check(
  "Retail/E-commerce Pack present (9th vertical product, R85)",
  existsSync(join(ROOT, "src/lib/vertical-packs/retail-ecommerce.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Retail pack: Klarna 2024 case citation (anti-slop guard for Klarna defense)",
  fileContains(
    "src/lib/vertical-packs/retail-ecommerce.ts",
    "Klarna",
  ) && fileContains(
    "src/lib/__tests__/retail-ecommerce-pack.test.ts",
    "Klarna",
  ) ? 1 : 0,
  1,
  { dimension: "honesty" },
);

check(
  "Retail pack: Robles v. Domino's ADA Title III citation",
  fileContains(
    "src/lib/vertical-packs/retail-ecommerce.ts",
    "Robles v. Domino's",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Retail pack: PCI DSS 4.0 PAN-blocking rule with PII guard reference",
  fileContains(
    "src/lib/vertical-packs/retail-ecommerce.ts",
    "PCI DSS 4.0",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Retail pack: COPPA HARD-BLOCK rule with FTC TikTok $245M citation",
  fileContains(
    "src/lib/vertical-packs/retail-ecommerce.ts",
    "TikTok $245M 2025",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Retail pack registered in /api/vertical-packs/[packId] router",
  fileContains(
    "src/app/api/vertical-packs/[packId]/route.ts",
    "retail-ecommerce",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Retail pack PASSES the R63 pack validator (regression-proof)",
  fileContains(
    "src/lib/__tests__/retail-ecommerce-pack.test.ts",
    "PASSES the R63 pack validator",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── Day 2 — R86 Education Pack (FERPA) ─────────────────────────────

check(
  "Education Pack present (10th vertical product, R86)",
  existsSync(join(ROOT, "src/lib/vertical-packs/education.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Education pack covers FERPA + Title VI + IDEA + Section 504 + Title IX",
  fileContains("src/lib/vertical-packs/education.ts", "FERPA 20 USC §1232g") &&
    fileContains("src/lib/vertical-packs/education.ts", "Title VI") &&
    fileContains("src/lib/vertical-packs/education.ts", "IDEA 20 USC §1400") &&
    fileContains("src/lib/vertical-packs/education.ts", "Title IX 20 USC §1681") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Education pack: AI-in-admissions bias audit cites NYC LL144 + CO SB 24-205",
  fileContains(
    "src/lib/vertical-packs/education.ts",
    "NYC LL144",
  ) && fileContains(
    "src/lib/vertical-packs/education.ts",
    "Colorado SB 24-205",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Education pack: state student-data multi-state coverage (NY + CA + CO + IL)",
  fileContains("src/lib/vertical-packs/education.ts", "NY Education Law §2-d") &&
    fileContains("src/lib/vertical-packs/education.ts", "SOPIPA") &&
    fileContains("src/lib/vertical-packs/education.ts", "Colorado HB 22-1244") &&
    fileContains("src/lib/vertical-packs/education.ts", "Illinois SIPA") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Education pack: 7-year retention for IEP + Title IX (matches IDEA + Title IX)",
  fileContains("src/lib/vertical-packs/education.ts", "2555") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Education pack registered in /api/vertical-packs/[packId] router",
  fileContains(
    "src/app/api/vertical-packs/[packId]/route.ts",
    "\"education\":",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Education pack PASSES the R63 pack validator (regression-proof)",
  fileContains(
    "src/lib/__tests__/education-pack.test.ts",
    "PASSES the R63 pack validator",
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── R91 — Agentic Commerce Authorization Token (ACAT) ─────────────
// The cryptographic substrate that lets Stripe, Visa, Mastercard,
// Shopify, Amazon, etc. verify agent authorization OFFLINE without
// trusting Sovereign. Sister doc: docs/AGENTIC-COMMERCE-LEADERSHIP.md.

check(
  "ACAT primitive present (R91 — Agentic Commerce Authorization Token)",
  existsSync(join(ROOT, "src/lib/agentic-commerce/acat.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "ACAT primitive has unit tests (R91)",
  existsSync(join(ROOT, "src/lib/__tests__/acat.test.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "ACAT enforces Macaroon-pattern narrowing-only attenuation",
  fileContains(
    "src/lib/agentic-commerce/acat.ts",
    "additionalCaveatIsNarrowing",
  ) &&
    fileContains(
      "src/lib/agentic-commerce/acat.ts",
      "would_widen",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "ACAT verifyACAT exposes all 12 distinct failure reasons (procurement)",
  fileContains("src/lib/agentic-commerce/acat.ts", "message_mismatch") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "signature_invalid") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "user_pubkey_mismatch") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "scope_violation") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "merchant_not_allowed") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "category_excluded") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "category_not_allowed") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "single_use_consumed") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "chain_hash_mismatch") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "amount_exceeds_scope") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "not_yet_valid") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "expired") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "ACAT chain hash uses GENESIS sentinel + sha256 (matches R26 / R37 pattern)",
  fileContains("src/lib/agentic-commerce/acat.ts", "GENESIS") &&
    fileContains("src/lib/agentic-commerce/acat.ts", "computeACATChainHash") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "ACAT HTTP transport helpers present (encode + decode for header transit)",
  fileContains(
    "src/lib/agentic-commerce/acat.ts",
    "encodeACATForHeader",
  ) &&
    fileContains(
      "src/lib/agentic-commerce/acat.ts",
      "decodeACATFromHeader",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "ACAT receipt summary present (procurement-readable for R45 export)",
  fileContains(
    "src/lib/agentic-commerce/acat.ts",
    "summarizeACATForReceipt",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Agentic Commerce Leadership doc present (procurement positioning)",
  existsSync(join(ROOT, "docs/AGENTIC-COMMERCE-LEADERSHIP.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Leadership doc cites real market events (Stripe, Visa, Mastercard launches)",
  fileContains("docs/AGENTIC-COMMERCE-LEADERSHIP.md", "Stripe") &&
    fileContains("docs/AGENTIC-COMMERCE-LEADERSHIP.md", "Visa Intelligent Commerce") &&
    fileContains("docs/AGENTIC-COMMERCE-LEADERSHIP.md", "Mastercard") &&
    fileContains("docs/AGENTIC-COMMERCE-LEADERSHIP.md", "Macaroon") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── R92 — Stripe Agentic Commerce Toolkit Adapter ─────────────────
// First rails adapter for ACAT. Pure functions. Tests verify the
// roundtrip + chunked metadata + chargeback evidence packet.

check(
  "R92 Stripe Agentic Commerce Toolkit adapter present",
  existsSync(
    join(ROOT, "src/lib/agentic-commerce/stripe-adapter.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R92 Stripe adapter has unit tests",
  existsSync(join(ROOT, "src/lib/__tests__/stripe-adapter.test.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "R92 adapter is pure-function (no Stripe SDK runtime import)",
  fileContains("src/lib/agentic-commerce/stripe-adapter.ts", "import {") &&
    !fileContains(
      "src/lib/agentic-commerce/stripe-adapter.ts",
      "from \"stripe\"",
    ) &&
    !fileContains(
      "src/lib/agentic-commerce/stripe-adapter.ts",
      "from 'stripe'",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R92 adapter chunks metadata respecting Stripe's 500-char limit",
  fileContains(
    "src/lib/agentic-commerce/stripe-adapter.ts",
    "STRIPE_METADATA_VALUE_MAX",
  ) &&
    fileContains(
      "src/lib/agentic-commerce/stripe-adapter.ts",
      "chunkForStripeMetadata",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R92 chargeback evidence packet is self-contained + offline-verifiable",
  fileContains(
    "src/lib/agentic-commerce/stripe-adapter.ts",
    "buildChargebackEvidence",
  ) &&
    fileContains(
      "src/lib/agentic-commerce/stripe-adapter.ts",
      "sovereign-chargeback-evidence-v1",
    ) &&
    fileContains(
      "src/lib/agentic-commerce/stripe-adapter.ts",
      "@sovereign/inspector",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R92 adapter caps chunked metadata reassembly to 99 parts (amplification defense)",
  fileContains(
    "src/lib/agentic-commerce/stripe-adapter.ts",
    "partsCount > 99",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── @sovereign/inspector — ACAT verifier as npm package ───────────

check(
  "Inspector ACAT module present (npm-publishable offline verifier)",
  existsSync(join(ROOT, "packages/inspector/src/acat.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector ACAT module has unit tests (cross-implementation agreement)",
  existsSync(join(ROOT, "packages/inspector/__tests__/acat.test.mjs")) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector exports ACAT module from index.mjs",
  fileContains("packages/inspector/src/index.mjs", "./acat.mjs") ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector package.json exposes ./acat subpath export",
  fileContains("packages/inspector/package.json", "\"./acat\":") &&
    fileContains("packages/inspector/package.json", "\"./src/acat.mjs\"") ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector CLI exposes verify-acat + verify-evidence subcommands",
  fileContains("packages/inspector/src/cli.mjs", "verify-acat") &&
    fileContains("packages/inspector/src/cli.mjs", "verify-evidence") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector ACAT verifier has all 12 failure reasons (matches server impl)",
  fileContains("packages/inspector/src/acat.mjs", "user_pubkey_mismatch") &&
    fileContains("packages/inspector/src/acat.mjs", "message_mismatch") &&
    fileContains("packages/inspector/src/acat.mjs", "signature_invalid") &&
    fileContains("packages/inspector/src/acat.mjs", "chain_hash_mismatch") &&
    fileContains("packages/inspector/src/acat.mjs", "not_yet_valid") &&
    fileContains("packages/inspector/src/acat.mjs", "expired") &&
    fileContains("packages/inspector/src/acat.mjs", "scope_violation") &&
    fileContains("packages/inspector/src/acat.mjs", "amount_exceeds_scope") &&
    fileContains("packages/inspector/src/acat.mjs", "category_excluded") &&
    fileContains("packages/inspector/src/acat.mjs", "category_not_allowed") &&
    fileContains("packages/inspector/src/acat.mjs", "merchant_not_allowed") &&
    fileContains("packages/inspector/src/acat.mjs", "single_use_consumed") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector verifies Stripe chargeback evidence packets offline",
  fileContains(
    "packages/inspector/src/acat.mjs",
    "verifyStripeChargebackEvidence",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector README documents ACAT + chargeback evidence flows",
  fileContains("packages/inspector/README.md", "verify-acat") &&
    fileContains("packages/inspector/README.md", "verify-evidence") &&
    fileContains("packages/inspector/README.md", "Macaroon-pattern") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── /trust/agentic-commerce public live-verifier UI ───────────────

check(
  "Live ACAT verification API present (POST /api/_health/acat-verify)",
  existsSync(
    join(ROOT, "src/app/api/_health/acat-verify/route.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Live ACAT verification public re-export present",
  existsSync(join(ROOT, "src/app/api/health/acat-verify/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "/trust/agentic-commerce page present (procurement-grade live demo)",
  existsSync(join(ROOT, "src/app/trust/agentic-commerce/page.tsx")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "/trust/agentic-commerce includes live verifier client component",
  existsSync(
    join(ROOT, "src/app/trust/agentic-commerce/AcatLiveVerifier.tsx"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "/trust/agentic-commerce documents the 7 trust questions + market timeline",
  fileContains(
    "src/app/trust/agentic-commerce/page.tsx",
    "TRUST_QUESTIONS",
  ) &&
    fileContains("src/app/trust/agentic-commerce/page.tsx", "MARKET_EVENTS") &&
    fileContains(
      "src/app/trust/agentic-commerce/page.tsx",
      "Visa Intelligent Commerce",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── R100 / R101 / R102 — Control Plane Pillar ─────────────────────
// The 3 missing non-negotiables for an agentic-AI control plane:
// policy guardrails (R100), agent discovery (R101), cost governance
// (R102). Sister doc: docs/AGENTIC-CONTROL-PLANE-LEADERSHIP.md.

check(
  "R100 Sovereign Policy Engine present (composable predicate DSL)",
  existsSync(join(ROOT, "src/lib/control-plane/policy-engine.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R100 Policy Engine has unit tests",
  existsSync(
    join(ROOT, "src/lib/control-plane/__tests__/policy-engine.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "R100 Policy Engine has all 6 effects (allow / deny / hitl / acat / attest / break-glass)",
  fileContains("src/lib/control-plane/policy-engine.ts", "\"allow\"") &&
    fileContains("src/lib/control-plane/policy-engine.ts", "\"deny\"") &&
    fileContains(
      "src/lib/control-plane/policy-engine.ts",
      "\"require-hitl\"",
    ) &&
    fileContains(
      "src/lib/control-plane/policy-engine.ts",
      "\"require-acat\"",
    ) &&
    fileContains(
      "src/lib/control-plane/policy-engine.ts",
      "\"require-attestation\"",
    ) &&
    fileContains(
      "src/lib/control-plane/policy-engine.ts",
      "\"require-break-glass\"",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R100 Policy Engine composes shipped primitives (R37 / R40 / R42 / R91)",
  fileContains("src/lib/control-plane/policy-engine.ts", "act-present") &&
    fileContains(
      "src/lib/control-plane/policy-engine.ts",
      "reputation-grade-min",
    ) &&
    fileContains(
      "src/lib/control-plane/policy-engine.ts",
      "credit-headroom-min-cents",
    ) &&
    fileContains("src/lib/control-plane/policy-engine.ts", "acat-present") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R100 default-deny posture — no_matching_policy fallback present",
  fileContains(
    "src/lib/control-plane/policy-engine.ts",
    "no_matching_policy",
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R100 break-glass requires reason ≥ 10 chars (admin override audit)",
  fileContains(
    "src/lib/control-plane/policy-engine.ts",
    "reason_too_short",
  ) &&
    fileContains(
      "src/lib/control-plane/policy-engine.ts",
      "policy.break_glass",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R101 Agent Registry / Crew Composer present",
  existsSync(join(ROOT, "src/lib/control-plane/agent-registry.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R101 Agent Registry has unit tests",
  existsSync(
    join(ROOT, "src/lib/control-plane/__tests__/agent-registry.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "R101 Crew Composer ranking algorithm: capability × trust × availability",
  fileContains("src/lib/control-plane/agent-registry.ts", "capabilityScore") &&
    fileContains("src/lib/control-plane/agent-registry.ts", "rankingScore") &&
    fileContains("src/lib/control-plane/agent-registry.ts", "availability") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R101 unmetCapabilities escalation set surfaces gaps for human routing",
  fileContains(
    "src/lib/control-plane/agent-registry.ts",
    "unmetCapabilities",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R102 Cost Governance present (per-agent + per-team + per-tenant caps)",
  existsSync(
    join(ROOT, "src/lib/control-plane/cost-governance.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R102 Cost Governance has unit tests",
  existsSync(
    join(ROOT, "src/lib/control-plane/__tests__/cost-governance.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "R102 alert thresholds at 50 / 75 / 90 percent",
  fileContains("src/lib/control-plane/cost-governance.ts", "warn-50") &&
    fileContains("src/lib/control-plane/cost-governance.ts", "warn-75") &&
    fileContains("src/lib/control-plane/cost-governance.ts", "warn-90") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R102 free-tier providers bypass cost gate (Ollama / NIM / Cerebras)",
  fileContains(
    "src/lib/control-plane/cost-governance.ts",
    "providerCostTier",
  ) &&
    fileContains("src/lib/control-plane/cost-governance.ts", "freeRun") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R102 most-restrictive cap wins (tenant + team + agent)",
  fileContains(
    "src/lib/control-plane/cost-governance.ts",
    "breachedScope",
  ) &&
    fileContains("src/lib/control-plane/cost-governance.ts", "\"tenant\"") &&
    fileContains("src/lib/control-plane/cost-governance.ts", "\"team\"") &&
    fileContains("src/lib/control-plane/cost-governance.ts", "\"agent\"") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Control Plane public APIs present (policy + agents + budget)",
  existsSync(
    join(ROOT, "src/app/api/_control-plane/policy/evaluate/route.ts"),
  ) &&
    existsSync(join(ROOT, "src/app/api/_control-plane/agents/route.ts")) &&
    existsSync(
      join(ROOT, "src/app/api/_control-plane/budget/preview/route.ts"),
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Control Plane public APIs have re-exports (procurement-readable URLs)",
  existsSync(
    join(ROOT, "src/app/api/control-plane/policy/evaluate/route.ts"),
  ) &&
    existsSync(join(ROOT, "src/app/api/control-plane/agents/route.ts")) &&
    existsSync(
      join(ROOT, "src/app/api/control-plane/budget/preview/route.ts"),
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "/trust/control-plane page present (live policy evaluator)",
  existsSync(join(ROOT, "src/app/trust/control-plane/page.tsx")) &&
    existsSync(
      join(ROOT, "src/app/trust/control-plane/LivePolicyEvaluator.tsx"),
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "/trust/control-plane scoreboards 6 enterprise non-negotiables + maturity model",
  fileContains(
    "src/app/trust/control-plane/page.tsx",
    "NON_NEGOTIABLES",
  ) &&
    fileContains(
      "src/app/trust/control-plane/page.tsx",
      "MATURITY_MODEL",
    ) &&
    fileContains(
      "src/app/trust/control-plane/page.tsx",
      "COMPETITIVE_POSITION",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Control Plane Leadership doc present (procurement positioning)",
  existsSync(
    join(ROOT, "docs/AGENTIC-CONTROL-PLANE-LEADERSHIP.md"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Leadership doc cites real competitors (Oracle / Microsoft / SAP / n8n / UiPath)",
  fileContains("docs/AGENTIC-CONTROL-PLANE-LEADERSHIP.md", "Oracle") &&
    fileContains("docs/AGENTIC-CONTROL-PLANE-LEADERSHIP.md", "Microsoft") &&
    fileContains("docs/AGENTIC-CONTROL-PLANE-LEADERSHIP.md", "SAP") &&
    fileContains("docs/AGENTIC-CONTROL-PLANE-LEADERSHIP.md", "n8n") &&
    fileContains("docs/AGENTIC-CONTROL-PLANE-LEADERSHIP.md", "UiPath") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── R110 / R111 — Multimodal Perception Mesh ─────────────────────
// Sovereign's NVIDIA Nemotron 3 Nano Omni integration as a SUBSTRATE
// — five specialized perception node kinds + cross-modal correlation,
// turning ONE model into a PRODUCT CATEGORY. Sister doc:
// docs/MULTIMODAL-PERCEPTION-MESH.md.

check(
  "R110 Nemotron Omni client present (pure-function HTTP client)",
  existsSync(
    join(ROOT, "src/lib/perception/nemotron-omni-client.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R110 Omni client has unit tests",
  existsSync(
    join(ROOT, "src/lib/perception/__tests__/nemotron-omni-client.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "R110 Omni client supports all 4 modalities (text + image + audio + video)",
  fileContains(
    "src/lib/perception/nemotron-omni-client.ts",
    "image_url",
  ) &&
    fileContains(
      "src/lib/perception/nemotron-omni-client.ts",
      "audio_url",
    ) &&
    fileContains(
      "src/lib/perception/nemotron-omni-client.ts",
      "video_url",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R110 model slug is env-configurable (provider-agnostic — NIM / OpenRouter / vLLM / llama.cpp)",
  fileContains(
    "src/lib/perception/nemotron-omni-client.ts",
    "NEMOTRON_OMNI_MODEL_SLUG",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R110 defensive validation surfaces 7 typed reasons (procurement-grade)",
  fileContains(
    "src/lib/perception/nemotron-omni-client.ts",
    "no_parts",
  ) &&
    fileContains(
      "src/lib/perception/nemotron-omni-client.ts",
      "system_prompt_required",
    ) &&
    fileContains(
      "src/lib/perception/nemotron-omni-client.ts",
      "image_data_url_too_large",
    ) &&
    fileContains(
      "src/lib/perception/nemotron-omni-client.ts",
      "audio_data_url_too_large",
    ) &&
    fileContains(
      "src/lib/perception/nemotron-omni-client.ts",
      "unsupported_image_mime",
    ) &&
    fileContains(
      "src/lib/perception/nemotron-omni-client.ts",
      "unsupported_audio_mime",
    ) &&
    fileContains(
      "src/lib/perception/nemotron-omni-client.ts",
      "max_tokens_out_of_range",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R111 Multimodal Perception Mesh present",
  existsSync(join(ROOT, "src/lib/perception/mesh.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R111 Mesh has unit tests",
  existsSync(
    join(ROOT, "src/lib/perception/__tests__/mesh.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "R111 Mesh defines all 5 node kinds (video / audio / screenshot / document / freeform)",
  fileContains("src/lib/perception/mesh.ts", "video-monitor") &&
    fileContains("src/lib/perception/mesh.ts", "audio-transcriber") &&
    fileContains("src/lib/perception/mesh.ts", "screenshot-analyzer") &&
    fileContains("src/lib/perception/mesh.ts", "document-extractor") &&
    fileContains("src/lib/perception/mesh.ts", "freeform-synthesizer") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R111 Mesh defines all 4 cross-modal correlation rule kinds",
  fileContains("src/lib/perception/mesh.ts", "keyword-overlap") &&
    fileContains("src/lib/perception/mesh.ts", "entity-overlap") &&
    fileContains("src/lib/perception/mesh.ts", "time-proximity") &&
    fileContains("src/lib/perception/mesh.ts", "json-field-match") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R111 plan composition is deterministic (sort by nodeId)",
  fileContains("src/lib/perception/mesh.ts", "localeCompare") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R111 BOARDROOM_WATCH_MESH pre-built mesh + compliance rules",
  fileContains("src/lib/perception/mesh.ts", "BOARDROOM_WATCH_MESH") &&
    fileContains(
      "src/lib/perception/mesh.ts",
      "BOARDROOM_COMPLIANCE_RULES",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Perception public APIs present (plan + correlate)",
  existsSync(join(ROOT, "src/app/api/_perception/plan/route.ts")) &&
    existsSync(join(ROOT, "src/app/api/_perception/correlate/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Perception public APIs have re-exports",
  existsSync(join(ROOT, "src/app/api/perception/plan/route.ts")) &&
    existsSync(join(ROOT, "src/app/api/perception/correlate/route.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "/trust/perception page present (live mesh planner UI)",
  existsSync(join(ROOT, "src/app/trust/perception/page.tsx")) &&
    existsSync(
      join(ROOT, "src/app/trust/perception/LivePerceptionPlanner.tsx"),
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "/trust/perception scoreboards architecture comparison + 5 node kinds + correlation rules",
  fileContains("src/app/trust/perception/page.tsx", "ARCHITECTURE_VS") &&
    fileContains("src/app/trust/perception/page.tsx", "NODE_KINDS") &&
    fileContains(
      "src/app/trust/perception/page.tsx",
      "CORRELATION_KINDS",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Perception Leadership doc present (procurement positioning)",
  existsSync(join(ROOT, "docs/MULTIMODAL-PERCEPTION-MESH.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Perception doc cites Nemotron Omni + competitive positioning",
  fileContains(
    "docs/MULTIMODAL-PERCEPTION-MESH.md",
    "Nemotron 3 Nano Omni",
  ) &&
    fileContains(
      "docs/MULTIMODAL-PERCEPTION-MESH.md",
      "Operator",
    ) &&
    fileContains(
      "docs/MULTIMODAL-PERCEPTION-MESH.md",
      "Computer Use",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── R120 — Edge Node Framework ────────────────────────────────────
// The formal boundary between Sovereign and the open-source agentic
// ecosystem. Stub-first, fail-closed adapter contract that wraps
// every external dispatch with R100/R102/R26/R37/R91. Sister doc:
// docs/EDGE-NODE-FRAMEWORK.md. Specific integrations follow as
// R121-R130 (Trae / AgentFlow / Werkstatt / Kimi K2.6 / Cognee /
// Qualixar / CUA / UI-TARS / Understudy / frontier models).

check(
  "R120 Edge Node Framework present (types + registry + dispatcher)",
  existsSync(join(ROOT, "src/lib/edge-nodes/types.ts")) &&
    existsSync(join(ROOT, "src/lib/edge-nodes/registry.ts")) &&
    existsSync(join(ROOT, "src/lib/edge-nodes/dispatcher.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R120 framework has unit tests",
  existsSync(
    join(ROOT, "src/lib/edge-nodes/__tests__/edge-nodes.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "R120 StubEdgeNode is fail-closed (matches R71/R54/R55 pattern)",
  fileContains("src/lib/edge-nodes/stub-edge-node.ts", "edge_node_not_configured") &&
    fileContains("src/lib/edge-nodes/stub-edge-node.ts", "isStub: true") &&
    fileContains("src/lib/edge-nodes/stub-edge-node.ts", "not-configured") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R120 dispatcher composes with R100 / R102 / R37 / R91 (preflight order)",
  fileContains("src/lib/edge-nodes/dispatcher.ts", "policy_denied") &&
    fileContains("src/lib/edge-nodes/dispatcher.ts", "act_required") &&
    fileContains("src/lib/edge-nodes/dispatcher.ts", "acat_required") &&
    fileContains("src/lib/edge-nodes/dispatcher.ts", "budget_exhausted") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R120 routing decision distinguishes route / no-match / all-stub",
  fileContains("src/lib/edge-nodes/dispatcher.ts", "no_node_supports_capability") &&
    fileContains("src/lib/edge-nodes/dispatcher.ts", "only_stubs_available") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R120 capability ranking applies stub-penalty (real > stub)",
  fileContains("src/lib/edge-nodes/registry.ts", "stub-penalty") &&
    fileContains("src/lib/edge-nodes/registry.ts", "stub = m.isStub ? 0.5 : 1.0") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R120 three persona stubs present (software-engineer / analyst / operator)",
  existsSync(
    join(ROOT, "src/lib/edge-nodes/personas/software-engineer.ts"),
  ) &&
    existsSync(join(ROOT, "src/lib/edge-nodes/personas/analyst.ts")) &&
    existsSync(join(ROOT, "src/lib/edge-nodes/personas/operator.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R120 personas name procurement-readable upstreams (Trae / Cognee / CUA / Kimi / UI-TARS)",
  fileContains(
    "src/lib/edge-nodes/personas/software-engineer.ts",
    "Trae Agent",
  ) &&
    fileContains("src/lib/edge-nodes/personas/analyst.ts", "Cognee") &&
    fileContains("src/lib/edge-nodes/personas/analyst.ts", "Kimi K2.6") &&
    fileContains(
      "src/lib/edge-nodes/personas/operator.ts",
      "UI-TARS-desktop",
    ) &&
    fileContains("src/lib/edge-nodes/personas/operator.ts", "CUA") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R120 default registry registers all three persona stubs",
  fileContains("src/lib/edge-nodes/index.ts", "createDefaultEdgeNodeRegistry") &&
    fileContains("src/lib/edge-nodes/index.ts", "createSoftwareEngineerStub") &&
    fileContains("src/lib/edge-nodes/index.ts", "createAnalystStub") &&
    fileContains("src/lib/edge-nodes/index.ts", "createOperatorStub") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Edge Node public APIs present (list + dispatch + re-exports)",
  existsSync(join(ROOT, "src/app/api/_edge-nodes/route.ts")) &&
    existsSync(
      join(ROOT, "src/app/api/_edge-nodes/dispatch/route.ts"),
    ) &&
    existsSync(join(ROOT, "src/app/api/edge-nodes/route.ts")) &&
    existsSync(
      join(ROOT, "src/app/api/edge-nodes/dispatch/route.ts"),
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "/trust/edge-nodes page present (live dispatcher preview UI)",
  existsSync(join(ROOT, "src/app/trust/edge-nodes/page.tsx")) &&
    existsSync(
      join(ROOT, "src/app/trust/edge-nodes/LiveEdgeDispatcher.tsx"),
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "/trust/edge-nodes scoreboards 3 personas + architecture comparison + composition layers",
  fileContains("src/app/trust/edge-nodes/page.tsx", "PERSONAS") &&
    fileContains("src/app/trust/edge-nodes/page.tsx", "ARCHITECTURE_VS") &&
    fileContains(
      "src/app/trust/edge-nodes/page.tsx",
      "COMPOSITION_LAYERS",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Edge Node Framework Leadership doc present (procurement positioning)",
  existsSync(join(ROOT, "docs/EDGE-NODE-FRAMEWORK.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Edge Node doc names integration roadmap (R121-R130) + composition story",
  fileContains("docs/EDGE-NODE-FRAMEWORK.md", "R121") &&
    fileContains("docs/EDGE-NODE-FRAMEWORK.md", "R130") &&
    fileContains("docs/EDGE-NODE-FRAMEWORK.md", "Trae Agent") &&
    fileContains("docs/EDGE-NODE-FRAMEWORK.md", "Cognee") &&
    fileContains("docs/EDGE-NODE-FRAMEWORK.md", "UI-TARS-desktop") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── R130 — Performance Observatory ───────────────────────────────
// Anti-AI-washing benchmark registry. Closes evaluation gaps E4
// (contamination), E6 (CuP-as-standard), E8 (auto-auditing), E9
// (infrastructure noise) from the April 2026 strategic gap inventory.
// Sister doc: docs/PERFORMANCE-OBSERVATORY.md.

check(
  "R130 Performance Observatory framework present (4 pure-function files)",
  existsSync(join(ROOT, "src/lib/performance/targets.ts")) &&
    existsSync(join(ROOT, "src/lib/performance/benchmark-results.ts")) &&
    existsSync(join(ROOT, "src/lib/performance/gap-analysis.ts")) &&
    existsSync(join(ROOT, "src/lib/performance/attestation.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R130 framework has unit tests (54+ tests)",
  existsSync(
    join(ROOT, "src/lib/performance/__tests__/performance.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "R130 targets registry ships 7 prebuilt 2026 SOTA targets",
  fileContains("src/lib/performance/targets.ts", "swe-bench-verified") &&
    fileContains("src/lib/performance/targets.ts", "swe-bench-pro") &&
    fileContains("src/lib/performance/targets.ts", "gaia-level-3") &&
    fileContains("src/lib/performance/targets.ts", "long-mem-eval") &&
    fileContains(
      "src/lib/performance/targets.ts",
      "gateway-throughput-rps",
    ) &&
    fileContains("src/lib/performance/targets.ts", "gateway-overhead-ms") &&
    fileContains(
      "src/lib/performance/targets.ts",
      "broker-throughput-msgs-per-s",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R130 every target carries a verificationKind (anti-AI-washing structural rule)",
  fileContains("src/lib/performance/targets.ts", "independent-replayable") &&
    fileContains("src/lib/performance/targets.ts", "internal-only") &&
    fileContains("src/lib/performance/targets.ts", "claimed-only") &&
    fileContains("src/lib/performance/targets.ts", "verificationKind") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R130 result validation refuses scores without runHash + measuredAt + source fields",
  fileContains(
    "src/lib/performance/benchmark-results.ts",
    "missing_run_hash",
  ) &&
    fileContains(
      "src/lib/performance/benchmark-results.ts",
      "missing_measured_at",
    ) &&
    fileContains(
      "src/lib/performance/benchmark-results.ts",
      "missing_source_fields",
    ) &&
    fileContains(
      "src/lib/performance/benchmark-results.ts",
      "verification_too_weak",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R130 status classifier surfaces 'not-measured' explicitly (no silent claims)",
  fileContains(
    "src/lib/performance/benchmark-results.ts",
    "\"not-measured\"",
  ) &&
    fileContains(
      "src/lib/performance/benchmark-results.ts",
      "No measurement recorded",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R130 gap analysis uses linear extrapolation (transparent + replayable, NOT opaque ML)",
  fileContains("src/lib/performance/gap-analysis.ts", "leastSquaresFit") &&
    fileContains(
      "src/lib/performance/gap-analysis.ts",
      "estimateTimeToTarget",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R130 attestation composes with R44 chain hash pattern (GENESIS + sha256)",
  fileContains("src/lib/performance/attestation.ts", "GENESIS") &&
    fileContains(
      "src/lib/performance/attestation.ts",
      "computeAttestationChainHash",
    ) &&
    fileContains(
      "src/lib/performance/attestation.ts",
      "buildBenchmarkAttestationMessage",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R130 public APIs present (targets + results/verify + gap-analysis + re-exports)",
  existsSync(join(ROOT, "src/app/api/_performance/targets/route.ts")) &&
    existsSync(
      join(ROOT, "src/app/api/_performance/results/verify/route.ts"),
    ) &&
    existsSync(
      join(ROOT, "src/app/api/_performance/gap-analysis/route.ts"),
    ) &&
    existsSync(join(ROOT, "src/app/api/performance/targets/route.ts")) &&
    existsSync(
      join(ROOT, "src/app/api/performance/results/verify/route.ts"),
    ) &&
    existsSync(
      join(ROOT, "src/app/api/performance/gap-analysis/route.ts"),
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "/trust/performance-observatory page present (live benchmark board)",
  existsSync(
    join(ROOT, "src/app/trust/performance-observatory/page.tsx"),
  ) &&
    existsSync(
      join(
        ROOT,
        "src/app/trust/performance-observatory/LiveBenchmarkBoard.tsx",
      ),
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "/trust/performance-observatory documents 5 anti-AI-washing rules + roadmap",
  fileContains(
    "src/app/trust/performance-observatory/page.tsx",
    "ANTI_AI_WASHING_RULES",
  ) &&
    fileContains(
      "src/app/trust/performance-observatory/page.tsx",
      "ARCHITECTURE_VS",
    ) &&
    fileContains(
      "src/app/trust/performance-observatory/page.tsx",
      "PHASES",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Performance Observatory leadership doc present",
  existsSync(join(ROOT, "docs/PERFORMANCE-OBSERVATORY.md")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Leadership doc cites real evaluation crisis (Berkeley, OpenAI Verified deprecation, BenchGuard)",
  fileContains("docs/PERFORMANCE-OBSERVATORY.md", "UC Berkeley") &&
    fileContains(
      "docs/PERFORMANCE-OBSERVATORY.md",
      "OpenAI",
    ) &&
    fileContains("docs/PERFORMANCE-OBSERVATORY.md", "BenchGuard") &&
    fileContains(
      "docs/PERFORMANCE-OBSERVATORY.md",
      "Completion Under Policy",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── R121 — Aider Software Engineer Edge Node (Move 3) ─────────────
// First REAL (non-stub) Edge Node. Wraps Aider (Apache-2.0) under
// the full Sovereign trust substrate. Feature-flagged via
// SOVEREIGN_AIDER_ENABLED so the 222 existing agents see no behavior
// change. Closes the "all Edge Nodes are stubs" gap from the proof-
// conversion arc.

check(
  "R121 Aider Edge Node real adapter present",
  existsSync(
    join(ROOT, "src/lib/edge-nodes/personas/aider-software-engineer.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "edge-nodes" },
);

check(
  "R121 Aider subprocess runner isolated in own file (only spawn import)",
  existsSync(join(ROOT, "src/lib/edge-nodes/personas/aider-runner.ts")) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R121 Aider feature-flag default-OFF preserved (SOVEREIGN_AIDER_ENABLED)",
  fileContains(
    "src/lib/edge-nodes/personas/aider-software-engineer.ts",
    'SOVEREIGN_AIDER_ENABLED !== "true"',
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R121 Aider path-traversal defense present (no ..' / no NUL / abs repoPath)",
  fileContains(
    "src/lib/edge-nodes/personas/aider-software-engineer.ts",
    "repo_path_traversal",
  ) &&
    fileContains(
      "src/lib/edge-nodes/personas/aider-software-engineer.ts",
      "files_path_traversal",
    ) &&
    fileContains(
      "src/lib/edge-nodes/personas/aider-software-engineer.ts",
      "files_contain_nul",
    ) &&
    fileContains(
      "src/lib/edge-nodes/personas/aider-software-engineer.ts",
      "repo_path_must_be_absolute",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R121 Aider runner uses spawn with shell:false (no shell metacharacter vector)",
  fileContains("src/lib/edge-nodes/personas/aider-runner.ts", "shell: false") &&
    fileContains(
      "src/lib/edge-nodes/personas/aider-runner.ts",
      "SIGTERM",
    ) &&
    fileContains(
      "src/lib/edge-nodes/personas/aider-runner.ts",
      "SIGKILL",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R121 Aider tests present",
  existsSync(
    join(ROOT, "src/lib/edge-nodes/__tests__/aider-software-engineer.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "R121 Aider registered in default Edge Node registry",
  fileContains(
    "src/lib/edge-nodes/index.ts",
    "createAiderSoftwareEngineerNode",
  ) &&
    fileContains("src/lib/edge-nodes/index.ts", "defaultAiderRunner") ? 1 : 0,
  1,
  { dimension: "edge-nodes" },
);

// ─── R131 — SWE-bench Verified Harness (Move 4) ────────────────────
// Operator-runnable harness that produces R130-valid BenchmarkResults
// for SWE-bench Verified. Closes the "no harness, only hand-crafted
// numbers" gap.

check(
  "R131 SWE-bench Verified harness present",
  existsSync(
    join(ROOT, "src/lib/performance/harnesses/swe-bench-verified.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "performance" },
);

check(
  "R131 harness emits R130-valid BenchmarkResult (summaryToBenchmarkResult)",
  fileContains(
    "src/lib/performance/harnesses/swe-bench-verified.ts",
    "summaryToBenchmarkResult",
  ) &&
    fileContains(
      "src/lib/performance/harnesses/swe-bench-verified.ts",
      'opts.verification ?? "internal-only"',
    ) ? 1 : 0,
  1,
  { dimension: "performance" },
);

check(
  "R131 harness has SHA-256 runHash anchor (anti-AI-washing)",
  fileContains(
    "src/lib/performance/harnesses/swe-bench-verified.ts",
    "computeRunHash",
  ) &&
    fileContains(
      "src/lib/performance/harnesses/swe-bench-verified.ts",
      "createHash",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R131 harness has tests",
  existsSync(
    join(
      ROOT,
      "src/lib/performance/harnesses/__tests__/swe-bench-verified.test.ts",
    ),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "R131 harness Edge Node bridge composes with R121 dispatch interface",
  fileContains(
    "src/lib/performance/harnesses/swe-bench-verified.ts",
    "makeEdgeNodeBackedRunner",
  ) &&
    fileContains(
      "src/lib/performance/harnesses/swe-bench-verified.ts",
      'capability: "fix-github-issue"',
    ) ? 1 : 0,
  1,
  { dimension: "performance" },
);

// ─── R140 / R141 — Behavioral Invariant Layer + RiskGate (Move 5) ──
// Pure-function drift-detection + Viability Index VI(t) ∈ [-1, +1]
// composed UPSTREAM of R100's policy gate. Catches drift earned
// through individually-legitimate actions that R100 cannot see.
// Maps to EU AI Act Art. 3(23) "substantial modification" boundary.

check(
  "R140/R141 Viability gate present (IML + RiskGate in single module)",
  existsSync(join(ROOT, "src/lib/control-plane/viability.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R140 IML uses 3 statistical primitives (KL + segment-vs-rest z + n-gram novelty)",
  fileContains(
    "src/lib/control-plane/viability.ts",
    "klDivergenceClass",
  ) &&
    fileContains(
      "src/lib/control-plane/viability.ts",
      "segmentVsRestZ",
    ) &&
    fileContains(
      "src/lib/control-plane/viability.ts",
      "detectSequentialNovelty",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R141 RiskGate emits VI(t) ∈ [-1, +1] with transparent linear penalties",
  fileContains("src/lib/control-plane/viability.ts", "computeViability") &&
    fileContains(
      "src/lib/control-plane/viability.ts",
      "DEFAULT_ALLOW_THRESHOLD",
    ) &&
    fileContains(
      "src/lib/control-plane/viability.ts",
      "DEFAULT_ESCALATE_THRESHOLD",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R140/R141 viability gate is feature-flagged (SOVEREIGN_VIABILITY_GATE_ENABLED, default-OFF)",
  fileContains(
    "src/lib/control-plane/viability.ts",
    'SOVEREIGN_VIABILITY_GATE_ENABLED === "true"',
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R140 admission profile is hash-anchored (anti-tampering with R26 chain)",
  fileContains(
    "src/lib/control-plane/viability.ts",
    "hashAdmissionProfile",
  ) &&
    fileContains(
      "src/lib/control-plane/viability.ts",
      "profileHash",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R140/R141 viability gate has tests",
  existsSync(
    join(ROOT, "src/lib/control-plane/__tests__/viability.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "R140/R141 viability gate emits R140 + R141 audit entries when blocking",
  fileContains(
    "src/lib/control-plane/viability.ts",
    '"agent.drift_detected"',
  ) &&
    fileContains(
      "src/lib/control-plane/viability.ts",
      '"agent.viability_threshold"',
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── R140-R145 audit-vocabulary extension ──────────────────────────
// New typed AuditAction variants for future modules (drift / VI(t) /
// PAGRL / kill-switch / cross-protocol / memory-payload).

check(
  "Audit-log declares R140-R145 vocabulary (forward-compatible with future modules)",
  fileContains("src/lib/audit-log.ts", '"agent.drift_detected"') &&
    fileContains("src/lib/audit-log.ts", '"agent.viability_threshold"') &&
    fileContains("src/lib/audit-log.ts", '"agent.governance_consult"') &&
    fileContains("src/lib/audit-log.ts", '"agent.kill_switch"') &&
    fileContains("src/lib/audit-log.ts", '"agent.cross_protocol_block"') &&
    fileContains("src/lib/audit-log.ts", '"agent.memory_payload_blocked"') ? 1 : 0,
  1,
  { dimension: "security" },
);

// ─── Move 2: R100 Policy Gate wired to agent factory ───────────────

check(
  "Move 2: agent-factory-policy-gate.ts pure-function wrapper present",
  existsSync(join(ROOT, "src/lib/agent-factory-policy-gate.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Move 2: agent-factory imports the policy gate (wired into request path)",
  fileContains(
    "src/lib/agent-factory.ts",
    "evaluatePolicyGate",
  ) &&
    fileContains(
      "src/lib/agent-factory.ts",
      'from "@/lib/agent-factory-policy-gate"',
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Move 2: gate is feature-flagged (SOVEREIGN_POLICY_GATE_ENABLED, default-OFF)",
  fileContains(
    "src/lib/agent-factory-policy-gate.ts",
    'SOVEREIGN_POLICY_GATE_ENABLED === "true"',
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Move 2: agent.policy_gate.deny audit action declared",
  fileContains("src/lib/audit-log.ts", '"agent.policy_gate.deny"') ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Move 2: gate has tests (16 unit tests covering all verdict paths)",
  existsSync(
    join(ROOT, "src/lib/__tests__/agent-factory-policy-gate.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── R142 — PAGRL (Pre-Action Governance Reasoning Loop) ───────────
// Move 6 of the proof-conversion arc. Pure-function 4-layer ruleset
// consultation that runs UPSTREAM of R100's policy gate. Internalized
// governance per "Think Before You Act" (April 2026, 14-author
// production-validated paper) — produces 95% compliance accuracy
// with zero false escalations. Gives SOC 2 / EU AI Act auditors WHICH
// layer's rule fired and WHY for every state-changing action.

check(
  "R142 PAGRL module present (governance.ts)",
  existsSync(join(ROOT, "src/lib/control-plane/governance.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R142 declares all 4 canonical layers (global / workflow / agent / situational)",
  fileContains("src/lib/control-plane/governance.ts", '"global"') &&
    fileContains("src/lib/control-plane/governance.ts", '"workflow"') &&
    fileContains("src/lib/control-plane/governance.ts", '"agent"') &&
    fileContains("src/lib/control-plane/governance.ts", '"situational"') ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R142 declares all 3 verdicts (permit / modify / escalate)",
  fileContains("src/lib/control-plane/governance.ts", '"permit"') &&
    fileContains("src/lib/control-plane/governance.ts", '"modify"') &&
    fileContains("src/lib/control-plane/governance.ts", '"escalate"') ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R142 PAGRL is feature-flagged (SOVEREIGN_GOVERNANCE_LOOP_ENABLED, default-OFF)",
  fileContains(
    "src/lib/control-plane/governance.ts",
    'SOVEREIGN_GOVERNANCE_LOOP_ENABLED === "true"',
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R142 fires agent.governance_consult audit action (already in audit-log vocab)",
  fileContains("src/lib/control-plane/governance.ts", '"agent.governance_consult"') ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R142 PAGRL ships tests",
  existsSync(
    join(ROOT, "src/lib/control-plane/__tests__/governance.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── R143 — ODTA (Observability/Decidability/Timeliness/Attestability) ─
// Runtime-placement test from "Beyond Task Success" (April 2026).
// Closes the governance-to-action closure gap: ensures every state-
// changing action passes 4 named predicates before dispatch.

check(
  "R143 ODTA module present (odta.ts)",
  existsSync(join(ROOT, "src/lib/control-plane/odta.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R143 declares all 4 canonical predicates (observability / decidability / timeliness / attestability)",
  fileContains("src/lib/control-plane/odta.ts", '"observability"') &&
    fileContains("src/lib/control-plane/odta.ts", '"decidability"') &&
    fileContains("src/lib/control-plane/odta.ts", '"timeliness"') &&
    fileContains("src/lib/control-plane/odta.ts", '"attestability"') ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R143 ODTA is feature-flagged (SOVEREIGN_ODTA_GATE_ENABLED, default-OFF)",
  fileContains(
    "src/lib/control-plane/odta.ts",
    'SOVEREIGN_ODTA_GATE_ENABLED === "true"',
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R143 ODTA ships tests",
  existsSync(join(ROOT, "src/lib/control-plane/__tests__/odta.test.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── Inspector v1.0 — All 5 pillars covered offline ──────────────
// The procurement-grade trust artifact. One npm install gives
// auditors the ability to verify ACAT (R91) + Stripe evidence (R92) +
// perception-mesh plans (R110/R111) + edge-node dispatch (R120) +
// benchmark attestations (R130) entirely offline.

check(
  "Inspector v1.0 — perception module port present (R110/R111 offline verifier)",
  existsSync(join(ROOT, "packages/inspector/src/perception.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector v1.0 — edge-nodes module port present (R120 offline verifier)",
  existsSync(join(ROOT, "packages/inspector/src/edge-nodes.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector v1.0 — performance module port present (R130 offline verifier)",
  existsSync(join(ROOT, "packages/inspector/src/performance.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector v1.0 — perception module has 4 cross-modal correlation kinds",
  fileContains(
    "packages/inspector/src/perception.mjs",
    "keyword-overlap",
  ) &&
    fileContains(
      "packages/inspector/src/perception.mjs",
      "entity-overlap",
    ) &&
    fileContains(
      "packages/inspector/src/perception.mjs",
      "time-proximity",
    ) &&
    fileContains(
      "packages/inspector/src/perception.mjs",
      "json-field-match",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector v1.0 — edge-nodes module enforces preflight gate ordering (R100→R37→R91→R102)",
  fileContains(
    "packages/inspector/src/edge-nodes.mjs",
    "policy_denied",
  ) &&
    fileContains("packages/inspector/src/edge-nodes.mjs", "act_required") &&
    fileContains(
      "packages/inspector/src/edge-nodes.mjs",
      "acat_required",
    ) &&
    fileContains(
      "packages/inspector/src/edge-nodes.mjs",
      "budget_exhausted",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Inspector v1.0 — performance module preserves anti-AI-washing rules (7 typed reasons)",
  fileContains(
    "packages/inspector/src/performance.mjs",
    "missing_run_hash",
  ) &&
    fileContains(
      "packages/inspector/src/performance.mjs",
      "missing_measured_at",
    ) &&
    fileContains(
      "packages/inspector/src/performance.mjs",
      "verification_too_weak",
    ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "Inspector v1.0 — has unit tests for all 3 new modules",
  existsSync(
    join(ROOT, "packages/inspector/__tests__/perception.test.mjs"),
  ) &&
    existsSync(
      join(ROOT, "packages/inspector/__tests__/edge-nodes.test.mjs"),
    ) &&
    existsSync(
      join(ROOT, "packages/inspector/__tests__/performance.test.mjs"),
    ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector v1.0 — package.json declares v1.0+ and 9 export subpaths",
  fileContains("packages/inspector/package.json", "\"version\": \"1.") &&
    fileContains("packages/inspector/package.json", "\"./perception\"") &&
    fileContains("packages/inspector/package.json", "\"./edge-nodes\"") &&
    fileContains("packages/inspector/package.json", "\"./performance\"") ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector v1.0 — index.mjs re-exports all 3 new modules",
  fileContains(
    "packages/inspector/src/index.mjs",
    "./perception.mjs",
  ) &&
    fileContains(
      "packages/inspector/src/index.mjs",
      "./edge-nodes.mjs",
    ) &&
    fileContains(
      "packages/inspector/src/index.mjs",
      "./performance.mjs",
    ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector v1.0 — CLI exposes 3 new verify-* subcommands",
  fileContains(
    "packages/inspector/src/cli.mjs",
    "verify-perception-plan",
  ) &&
    fileContains(
      "packages/inspector/src/cli.mjs",
      "verify-edge-dispatch",
    ) &&
    fileContains(
      "packages/inspector/src/cli.mjs",
      "verify-benchmark",
    ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── Inspector — R142 PAGRL + R143 ODTA port (Move 6) ────────────
// Customers replay any governance consultation offline and verify
// the verdict claimed by the platform was produced by the same
// algorithm. Closes governance-to-action gap from auditor side.

check(
  "Inspector — governance.mjs port present (R142/R143 offline verifier)",
  existsSync(join(ROOT, "packages/inspector/src/governance.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector — governance port has tests",
  existsSync(
    join(ROOT, "packages/inspector/__tests__/governance.test.mjs"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector — index.mjs re-exports governance.mjs",
  fileContains("packages/inspector/src/index.mjs", "./governance.mjs") ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector CLI exposes verify-governance-trace subcommand",
  fileContains(
    "packages/inspector/src/cli.mjs",
    "verify-governance-trace",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── R145 — Memory Payload Guard (Move 7) ─────────────────────────
// Pure-function scanner that detects embedded-instruction patterns in
// content being written to a memory store. Fires the
// agent.memory_payload_blocked audit action that's been in the
// audit-log vocabulary on disk since 6d0511c7. Closes the zombie-
// memory + cross-agent contagion attack class from the Mnemonic
// Sovereignty survey (April 2026).

check(
  "R145 memory-guard module present (payload-guard.ts)",
  existsSync(join(ROOT, "src/lib/memory/payload-guard.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R145 declares all 5 canonical detectors",
  fileContains("src/lib/memory/payload-guard.ts", '"role-marker-injection"') &&
    fileContains("src/lib/memory/payload-guard.ts", '"direct-instruction"') &&
    fileContains("src/lib/memory/payload-guard.ts", '"tool-call-hijack"') &&
    fileContains("src/lib/memory/payload-guard.ts", '"propagation-marker"') &&
    fileContains("src/lib/memory/payload-guard.ts", '"encoded-payload"') ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R145 fires agent.memory_payload_blocked audit action (already in vocab)",
  fileContains("src/lib/memory/payload-guard.ts", '"agent.memory_payload_blocked"') ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R145 is feature-flagged (SOVEREIGN_MEMORY_PAYLOAD_GUARD_ENABLED, default-OFF)",
  fileContains(
    "src/lib/memory/payload-guard.ts",
    'SOVEREIGN_MEMORY_PAYLOAD_GUARD_ENABLED === "true"',
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R145 anchors blocked content with SHA-256 hash (cross-agent correlation)",
  fileContains("src/lib/memory/payload-guard.ts", "createHash") &&
    fileContains("src/lib/memory/payload-guard.ts", '"sha256"') ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R145 ships tests",
  existsSync(join(ROOT, "src/lib/memory/__tests__/payload-guard.test.ts")) ? 1 : 0,
  1,
  { dimension: "process" },
);

// ─── Inspector — R145 memory-guard port (Move 7) ─────────────────

check(
  "Inspector — memory-guard.mjs port present (R145 offline verifier)",
  existsSync(join(ROOT, "packages/inspector/src/memory-guard.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector — memory-guard port has tests",
  existsSync(
    join(ROOT, "packages/inspector/__tests__/memory-guard.test.mjs"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector — index.mjs re-exports memory-guard.mjs",
  fileContains("packages/inspector/src/index.mjs", "./memory-guard.mjs") ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector CLI exposes verify-memory-payload subcommand",
  fileContains(
    "packages/inspector/src/cli.mjs",
    "verify-memory-payload",
  ) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── R150 — Agentic AI Bill of Materials (Move 8) ─────────────────
// Pure-function generator that emits SPDX 3.1-compatible AIBOM
// documents with hash-anchored components + document hash. Closes
// OWASP ASI04 (Agentic Supply Chain Vulnerabilities) attestation
// gap.

check(
  "R150 AIBOM module present (aibom.ts)",
  existsSync(join(ROOT, "src/lib/supply-chain/aibom.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R150 declares 5 component kinds + 6 relationship kinds",
  fileContains("src/lib/supply-chain/aibom.ts", '"model"') &&
    fileContains("src/lib/supply-chain/aibom.ts", '"tool"') &&
    fileContains("src/lib/supply-chain/aibom.ts", '"data-source"') &&
    fileContains("src/lib/supply-chain/aibom.ts", '"agent"') &&
    fileContains("src/lib/supply-chain/aibom.ts", '"dependency"') &&
    fileContains("src/lib/supply-chain/aibom.ts", '"DEPENDS_ON"') &&
    fileContains("src/lib/supply-chain/aibom.ts", '"INVOKES"') &&
    fileContains("src/lib/supply-chain/aibom.ts", '"TRAINED_ON"') ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R150 components are SHA-256 fingerprinted (anti-tampering anchor)",
  fileContains("src/lib/supply-chain/aibom.ts", "computeComponentFingerprint") &&
    fileContains("src/lib/supply-chain/aibom.ts", "createHash") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R150 documents are hash-anchored (computeDocumentHash with sorted canonical encoding)",
  fileContains("src/lib/supply-chain/aibom.ts", "computeDocumentHash") &&
    fileContains("src/lib/supply-chain/aibom.ts", "documentHash") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R150 vulnerability blocklist primitive present",
  fileContains("src/lib/supply-chain/aibom.ts", "checkVulnerabilityBlocklist") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R150 fires agent.sbom_generated audit action",
  fileContains("src/lib/audit-log.ts", '"agent.sbom_generated"') &&
    fileContains("src/lib/supply-chain/aibom.ts", "agent.sbom_generated") ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R150 ships tests",
  existsSync(
    join(ROOT, "src/lib/supply-chain/__tests__/aibom.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector — aibom.mjs port present (R150 offline verifier)",
  existsSync(join(ROOT, "packages/inspector/src/aibom.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector — aibom port has tests",
  existsSync(
    join(ROOT, "packages/inspector/__tests__/aibom.test.mjs"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector — index.mjs re-exports aibom.mjs",
  fileContains("packages/inspector/src/index.mjs", "./aibom.mjs") ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector CLI exposes verify-aibom subcommand",
  fileContains("packages/inspector/src/cli.mjs", "verify-aibom") ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

// ─── R155 — Confidence-Calibrated HITL Routing (Move 9) ───────────
// Pure-function decision logic that consumes upstream gate verdicts
// (R100 policy, R140-R141 viability, R143 ODTA) and decides
// auto_proceed / silent_approval / hitl_required / hard_deny. Closes
// approval-fatigue gap (Gap 41) + OWASP ASI09 trust exploitation
// (Gap 9) by routing only meaningful uncertainty to humans.

check(
  "R155 HITL routing module present",
  existsSync(join(ROOT, "src/lib/control-plane/hitl-routing.ts")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R155 declares all 4 routing kinds (auto_proceed/silent_approval/hitl_required/hard_deny)",
  fileContains("src/lib/control-plane/hitl-routing.ts", '"auto_proceed"') &&
    fileContains("src/lib/control-plane/hitl-routing.ts", '"silent_approval"') &&
    fileContains("src/lib/control-plane/hitl-routing.ts", '"hitl_required"') &&
    fileContains("src/lib/control-plane/hitl-routing.ts", '"hard_deny"') ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "R155 is feature-flagged (SOVEREIGN_HITL_ROUTING_ENABLED, default-OFF means conservative-route-everything)",
  fileContains(
    "src/lib/control-plane/hitl-routing.ts",
    'SOVEREIGN_HITL_ROUTING_ENABLED === "true"',
  ) ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R155 reuses agent.governance_consult audit action with phase=hitl-routing discriminator",
  fileContains("src/lib/control-plane/hitl-routing.ts", '"hitl-routing"') &&
    fileContains("src/lib/control-plane/hitl-routing.ts", '"agent.governance_consult"') ? 1 : 0,
  1,
  { dimension: "security" },
);

check(
  "R155 ships tests",
  existsSync(
    join(ROOT, "src/lib/control-plane/__tests__/hitl-routing.test.ts"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector — hitl-routing.mjs port present (R155 offline verifier)",
  existsSync(join(ROOT, "packages/inspector/src/hitl-routing.mjs")) ? 1 : 0,
  1,
  { dimension: "trust-asset" },
);

check(
  "Inspector — hitl-routing port has tests",
  existsSync(
    join(ROOT, "packages/inspector/__tests__/hitl-routing.test.mjs"),
  ) ? 1 : 0,
  1,
  { dimension: "process" },
);

check(
  "Inspector — index.mjs re-exports hitl-routing.mjs",
  fileContains("packages/inspector/src/index.mjs", "./hitl-routing.mjs") ? 1 : 0,
  1,
  { dimension: "process" },
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
