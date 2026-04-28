/**
 * GET /api/health/diagnose
 *
 * Self-service deploy diagnostic. Returns SPECIFIC reasons for any
 * platform failure — which env var is missing, which table doesn't
 * exist, what SQL error fired, etc.
 *
 * The use case: production was failing for ~24h with `db:disconnected`
 * and `Failed query: update...` — neither error message tells the
 * operator WHAT to fix. This endpoint returns enough detail to act.
 *
 * SECURITY:
 *   - Public read (no auth) — operators need to hit it without
 *     credentials to diagnose deploys
 *   - But: env var names ONLY (never values), connection strings
 *     hashed, no PII, no per-tenant data
 *   - Error messages from the DB are surfaced verbatim — these
 *     should not contain secrets in normal operation, but if a
 *     specific DB driver leaks them, that's an upstream bug
 *
 * Rate-limited at the platform middleware level.
 */

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("health-diagnose");

export const runtime = "nodejs";
// 30s edge cache — enough to absorb monitoring polls without
// hammering the DB on every page load.
export const revalidate = 30;

// Boot-required env vars. Source of truth: src/lib/env.ts and
// docs/SUCCESSION.md "Production envs". If any of these is missing
// in prod, the platform refuses to boot via assertProductionRequiredEnv —
// but we report it here for diagnostic purposes.
const BOOT_REQUIRED_ENVS = [
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "ENCRYPTION_KEY",
  "CRON_SECRET",
];

// Strongly recommended env vars. Their absence is logged but doesn't
// fail the platform.
const RECOMMENDED_ENVS = [
  "SENTRY_DSN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_ARRAY",
  "STRIPE_PRICE_NODE",
  "STRIPE_PRICE_ENTERPRISE",
  "RESEND_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "NVIDIA_NIM_API_KEY",
  "GROQ_API_KEY",
  "CEREBRAS_API_KEY",
  "OPENAI_API_KEY",
  "TAVILY_API_KEY",
  "UPSTASH_REDIS_REST_URL",
];

// Tables the platform expects to exist. Migration 0030+ tables are
// flagged as "may not be applied" since the TIER S checklist
// documents these as pending.
const EXPECTED_TABLES_CORE = [
  "users",
  "tenants",
  "subscriptions",
  "agent_activity",
  "audit_logs",
  "jobs", // migration 0002 — async_jobs
  "playbook_runs", // migration 0003
];

const EXPECTED_TABLES_R26_R32 = [
  "hitl_approval_requests", // 0041
  "execution_audit_log", // 0041
  "usage_outbox", // post-R26
  "tenant_cost_ledger", // 0042
  "platform_health_snapshots", // 0042
  "agent_traces", // 0043
  "agent_spend_authorizations", // 0044
  "agent_spend_charges", // 0044
];

interface EnvCheck {
  name: string;
  present: boolean;
  /** Hashed value for DATABASE_URL (helps operator confirm which DB they're pointing at). */
  hash?: string;
}

interface DbCheck {
  reachable: boolean;
  /** Raw SQL error message; null on success. */
  error: string | null;
  /** Connection latency in ms; null on failure. */
  latencyMs: number | null;
  /** Hostname extracted from DATABASE_URL (for "is this the right DB?" check). */
  host: string | null;
}

interface TableCheck {
  expected: string[];
  found: string[];
  missing: string[];
  /** Migrations that need to run (heuristic; based on missing tables). */
  needsMigrations: string[];
}

function checkEnvs(): { boot: EnvCheck[]; recommended: EnvCheck[] } {
  const boot = BOOT_REQUIRED_ENVS.map((name) => {
    const v = process.env[name];
    const result: EnvCheck = { name, present: !!v };
    if (name === "DATABASE_URL" && v) {
      // Hash the value (first 8 chars of sha256) so operators can
      // confirm which DATABASE_URL is set without leaking it.
      result.hash = createHash("sha256").update(v).digest("hex").slice(0, 8);
    }
    return result;
  });
  const recommended = RECOMMENDED_ENVS.map((name) => ({
    name,
    present: !!process.env[name],
  }));
  return { boot, recommended };
}

function extractHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return null;
  }
}

