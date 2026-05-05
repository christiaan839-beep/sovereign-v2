/**
 * Cron route authentication helper.
 *
 * Checks the Authorization header against CRON_SECRET, handling two common
 * pitfalls that were found in the security audit:
 *
 * 1. **"Bearer undefined" bypass** — if CRON_SECRET is unset, naive code
 *    like `auth !== \`Bearer ${CRON_SECRET}\`` compares against
 *    "Bearer undefined", which an attacker can literally send. This helper
 *    rejects unset secrets with 503 before the comparison.
 *
 * 2. **Fail-open guards** — patterns like `if (CRON_SECRET && auth !== ...)`
 *    silently skip the check when the env var is unset. This helper ALWAYS
 *    checks, never skips.
 *
 * 3. **NODE_ENV gates** — patterns that only enforce auth in production
 *    (so preview/staging deploys are wide open). This helper enforces in
 *    every environment.
 *
 * Usage:
 *
 * ```ts
 * import { requireCronAuth } from "@/lib/cron-auth";
 *
 * export async function POST(req: Request) {
 *   const err = requireCronAuth(req);
 *   if (err) return err;
 *   // ... handler
 * }
 * ```
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export function requireCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  // Fail-closed: without a configured secret, refuse every request.
  // Previously many routes would either skip the check (allowing every
  // request) or compare against "Bearer undefined" (allowing an attacker
  // to send that literal string).
  if (!secret || secret.length === 0) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;

  // Constant-time compare. Previously `authHeader !== expected` leaked the
  // secret one byte at a time over a few thousand probes.
  let valid = false;
  try {
    const a = Buffer.from(authHeader);
    const b = Buffer.from(expected);
    valid = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    valid = false;
  }

  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
