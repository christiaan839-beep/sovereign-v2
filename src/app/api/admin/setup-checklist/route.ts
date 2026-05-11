/**
 * SETUP CHECKLIST — GET /api/admin/setup-checklist
 *
 * Admin-only endpoint that returns the current readiness state of the
 * platform: which env vars are set, which migrations have been applied,
 * which webhook secrets are configured. Powers the /dashboard/admin/setup
 * UI page so the operator can see green/red ticks instead of guessing.
 *
 * The checks are deliberately conservative — they verify presence, not
 * correctness. A populated env var with a wrong value will read as OK
 * here; that surfaces at runtime as an integration failure.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("setup-checklist");

export const dynamic = "force-dynamic";

type Status = "ok" | "missing" | "error";

interface CheckItem {
  label: string;
  status: Status;
  hint?: string;
}

interface CheckCategory {
  name: string;
  items: CheckItem[];
}

interface ChecklistResponse {
  categories: CheckCategory[];
  summary: { total: number; ok: number; missing: number; errors: number };
  generatedAt: string;
}

function envCheck(name: string, hint: string, required = true): CheckItem {
  const value = process.env[name];
  return {
    label: name,
    status:
      value && value.trim().length > 0
        ? "ok"
        : required
          ? "missing"
          : "missing",
    hint: value ? undefined : hint,
  };
}

async function tableCheck(
  table: string,
  migration: string,
): Promise<CheckItem> {
  try {
    // SELECT 1 FROM <table> LIMIT 0 — fastest possible existence check.
    // LIMIT 0 returns no rows; we only care that the planner can resolve
    // the relation, so an empty result == table exists.
    await db.execute(sql.raw(`SELECT 1 FROM "${table}" LIMIT 0`));
    return { label: table, status: "ok" };
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      return {
        label: table,
        status: "missing",
        hint: `Apply ${migration} in Neon SQL Editor`,
      };
    }
    log.warn("table check errored", { table, error: msg });
    return {
      label: table,
      status: "error",
      hint: "Database query failed — check connection and Neon status",
    };
  }
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const categories: CheckCategory[] = [];

  // ── Critical env (platform malfunctions without these) ──────────────
  categories.push({
    name: "Critical env",
    items: [
      envCheck("DATABASE_URL", "Neon Postgres connection string"),
      envCheck(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "Clerk Dashboard → API keys",
      ),
      envCheck("CLERK_SECRET_KEY", "Clerk Dashboard → API keys"),
      envCheck(
        "ENCRYPTION_KEY",
        "Random string ≥32 chars used for safeEncrypt of stored secrets",
      ),
      envCheck("CRON_SECRET", "Random string used to authorize cron endpoints"),
    ],
  });

  // ── Payments ──
  categories.push({
    name: "Payments (Stripe)",
    items: [
      envCheck("STRIPE_SECRET_KEY", "Stripe Dashboard → Developers → API keys"),
      envCheck(
        "STRIPE_WEBHOOK_SECRET",
        "Stripe Dashboard → Webhooks → Signing secret",
      ),
      envCheck("STRIPE_PRICE_STARTER", "Stripe Price ID for Starter plan"),
      envCheck("STRIPE_PRICE_ARRAY", "Stripe Price ID for Array plan"),
      envCheck("STRIPE_PRICE_NODE", "Stripe Price ID for Node plan"),
      envCheck(
        "STRIPE_PRICE_ENTERPRISE",
        "Stripe Price ID for Enterprise plan",
      ),
    ],
  });

  // ── Webhooks ──
  categories.push({
    name: "Webhook signing secrets",
    items: [
      envCheck(
        "CLERK_WEBHOOK_SECRET",
        "Clerk Dashboard → Webhooks → Signing secret",
      ),
      envCheck(
        "HUBSPOT_CLIENT_SECRET",
        "HubSpot Developer App → Auth → Client secret",
      ),
      envCheck(
        "CALCOM_WEBHOOK_SECRET",
        "Cal.com → Webhooks → Signing secret",
        false,
      ),
      envCheck(
        "YOCO_WEBHOOK_SECRET",
        "Yoco → Webhooks → Signing secret",
        false,
      ),
      envCheck(
        "TELEGRAM_WEBHOOK_SECRET",
        "Random string for Telegram webhook verification",
        false,
      ),
    ],
  });

  // ── Email & comms ──
  categories.push({
    name: "Email & comms",
    items: [
      envCheck("RESEND_API_KEY", "Resend → API keys"),
      envCheck("RESEND_FROM_EMAIL", "Verified sender address", false),
      envCheck("TELEGRAM_BOT_TOKEN", "BotFather → /newbot → token", false),
    ],
  });

  // ── AI providers ──
  categories.push({
    name: "AI providers (need at least one)",
    items: [
      envCheck("GOOGLE_GENERATIVE_AI_API_KEY", "Google AI Studio → API key"),
      envCheck("NVIDIA_NIM_API_KEY", "build.nvidia.com → API key (free)"),
      envCheck("ANTHROPIC_API_KEY", "console.anthropic.com → API keys", false),
      envCheck("CEREBRAS_API_KEY", "inference.cerebras.ai → API keys", false),
      envCheck("GROQ_API_KEY", "console.groq.com → API keys", false),
    ],
  });

  // ── Admin ──
  categories.push({
    name: "Admin & ops",
    items: [
      envCheck(
        "ADMIN_USER_IDS",
        "Comma-separated Clerk user IDs allowed to grant credits / call admin routes",
      ),
      envCheck(
        "UPSTASH_REDIS_REST_URL",
        "Upstash → REST URL (used for distributed rate limiting + idempotency)",
      ),
      envCheck("UPSTASH_REDIS_REST_TOKEN", "Upstash → REST Token"),
    ],
  });

  // ── Database migrations ──
  // Listed in migration order; missing-out-of-order means the operator
  // ran some but not the rest, which is the most common failure mode.
  const migrationChecks = await Promise.all([
    tableCheck("jobs", "drizzle/0002_async_jobs.sql"),
    tableCheck("playbook_runs", "drizzle/0003_playbook_runs.sql"),
    tableCheck("audit_logs", "drizzle/0004_remaining_tables.sql"),
    tableCheck("graph_nodes", "drizzle/0004_remaining_tables.sql"),
    tableCheck("workflows", "drizzle/0004_remaining_tables.sql"),
    tableCheck("affiliates", "drizzle/0004_remaining_tables.sql"),
    tableCheck("tenant_memories", "drizzle/0004_remaining_tables.sql"),
    tableCheck("user_credits", "drizzle/0017_semantic_memory.sql"),
    tableCheck("credit_transactions", "drizzle/0017_semantic_memory.sql"),
    tableCheck("case_studies", "drizzle/0018_finishing_tables.sql"),
    tableCheck("oauth_connections", "drizzle/0018_finishing_tables.sql"),
    tableCheck("stripe_events", "drizzle/0018_finishing_tables.sql"),
  ]);
  categories.push({ name: "Database migrations", items: migrationChecks });

  // ── Tally ──
  let total = 0;
  let ok = 0;
  let missing = 0;
  let errors = 0;
  for (const cat of categories) {
    for (const item of cat.items) {
      total++;
      if (item.status === "ok") ok++;
      else if (item.status === "missing") missing++;
      else errors++;
    }
  }

  const payload: ChecklistResponse = {
    categories,
    summary: { total, ok, missing, errors },
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
