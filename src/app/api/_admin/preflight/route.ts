import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-preflight");

/**
 * GET /api/_admin/preflight
 *
 * The single source of truth for "is this deployment ready to take
 * real money?" Surfaces every dimension that must be green before
 * flipping a customer-facing payment provider live:
 *
 *   - Required env vars present
 *   - Critical migrations applied (column-level introspection)
 *   - Webhook secrets configured
 *   - Payment gateways wired
 *   - Observability stack alive (Sentry, Phoenix optional)
 *   - Test seed: an active tenant exists, can the DB respond
 *
 * Each check returns one of:
 *   { ok: true }
 *   { ok: false, reason: string }
 *   { ok: "warn", reason: string }   ← optional, not a blocker
 *
 * The /admin/preflight page renders this as a green/red traffic
 * light grid. Blockers are show-stoppers for go-live; warnings are
 * "fix soon, but you can ship without them."
 *
 * No PII is returned. The reason strings are operator-facing and
 * never echo a key value or token.
 */

interface CheckResult {
  ok: true | false | "warn";
  reason?: string;
}

interface CheckGroup {
  name: string;
  checks: Record<string, CheckResult>;
}

function envOk(varName: string): CheckResult {
  return process.env[varName]?.trim()
    ? { ok: true }
    : { ok: false, reason: `${varName} not set` };
}

function envOptional(varName: string, hint: string): CheckResult {
  return process.env[varName]?.trim()
    ? { ok: true }
    : { ok: "warn", reason: hint };
}

async function columnExists(
  table: string,
  column: string,
): Promise<CheckResult> {
  try {
    const rows = (await db.execute(sql`
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ${table}
         AND column_name = ${column}
       LIMIT 1
    `)) as unknown as { rows?: unknown[] } | unknown[];
    const len = Array.isArray(rows) ? rows.length : (rows.rows?.length ?? 0);
    return len > 0
      ? { ok: true }
      : {
          ok: false,
          reason: `${table}.${column} missing — apply MIGRATIONS-RUNME.sql`,
        };
  } catch (err) {
    return {
      ok: false,
      reason: `DB unreachable: ${(err as Error).message.slice(0, 80)}`,
    };
  }
}

