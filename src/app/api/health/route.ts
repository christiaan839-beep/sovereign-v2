import { NextResponse } from "next/server";

const startedAt = Date.now();

/**
 * HEALTH CHECK — /api/health
 *
 * NEVER crashes. NEVER returns 500. Always returns JSON with status.
 * Uses dynamic imports so a broken DB module can't take down the health endpoint.
 */
export async function GET() {
  try {
    const services: Record<string, string> = {};
    let dbLatencyMs = -1;

    // ── Database (dynamic import — if DB module crashes, we still respond) ──
    try {
      const { testConnection } = await import("@/db");
      const dbTest = await testConnection();
      dbLatencyMs = dbTest.latencyMs;
      services.db = dbTest.connected ? "ok" : "sleeping";
    } catch {
      services.db = "unreachable";
    }

    // ── NIM key presence ──
    services.nim = process.env.NVIDIA_NIM_API_KEY ? "ok" : "unconfigured";
    services.gemini = process.env.GEMINI_API_KEY ? "ok" : "unconfigured";
    services.claude = process.env.ANTHROPIC_API_KEY ? "ok" : "unconfigured";
    services.groq = process.env.GROQ_API_KEY ? "ok" : "unconfigured";

    // ── Redis / Upstash (for rate limiting) ──
    try {
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (redisUrl && redisToken) {
        const pingRes = await fetch(`${redisUrl}/ping`, {
          headers: { Authorization: `Bearer ${redisToken}` },
          signal: AbortSignal.timeout(2000),
        });
        services.redis = pingRes.ok ? "ok" : "error";
      } else {
        services.redis = "unconfigured";
      }
    } catch {
      services.redis = "unreachable";
    }

    // ── Email (Resend) ──
    // Two-tier check:
    //   1. RESEND_API_KEY presence ("ok" or "unconfigured")
    //   2. When RESEND_FROM_DOMAIN is set, verify the domain is
    //      "verified" via Resend's /domains endpoint. Catches the
    //      single biggest welcome-email failure mode: a key is set
    //      but the sender domain hasn't passed SPF/DKIM/DMARC, so
    //      every welcome email lands in spam silently.
    if (!process.env.RESEND_API_KEY) {
      services.email = "unconfigured";
    } else {
      const fromDomain = process.env.RESEND_FROM_DOMAIN?.trim();
      if (!fromDomain) {
        // Key present but no domain to verify — best we can do.
        services.email = "ok";
      } else {
        try {
          const res = await fetch("https://api.resend.com/domains", {
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
            signal: AbortSignal.timeout(2500),
          });
          if (!res.ok) {
            services.email = "error";
          } else {
            const body = (await res.json()) as {
              data?: Array<{ name: string; status: string }>;
            };
            const match = body.data?.find((d) => d.name === fromDomain);
            services.email = match?.status === "verified" ? "ok" : "warn";
          }
        } catch {
          // Resend timeout / network — don't fail the whole health
          // endpoint over an email deliverability check.
          services.email = "unreachable";
        }
      }
    }

    // ── Auth (Clerk) ──
    services.auth = process.env.CLERK_SECRET_KEY ? "ok" : "unconfigured";

    // ── Circuit breakers (dynamic import) ──
    let circuits = {};
    try {
      const { getCircuitStatus } = await import("@/lib/circuit-breaker");
      circuits = getCircuitStatus();
    } catch {
      /* skip */
    }

    // ── Model registry ──
    let modelSummary = { totalModels: 65 };
    try {
      const { getModelRegistry } = await import("@/lib/nvidia");
      const registry = getModelRegistry();
      modelSummary = { totalModels: registry.totalModels };
    } catch {
      /* skip */
    }

    // ── Agent registry ──
    let agentSummary = { totalAgents: 129 };
    try {
      const { AGENT_REGISTRY } = await import("@/app/api/agents/registry");
      agentSummary = { totalAgents: Object.keys(AGENT_REGISTRY).length };
    } catch {
      /* skip */
    }

    // ── Uptime ──
    const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

    // ── Overall status ──
    const dbOk = services.db === "ok";
    const status = dbOk ? "ok" : "degraded";

    return NextResponse.json({
      status,
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      services,
      database: { status: services.db, latencyMs: dbLatencyMs },
      circuits,
      models: modelSummary,
      agents: agentSummary,
    });
  } catch (err) {
    // Absolute last resort — NEVER return 500
    return NextResponse.json({
      status: "error",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
