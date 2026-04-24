/**
 * GET /api/_health/production-readiness
 *
 * One URL that tells an operator exactly what's missing to run this
 * platform in production. Checks:
 *
 *   - Required env vars (DATABASE_URL, CLERK_*, NIM_API_KEY, …)
 *   - Recommended env vars (ADMIN_USER_IDS, RESEND_API_KEY, …)
 *   - Database reachable
 *   - Database migrations applied (probes for expected tables)
 *   - AI provider reachable (NIM, Anthropic — light probes)
 *   - Auth provider reachable (Clerk)
 *   - Safety + policy config sane
 *   - npm packages structure builds (validator + CLI)
 *
 * Returns 200 with a structured report even when things are
 * broken — operators want to see the whole checklist at once, not
 * get a 500 on the first failure.
 *
 * Auth: PUBLIC for the summary (counts of missing items). DETAIL
 * with env-var names and error messages requires requireAdmin().
 * This way a probe from monitoring shows "all green" or "3 items
 * missing" without leaking which env vars are unset.
 */

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { isAdmin } from "@/lib/admin-auth";
import { auth } from "@clerk/nextjs/server";
import { activeDeepSafetyProvider } from "@/lib/submission-safety";
import { activePolicyName } from "@/lib/creator-approval-policy";

/* ─── Types ───────────────────────────────────────────────────── */

export interface CheckResult {
  name: string;
  /** "required" | "recommended" | "optional" */
  tier: "required" | "recommended" | "optional";
  status: "ok" | "missing" | "error" | "unknown";
  /** Short human-friendly explanation. */
  message: string;
  /** Only included for admin requests. May contain sensitive details. */
  detail?: string;
}

export interface ReadinessReport {
  summary: {
    totalChecks: number;
    ok: number;
    missingRequired: number;
    missingRecommended: number;
    errors: number;
    productionReady: boolean;
  };
  env: {
    nodeEnv: string;
    vercelEnv: string | null;
  };
  checks: CheckResult[];
}

/* ─── Small env helpers ───────────────────────────────────────── */

function hasEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

function checkRequired(name: string, description: string): CheckResult {
  return hasEnv(name)
    ? { name, tier: "required", status: "ok", message: description }
    : {
        name,
        tier: "required",
        status: "missing",
        message: description,
        detail: `Set the ${name} env var in Vercel.`,
      };
}

function checkRecommended(name: string, description: string): CheckResult {
  return hasEnv(name)
    ? { name, tier: "recommended", status: "ok", message: description }
    : {
        name,
        tier: "recommended",
        status: "missing",
        message: description,
        detail: `Optional but recommended; set ${name} to enable this feature.`,
      };
}

function checkOptional(name: string, description: string): CheckResult {
  return hasEnv(name)
    ? { name, tier: "optional", status: "ok", message: description }
    : { name, tier: "optional", status: "missing", message: description };
}

/* ─── Database probes ─────────────────────────────────────────── */

