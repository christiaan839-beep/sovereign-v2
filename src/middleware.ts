import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { apiLogger } from '@/lib/api-logger';

/**
 * SOVEREIGN MATRIX — UNIFIED EDGE MIDDLEWARE
 *
 * Handles THREE concerns at the Vercel Edge:
 * 1. Dashboard auth protection (Clerk session check)
 * 2. API Gateway for /api/agents/* routes — rate limiting, metering, CORS
 * 3. A/B Testing for /landing/* routes
 *
 * Rate limiting: Uses Upstash Redis when configured, falls back to in-memory.
 * In-memory resets on cold starts (Vercel serverless), so Redis is required for production.
 */

export const config = {
  matcher: ['/landing/:path*', '/api/agents/:path*', '/dashboard/:path*', '/dashboard'],
};

// In-memory rate limit fallback (per-edge-instance — resets on cold start)
const memoryLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit via Upstash Redis REST API (works in Edge Runtime).
 * Returns null if Redis is not configured (falls back to in-memory).
 */
async function checkRedisRateLimit(clientId: string): Promise<{ allowed: boolean; count: number } | null> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) return null;

  try {
    const window = Math.floor(Date.now() / 60000); // 1-minute windows
    const key = `rl:mw:${clientId}:${window}`;

    const res = await fetch(`${redisUrl}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, 120]]),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const count = data?.[0]?.result ?? 1;
    return { allowed: count <= 100, count };
  } catch {
    return null; // Redis down — fall back to in-memory
  }
}

function checkMemoryRateLimit(clientId: string): { allowed: boolean; count: number } {
  const now = Date.now();
  const entry = memoryLimits.get(clientId);

  if (entry && now < entry.resetAt) {
    entry.count += 1;
    return { allowed: entry.count <= 100, count: entry.count };
  }

  memoryLimits.set(clientId, { count: 1, resetAt: now + 60000 });

  // Cleanup stale entries to bound memory
  if (memoryLimits.size > 200) {
    for (const [key, val] of memoryLimits) {
      if (now >= val.resetAt) memoryLimits.delete(key);
    }
  }

  return { allowed: true, count: 1 };
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // ── DASHBOARD AUTH PROTECTION ──
  if (url.pathname.startsWith('/dashboard')) {
    const sessionToken = request.cookies.get('__session')?.value || request.cookies.get('__clerk_db_jwt')?.value;
    if (!sessionToken) {
      const signInUrl = new URL('/', request.url);
      signInUrl.searchParams.set('redirect_url', url.pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // ── API GATEWAY for /api/agents/* ──
  if (url.pathname.startsWith('/api/agents')) {
    const apiKey = request.headers.get('x-api-key') || '';
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous';
    const clientId = apiKey || clientIp;

    apiLogger.log({
      route: url.pathname,
      method: request.method,
      status: 202,
      durationMs: 0,
      clientIp
    });

    // Rate limiting: 100 requests per minute per client
    // Try Redis first (persists across deploys), fall back to in-memory
    const redisResult = await checkRedisRateLimit(clientId);
    const rateResult = redisResult ?? checkMemoryRateLimit(clientId);

    if (!rateResult.allowed) {
      apiLogger.log({
        route: url.pathname,
        method: request.method,
        status: 429,
        durationMs: 0,
        clientIp,
        error: "Rate limit exceeded"
      });
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 100 requests per minute.', retry_after_seconds: 60 },
        { status: 429 }
      );
    }

    // Add metering headers
    const response = NextResponse.next();
    response.headers.set('X-Sovereign-Agent', url.pathname.replace('/api/agents/', ''));
    response.headers.set('X-Sovereign-Timestamp', new Date().toISOString());
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, 100 - rateResult.count)));

    // CORS headers for external integrations
    const origin = request.headers.get('origin') || '';
    const allowedOrigins = [
      'https://sovereignmatrix.agency',
      'https://hooks.zapier.com',
      'https://hook.eu1.make.com',
      'https://hook.us1.make.com',
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean);
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]!;
    response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');

    return response;
  }

  // ── A/B TESTING for /landing/* ──
  let cohort = request.cookies.get('sovereign_cohort')?.value;

  if (!cohort) {
    cohort = Math.random() > 0.5 ? 'variant_alpha' : 'variant_beta';
  }

  url.pathname = `${url.pathname}/${cohort}`;
  const response = NextResponse.rewrite(url);

  response.cookies.set('sovereign_cohort', cohort, {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
