import { NextResponse } from "next/server";

/**
 * READINESS PROBE — GET /api/health/ready
 *
 * The Kubernetes-style "should this instance receive traffic?" check.
 * Distinct from /api/health (returns 200 always, useful for liveness) and
 * /api/health/deep (returns rich diagnostics, never gates traffic).
 *
 * This endpoint:
 *   - returns 200 with `ready: true` only if every CRITICAL dependency
 *     responds within its timeout
 *   - returns 503 with `ready: false` and the failing component on degradation
 *
 * Wire this into Vercel's deploy hook (or your uptime monitor's pager) so a
 * deploy with broken integrations automatically fails the gate instead of
 * silently degrading customer experience.
 *
 * "Critical" = anything a logged-in user needs on the golden path:
 *   - Database (every authenticated request reads at least one table)
 *   - Auth provider (Clerk JWKS — without this, no session validates)
 *   - At least one AI provider (Gemini OR NIM OR Cerebras)
 *
 * "Optional" services (Stripe, Resend, Upstash, Telegram) are NOT in the
 * critical set — their absence degrades specific features but doesn't take
 * the platform down. Their state is reported, just not gated.
 *
 * Every probe has an explicit timeout. Slow dependencies don't hang the
 * health endpoint and starve the entire app pool.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROBE_TIMEOUT_MS = 2500;

type ProbeStatus = "ok" | "degraded" | "down" | "unconfigured";

interface ProbeResult {
  status: ProbeStatus;
  latencyMs: number;
  detail?: string;
}

async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return await Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`probe timeout (${timeoutMs}ms)`)),
        timeoutMs,
      ),
    ),
  ]);
}

async function probeDb(): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await withTimeout(() => db.execute(sql`SELECT 1 as ok`), PROBE_TIMEOUT_MS);
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeClerk(): Promise<ProbeResult> {
  const start = Date.now();
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pk) {
    return {
      status: "unconfigured",
      latencyMs: 0,
      detail: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not set",
    };
  }
  // Clerk publishable keys encode the frontend API host as a base64-ish
  // suffix. Decoding is fragile across SDK versions, so we just hit the
  // well-known JWKS endpoint via the Clerk Frontend API URL convention.
  // Any 200 response (even an empty key set) proves the key resolves.
  try {
    // pk_live_<base64-host> | pk_test_<base64-host>
    const encoded = pk.split("_").slice(2).join("_").replace(/\$+$/, "");
    let host: string | null = null;
    try {
      host = Buffer.from(encoded, "base64")
        .toString("utf-8")
        .replace(/\$+$/, "");
    } catch {
      host = null;
    }
    if (!host || !host.includes(".")) {
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        detail: "could not decode Clerk publishable key",
      };
    }
    const res = await withTimeout(
      () =>
        fetch(`https://${host}/.well-known/jwks.json`, {
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        }),
      PROBE_TIMEOUT_MS,
    );
    if (!res.ok) {
      return {
        status: "down",
        latencyMs: Date.now() - start,
        detail: `JWKS HTTP ${res.status}`,
      };
    }
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeRedis(): Promise<ProbeResult> {
  const start = Date.now();
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return {
      status: "unconfigured",
      latencyMs: 0,
      detail: "UPSTASH_REDIS_REST_URL/_TOKEN not set",
    };
  }
  try {
    const res = await withTimeout(
      () =>
        fetch(`${url}/ping`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        }),
      PROBE_TIMEOUT_MS,
    );
    if (!res.ok) {
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        detail: `Redis HTTP ${res.status}`,
      };
    }
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "degraded",
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function presenceProbe(envName: string, label: string): ProbeResult {
  return process.env[envName]
    ? { status: "ok", latencyMs: 0 }
    : {
        status: "unconfigured",
        latencyMs: 0,
        detail: `${envName} not set (${label})`,
      };
}

export async function GET() {
  const startedAt = Date.now();

  const [db, clerk, redis] = await Promise.all([
    probeDb(),
    probeClerk(),
    probeRedis(),
  ]);

  const stripe = presenceProbe("STRIPE_SECRET_KEY", "Stripe billing");
  const resend = presenceProbe("RESEND_API_KEY", "Resend email");
  const sentry = presenceProbe("SENTRY_DSN", "Sentry error tracking");

  const aiProviders = {
    gemini: presenceProbe("GOOGLE_GENERATIVE_AI_API_KEY", "Google Gemini"),
    nim: presenceProbe("NVIDIA_NIM_API_KEY", "NVIDIA NIM"),
    cerebras: presenceProbe("CEREBRAS_API_KEY", "Cerebras"),
    anthropic: presenceProbe("ANTHROPIC_API_KEY", "Anthropic"),
    groq: presenceProbe("GROQ_API_KEY", "Groq"),
  };

  const aiOk = Object.values(aiProviders).some((p) => p.status === "ok");

  // Critical = traffic-gating. If any of these are red, return 503.
  const criticalFailures: string[] = [];
  if (db.status !== "ok") criticalFailures.push(`db:${db.status}`);
  if (clerk.status !== "ok" && clerk.status !== "unconfigured")
    criticalFailures.push(`clerk:${clerk.status}`);
  // Unconfigured Clerk on a preview deploy is a real problem — keep it critical.
  if (clerk.status === "unconfigured")
    criticalFailures.push("clerk:unconfigured");
  if (!aiOk) criticalFailures.push("ai:no-provider-configured");

  const ready = criticalFailures.length === 0;

  const body = {
    ready,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    critical: {
      db,
      clerk,
      ai: { ok: aiOk, providers: aiProviders },
    },
    optional: {
      stripe,
      resend,
      redis,
      sentry,
    },
    failures: criticalFailures,
  };

  return NextResponse.json(body, {
    status: ready ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      // Surface readiness as a header so monitors can branch on it without
      // parsing the body.
      "X-Ready": ready ? "true" : "false",
    },
  });
}
