import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api-guard";

/**
 * Reusable auth guard for API routes.
 * Returns the user email if authenticated, or a 401 response if not.
 *
 * Includes per-user rate limiting (60 req/min) by default. Opt out with
 * `requireAuth({ rateLimit: false })` for endpoints with higher throughput
 * needs (e.g., streaming, batched background jobs).
 *
 * Round 25 — pass `csrf: true` (or use `requireMutatingAuth`) on any
 * non-GET endpoint that mutates user state. Without an Origin/Referer
 * check, a logged-in user visiting evil.com can have their session
 * cookie auto-attached to a cross-site POST → silent API key minting,
 * plan changes, account deletion. SameSite=Lax doesn't stop top-level
 * navigation POSTs; only an Origin compare does.
 *
 * Usage:
 *   const auth = await requireAuth();          // GET endpoints
 *   const auth = await requireMutatingAuth(req); // POST/DELETE/PATCH
 */
export async function requireAuth(
  opts: { rateLimit?: boolean } = {}
): Promise<
  { email: string; userId: string; error?: never } | { error: NextResponse; email?: never; userId?: never }
> {
  const { rateLimit = true } = opts;
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!user || !email) {
      return {
        error: NextResponse.json(
          { error: "Unauthorized. Please sign in." },
          { status: 401 }
        ),
      };
    }

    if (rateLimit) {
      const check = checkRateLimit(user.id);
      if (!check.allowed) {
        return {
          error: NextResponse.json(
            { error: "Rate limit exceeded", code: "RATE_LIMITED", resetIn: check.resetIn },
            { status: 429, headers: { "Retry-After": String(Math.ceil(check.resetIn / 1000)) } }
          ),
        };
      }
    }

    return { email, userId: user.id };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Authentication failed." },
        { status: 401 }
      ),
    };
  }
}

/**
 * Round 25 — Origin / Referer check for cookie-authenticated mutating
 * endpoints.
 *
 * Why: Clerk session cookies are SameSite=Lax, which auto-sends them
 * on top-level navigation POSTs (form submissions). An attacker
 * crafts a form on evil.com that POSTs to /api/_settings/api-keys —
 * the user's Clerk cookie attaches, the request looks identical to
 * a legit one. Only an Origin/Referer compare catches it.
 *
 * Honors:
 *   - `process.env.NEXT_PUBLIC_APP_URL` (canonical prod origin)
 *   - Vercel preview URLs (`https://<branch>-<sha>.vercel.app`)
 *   - localhost on common dev ports
 *
 * Returns null when the origin is allowed (no error). Returns a
 * NextResponse 403 when blocked. The pattern mirrors `requireAuth`'s
 * { error?: NextResponse } shape so callers chain identically.
 *
 * Exempt this gate on:
 *   - Webhook receivers (HMAC-signed, no cookie)
 *   - Public unauthenticated POSTs (waitlist signup, demo runs)
 * by simply not calling it on those routes.
 */
export function requireSameOrigin(req: Request): NextResponse | null {
  // GET / HEAD / OPTIONS are inherently CSRF-safe (no state change).
  // CSRF only applies to mutating verbs.
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Both empty = either curl from the cmd-line (which can't carry a
  // session cookie anyway, so harmless) OR a stripped browser request
  // (which would be highly suspicious). We refuse to authorize on the
  // assumption that legitimate browser POSTs always send Origin.
  if (!origin && !referer) {
    return NextResponse.json(
      { error: "Cross-origin POSTs require Origin or Referer header." },
      { status: 403 },
    );
  }

  const candidate = origin ?? new URL(referer!).origin;
  if (!isAllowedOrigin(candidate)) {
    return NextResponse.json(
      { error: "Cross-origin request refused.", origin: candidate },
      { status: 403 },
    );
  }

  return null;
}

/**
 * The mutating-endpoint convenience: requireAuth + requireSameOrigin
 * in one call. Most of the platform's POST/DELETE/PATCH routes should
 * use this instead of the bare `requireAuth`.
 */
export async function requireMutatingAuth(
  req: Request,
  opts: { rateLimit?: boolean } = {},
): Promise<
  { email: string; userId: string; error?: never } | { error: NextResponse; email?: never; userId?: never }
> {
  const csrfErr = requireSameOrigin(req);
  if (csrfErr) return { error: csrfErr };
  return requireAuth(opts);
}

function isAllowedOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.host;
    const protocol = u.protocol;

    // Canonical app origin from env. The single source of truth.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      try {
        const allowed = new URL(appUrl);
        if (allowed.host === host && allowed.protocol === protocol) return true;
      } catch {
        // Misconfigured env, fall through to other checks.
      }
    }

    // Vercel preview deployments — *.vercel.app over HTTPS only.
    // Without this, every preview URL would 403 itself.
    if (protocol === "https:" && host.endsWith(".vercel.app")) return true;

    // Localhost on common dev ports for `npm run dev`.
    const isLocalhost =
      host === "localhost" ||
      host.startsWith("localhost:") ||
      host === "127.0.0.1" ||
      host.startsWith("127.0.0.1:") ||
      host === "[::1]" ||
      host.startsWith("[::1]:");
    if (isLocalhost && (protocol === "http:" || protocol === "https:")) return true;

    return false;
  } catch {
    // Malformed URL string — refuse to authorize.
    return false;
  }
}