async function checkDb(): Promise<DbCheck> {
  if (!process.env.DATABASE_URL) {
    return {
      reachable: false,
      error: "DATABASE_URL not set",
      latencyMs: null,
      host: null,
    };
  }
  const host = extractHost(process.env.DATABASE_URL);
  const start = Date.now();
  try {
    const { db } = await import("@/db");
    await db.execute(sql`SELECT 1 AS ping`);
    return {
      reachable: true,
      error: null,
      latencyMs: Date.now() - start,
      host,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn("DB diagnose failed", { error: msg, host });
    return {
      reachable: false,
      error: msg,
      latencyMs: Date.now() - start,
      host,
    };
  }
}

async function checkTables(): Promise<TableCheck> {
  const expected = [...EXPECTED_TABLES_CORE, ...EXPECTED_TABLES_R26_R32];
  if (!process.env.DATABASE_URL) {
    return { expected, found: [], missing: expected, needsMigrations: ["unknown — DB unreachable"] };
  }
  try {
    const { db } = await import("@/db");
    // information_schema.tables is the standard SQL-spec way to enumerate.
    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `);
    const rows = (result as unknown as { rows: Array<{ table_name: string }> }).rows ?? [];
    const found = rows.map((r) => r.table_name).sort();
    const missing = expected.filter((t) => !found.includes(t));
    const needsMigrations: string[] = [];
    if (missing.includes("jobs")) needsMigrations.push("0002_async_jobs.sql");
    if (missing.includes("playbook_runs")) needsMigrations.push("0003_playbook_runs.sql");
    if (missing.includes("hitl_approval_requests") || missing.includes("execution_audit_log")) {
      needsMigrations.push("0041_hitl_and_execution_audit.sql");
    }
    if (missing.includes("tenant_cost_ledger") || missing.includes("platform_health_snapshots")) {
      needsMigrations.push("0042_platform_health_and_cost_runaway.sql");
    }
    if (missing.includes("agent_traces")) {
      needsMigrations.push("0043_agent_traces.sql");
    }
    if (missing.includes("agent_spend_authorizations") || missing.includes("agent_spend_charges")) {
      needsMigrations.push("0044_agent_spend_authorizations.sql");
    }
    return { expected, found, missing, needsMigrations };
  } catch (err) {
    log.warn("Table diagnose failed", { error: String(err) });
    return {
      expected,
      found: [],
      missing: expected,
      needsMigrations: ["unknown — table query failed"],
    };
  }
}

function diagnose(env: ReturnType<typeof checkEnvs>, dbCheck: DbCheck, tableCheck: TableCheck): {
  status: "healthy" | "degraded" | "broken";
  summary: string;
  hints: string[];
} {
  const hints: string[] = [];
  const missingBoot = env.boot.filter((e) => !e.present).map((e) => e.name);
  if (missingBoot.length > 0) {
    hints.push(
      `Set boot-required env vars in Vercel: ${missingBoot.join(", ")}. See docs/TIER-S-CHECKLIST.md.`,
    );
  }
  if (!dbCheck.reachable) {
    hints.push(
      `Database unreachable (${dbCheck.host ?? "unknown host"}). Common causes: ` +
        `(1) Neon branch paused — wake via dashboard or new connection. ` +
        `(2) DATABASE_URL points at wrong branch. ` +
        `(3) sslmode=require missing from URL.`,
    );
  }
  if (tableCheck.needsMigrations.length > 0 && tableCheck.needsMigrations[0] !== "unknown — DB unreachable") {
    hints.push(
      `Run pending migrations: ${tableCheck.needsMigrations.join(", ")}. ` +
        `Use \`DATABASE_URL='...' node scripts/apply-prod-migrations.mjs\`.`,
    );
  }
  // Status determination
  if (missingBoot.length > 0) {
    return {
      status: "broken",
      summary: `${missingBoot.length} boot-required env var(s) missing. Platform will refuse to boot.`,
      hints,
    };
  }
  if (!dbCheck.reachable) {
    return {
      status: "broken",
      summary: "Database unreachable.",
      hints,
    };
  }
  if (tableCheck.missing.length > 0) {
    return {
      status: "degraded",
      summary: `${tableCheck.missing.length} expected table(s) missing — features depending on them will fail.`,
      hints,
    };
  }
  return {
    status: "healthy",
    summary: "All boot-required envs present, DB reachable, all expected tables exist.",
    hints: hints.length > 0 ? hints : [],
  };
}

export async function GET() {
  const t0 = Date.now();
  const env = checkEnvs();
  const dbCheck = await checkDb();
  const tableCheck = await checkTables();
  const verdict = diagnose(env, dbCheck, tableCheck);

  return NextResponse.json(
    {
      status: verdict.status,
      summary: verdict.summary,
      hints: verdict.hints,
      env: {
        boot: env.boot,
        recommended: env.recommended,
      },
      database: dbCheck,
      tables: tableCheck,
      generatedAt: new Date().toISOString(),
      generatedInMs: Date.now() - t0,
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=30, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
