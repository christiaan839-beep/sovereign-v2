import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { apiLogger } from '@/lib/api-logger';

/**
 * SOVEREIGN MATRIX — UNIFIED EDGE MIDDLEWARE
 *
 * Handles TWO concerns at the Vercel Edge:
 * 1. A/B Testing for /landing/* routes
 * 2. API Gateway for /api/agents/* routes — rate limiting, metering, CORS
 *
 * Rate Limiting Strategy:
 *   - Production (UPSTASH_REDIS_REST_URL set): Upstash Redis sliding window, 100 req/min.
 *     Distributed across all Vercel edge regions. Consistent at 10K+ concurrent users.
 *   - Development / fallback: In-memory Map per edge instance (correct for <1K users).
 */

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

// ── DISTRIBUTED RATE LIMITER (Upstash Redis) ──────────────────────────────────
// Upstash Redis is edge-compatible (HTTP REST — no TCP). When UPSTASH_REDIS_REST_URL
// is set, we use a sliding window across ALL Vercel edge regions. Without it, we
// fall back to an in-memory Map that works correctly for single-region / dev setups.
//
// Lazy singleton: initialized on first request, cached for the lifetime of the
// edge isolate (avoids module-level async, plays nicely with Next.js edge runtime).

type UpstashLimiter = {
  limit: (key: string) => Promise<{ success: boolean; remaining: number; reset: number }>;
};

let _rlCache: UpstashLimiter | null | undefined = undefined; // undefined = not yet initialized

async function getUpstashLimiter(): Promise<UpstashLimiter | null> {
  if (_rlCache !== undefined) return _rlCache;

  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    _rlCache = null;
    return null;
  }

  try {
    const { Redis } = await import('@upstash/redis');
    const { Ratelimit } = await import('@upstash/ratelimit');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    _rlCache = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,         // stores hit count in Redis for Upstash analytics dashboard
      prefix: 'sovereign:rl',  // namespace to avoid key collisions
    });
  } catch {
    // Redis init failed (bad env vars, network error) — fall back to in-memory
    _rlCache = null;
  }
  return _rlCache;
}

// Fallback: in-memory Map (correct for <1K concurrent users, single region)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
let rateLimitRequestCount = 0;

/** Pre-computed security headers (avoid recreating on every request) */
const SECURITY_HEADERS: ReadonlyArray<[string, string]> = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['X-XSS-Protection', '1; mode=block'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(self), geolocation=()'],
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
] as const;

/** Apply enterprise security headers to all responses */
function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of SECURITY_HEADERS) {
    response.headers.set(key, value);
  }
  return response;
}

/** Main domains — everything else is treated as a white-label custom domain */
const MAIN_DOMAINS = new Set([
  'sovereignmatrix.agency',
  'www.sovereignmatrix.agency',
  'localhost',
]);

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/_agents(.*)',
  '/api/_billing(.*)',
  '/api/_misc/admin(.*)',
  '/api/_settings(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL('/login', request.url);
      signInUrl.searchParams.set('redirect_url', request.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }
  }
  return sovereignMiddleware(request as NextRequest);
});

