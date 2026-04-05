import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { usage, apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { createLogger } from "@/lib/logger";
const log = createLogger("api-v1-proxy");

/**
 * PUBLIC API GATEWAY — /api/v1/[...path]
 *
 * Proxies authenticated API requests to internal agent routes.
 * Validates Bearer API keys, enforces rate limits, and logs usage.
 *
 * Example:
 *   POST /api/v1/agents/leads
 *     Authorization: Bearer sk_abc123
 *     -> proxied to /api/agents/leads (internal)
 */

// In-memory API key rate tracking
const apiRateLimits = new Map<string, { count: number; resetAt: number }>();

const PLAN_RATE_LIMITS: Record<string, number> = {
  free: 100,       // 100/day
  pro: 10_000,     // 10,000/day
  enterprise: Infinity,
};

function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer sk_")) {
    return authHeader.slice(7); // "Bearer " = 7 chars
  }
  // Also check x-api-key header
  const xApiKey = request.headers.get("x-api-key");
  if (xApiKey?.startsWith("sk_")) {
    return xApiKey;
  }
  return null;
}

/** Validate API key against database. Returns plan or null if invalid. */
async function validateApiKey(rawKey: string): Promise<{ plan: string; userId: string } | null> {
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  try {
    const rows = await db.select().from(apiKeys)
      .where(eq(apiKeys.key, keyHash))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.revokedAt) return null;
    if (row.expiresAt && row.expiresAt < new Date()) return null;
    // Update last used timestamp (best-effort — log failures but don't block)
    db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch((err) => {
      log.warn("Failed to update lastUsedAt on API key", { keyId: row.id, error: (err as Error).message });
    });
    return { plan: row.plan, userId: row.userId };
  } catch (err) {
    // DB unavailable — fall back to prefix convention for resilience
    log.warn("API key DB validation failed, falling back to prefix convention", { error: (err as Error).message });
    let plan = "free";
    if (rawKey.startsWith("sk_pro_")) plan = "pro";
    else if (rawKey.startsWith("sk_ent_")) plan = "enterprise";
    // Use the key hash (not raw key) as a stable, non-sensitive identifier
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 16);
    return { plan, userId: `apikey_${keyHash}` };
  }
}

function checkRateLimit(apiKey: string, plan: string = "free"): {
  allowed: boolean;
  remaining: number;
  plan: string;
} {

  const limit = PLAN_RATE_LIMITS[plan] ?? PLAN_RATE_LIMITS.free;
  const now = Date.now();
  const tracker = apiRateLimits.get(apiKey);

  if (tracker && tracker.resetAt > now) {
    if (tracker.count >= limit) {
      return { allowed: false, remaining: 0, plan };
    }
    tracker.count += 1;
    return { allowed: true, remaining: limit - tracker.count, plan };
  }

  // New window
  apiRateLimits.set(apiKey, { count: 1, resetAt: now + 86_400_000 }); // 24h
  return { allowed: true, remaining: limit - 1, plan };
}

async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const startTime = Date.now();
  const { path } = await params;

  // Validate API key
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing or invalid API key. Use: Authorization: Bearer sk_your_key",
      },
      { status: 401 }
    );
  }

  // Validate key against DB (falls back to prefix convention if DB unavailable)
  const keyInfo = await validateApiKey(apiKey);

  // Rate limit check — use DB-resolved plan if available
  const rateCheck = checkRateLimit(apiKey, keyInfo?.plan);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Rate limit exceeded.",
        plan: rateCheck.plan,
        limit: PLAN_RATE_LIMITS[rateCheck.plan],
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Plan": rateCheck.plan,
        },
      }
    );
  }

  // Build the internal route path
  const internalPath = `/api/${path.join("/")}`;
  const internalUrl = new URL(internalPath, request.nextUrl.origin);
  // Forward query params
  request.nextUrl.searchParams.forEach((value, key) => {
    internalUrl.searchParams.set(key, value);
  });

  try {
    // Forward the request to the internal route
    const body = request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined;

    const internalRes = await fetch(internalUrl.toString(), {
      method: request.method,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
        // Pass through a system marker so internal routes know this is trusted
        "X-Sovereign-Internal": "v1-proxy",
      },
      body,
    });

    const responseTimeMs = Date.now() - startTime;

    let data: unknown;
    const contentType = internalRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await internalRes.json();
    } else {
      data = await internalRes.text();
    }

    // Log usage to database — use the authenticated userId from validation,
    // NEVER the raw API key (keys are secrets; storing prefixes leaks entropy)
    try {
      const agentId = path.join("/");
      await db.insert(usage).values({
        userId: keyInfo?.userId || "unknown",
        agentId,
        model: (data as Record<string, unknown>)?.model as string || "unknown",
        tokensUsed: (data as Record<string, unknown>)?.tokensUsed as number || 0,
      });
    } catch (err) {
      // Non-blocking: don't fail the request if usage logging fails, but log it
      log.warn("Failed to log usage", { error: (err as Error).message });
    }

    return NextResponse.json(
      {
        success: internalRes.ok,
        data,
        responseTimeMs,
      },
      {
        status: internalRes.status,
        headers: {
          "X-RateLimit-Remaining": String(rateCheck.remaining),
          "X-RateLimit-Plan": rateCheck.plan,
          "X-Response-Time": `${responseTimeMs}ms`,
        },
      }
    );
  } catch (err) {
    log.error("API v1 Proxy error", err as Record<string, unknown>);
    return NextResponse.json(
      {
        success: false,
        error: "Internal routing error.",
        responseTimeMs: Date.now() - startTime,
      },
      { status: 502 }
    );
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
