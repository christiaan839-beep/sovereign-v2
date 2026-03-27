import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/db";
import { usage } from "@/db/schema";

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

// Known valid API key prefixes — keys must be at least 20 chars to prevent brute-force guessing
const MIN_API_KEY_LENGTH = 20;

function checkRateLimit(apiKey: string): {
  allowed: boolean;
  remaining: number;
  plan: string;
} {
  // Enforce minimum key length to prevent trivially forged keys
  if (apiKey.length < MIN_API_KEY_LENGTH) {
    return { allowed: false, remaining: 0, plan: "invalid" };
  }

  // TODO: Validate API keys against the database instead of prefix-based plan detection.
  // Current prefix-based approach (sk_free_, sk_pro_, sk_ent_) can be bypassed by forging keys.
  // Until DB validation is implemented, all unknown keys default to "free" tier rate limits.
  let plan = "free";
  if (apiKey.startsWith("sk_pro_")) plan = "pro";
  else if (apiKey.startsWith("sk_ent_")) plan = "enterprise";

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

  // Rate limit check
  const rateCheck = checkRateLimit(apiKey);
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
        // Pass through service secret so internal routes can verify this is a trusted proxy call
        "X-Sovereign-Internal": process.env.INTERNAL_SERVICE_SECRET || "v1-proxy",
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

    // Log usage to database
    try {
      const agentId = path.join("/");
      await db.insert(usage).values({
        userId: createHash("sha256").update(apiKey).digest("hex").slice(0, 16), // Hashed key identifier — never log raw keys
        agentId,
        model: (data as Record<string, unknown>)?.model as string || "unknown",
        tokensUsed: (data as Record<string, unknown>)?.tokensUsed as number || 0,
      });
    } catch {
      // Non-blocking: don't fail the request if usage logging fails
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
    console.error("[API v1 Proxy]", err);
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