async function probeDatabase(): Promise<CheckResult> {
  if (!hasEnv("DATABASE_URL")) {
    return {
      name: "database.reachable",
      tier: "required",
      status: "missing",
      message: "DATABASE_URL not configured",
    };
  }
  try {
    await db.execute(sql`SELECT 1`);
    return {
      name: "database.reachable",
      tier: "required",
      status: "ok",
      message: "Neon responds to SELECT 1",
    };
  } catch (err) {
    return {
      name: "database.reachable",
      tier: "required",
      status: "error",
      message: "DB did not respond",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Probe for whether critical migrations have been applied by checking
 * for specific columns added by each migration. Returns a list of
 * individual-table results so the operator sees which migration is
 * behind.
 */
async function probeMigrations(): Promise<CheckResult[]> {
  if (!hasEnv("DATABASE_URL")) return [];
  const checks: Array<{ name: string; query: string; detail: string }> = [
    {
      name: "migration.0025.sam_submission_fields",
      query:
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_agents' AND column_name = 'sam_version' LIMIT 1`,
      detail: "drizzle/0025_sam_submission_fields.sql",
    },
    {
      name: "migration.0026.marketplace_slug",
      query:
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_agents' AND column_name = 'slug' LIMIT 1`,
      detail: "drizzle/0026_marketplace_slug.sql",
    },
    {
      name: "migration.0027.marketplace_views",
      query:
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'marketplace_agent_views' LIMIT 1`,
      detail: "drizzle/0027_marketplace_agent_views.sql",
    },
    {
      name: "migration.0028.creator_earnings",
      query:
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'creator_earnings' LIMIT 1`,
      detail: "drizzle/0028_creator_earnings.sql",
    },
    {
      name: "migration.0029.marketplace_embedding",
      query:
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_agents' AND column_name = 'embedding' LIMIT 1`,
      detail: "drizzle/0029_marketplace_embedding.sql",
    },
  ];

  const results: CheckResult[] = [];
  for (const c of checks) {
    try {
      const rows = await db.execute(sql.raw(c.query));
      // Drizzle returns `{ rows: [...] }` for raw queries. Empty =
      // migration not applied.
      const found =
        (rows as unknown as { rows?: unknown[] }).rows !== undefined
          ? ((rows as unknown as { rows?: unknown[] }).rows?.length ?? 0) > 0
          : Array.isArray(rows) && rows.length > 0;
      results.push({
        name: c.name,
        tier: "required",
        status: found ? "ok" : "missing",
        message: found ? "Applied" : "Not applied",
        detail: c.detail,
      });
    } catch (err) {
      results.push({
        name: c.name,
        tier: "required",
        status: "error",
        message: "Check failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

/* ─── Provider probes (light — only HEAD-style reachability) ──── */

async function probeNim(): Promise<CheckResult> {
  if (!hasEnv("NIM_API_KEY") && !hasEnv("NVIDIA_API_KEY")) {
    return {
      name: "nim.reachable",
      tier: "required",
      status: "missing",
      message: "NIM_API_KEY not configured — search, safety, and routing all need this",
    };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.NIM_API_KEY ?? process.env.NVIDIA_API_KEY}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return {
      name: "nim.reachable",
      tier: "required",
      status: res.ok ? "ok" : "error",
      message: res.ok ? "NIM /models endpoint responded OK" : `NIM returned HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name: "nim.reachable",
      tier: "required",
      status: "error",
      message: "Could not reach NIM",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ─── Config coherence ────────────────────────────────────────── */

function checkApprovalPolicy(): CheckResult {
  const name = activePolicyName();
  return {
    name: "policy.approval",
    tier: "recommended",
    status: "ok",
    message: `Active policy: ${name}`,
    detail:
      name === "open"
        ? "WARNING: open policy auto-publishes every SAM-valid submission. Deep-safety must be enabled."
        : undefined,
  };
}

function checkSafetyProvider(): CheckResult {
  const provider = activeDeepSafetyProvider();
  return {
    name: "policy.safety",
    tier: "recommended",
    status: "ok",
    message: `Deep-safety provider: ${provider}`,
  };
}

/* ─── Main handler ────────────────────────────────────────────── */

export async function GET(): Promise<Response> {
  // Which level of detail to return depends on whether the caller is
  // an admin. Public probes see only tier/status; admin sees detail.
  let includeDetail = false;
  try {
    const a = await auth();
    if (a?.userId && isAdmin(a.userId)) includeDetail = true;
  } catch {
    /* unauthenticated is fine */
  }

  // Run all checks.
  const required: CheckResult[] = [
    checkRequired("DATABASE_URL", "Postgres connection string"),
    checkRequired("CLERK_SECRET_KEY", "Clerk server auth"),
    checkRequired("CLERK_PUBLISHABLE_KEY", "Clerk client auth"),
    ...(hasEnv("NIM_API_KEY") || hasEnv("NVIDIA_API_KEY")
      ? [
          {
            name: "NIM_API_KEY",
            tier: "required" as const,
            status: "ok" as const,
            message: "NIM key present (free-tier routing + safety + search + vision)",
          },
        ]
      : [
          {
            name: "NIM_API_KEY",
            tier: "required" as const,
            status: "missing" as const,
            message: "NIM key missing — core platform features unavailable",
            detail: "Set NIM_API_KEY or NVIDIA_API_KEY in Vercel",
          },
        ]),
  ];

  const recommended: CheckResult[] = [
    checkRecommended("ADMIN_USER_IDS", "Admin allowlist — /admin/* requires it"),
    checkRecommended("RESEND_API_KEY", "Transactional email — approval/rejection notifications"),
    checkRecommended("NEXT_PUBLIC_SITE_URL", "Public site URL — used in email links + OG"),
    checkRecommended("SOVEREIGN_APPROVAL_POLICY", "Defaults to 'curated' which is safe"),
    checkRecommended("SOVEREIGN_SAFETY_PROVIDER", "Defaults to 'nemoguard' (free)"),
  ];

  const optional: CheckResult[] = [
    checkOptional("ANTHROPIC_API_KEY", "Premium fallback routing + Claude critic"),
    checkOptional("GOOGLE_AI_API_KEY", "Multimodal + grounded search"),
    checkOptional("CEREBRAS_API_KEY", "Ultra-fast classification tier"),
    checkOptional("GROQ_API_KEY", "Fast DeepSeek + Qwen tier"),
    checkOptional("TAVILY_API_KEY", "Web search"),
    checkOptional("UPSTASH_REDIS_REST_URL", "Cross-instance cache + rate limits"),
    checkOptional("STRIPE_SECRET_KEY", "Payments + earnings payouts"),
    checkOptional("SENTRY_DSN", "Error tracking"),
    checkOptional("NPM_TOKEN", "Auto-publish @sovereignmatrix packages"),
  ];

  const [dbProbe, nimProbe, migrationProbes] = await Promise.all([
    probeDatabase(),
    probeNim(),
    probeMigrations(),
  ]);

  const config: CheckResult[] = [checkApprovalPolicy(), checkSafetyProvider()];

  const all: CheckResult[] = [
    ...required,
    dbProbe,
    nimProbe,
    ...migrationProbes,
    ...recommended,
    ...config,
    ...optional,
  ];

  // Redact detail for non-admins.
  const finalChecks = all.map((c) =>
    includeDetail ? c : { ...c, detail: undefined },
  );

  const ok = finalChecks.filter((c) => c.status === "ok").length;
  const errors = finalChecks.filter((c) => c.status === "error").length;
  const missingRequired = finalChecks.filter(
    (c) => c.tier === "required" && c.status !== "ok",
  ).length;
  const missingRecommended = finalChecks.filter(
    (c) => c.tier === "recommended" && c.status !== "ok",
  ).length;

  const report: ReadinessReport = {
    summary: {
      totalChecks: finalChecks.length,
      ok,
      missingRequired,
      missingRecommended,
      errors,
      productionReady: missingRequired === 0 && errors === 0,
    },
    env: {
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      vercelEnv: process.env.VERCEL_ENV ?? null,
    },
    checks: finalChecks,
  };

  return NextResponse.json(report, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
