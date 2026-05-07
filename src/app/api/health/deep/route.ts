import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { fetchWithTimeout, TimeoutError } from "@/lib/with-timeout";
import { withTimeout } from "@/lib/with-timeout";

/**
 * DEEP HEALTH CHECK — Comprehensive platform status.
 *
 * Returns the live health of every external dependency:
 *   - Database (Neon Postgres) — `SELECT 1`
 *   - NVIDIA NIM, Anthropic, Gemini, Groq — real model-list pings,
 *     parallel, 3s budget per provider
 *   - Resend, Clerk, Stripe — env-var presence (these don't expose
 *     a low-cost ping endpoint without burning API credits)
 *
 * All external pings run in parallel under `Promise.all` so the
 * total response is bounded by the slowest provider, not the sum.
 * Each provider individually wraps `AbortSignal.timeout(3000)` so a
 * stalled provider can't pin a Lambda.
 *
 * Used by: /status page, monitoring, admin panel, UptimeRobot.
 */

const PING_BUDGET_MS = 3000;

type CheckStatus = "ok" | "degraded" | "down";
interface Check {
  status: CheckStatus;
  latency_ms: number;
  detail?: string;
}

async function pingNim(): Promise<Check> {
  const key = process.env.NVIDIA_NIM_API_KEY;
  if (!key)
    return { status: "down", latency_ms: 0, detail: "API key not configured" };
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      "https://integrate.api.nvidia.com/v1/models",
      {
        headers: { Authorization: `Bearer ${key}` },
        timeoutMs: PING_BUDGET_MS,
        label: "nim-ping",
      },
    );
    return {
      status: res.ok ? "ok" : "degraded",
      latency_ms: Date.now() - start,
      detail: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      detail: err instanceof TimeoutError ? "Timed out" : "Unreachable",
    };
  }
}

async function pingAnthropic(): Promise<Check> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    return { status: "down", latency_ms: 0, detail: "API key not configured" };
  const start = Date.now();
  try {
    // GET /v1/models is auth-required and returns the model list
    // without consuming any token credits. Available since Aug 2024.
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      timeoutMs: PING_BUDGET_MS,
      label: "anthropic-ping",
    });
    return {
      status: res.ok ? "ok" : "degraded",
      latency_ms: Date.now() - start,
      detail: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      detail: err instanceof TimeoutError ? "Timed out" : "Unreachable",
    };
  }
}

async function pingGemini(): Promise<Check> {
  const key =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key)
    return { status: "down", latency_ms: 0, detail: "API key not configured" };
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { timeoutMs: PING_BUDGET_MS, label: "gemini-ping" },
    );
    return {
      status: res.ok ? "ok" : "degraded",
      latency_ms: Date.now() - start,
      detail: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      detail: err instanceof TimeoutError ? "Timed out" : "Unreachable",
    };
  }
}

async function pingGroq(): Promise<Check> {
  const key = process.env.GROQ_API_KEY;
  if (!key)
    return {
      status: "down",
      latency_ms: 0,
      detail: "Not configured (optional)",
    };
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      "https://api.groq.com/openai/v1/models",
      {
        headers: { Authorization: `Bearer ${key}` },
        timeoutMs: PING_BUDGET_MS,
        label: "groq-ping",
      },
    );
    return {
      status: res.ok ? "ok" : "degraded",
      latency_ms: Date.now() - start,
      detail: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      detail: err instanceof TimeoutError ? "Timed out" : "Unreachable",
    };
  }
}

async function pingDatabase(): Promise<Check> {
  if (!process.env.DATABASE_URL) {
    return {
      status: "down",
      latency_ms: 0,
      detail: "DATABASE_URL not configured",
    };
  }
  const start = Date.now();
  try {
    const { db } = await import("@/db");
    await withTimeout(db.execute(sql`SELECT 1`), PING_BUDGET_MS, "db-ping");
    return { status: "ok", latency_ms: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      detail: err instanceof TimeoutError ? "Timed out" : "Unreachable",
    };
  }
}

function envCheck(
  label: string,
  present: boolean,
  missingDetail = "Not configured",
): Check {
  return present
    ? { status: "ok", latency_ms: 0, detail: `${label} key configured` }
    : { status: "down", latency_ms: 0, detail: missingDetail };
}

export async function GET() {
  const start = Date.now();

  // All real pings run in parallel under one budget — total latency
  // is bounded by the slowest, not the sum.
  const [database, nvidia_nim, anthropic, gemini, groq] = await Promise.all([
    pingDatabase(),
    pingNim(),
    pingAnthropic(),
    pingGemini(),
    pingGroq(),
  ]);

  const checks: Record<string, Check> = {
    database,
    nvidia_nim,
    anthropic,
    gemini,
    groq,
    email: envCheck("Resend", !!process.env.RESEND_API_KEY),
    auth: envCheck("Clerk", !!process.env.CLERK_SECRET_KEY),
    payments_paypal: envCheck(
      "PayPal",
      !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    ),
    payments_yoco: envCheck(
      "Yoco",
      !!process.env.YOCO_SECRET_KEY,
      "Not configured (optional)",
    ),
    payments_stripe: envCheck(
      "Stripe",
      !!process.env.STRIPE_SECRET_KEY,
      "Not configured (optional)",
    ),
  };

  const total = Object.keys(checks).length;
  const healthy = Object.values(checks).filter((c) => c.status === "ok").length;
  const degraded = Object.values(checks).filter(
    (c) => c.status === "degraded",
  ).length;
  const down = Object.values(checks).filter((c) => c.status === "down").length;

  return NextResponse.json({
    status:
      healthy === total
        ? "healthy"
        : down > 0
          ? "down"
          : degraded > 0
            ? "degraded"
            : "partial",
    healthy,
    degraded,
    down,
    total,
    uptime_percent: Math.round((healthy / total) * 1000) / 10,
    checks,
    checked_at: new Date().toISOString(),
    total_latency_ms: Date.now() - start,
  });
}