async function tableExists(table: string): Promise<CheckResult> {
  try {
    const rows = (await db.execute(sql`
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ${table}
       LIMIT 1
    `)) as unknown as { rows?: unknown[] } | unknown[];
    const len = Array.isArray(rows) ? rows.length : (rows.rows?.length ?? 0);
    return len > 0
      ? { ok: true }
      : {
          ok: false,
          reason: `${table} missing — apply MIGRATIONS-RUNME.sql`,
        };
  } catch (err) {
    return {
      ok: false,
      reason: `DB unreachable: ${(err as Error).message.slice(0, 80)}`,
    };
  }
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  // Run all DB checks in parallel.
  const [
    tenantsExists,
    deploymentProfileCol,
    isSuspendedCol,
    usageTenantIdCol,
    customerDeliveriesExists,
    fridayLettersExists,
    webhookEventsExists,
    auditLogsExists,
  ] = await Promise.all([
    tableExists("tenants"),
    columnExists("tenants", "deployment_profile"),
    columnExists("tenants", "is_suspended"),
    columnExists("usage", "tenant_id"),
    tableExists("customer_deliveries"),
    tableExists("friday_letters"),
    tableExists("webhook_events"),
    tableExists("audit_logs"),
  ]);

  const groups: CheckGroup[] = [
    {
      name: "Database core",
      checks: {
        tenants: tenantsExists,
        usage_tenant_id: usageTenantIdCol,
        customer_deliveries: customerDeliveriesExists,
        friday_letters: fridayLettersExists,
        webhook_events: webhookEventsExists,
        audit_logs: auditLogsExists,
      },
    },
    {
      name: "Sovereign features (0023 + 0024)",
      checks: {
        deployment_profile_column: deploymentProfileCol,
        is_suspended_column: isSuspendedCol,
      },
    },
    {
      name: "Required env",
      checks: {
        DATABASE_URL: envOk("DATABASE_URL"),
        CLERK_SECRET_KEY: envOk("CLERK_SECRET_KEY"),
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: envOk(
          "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        ),
        NEXT_PUBLIC_APP_URL: envOk("NEXT_PUBLIC_APP_URL"),
        ADMIN_USER_IDS: envOk("ADMIN_USER_IDS"),
      },
    },
    {
      name: "Inference (at least one strongly recommended)",
      checks: {
        NVIDIA_NIM_API_KEY: envOptional(
          "NVIDIA_NIM_API_KEY",
          "Set for $0 default inference via build.nvidia.com",
        ),
        ANTHROPIC_API_KEY: envOptional(
          "ANTHROPIC_API_KEY",
          "Optional — paid Claude fallback",
        ),
        GEMINI_API_KEY: envOptional(
          "GEMINI_API_KEY",
          "Optional — paid Gemini fallback",
        ),
      },
    },
    {
      name: "Auth + webhook signing",
      checks: {
        CLERK_WEBHOOK_SECRET: envOk("CLERK_WEBHOOK_SECRET"),
        CRON_SECRET: envOk("CRON_SECRET"),
      },
    },
    {
      name: "Payments (configure at least one)",
      checks: {
        PayPal:
          process.env.PAYPAL_CLIENT_ID &&
          process.env.PAYPAL_CLIENT_SECRET &&
          process.env.PAYPAL_WEBHOOK_ID
            ? { ok: true }
            : {
                ok: "warn",
                reason:
                  "Set PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET + PAYPAL_WEBHOOK_ID",
              },
        Yoco:
          process.env.YOCO_SECRET_KEY && process.env.YOCO_WEBHOOK_SECRET
            ? { ok: true }
            : {
                ok: "warn",
                reason: "Set YOCO_SECRET_KEY + YOCO_WEBHOOK_SECRET",
              },
        PayFast:
          process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY
            ? { ok: true }
            : {
                ok: "warn",
                reason: "Set PAYFAST_MERCHANT_ID + PAYFAST_MERCHANT_KEY",
              },
        Paystack: envOptional(
          "PAYSTACK_SECRET_KEY",
          "Optional — South African / NGN flow",
        ),
      },
    },
    {
      name: "Reliability",
      checks: {
        UPSTASH_REDIS:
          process.env.UPSTASH_REDIS_REST_URL &&
          process.env.UPSTASH_REDIS_REST_TOKEN
            ? { ok: true }
            : {
                ok: "warn",
                reason:
                  "Set UPSTASH_REDIS_REST_URL + token for shared rate-limit + idempotency tier",
              },
        SENTRY_DSN: envOptional(
          "SENTRY_DSN",
          "Strongly recommended — error tracking + breadcrumbs",
        ),
      },
    },
    {
      name: "Operations",
      checks: {
        RESEND_API_KEY: envOptional(
          "RESEND_API_KEY",
          "Required for welcome email + delivery notifications",
        ),
        SLACK_OPS_WEBHOOK_URL: envOptional(
          "SLACK_OPS_WEBHOOK_URL",
          "Error-watcher cron pages here when high-severity errors land",
        ),
        MCP_API_KEY: envOptional(
          "MCP_API_KEY",
          "Production should set — gates the public /api/mcp endpoint",
        ),
      },
    },
    {
      name: "Observability (optional)",
      checks: {
        PHOENIX_OTLP_ENDPOINT: envOptional(
          "PHOENIX_OTLP_ENDPOINT",
          "Set to OTLP/HTTP collector to capture AI traces",
        ),
        LLAMA_FIREWALL_ENDPOINT: envOptional(
          "LLAMA_FIREWALL_ENDPOINT",
          "Output verifier Layer 6 — falls back to Layer 1-5 when unset",
        ),
      },
    },
  ];

  // Aggregate counts across groups.
  let blockers = 0;
  let warnings = 0;
  let greens = 0;
  for (const g of groups) {
    for (const c of Object.values(g.checks)) {
      if (c.ok === true) greens++;
      else if (c.ok === false) blockers++;
      else warnings++;
    }
  }

  const verdict =
    blockers === 0 && warnings === 0
      ? "go"
      : blockers === 0
        ? "go-with-warnings"
        : "block";

  log.info("Preflight check ran", {
    adminUserId: gate.userId,
    verdict,
    blockers,
    warnings,
    greens,
  });

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    verdict,
    counts: { greens, warnings, blockers },
    groups,
  });
}
