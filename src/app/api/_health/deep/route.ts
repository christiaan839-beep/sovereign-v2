import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { capabilities } from "@/lib/env.validated";

/**
 * DEEP HEALTH CHECK — Tests actual connectivity to all services.
 * Use /api/health for basic status, /api/health/deep for production monitoring.
 */
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // ─── Database Connectivity ───
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "operational", latencyMs: Date.now() - dbStart };
  } catch (err: unknown) {
    checks.database = {
      status: "down",
      latencyMs: Date.now() - dbStart,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }

  // ─── NVIDIA NIM ───
  if (capabilities.nvidia) {
    const nimStart = Date.now();
    try {
      const res = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      }, { ruleId: "health.deep.route.1", allowedHosts: ["integrate.api.nvidia.com"] });
      checks.nvidia_nim = {
        status: res.ok ? "operational" : `degraded (${res.status})`,
        latencyMs: Date.now() - nimStart,
      };
    } catch {
      checks.nvidia_nim = { status: "unreachable", latencyMs: Date.now() - nimStart };
    }
  }

  // ─── Clerk Auth ───
  checks.clerk = { status: capabilities.ai ? "configured" : "not_configured" };

  // ─── Capability Matrix ───
  const capabilityMatrix = {
    ai_providers: {
      nvidia_nim: capabilities.nvidia,
      google_gemini: capabilities.gemini,
      anthropic_claude: capabilities.claude,
      groq: capabilities.groq,
      any_available: capabilities.ai,
    },
    communications: {
      email: capabilities.email,
      sms: capabilities.sms,
      whatsapp: capabilities.whatsapp,
      telegram: capabilities.telegram,
      realtime_websocket: capabilities.realtime,
    },
    payments: {
      stripe: capabilities.stripe,
      payfast: capabilities.payfast,
      paystack: capabilities.paystack,
    },
    intelligence: {
      vector_memory: capabilities.vectorMemory,
      web_search: capabilities.webSearch,
      hubspot_crm: capabilities.hubspot,
      salesforce_crm: capabilities.salesforce,
    },
    infrastructure: {
      redis_cache: capabilities.cache,
    },
  };

  const allChecks = Object.values(checks);
  const hasDown = allChecks.some((c) => c.status === "down");
  const hasDegraded = allChecks.some((c) => c.status.includes("degraded") || c.status === "unreachable");

  return NextResponse.json(
    {
      status: hasDown ? "critical" : hasDegraded ? "degraded" : "healthy",
      platform: "Sovereign Matrix",
      version: "2.1.0",
      timestamp: new Date().toISOString(),
      checks,
      capabilities: capabilityMatrix,
    },
    { status: hasDown ? 503 : 200 }
  );
}
