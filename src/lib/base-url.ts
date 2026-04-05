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
