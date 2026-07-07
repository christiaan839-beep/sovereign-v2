import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";
import { apiLogger } from "@/lib/api-logger";

/**
 * SOVEREIGN MATRIX — UNIFIED EDGE MIDDLEWARE (wave 107)
 *
 * Historical note: this file was previously `src/proxy.ts`, which Next.js
 * does NOT auto-load. Renamed to `src/middleware.ts` so the Clerk route
 * protection, Upstash rate limiting, CORS preflight, and security headers
 * below actually run on every request. Before the rename, the entire
 * middleware layer was dead code — a P0 finding from the wave-107 audit.
 *
 * Handles FOUR concerns at the Vercel Edge:
 * 1. CSRF/origin enforcement for cookie-authed mutating requests (wave 107)
 * 2. Clerk dashboard auth gate (/dashboard/*, /api/_agents/*, etc.)
 * 3. A/B Testing for /landing/* routes
 * 4. API Gateway for /api/agents/* routes — rate limiting, metering, CORS
 *
 * Rate Limiting Strategy:
 *   - Production (UPSTASH_REDIS_REST_URL set): Upstash Redis sliding window, 100 req/min.
 *     Distributed across all Vercel edge regions. Consistent at 10K+ concurrent users.
 *   - Development / fallback: In-memory Map per edge instance (correct for <1K users).
 *
 * CSRF/Origin Strategy (wave 107):
 *   - State-changing methods (POST/PUT/PATCH/DELETE) on cookie-authed routes
 *     must come from a same-origin browser context or carry a Bearer/x-api-key
 *     credential. Webhook routes are excluded (they HMAC-verify themselves).
 *     Cron routes are excluded (they CRON_SECRET-verify themselves).
 *   - Defense uses BOTH `Sec-Fetch-Site` (Chrome 76+, FF 90+, Safari 16+) AND
 *     `Origin` header allowlist for older browsers. A request with neither is
 *     rejected — modern browsers always send at least one.
 */

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

// ── CSRF / ORIGIN ENFORCEMENT (wave 107) ──────────────────────────────────────
// Cookie-authed routes (anything reading Clerk session) are vulnerable to CSRF
// without an Origin check. Clerk's session cookie is SameSite=Lax, which still
// permits top-level cross-origin POSTs. We close that gap here.

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Routes that authenticate via HMAC signature or CRON_SECRET — they do NOT
 * read the Clerk cookie, so cross-origin POSTs cannot ride a user's session.
 *
 * Wave-107.1: Replaced the previous `pathname.includes('/webhook')` substring
 * match with an EXPLICIT PREFIX ALLOWLIST. The substring match created a
 * Critical CSRF bypass: `/api/_settings/webhooks` (user-action route mutating
 * the user's own webhook config), `/api/_integrations/webhook` (SSRF-on-
 * demand — server-side fetches a user-supplied URL), and any future route
 * named "webhook-*" would all bypass the CSRF check while still being
 * cookie-authed. Explicit allowlist is the only safe model — never grow
 * this list without confirming HMAC or CRON_SECRET verification in the
 * route handler itself.
 */
const COOKIE_INDEPENDENT_PREFIXES: readonly string[] = [
  "/api/webhooks/", // Clerk + svix-style inbound webhooks (HMAC-verified)
  "/api/_webhooks/", // Twilio, Slack, Zapier, GitHub etc. (HMAC-verified)
  "/api/cron/", // Vercel cron (CRON_SECRET-verified)
  "/api/_cron/", // legacy cron paths (CRON_SECRET-verified)
  "/api/_payments/stripe/webhook", // stripe-signature HMAC
  "/api/_payments/paystack/webhook", // x-paystack-signature HMAC
  "/api/_payments/payfast/webhook", // PayFast signature
  "/api/_payments/paypal/webhook", // PayPal Transmission-Signature
  "/api/_payments/yoco/webhook", // Yoco signature
  "/api/_payments/crypto/webhook", // crypto provider signature
  "/api/_payments/moonpay/webhook", // MoonPay signature
  "/api/payments/stripe/webhook", // legacy stripe path
  "/api/payments/paystack/webhook",
  "/api/payments/payfast/webhook",
  "/api/payments/paypal/webhook",
  "/api/payments/yoco/webhook",
  "/api/payments/crypto/webhook",
  "/api/payments/moonpay/webhook",
  "/api/_billing/webhook", // internal billing pipeline
];

function isCookieIndependentRoute(pathname: string): boolean {
  return COOKIE_INDEPENDENT_PREFIXES.some((pref) => pathname.startsWith(pref));
}

/** Minimum length for a header to be treated as a credential.
 *  Wave-107.1: the original check only looked at PRESENCE, allowing
 *  `x-api-key: x` to disable the entire CSRF check. Real API keys are
 *  always at least 16 chars (Stripe sk_/pk_, Clerk sess_*, etc.). */
const MIN_CREDENTIAL_LENGTH = 16;

/** Server-to-server callers identify via Authorization / x-api-key — those
 *  headers are NOT auto-sent cross-origin by browsers, so they can't be
 *  used in a CSRF attack. Skip origin enforcement when a CREDENTIAL-SHAPED
 *  value is present (not just any non-empty header). */
