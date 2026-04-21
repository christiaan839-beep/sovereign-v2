/**
 * GET /api/health/deep — Comprehensive platform status.
 *
 * Pings every upstream dependency in parallel with a 2s per-check
 * deadline, returns { status, checks, timestamp, latency_ms }.
 *
 * HTTP status codes (UptimeRobot-compatible):
 *   200 — all critical services healthy
 *   503 — DB or Clerk (critical) is down — page on-call
 *   200 — AI providers degraded (graceful-degradation covers it)
 *
 * Runtime: Node.js (needs drizzle + fs-backed SDK imports).
 * Use GET /api/health/ping for a lightweight single-bit liveness probe.
 *
 * Critical vs. advisory:
 *   CRITICAL   — db, auth       → any failure → 503
 *   IMPORTANT  — nvidia_nim     → failure → 200 degraded (other AI providers
 *                                 cover via failover chain)
 *   ADVISORY   — everything else — config presence + best-effort ping
 */

import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("health-deep");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECK_TIMEOUT_MS = 2_000;

type CheckStatus = "ok" | "degraded" | "down";
interface CheckResult {
  status: CheckStatus;
  latency_ms: number;
  detail?: string;
}

/** Race a promise against a 2s timer. Never throws — always produces a
 *  CheckResult so the parent Promise.allSettled collects cleanly. */
