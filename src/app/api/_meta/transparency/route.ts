/**
 * GET /api/_meta/transparency.json — Sovereign Bill of Trust
 *
 * One canonical, machine-readable document that any auditor — human or
 * AI agent — can ingest in a single request to verify Sovereign
 * Matrix's claims about itself. Shape is stable, versioned, and every
 * non-trivial claim cites a verifiable source artifact (commit hash,
 * file path, migration, test run).
 *
 * WHY THIS EXISTS
 * ───────────────
 * The "Stanford Foundation Model Transparency Index" approach (and its
 * equivalents — EU AI Act baseline, NIST AI RMF, MITRE ATLAS) auto-
 * scrape provider documentation across the web and majority-vote-score
 * each claim. Their measured cost: <$3 per platform, 50 platforms in a
 * batch. The bottleneck for THEM is fragmentation; the bottleneck for
 * US is making our claims grep-able instead of buried in 97 different
 * marketing pages.
 *
 * This endpoint IS our transparency surface for those auditors. Every
 * claim has:
 *   - a `value` field (the actual datum)
 *   - a `cite` field (where the claim is verifiable — usually a path
 *     in this repo, sometimes a public URL)
 *   - optionally `since` (commit SHA / date when the claim was first
 *     true)
 *
 * SHAPE STABILITY
 * ───────────────
 * The top-level keys are versioned via `schemaVersion`. We will only
 * change the schema in a way that:
 *   1. Bumps `schemaVersion`, and
 *   2. Preserves the previous version at /api/_meta/transparency/v1
 *      etc. for at least 90 days.
 * That gives auditor pipelines a stable target.
 *
 * NO PII — everything in this response is either a public claim about
 * the platform, an aggregate count, or a code/file path. Safe to share
 * unauthenticated.
 *
 * Cache: 1 hour at the edge. Refreshes on each deploy as the underlying
 * data drifts. Clients should treat any stale-by-more-than-24h response
 * as "platform may be unmaintained" — that's the intent.
 */

import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const revalidate = 3600;

// Repo root resolves at build time (next.config pins turbopack.root to
// the worktree). At runtime, process.cwd() is the same place.
const ROOT = process.cwd();

interface Citation {
  value: unknown;
  cite: string;
  detail?: string;
}

function cite(value: unknown, cite: string, detail?: string): Citation {
  return { value, cite, ...(detail ? { detail } : {}) };
}

function fileExists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

function fileMatchCount(rel: string, re: RegExp): number {
  if (!fileExists(rel)) return 0;
  try {
    const text = readFileSync(join(ROOT, rel), "utf8");
    return (text.match(re) ?? []).length;
  } catch {
    return 0;
  }
}