function hasBearerOrApiKey(request: NextRequest): boolean {
  const authz = request.headers.get("authorization")?.trim() ?? "";
  if (authz.length >= MIN_CREDENTIAL_LENGTH) return true;
  const apiKey = request.headers.get("x-api-key")?.trim() ?? "";
  if (apiKey.length >= MIN_CREDENTIAL_LENGTH) return true;
  return false;
}

function buildAllowedOrigins(): Set<string> {
  const env = process.env.ALLOWED_ORIGINS ?? "";
  const fromEnv = env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults: string[] = [
    "https://sovereignmatrix.agency",
    "https://www.sovereignmatrix.agency",
  ];
  if (process.env.NEXT_PUBLIC_APP_URL)
    defaults.push(process.env.NEXT_PUBLIC_APP_URL);
  if (process.env.NODE_ENV !== "production") {
    defaults.push("http://localhost:3000", "http://localhost:3001");
  }
  return new Set([...defaults, ...fromEnv]);
}

const ALLOWED_ORIGINS = buildAllowedOrigins();

/**
 * Returns null if the request passes CSRF/origin policy, or a 403
 * NextResponse if it should be blocked. Exported for unit tests.
 */
export function enforceCsrfOrigin(request: NextRequest): NextResponse | null {
  if (!STATE_CHANGING_METHODS.has(request.method)) return null;
  if (isCookieIndependentRoute(request.nextUrl.pathname)) return null;
  if (hasBearerOrApiKey(request)) return null;

  // Sec-Fetch-Site is the modern primary signal. Browsers set it on every
  // request; non-browser clients usually don't. Trust it when present.
  //
  // Wave-107.1: NARROWED — "none" is no longer auto-allowed. Spec-wise
  // "none" means "not initiated by a document" (typed URL, bookmark,
  // extension worker). For a state-changing POST that's almost never
  // legitimate from a real user flow. Fall through to the Origin/Referer
  // allowlist so address-bar / extension POSTs still work IF they carry
  // a valid Origin or Referer, but aren't auto-trusted.
  const sfs = request.headers.get("sec-fetch-site");
  if (sfs === "same-origin" || sfs === "same-site") {
    return null; // browser-confirmed safe
  }
  if (sfs === "cross-site") {
    return blockedResponse("cross-site request blocked");
  }

  // Fallback: older browser or non-browser. Fall back to Origin allowlist.
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) return null;

  // Last positive signal: Referer pointing at an allowed origin. Referer
  // can be stripped by privacy extensions, so its ABSENCE is not proof of
  // attack — but its PRESENCE pointing to an allowed origin is a positive.
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (ALLOWED_ORIGINS.has(refOrigin)) return null;
    } catch {
      /* malformed referer → fall through to reject */
    }
  }

  return blockedResponse(
    origin
      ? `origin "${origin}" not allowed`
      : "missing Origin / Sec-Fetch-Site for state-changing request",
  );
}

function blockedResponse(reason: string): NextResponse {
  // Generic 403 to clients; specific reason logged for SRE visibility.
  apiLogger.log({
    route: "middleware:csrf",
    method: "BLOCKED",
    status: 403,
    durationMs: 0,
    clientIp: "n/a",
    error: reason,
  });
  return NextResponse.json(
    { error: "Forbidden" },
    {
      status: 403,
      headers: {
        "X-Sovereign-Reason": "csrf-origin",
      },
    },
  );
}

// ── DISTRIBUTED RATE LIMITER (Upstash Redis) ──────────────────────────────────
// Upstash Redis is edge-compatible (HTTP REST — no TCP). When UPSTASH_REDIS_REST_URL
// is set, we use a sliding window across ALL Vercel edge regions. Without it, we
// fall back to an in-memory Map that works correctly for single-region / dev setups.
//
// Lazy singleton: initialized on first request, cached for the lifetime of the
// edge isolate (avoids module-level async, plays nicely with Next.js edge runtime).

type UpstashLimiter = {
  limit: (
    key: string,
  ) => Promise<{ success: boolean; remaining: number; reset: number }>;
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
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    _rlCache = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      analytics: true, // stores hit count in Redis for Upstash analytics dashboard
      prefix: "sovereign:rl", // namespace to avoid key collisions
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

/**
 * Pre-computed security headers (avoid recreating on every request).
 *
 * next.config.ts is the single source of truth for Permissions-Policy
 * and Strict-Transport-Security (BACKLOG header-dup): the old middleware
 * copies here disagreed with it (microphone allowed vs denied; weaker
 * HSTS max-age with no `preload`), and whichever won the Next header
 * merge silently overrode one documented policy. Only headers
 * next.config.ts does NOT already set remain here.
 */
const SECURITY_HEADERS: ReadonlyArray<[string, string]> = [
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["X-XSS-Protection", "1; mode=block"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
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
  "sovereignmatrix.agency",
  "www.sovereignmatrix.agency",
  "localhost",
]);

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/_agents(.*)",
  "/api/_billing(.*)",
  "/api/_misc/admin(.*)",
  "/api/_settings(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // The Edge runtime always passes a NextRequest in practice; the guard
  // (BACKLOG L2) replaces a blind `as` cast so a plain Request could
  // never flow into nextUrl-dependent code unnoticed.
  const req =
    request instanceof NextRequest ? request : new NextRequest(request);

  // Wave-107: CSRF/origin check FIRST — before auth lookup. Reject obvious
  // cross-site attacks at the edge with a 403 so they never touch Clerk.
  const csrfBlock = enforceCsrfOrigin(req);
  if (csrfBlock) return csrfBlock;

  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL("/login", req.url);
      signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }
  }
  return sovereignMiddleware(req);
});

