import { NextResponse } from "next/server";

/**
 * RATE LIMITER — Uses in-memory store (upgradeable to Upstash Redis).
 * IP-based request throttling for all API endpoints.
 * Free tier-ready: works without any external dependencies.
 */

// In-memory rate limit store (per-instance; use Upstash Redis for production)
const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;  // 1 minute
const MAX_REQUESTS = 30;   // 30 requests per minute per IP

function getIP(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "anonymous";
}

function isRateLimited(ip: string): { limited: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, remaining: MAX_REQUESTS - 1, resetIn: WINDOW_MS };
  }

  entry.count++;
  store.set(ip, entry);

  return {
    limited: entry.count > MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - entry.count),
    resetIn: entry.resetAt - now,
  };
}

// Cleanup stale entries every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(ip);
  }
}, 5 * 60_000);

/**
 * GET: check rate limit status for current IP
 */
export async function GET(req: Request) {
  const ip = getIP(req);
  const status = isRateLimited(ip);
  return NextResponse.json({
    ip,
    ...status,
    windowMs: WINDOW_MS,
    maxRequests: MAX_REQUESTS,
  });
}

/**
 * POST: verify a request and return headers (middleware helper)
 */
export async function POST(req: Request) {
  const ip = getIP(req);
  const status = isRateLimited(ip);

  if (status.limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly.", resetIn: status.resetIn },
      { status: 429, headers: {
        "X-RateLimit-Limit": MAX_REQUESTS.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": Math.ceil(status.resetIn / 1000).toString(),
        "Retry-After": Math.ceil(status.resetIn / 1000).toString(),
      }}
    );
  }

  return NextResponse.json({
    allowed: true,
    remaining: status.remaining,
    ip,
  }, { headers: {
    "X-RateLimit-Limit": MAX_REQUESTS.toString(),
    "X-RateLimit-Remaining": status.remaining.toString(),
  }});
}
