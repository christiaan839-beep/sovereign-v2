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
 */

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

// In-memory rate limit tracking (per-edge-instance)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
let rateLimitRequestCount = 0; // Track requests for periodic cleanup

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

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

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

function sovereignMiddleware(request: NextRequest) {
  const url = request.nextUrl;

  // ── CORS PREFLIGHT HANDLING ──
  if (request.method === 'OPTIONS') {
    const preflight = new NextResponse(null, { status: 204 });
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
    // Extract client identifier (API key, IP, or session)
    const apiKey = request.headers.get('x-api-key') || '';
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous';
    const clientId = apiKey || clientIp;

    // Log the incoming request
    apiLogger.log({
      route: url.pathname,
      method: request.method,
      status: 202, // Accepted/processing (middleware)
      durationMs: 0,
      clientIp
    });

    // Rate limiting: 100 requests per minute per client
    const now = Date.now();
    const limit = rateLimits.get(clientId);

    if (limit) {
      // Skip expired entries — treat as fresh window
      if (now >= limit.resetAt) {
        rateLimits.set(clientId, { count: 1, resetAt: now + 60000 });
      } else {
        limit.count += 1;
        if (limit.count > 100) {
          apiLogger.log({
            route: url.pathname,
            method: request.method,
            status: 429,
            durationMs: 0,
            clientIp,
            error: "Rate limit exceeded"
          });
          return NextResponse.json(
            { error: 'Rate limit exceeded. Max 100 requests per minute.', retry_after_seconds: Math.ceil((limit.resetAt - now) / 1000) },
            { status: 429 }
          );
        }
      }
    } else {
      rateLimits.set(clientId, { count: 1, resetAt: now + 60000 });
    }

    // Cleanup stale entries every 100th request (avoid checking size on every request)
    rateLimitRequestCount++;
    if (rateLimitRequestCount % 100 === 0) {
      for (const [key, val] of rateLimits) {
        if (now >= val.resetAt) rateLimits.delete(key);
      }
      // If still over cap after cleanup, remove oldest entries
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

    // Add metering headers
    const response = NextResponse.next();
    response.headers.set('X-Sovereign-Agent', url.pathname.replace('/api/_agents/', '').replace('/api/agents/', ''));
    response.headers.set('X-Sovereign-Timestamp', new Date().toISOString());
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, 100 - (rateLimits.get(clientId)?.count || 0))));
    
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

  response.headers.set('X-Request-Id', crypto.randomUUID());
  return response;
}