async function sovereignMiddleware(request: NextRequest) {
  const url = request.nextUrl;

  // ── CORS PREFLIGHT HANDLING ──
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin") || "";
    const allowedOrigins = [
      "https://sovereignmatrix.agency",
      "https://hooks.zapier.com",
      "https://hook.eu1.make.com",
      "https://hook.us1.make.com",
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean) as string[];
    const preflight = new NextResponse(null, { status: 204 });
    if (allowedOrigins.includes(origin)) {
      preflight.headers.set("Access-Control-Allow-Origin", origin);
    }
    preflight.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    preflight.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, x-api-key, Authorization",
    );
    preflight.headers.set("Access-Control-Max-Age", "86400");
    return applySecurityHeaders(preflight);
  }

  // ── WHITE-LABEL DOMAIN ROUTING ──
  // If the hostname is not a known main domain, tag the request so pages
  // can read X-Whitelabel-Domain and customise branding accordingly.
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";
  const isWhitelabel =
    hostname &&
    !MAIN_DOMAINS.has(hostname) &&
    !hostname.endsWith(".vercel.app");
  if (isWhitelabel) {
    const response = NextResponse.next();
    response.headers.set("X-Whitelabel-Domain", hostname);
    response.headers.set("X-Request-Id", crypto.randomUUID());
    // Still apply security headers for white-label requests
    return applySecurityHeaders(response);
  }

  // Dashboard auth is now handled by clerkMiddleware above via auth.protect()

  // ── API GATEWAY for /api/agents/* and /api/_agents/* ──
  if (
    url.pathname.startsWith("/api/agents") ||
    url.pathname.startsWith("/api/_agents")
  ) {
    // Extract client identifier (API key or IP)
    // On Vercel, x-forwarded-for is platform-injected and trusted.
    // Use the LAST IP in the chain (rightmost = Vercel's value, not user-supplied).
    const apiKey = request.headers.get("x-api-key") || "";
    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const clientIp =
      forwardedFor.split(",").pop()?.trim() ||
      request.headers.get("x-real-ip") ||
      "anonymous";
    const clientId = apiKey || clientIp;

    // Log the incoming request
    apiLogger.log({
      route: url.pathname,
      method: request.method,
      status: 202, // Accepted/processing (middleware)
      durationMs: 0,
      clientIp,
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
        {
          error: "Rate limit exceeded. Max 100 requests per minute.",
          retry_after_seconds: retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    // Add metering headers
    const response = NextResponse.next();
    response.headers.set(
      "X-Sovereign-Agent",
      url.pathname.replace("/api/_agents/", "").replace("/api/agents/", ""),
    );
    response.headers.set("X-Sovereign-Timestamp", new Date().toISOString());
    response.headers.set("X-RateLimit-Remaining", String(remaining));

    // CORS headers for external integrations (Zapier, Make, n8n)
    const origin = request.headers.get("origin") || "";
    const allowedOrigins = [
      "https://sovereignmatrix.agency",
      "https://hooks.zapier.com",
      "https://hook.eu1.make.com",
      "https://hook.us1.make.com",
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean);
    if (allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, x-api-key, Authorization",
    );

    // Add request ID for debugging
    response.headers.set("X-Request-Id", crypto.randomUUID());

    return applySecurityHeaders(response);
  }

  // ── STATIC ASSET CACHE HEADERS ──
  if (
    !url.pathname.startsWith("/api") &&
    !url.pathname.startsWith("/dashboard")
  ) {
    const response = NextResponse.next();
    response.headers.set(
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400",
    );
    response.headers.set("X-Request-Id", crypto.randomUUID());
    return applySecurityHeaders(response);
  }

  // ── A/B TESTING for /landing/* only ──
  if (!url.pathname.startsWith("/landing")) {
    const response = NextResponse.next();
    response.headers.set("X-Request-Id", crypto.randomUUID());
    return applySecurityHeaders(response);
  }

  let cohort = request.cookies.get("sovereign_cohort")?.value;

  if (!cohort) {
    cohort = Math.random() > 0.5 ? "variant_alpha" : "variant_beta";
  }

  url.pathname = `${url.pathname}/${cohort}`;
  const response = NextResponse.rewrite(url);

  response.cookies.set("sovereign_cohort", cohort, {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30,
  });

  response.headers.set("X-Request-Id", crypto.randomUUID());
  return response;
}
