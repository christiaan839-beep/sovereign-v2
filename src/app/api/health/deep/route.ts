import { NextResponse } from "next/server";

/**
 * DEEP HEALTH CHECK — Comprehensive platform status.
 * Checks every service, API key, and dependency.
 * Used by: /status page, monitoring, admin panel.
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export async function GET() {
  const start = Date.now();
  const checks: Record<
    string,
    { status: "ok" | "degraded" | "down"; latency_ms: number; detail?: string }
  > = {};

  // Check NVIDIA NIM
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  if (nimKey) {
    const nimStart = Date.now();
    try {
      const res = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/models", {
        headers: { Authorization: `Bearer ${nimKey}` },
        signal: AbortSignal.timeout(5000),
      }, { ruleId: "health.deep.route.1", allowedHosts: ["integrate.api.nvidia.com"] });
      checks.nvidia_nim = {
        status: res.ok ? "ok" : "degraded",
        latency_ms: Date.now() - nimStart,
      };
    } catch {
      checks.nvidia_nim = {
        status: "down",
        latency_ms: Date.now() - nimStart,
        detail: "Timeout or unreachable",
      };
    }
  } else {
    checks.nvidia_nim = {
      status: "down",
      latency_ms: 0,
      detail: "API key not configured",
    };
  }

  // Check Gemini
  const geminiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  checks.gemini = geminiKey
    ? { status: "ok", latency_ms: 0, detail: "Key configured" }
    : { status: "down", latency_ms: 0, detail: "API key not configured" };

  // Check Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  checks.anthropic = anthropicKey
    ? { status: "ok", latency_ms: 0, detail: "Key configured" }
    : { status: "down", latency_ms: 0, detail: "API key not configured" };

  // Check Groq
  const groqKey = process.env.GROQ_API_KEY;
  checks.groq = groqKey
    ? { status: "ok", latency_ms: 0, detail: "Key configured" }
    : { status: "down", latency_ms: 0, detail: "Not configured (optional)" };

  // Check Database
  try {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok", latency_ms: Date.now() - dbStart };
  } catch {
    checks.database = {
      status: "down",
      latency_ms: 0,
      detail: "DATABASE_URL not configured or unreachable",
    };
  }

  // Check Stripe
  checks.stripe = process.env.STRIPE_SECRET_KEY
    ? { status: "ok", latency_ms: 0, detail: "Key configured" }
    : { status: "down", latency_ms: 0, detail: "Not configured" };

  // Check Resend
  checks.email = process.env.RESEND_API_KEY
    ? { status: "ok", latency_ms: 0, detail: "Key configured" }
    : { status: "down", latency_ms: 0, detail: "Not configured" };

  // Check Clerk
  checks.auth = process.env.CLERK_SECRET_KEY
    ? { status: "ok", latency_ms: 0, detail: "Key configured" }
    : { status: "down", latency_ms: 0, detail: "Not configured" };

  // Summary
  const total = Object.keys(checks).length;
  const healthy = Object.values(checks).filter((c) => c.status === "ok").length;
  const degraded = Object.values(checks).filter(
    (c) => c.status === "degraded",
  ).length;

  return NextResponse.json({
    status:
      healthy === total ? "healthy" : degraded > 0 ? "degraded" : "partial",
    healthy,
    total,
    uptime_percent: Math.round((healthy / total) * 1000) / 10,
    checks,
    checked_at: new Date().toISOString(),
    total_latency_ms: Date.now() - start,
  });
}
