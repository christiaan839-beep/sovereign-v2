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
  matcher: ['/landing/:path*', '/api/agents/:path*', '/dashboard/:path*', '/dashboard'],
};

// In-memory rate limit tracking (per-edge-instance)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // ── DASHBOARD AUTH PROTECTION ──
  // Clerk sets __session cookie when user is authenticated
  if (url.pathname.startsWith('/dashboard')) {
    const sessionToken = request.cookies.get('__session')?.value || request.cookies.get('__clerk_db_jwt')?.value;
    if (!sessionToken) {
      // Redirect unauthenticated users to sign-in
      const signInUrl = new URL('/', request.url);
      signInUrl.searchParams.set('redirect_url', url.pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // ── API GATEWAY for /api/agents/* ──
  if (url.pathname.startsWith('/api/agents')) {
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

    // Cleanup stale entries at a low threshold to bound memory
    if (rateLimits.size > 100) {
      for (const [key, val] of rateLimits) {
        if (now >= val.resetAt) rateLimits.delete(key);
      }
    }

    // Add metering headers
    const response = NextResponse.next();
    response.headers.set('X-Sovereign-Agent', url.pathname.replace('/api/agents/', ''));
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