export async function GET(): Promise<NextResponse> {
  const generatedAt = new Date().toISOString();

  // Test counts read from the actual source files. We don't read
  // vitest's run output because the generator may run before tests
  // do — in CI, only at build time. A simple `^\s+it\(` and
  // `^registerEval` count is enough for a transparency-grade signal.
  const securityHardeningTests = fileMatchCount(
    "src/lib/__tests__/security-hardening.test.ts",
    /^\s+it\(/gm,
  );
  const auditLogTests = fileMatchCount(
    "src/lib/__tests__/audit-log.test.ts",
    /^\s+it\(/gm,
  );
  const safeJsonTests = fileMatchCount(
    "src/lib/__tests__/safe-json.test.ts",
    /^\s+it\(/gm,
  );
  const portalShareLinkTests = fileMatchCount(
    "src/lib/__tests__/portal-share-link.test.ts",
    /^\s+it\(/gm,
  );
  const creditsGrantTests = fileMatchCount(
    "src/lib/__tests__/credits-grant-route.test.ts",
    /^\s+it\(/gm,
  );
  const evalCount = fileMatchCount(
    "src/lib/__tests__/agent-evals/golden-set.ts",
    /^registerEval/gm,
  );
  const agentRegistryCount = fileMatchCount(
    "src/app/api/agents/registry.ts",
    /\(\) => import\(/g,
  );

  const evalCoveragePct =
    agentRegistryCount > 0
      ? Math.round((evalCount / agentRegistryCount) * 100)
      : 0;

  const body = {
    schemaVersion: "1.0",
    generatedAt,
    canonicalUrl: "https://sovereignmatrix.agency/api/_meta/transparency.json",
    spec: cite(
      "Sovereign Bill of Trust v1",
      "src/app/api/_meta/transparency/route.ts",
      "Schema is stable; previous versions remain reachable for 90 days post-bump.",
    ),

    // ─── Identity ──────────────────────────────────────────────
    identity: {
      productName: "Sovereign Matrix",
      vendor: "Sovereign Matrix Agency",
      contact: cite(
        "security@sovereignmatrix.agency",
        "public/.well-known/security.txt",
      ),
      sourceCode: cite(
        "available to operators + auditors under NDA",
        "src/app — handler tree is mirrored to every signed paid customer",
        "Open-source release tracked separately; closed by default to keep adversarial agents out of the loop on safety pipeline internals.",
      ),
    },

    // ─── Models + Providers ────────────────────────────────────
    models: {
      providersUsed: cite(
        [
          "nvidia-nim",
          "google-gemini",
          "anthropic-claude",
          "groq",
          "cerebras",
          "ollama-local",
          "openai",
          "xai",
          "mistral-direct",
          "cohere",
          "openrouter",
          "together",
          "databricks",
          "replicate",
        ],
        "src/lib/provider-costs.ts",
      ),
      providerCostClassification: cite(
        {
          free: ["ollama", "nim", "nvidia-nim", "cerebras"],
          metered: ["groq"],
          paid: [
            "openai",
            "xai",
            "mistral-direct",
            "cohere",
            "openrouter",
            "together",
            "databricks",
            "replicate",
            "gemini",
            "claude",
          ],
        },
        "src/lib/provider-costs.ts",
        "Providers labelled `paid` are billed per-token; the free-first router strips them when SOVEREIGN_FREE_ONLY=true is set.",
      ),
      sovereigntyMode: cite(
        "DATA_SOVEREIGNTY_MODE env strips China-host providers (deepseek, qwen, yi, moonshot, kimi, glm, minimax, 01-ai, zhipu)",
        "src/lib/providers/sovereignty.ts",
      ),
      freeOnlyMode: cite(
        "SOVEREIGN_FREE_ONLY env strips paid providers from failover; returns honest 'unavailable' rather than escalating",
        "src/lib/ai.ts",
      ),
      modelAttribution: cite(
        "Every agent response includes modelsConsulted[] — names of models that touched the request",
        "src/lib/model-attribution.ts",
        "Customers can see which providers handled their data without asking us.",
      ),
    },

    // ─── Safety pipeline ───────────────────────────────────────
    safety: {
      piiGuard: cite(
        {
          implementation: "regex + Luhn + IBAN mod-97 checksum",
          types: ["ssn", "credit_card", "iban", "swift_bic", "phone", "email", "us_zip", "ipv4"],
          modes: ["mask (default)", "flag (for resume/business-card/coi agents)", "skip (synthetic-data only)"],
          failureBehavior: "fail-open — scan errors NEVER block the user response",
        },
        "src/lib/pii-guard.ts",
      ),
      auditLogHashChain: cite(
        {
          algorithm: "SHA-256",
          chainPayload: "h(prev_hash | userId | action | resource | details | createdAt)",
          monitoring: "every 6 hours via Vercel Cron",
          adminCheck: "/api/admin/audit/verify-chain (requires admin role)",
          tamperDetection: "ANY in-place edit of details breaks the chain at the modified row",
          legacyRows: "rows pre-migration-0033 have NULL row_hash and skip the chain (non-breaking)",
        },
        "src/lib/audit-log.ts + drizzle/0033_audit_log_hash_chain.sql",
      ),
      apiKeyScoping: cite(
        {
          scopes: ["agent:read", "agent:execute", "agent:execute:<slug>", "data:read", "data:write", "admin"],
          ipAllowlist: "IPv4 CIDR per key (allowed_ips column)",
          legacyKeys: "NULL scopes = full access (back-compat); empty array = revoked-in-place",
          enforcement: "evaluateScope() on every /api/v1/[...path] request",
        },
        "src/lib/api-key-scopes.ts + drizzle/0034_api_key_scoping.sql",
      ),
      contentSafety: cite(
        "5-layer safety pipeline (jailbreak → PII → content → quality → critic)",
        "src/lib/safety-pipeline.ts",
      ),
      portalShareLinks: cite(
        {
          algorithm: "HMAC-SHA256 over clientId",
          revocation: "rotate PORTAL_SHARE_SECRET to kill all outstanding tokens",
          minter: "POST /api/portal/share-link (auth-required, audit-logged)",
          neverLogged: "raw tokens are never written to logs or the audit chain",
        },
        "src/lib/portal-share-link.ts",
      ),
    },

    // ─── Quality + evals ───────────────────────────────────────
    quality: {
      agents: cite(agentRegistryCount, "src/app/api/agents/registry.ts"),
      evals: cite(
        evalCount,
        "src/lib/__tests__/agent-evals/golden-set.ts",
        "Golden-set evals exercise each agent's core capability with structural-only assertions (no LLM-output text matching, so they survive model drift).",
      ),
      evalCoveragePct: cite(
        evalCoveragePct,
        "scripts/weekly-health.mjs (eval coverage % invariant; floor 25%)",
      ),
      tests: {
        securityHardening: cite(
          securityHardeningTests,
          "src/lib/__tests__/security-hardening.test.ts",
          "PII guard / API-key scopes / free-first router / classifyV1Request",
        ),
        auditLog: cite(
          auditLogTests,
          "src/lib/__tests__/audit-log.test.ts",
          "Includes 3 distinct tampering scenarios (details mutation / forged prev_hash / forged row_hash) — each detected at exact broken row.",
        ),
        safeJson: cite(safeJsonTests, "src/lib/__tests__/safe-json.test.ts"),
        portalShareLink: cite(
          portalShareLinkTests,
          "src/lib/__tests__/portal-share-link.test.ts",
          "Includes secret-rotation invalidates-all-tokens test.",
        ),
        creditsGrant: cite(
          creditsGrantTests,
          "src/lib/__tests__/credits-grant-route.test.ts",
          "Proves admin gate holds against unauth/non-admin/forged-Stripe-payment attacks.",
        ),
      },
      antiDriftInvariants: cite(
        fileMatchCount("scripts/weekly-health.mjs", /\bcheck\(/g),
        "scripts/weekly-health.mjs",
        "CI-blocking. Every PR runs this and fails on any regression.",
      ),
    },

    // ─── Operational transparency ──────────────────────────────
    operations: {
      slo: {
        endpoint: cite(
          "GET /api/_health/slo",
          "src/app/api/_health/slo/route.ts",
          "Cross-instance Postgres-backed read path; in-memory fallback when DATABASE_URL is missing.",
        ),
        statusPage: "https://sovereignmatrix.agency/status/slo",
        slos: cite(
          [
            { name: "health_availability", target: "99.9% in 30d" },
            { name: "agent_latency_p95", target: "<8s" },
            { name: "playbook_completion", target: "98% in 5m" },
            { name: "stripe_webhook_ok", target: "99.5%" },
            { name: "voice_first_audio_p95", target: "<1.5s" },
          ],
          "src/lib/slo-tracking.ts",
        ),
      },
      threatModel: cite(
        "STRIDE-based; every claim cites a file or test",
        "docs/THREAT_MODEL.md",
      ),
      vulnerabilityDisclosure: cite(
        "RFC 9116 security.txt at /.well-known/security.txt",
        "public/.well-known/security.txt",
      ),
      auditChainVerification: cite(
        "On-demand: GET /api/admin/audit/verify-chain (admin-gated). Continuous: /api/cron/verify-audit-chain runs every 6 hours.",
        "vercel.json (cron registration) + src/app/api/cron/verify-audit-chain/route.ts",
      ),
    },

    // ─── User-facing controls ──────────────────────────────────
    userControls: {
      dataExport: cite(
        "GET /api/_misc/data-export — full export of caller's data, including settings.apiKeys masked",
        "src/app/api/_misc/data-export/route.ts",
      ),
      dataDelete: cite(
        "Account deletion via Clerk; tenant data cascade-deleted via foreign keys (onDelete: cascade)",
        "src/db/schema.ts",
      ),
      byok: cite(
        "Bring-your-own-key for any provider — keys stored encrypted (AES-GCM via safeDecrypt) in settings.apiKeys",
        "src/app/api/settings/byok/route.ts + src/lib/crypto.ts",
        "User-supplied keys take precedence over platform-provided keys; corrupt blobs fall back to env-var via safeJsonParseObject (never blocks the user request).",
      ),
      apiKeys: cite(
        "Self-service key minting + rotation + per-key scope/IP allowlist",
        "src/app/api/_tokens/route.ts + src/app/api/_tokens/rotate/route.ts",
      ),
    },

    // ─── Reflexive transparency note ───────────────────────────
    reflexive: {
      audience: "human auditors AND AI agents",
      designForAuditorAgents: cite(
        "This document is intentionally machine-readable. Every claim has a `value` and a `cite` field; field names are stable; the schema is versioned. Auditor agents (FMTI, EU AI Act baseline, NIST AI RMF, ATLAS) can majority-vote-score Sovereign Matrix in a single GET.",
        "src/app/api/_meta/transparency/route.ts (this file)",
      ),
      whatWeDoNotClaim: cite(
        [
          "We do NOT have SOC 2 Type II — we have the controls (audit chain, hash-verified logs, scoped credentials) but no formal audit yet.",
          "We do NOT have a HIPAA BAA — the PII guard catches PHI but we are not a covered entity.",
          "We do NOT publish frontier-model evaluations against the OpenAI Evals harness yet — our golden-set evals are platform-specific.",
        ],
        "docs/WHATS-NOT-ELITE.md",
      ),
    },
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      // Hint to AI auditor crawlers that this is the canonical surface.
      "X-Sovereign-Transparency-Schema": "1.0",
      "X-Sovereign-Transparency-Audience": "human, ai-agent",
    },
  });
}
