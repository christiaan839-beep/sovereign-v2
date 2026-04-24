import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { usage, apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { createLogger } from "@/lib/logger";
import {
  evaluateScope,
  buildScopeDeniedResponse,
  type ApiKeyRecord,
} from "@/lib/api-key-scopes";
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

// ── API Key Validation Cache (prevents DB hit on every request) ──
//
// Cache shape note: we now cache the FULL ApiKeyRecord shape (including
// scopes/allowedAgents/allowedIps). That's an extra 0.1-1 KB per key
// even at the high end — negligible at 1K cache cap.
const API_KEY_CACHE_TTL = 5 * 60_000; // 5 minutes
const API_KEY_CACHE_MAX = 1_000;
const apiKeyCache = new Map<string, { record: ApiKeyRecord; cachedAt: number }>();

/** Invalidate a cached API key (call on revocation). */
export function invalidateApiKeyCache(keyHash: string): void {
  apiKeyCache.delete(keyHash);
}

function pruneApiKeyCache(): void {
  if (apiKeyCache.size <= API_KEY_CACHE_MAX) return;
  // Evict oldest entries
  const entries = [...apiKeyCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt);
  const toRemove = entries.slice(0, entries.length - API_KEY_CACHE_MAX);
  for (const [key] of toRemove) apiKeyCache.delete(key);
}

import { getApiRateLimit } from "@/lib/plans";

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

/**
 * Validate API key against database with LRU cache. Returns the full
 * key record (including scope columns) for downstream scope enforcement,
 * or null if invalid/expired/revoked.
 */
async function validateApiKey(rawKey: string): Promise<ApiKeyRecord | null> {
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  // Check cache first (avoids DB query on every request)
  const cached = apiKeyCache.get(keyHash);
  if (cached && Date.now() - cached.cachedAt < API_KEY_CACHE_TTL) {
    return cached.record;
  }

  try {
    const rows = await db.select().from(apiKeys)
      .where(eq(apiKeys.key, keyHash))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.revokedAt) { apiKeyCache.delete(keyHash); return null; }
    if (row.expiresAt && row.expiresAt < new Date()) { apiKeyCache.delete(keyHash); return null; }

    const record: ApiKeyRecord = {
      id: row.id,
      userId: row.userId,
      plan: row.plan,
      scopes: row.scopes ?? null,
      allowedAgents: row.allowedAgents ?? null,
      allowedIps: row.allowedIps ?? null,
    };

    // Populate cache with the full record so scope checks don't need a
    // second DB hit on each request.
    apiKeyCache.set(keyHash, { record, cachedAt: Date.now() });
    pruneApiKeyCache();

    // Update last used timestamp (best-effort — log failures but don't block)
    db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch((err) => {
      log.warn("Failed to update lastUsedAt on API key", { keyId: row.id, error: (err as Error).message });
    });
    return record;
  } catch (err) {
    // DB unavailable — deny. The in-memory cache already covers recently-used
    // keys for up to 5 minutes; we MUST NOT grant access based on a key prefix
    // (an attacker can forge any sk_pro_/sk_ent_ string).
    log.error("API key DB validation failed — denying request", { error: (err as Error).message });
    return null;
  }
}

/**
 * Map a v1 request to the {scope, agentSlug} pair the scope evaluator
 * expects. The v1 gateway is primarily an agent-execution surface, so:
 *   - /api/v1/agents/<slug> → agent:execute on <slug>
 *   - /api/v1/playbooks/* and other write paths → agent:execute (no slug)
 *   - /api/v1/health/* and other read-only paths → data:read
 *
 * GET requests on any other path default to data:read; non-GET defaults
 * to agent:execute. This keeps the rule conservative — most v1 traffic
 * IS agent execution, and read-only health checks are explicitly opt-in.
 */
function classifyV1Request(
  path: string[],
  method: string,
): { scope: "agent:execute" | "data:read" | "data:write"; agentSlug?: string } {
  if (path[0] === "agents" && path[1]) {
    return { scope: "agent:execute", agentSlug: path[1] };
  }
  if (path[0] === "playbooks" || path[0] === "workflows") {
    return { scope: "agent:execute" };
  }
  if (path[0] === "health" || path[0] === "status") {
    return { scope: "data:read" };
  }
  // Generic fallback: GET = read, anything else = write/execute.
  return method === "GET"
    ? { scope: "data:read" }
    : { scope: "agent:execute" };
}

/**
 * Pull the client IP from the request's x-forwarded-for / x-real-ip
 * headers. Vercel sets x-forwarded-for to "client-ip, proxy-1, proxy-2",
 * so we take the first entry.
 *
 * Returns undefined when no IP can be determined — the scope evaluator
 * will treat that as `ip_required` if the key has an allowedIps list,
 * which is the safe default.
 */
function getClientIp(request: NextRequest): string | undefined {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return undefined;
}

function checkRateLimit(apiKey: string, plan: string = "free"): {
  allowed: boolean;
  remaining: number;
  plan: string;
} {

  const limit = getApiRateLimit(plan);
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

  // Validate key against DB (deny if invalid — never trust the prefix)
  const keyInfo = await validateApiKey(apiKey);
  if (!keyInfo) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid or revoked API key.",
      },
      { status: 401 },
    );
  }

  // Scope check — least-privilege enforcement. NULL scopes = legacy
  // full-access (back-compat); any concrete scopes get evaluated against
  // the request's agent slug + client IP.
  const requested = classifyV1Request(path, request.method);
  const scopeResult = evaluateScope(keyInfo, {
    scope: requested.scope,
    agentSlug: requested.agentSlug,
    ipAddress: getClientIp(request),
  });
  if (!scopeResult.allowed) {
    log.warn("api v1: scope denied", {
      keyId: keyInfo.id,
      requested,
      reason: scopeResult.reason,
    });
    return buildScopeDeniedResponse(scopeResult.reason);
  }

  // Rate limit check — use DB-resolved plan
  const rateCheck = checkRateLimit(apiKey, keyInfo.plan);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Rate limit exceeded.",
        plan: rateCheck.plan,
        limit: getApiRateLimit(rateCheck.plan),
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

    // Hard 50s timeout — leaves 10s headroom for response serialization
    // within Vercel's 60s function limit. Without this, a hung agent
    // endpoint consumes the entire caller budget and returns a generic
    // platform timeout instead of an actionable 504.
    const internalRes = await fetch(internalUrl.toString(), {
      method: request.method,
      signal: AbortSignal.timeout(50_000),
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
        userId: keyInfo.userId,
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
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
    const responseTimeMs = Date.now() - startTime;

    if (isTimeout) {
      log.warn("API v1 Proxy — internal agent timeout", {
        path: path.join("/"),
        timeoutMs: 50_000,
        responseTimeMs,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Agent request timed out after 50 seconds.",
          responseTimeMs,
        },
        { status: 504 },
      );
    }

    log.error("API v1 Proxy error", err as Record<string, unknown>);
    return NextResponse.json(
      {
        success: false,
        error: "Internal routing error.",
        responseTimeMs,
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
