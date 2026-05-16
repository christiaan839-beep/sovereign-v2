import { auth } from "@clerk/nextjs/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-auth");

/**
 * ADMIN AUTH — allowlist guard for founder-only ops.
 *
 * Every endpoint under /api/_admin/* calls `requireAdmin()` at the
 * top. The allowlist is stored in the `ADMIN_USER_IDS` env var as a
 * comma-separated list of Clerk user IDs. We do NOT store admin
 * status in the database because:
 *
 *   1. It's a single-founder shop; the list is effectively static.
 *   2. Storing it in DB opens the "elevate yourself to admin" attack
 *      via a SQL injection / direct DB access vector.
 *   3. Env-var-only means a compromised user account can't escalate
 *      without also compromising the Vercel project.
 *
 * When you hire team members and this grows past 5 entries, move
 * to a proper `admins` table with audit log on grant/revoke.
 */

let _cachedAllowlist: Set<string> | null = null;

function getAllowlist(): Set<string> {
  if (_cachedAllowlist) return _cachedAllowlist;

  const raw = process.env.ADMIN_USER_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  _cachedAllowlist = new Set(ids);

  // Log once at module init so the founder sees the count in Vercel logs.
  if (ids.length === 0) {
    log.warn("ADMIN_USER_IDS is empty — no admin access possible");
  } else {
    log.info("Admin allowlist loaded", { count: ids.length });
  }

  return _cachedAllowlist;
}

/**
 * Assert the caller is an authenticated admin. Returns the admin's
 * userId on success, or a NextResponse to return from the route on
 * failure.
 *
 * When `WEBAUTHN_REQUIRED=true`, admins must also have completed a
 * hardware-key authentication within the last 15 minutes (audit-2026-05
 * step-up MFA requirement for SOC 2 CC6.1 / PCI 8.4.2 / HIPAA §164.312(d)).
 * Failure returns 403 with a `mfa-required` hint so the dashboard can
 * trigger the WebAuthn ceremony and retry the action.
 *
 * Usage:
 *   const gate = await requireAdmin();
 *   if (gate instanceof Response) return gate;
 *   const { userId } = gate;
 */
export async function requireAdmin(): Promise<
  { userId: string; admin: true } | Response
> {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!getAllowlist().has(userId)) {
    // Deliberately vague error — don't reveal the allowlist exists
    // or who's on it. A legitimate admin will see this + know to
    // check ADMIN_USER_IDS.
    log.warn("Non-admin user attempted admin action", { userId });
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Step-up MFA gate. Lazy-imported so a runtime without WebAuthn
  // wired up (eg. unit tests) doesn't pay the import cost.
  const { isWebauthnRequired, assertHasRecentMfa } =
    await import("@/lib/webauthn");
  if (isWebauthnRequired()) {
    const recent = await assertHasRecentMfa(userId);
    if (!recent) {
      log.warn("Admin action denied — no recent hardware-key MFA", { userId });
      return new Response(
        JSON.stringify({
          error: "mfa-required",
          hint: "Complete a WebAuthn assertion at /api/webauthn/authenticate and retry within 15 minutes.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  return { userId, admin: true };
}

/**
 * Non-request helper: check admin status of a given userId.
 * Used inside the UI (server component) to conditionally render
 * the admin menu item.
 */
export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getAllowlist().has(userId);
}

/** Test-only: reset the cache so unit tests can swap the env var. */
export function _resetAllowlistCacheForTests(): void {
  _cachedAllowlist = null;
}