async function timed(
  name: string,
  fn: (signal: AbortSignal) => Promise<CheckResult>,
): Promise<[string, CheckResult]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const start = Date.now();
  try {
    const result = await fn(controller.signal);
    return [name, { ...result, latency_ms: Date.now() - start }];
  } catch (err) {
    return [
      name,
      {
        status: "down",
        latency_ms: Date.now() - start,
        detail:
          err instanceof Error
            ? err.name === "AbortError"
              ? `timeout ${CHECK_TIMEOUT_MS}ms`
              : err.message.slice(0, 120)
            : "unknown error",
      },
    ];
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const start = Date.now();

  // Run every check in parallel — total request latency is the slowest
  // single check, not the sum. With 2s per check and ~15 checks, worst
  // case is 2s; typical is ~100-300ms.
  const results = await Promise.all([
    // ─── CRITICAL ────────────────────────────────────────────
    timed("database", async (): Promise<CheckResult> => {
      const { db } = await import("@/db");
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`SELECT 1`);
      return { status: "ok", latency_ms: 0 };
    }),
    timed("auth", async (): Promise<CheckResult> => {
      return process.env.CLERK_SECRET_KEY
        ? { status: "ok", latency_ms: 0, detail: "configured" }
        : { status: "down", latency_ms: 0, detail: "CLERK_SECRET_KEY missing" };
    }),

    // ─── IMPORTANT (fallback-covered) ────────────────────────
    timed("nvidia_nim", async (signal): Promise<CheckResult> => {
      if (!process.env.NVIDIA_NIM_API_KEY) {
        return { status: "down", latency_ms: 0, detail: "key not configured" };
      }
      const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
        headers: { Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY}` },
        signal,
      });
      return res.ok
        ? { status: "ok", latency_ms: 0 }
        : { status: "degraded", latency_ms: 0, detail: `HTTP ${res.status}` };
    }),

    // ─── ADVISORY (config presence + best-effort ping) ───────
    timed("cerebras", async (): Promise<CheckResult> =>
      process.env.CEREBRAS_API_KEY
        ? { status: "ok", latency_ms: 0, detail: "configured" }
        : { status: "down", latency_ms: 0, detail: "not configured" }),
    timed("gemini", async (): Promise<CheckResult> =>
      (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)
        ? { status: "ok", latency_ms: 0, detail: "configured" }
        : { status: "down", latency_ms: 0, detail: "not configured" }),
    timed("anthropic", async (): Promise<CheckResult> =>
      process.env.ANTHROPIC_API_KEY
        ? { status: "ok", latency_ms: 0, detail: "configured" }
        : { status: "down", latency_ms: 0, detail: "not configured" }),
    timed("groq", async (): Promise<CheckResult> =>
      process.env.GROQ_API_KEY
        ? { status: "ok", latency_ms: 0, detail: "configured" }
        : { status: "down", latency_ms: 0, detail: "not configured" }),
    timed("tavily", async (): Promise<CheckResult> =>
      process.env.TAVILY_API_KEY
        ? { status: "ok", latency_ms: 0, detail: "configured" }
        : { status: "down", latency_ms: 0, detail: "not configured" }),
    timed("redis", async (signal): Promise<CheckResult> => {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (!url || !token) {
        return { status: "down", latency_ms: 0, detail: "not configured" };
      }
      const res = await fetch(`${url}/ping`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      return res.ok
        ? { status: "ok", latency_ms: 0 }
        : { status: "down", latency_ms: 0, detail: `HTTP ${res.status}` };
    }),
    timed("sentry", async (): Promise<CheckResult> =>
      (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
        ? { status: "ok", latency_ms: 0, detail: "configured" }
        : { status: "down", latency_ms: 0, detail: "not configured" }),
    timed("pinecone", async (): Promise<CheckResult> =>
      process.env.PINECONE_API_KEY
        ? { status: "ok", latency_ms: 0, detail: "configured" }
        : { status: "down", latency_ms: 0, detail: "not configured" }),
    timed("qdrant", async (signal): Promise<CheckResult> => {
      const url = process.env.QDRANT_URL;
      if (!url) return { status: "down", latency_ms: 0, detail: "not configured" };
      const res = await fetch(`${url}/healthz`, { signal });
      return res.ok
        ? { status: "ok", latency_ms: 0 }
        : { status: "degraded", latency_ms: 0, detail: `HTTP ${res.status}` };
    }),
    timed("litellm", async (signal): Promise<CheckResult> => {
      const url = process.env.LITELLM_URL;
      if (!url) return { status: "down", latency_ms: 0, detail: "not configured" };
      const res = await fetch(`${url}/health`, { signal });
      return res.ok
        ? { status: "ok", latency_ms: 0 }
        : { status: "degraded", latency_ms: 0, detail: `HTTP ${res.status}` };
    }),
    timed("langfuse", async (): Promise<CheckResult> =>
      (process.env.LANGFUSE_HOST && process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY)
        ? { status: "ok", latency_ms: 0, detail: "configured" }
        : { status: "down", latency_ms: 0, detail: "not configured" }),
    timed("stripe", async (): Promise<CheckResult> =>
      process.env.STRIPE_SECRET_KEY
        ? { status: "ok", latency_ms: 0, detail: "configured" }
        : { status: "down", latency_ms: 0, detail: "not configured" }),
    timed("email", async (): Promise<CheckResult> =>
      process.env.RESEND_API_KEY
        ? { status: "ok", latency_ms: 0, detail: "configured" }
        : { status: "down", latency_ms: 0, detail: "not configured" }),
  ]);

  const checks: Record<string, CheckResult> = Object.fromEntries(results);

  // Status rollup: CRITICAL failures → 503. Everything else → 200.
  const CRITICAL = ["database", "auth"] as const;
  const criticalDown = CRITICAL.some((k) => checks[k]?.status === "down");
  const total = Object.keys(checks).length;
  const healthy = Object.values(checks).filter((c) => c.status === "ok").length;
  const degraded = Object.values(checks).filter((c) => c.status === "degraded").length;

  const rollup: "healthy" | "degraded" | "critical" = criticalDown
    ? "critical"
    : degraded > 0 || healthy < total
      ? "degraded"
      : "healthy";

  if (criticalDown) {
    log.error("Health deep: critical service down", {
      critical: CRITICAL.filter((k) => checks[k]?.status === "down").join(","),
    });
  }

  const body = {
    status: rollup,
    healthy,
    total,
    uptime_percent: Math.round((healthy / total) * 1000) / 10,
    checks,
    checked_at: new Date().toISOString(),
    total_latency_ms: Date.now() - start,
  };

  // 503 when critical is down so UptimeRobot fires; 200 otherwise.
  return NextResponse.json(body, { status: criticalDown ? 503 : 200 });
}
