const PRODUCTION_URL = "https://sovereignmatrix.agency";

/**
 * Resolves the canonical base URL for server-to-server API calls.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL  — explicit prod/staging override (https://sovereignmatrix.agency)
 *   2. VERCEL_URL           — auto-injected on Vercel preview deployments (no protocol)
 *   3. http://localhost:3000 — dev fallback
 *
 * Use this whenever one API route calls another via `fetch(...)` so we don't
 * hand-roll the same env-var fallback chain in 20 different files.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Resolves the canonical PUBLIC URL for user-facing links.
 *
 * Identical to getBaseUrl() except the dev fallback is the production
 * domain, not localhost. Use this for:
 *   - Payment gateway redirects (Stripe, Paystack, Yoco, PayFast)
 *   - Email link construction (must be stable/shareable)
 *   - Webhook callback URLs sent to external services
 *
 * These contexts need a URL that will still be reachable after the link
 * leaves the current process (e.g., email sent, redirect from bank).
 */
export function getPublicUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return PRODUCTION_URL;
}