async function sovereignMiddleware(request: NextRequest) {
  const url = request.nextUrl;

  // ── CORS PREFLIGHT HANDLING ──
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin') || '';
    const allowedOrigins = [
      'https://sovereignmatrix.agency',
      'https://hooks.zapier.com',
      'https://hook.eu1.make.com',
      'https://hook.us1.make.com',
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean) as string[];
    const preflight = new NextResponse(null, { status: 204 });
    if (allowedOrigins.includes(origin)) {
      preflight.headers.set('Access-Control-Allow-Origin', origin);
    }
    preflight.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    preflight.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
    preflight.headers.set('Access-Control-Max-Age', '86400');
    return applySecurityHeaders(preflight);
  }

  // ── WHITE-LABEL DOMAIN ROUTING ──
  // If the hostname is not a known main domain, tag the request so pages
  // can read X-Whitelabel-Domain and customise branding accordingly.
  const hostname = request.headers.get('host')?.split(':')[0] ?? '';
  const isWhitelabel = hostname && !MAIN_DOMAINS.has(hostname) && !hostname.endsWith('.vercel.app');
  if (isWhitelabel) {
    const response = NextResponse.next();
    response.headers.set('X-Whitelabel-Domain', hostname);
    response.headers.set('X-Request-Id', crypto.randomUUID());
    // Still apply security headers for white-label requests
    return applySecurityHeaders(response);
  }

  // Dashboard auth is now handled by clerkMiddleware above via auth.protect()

  // ── API GATEWAY for /api/agents/* and /api/_agents/* ──
  if (url.pathname.startsWith('/api/agents') || url.pathname.startsWith('/api/_agents')) {
    // Extract client identifier (API key or IP)
    // On Vercel, x-forwarded-for is platform-injected and trusted.
    // Use the LAST IP in the chain (rightmost = Vercel's value, not user-supplied).
    const apiKey = request.headers.get('x-api-key') || '';
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const clientIp = forwardedFor.split(',').pop()?.trim() || request.headers.get('x-real-ip') || 'anonymous';
    const clientId = apiKey || clientIp;

    // Log the incoming request
    apiLogger.log({
      route: url.pathname,
      method: request.method,
      status: 202, // Accepted/processing (middleware)
      durationMs: 0,
      clientIp
    });

    // ── RATE LIMITING ────────────────────────────────────────────────────────
    const now = Date.now();
    let rateLimited = false;
    let remaining = 99;
    let retryAfterSeconds = 60;

    const upstashRatelimit = await getUpstashLimiter();
    if (upstashRatelimit) {
      // Distributed sliding window via Upstash Redis
      const result = await upstashRatelimit.limit(clientId);
      remaining = result.remaining;
      if (!result.success) {
        rateLimited = true;
        retryAfterSeconds = Math.ceil((result.reset - now) / 1000);
      }
    } else {
      // Fallback: in-memory per-instance (dev / single-region)
      const limit = rateLimits.get(clientId);
      if (limit) {
        if (now >= limit.resetAt) {
          rateLimits.set(clientId, { count: 1, resetAt: now + 60000 });
          remaining = 99;
        } else {
          limit.count += 1;
          remaining = Math.max(0, 100 - limit.count);
          if (limit.count > 100) {
            rateLimited = true;
            retryAfterSeconds = Math.ceil((limit.resetAt - now) / 1000);
          }
        }
      } else {
        rateLimits.set(clientId, { count: 1, resetAt: now + 60000 });
        remaining = 99;
      }

      // Cleanup stale in-memory entries every 100th request
      rateLimitRequestCount++;
      if (rateLimitRequestCount % 100 === 0) {
        for (const [key, val] of rateLimits) {
          if (now >= val.resetAt) rateLimits.delete(key);
        }
        if (rateLimits.size > 500) {
          const excess = rateLimits.size - 500;
          let removed = 0;
          for (const key of rateLimits.keys()) {
            if (removed >= excess) break;
            rateLimits.delete(key);
            removed++;
          }
        }
      }
    }

    if (rateLimited) {
      apiLogger.log({
        route: url.pathname,
        method: request.method,
        status: 429,
        durationMs: 0,
        clientIp,
        error: "Rate limit exceeded",
      });
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 100 requests per minute.', retry_after_seconds: retryAfterSeconds },
        { status: 429 }
      );
    }

    // Add metering headers
    const response = NextResponse.next();
    response.headers.set('X-Sovereign-Agent', url.pathname.replace('/api/_agents/', '').replace('/api/agents/', ''));
    response.headers.set('X-Sovereign-Timestamp', new Date().toISOString());
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    
    // CORS headers for external integrations (Zapier, Make, n8n)
    const origin = request.headers.get('origin') || '';
    const allowedOrigins = [
      'https://sovereignmatrix.agency',
      'https://hooks.zapier.com',
      'https://hook.eu1.make.com',
      'https://hook.us1.make.com',
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean);
    if (allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');

    // Add request ID for debugging
    response.headers.set('X-Request-Id', crypto.randomUUID());

    return applySecurityHeaders(response);
  }

  // ── STATIC ASSET CACHE HEADERS ──
  if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/dashboard')) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    response.headers.set('X-Request-Id', crypto.randomUUID());
    return applySecurityHeaders(response);
  }

  // ── A/B TESTING for /landing/* only ──
  if (!url.pathname.startsWith('/landing')) {
    const response = NextResponse.next();
    response.headers.set('X-Request-Id', crypto.randomUUID());
    return applySecurityHeaders(response);
  }

  let cohort = request.cookies.get('sovereign_cohort')?.value;

  if (!cohort) {
    // Crypto-random 50/50 cohort assignment. Once assigned, the cookie
    // makes it sticky for 30 days so A/B metrics remain attributable to
    // the same user across sessions.
    const coin = new Uint8Array(1);
    crypto.getRandomValues(coin);
    cohort = coin[0] < 128 ? 'variant_alpha' : 'variant_beta';
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

  response.headers.set('X-Request-Id', crypto.randomUUID());
  return response;
}
