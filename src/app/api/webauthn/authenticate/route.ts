/**
 * SOVEREIGN MATRIX — /api/webauthn/authenticate (audit-2026-05).
 *
 * Step-up MFA assertion ceremony. Admin endpoints check
 * assertHasRecentMfa(userId) and 403 if no successful authentication
 * landed in the last 15 minutes.
 *
 *   POST /api/webauthn/authenticate
 *     → 200 { ok: true, options: PublicKeyCredentialRequestOptionsJSON }
 *     Client passes `options` to navigator.credentials.get() and POSTs
 *     the resulting AuthenticationResponseJSON back here.
 *
 *   POST /api/webauthn/authenticate { response: AuthenticationResponseJSON }
 *     → 200 { ok: true } — recent-MFA window starts ticking.
 *     → 400 on verification failure
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import {
  startAuthentication,
  finishAuthentication,
  isWebauthnConfigured,
} from "@/lib/webauthn";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("webauthn-authenticate");

const limiter = rateLimit({ interval: 60, limit: 20 });

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  if (!isWebauthnConfigured()) {
    return NextResponse.json(
      { error: "WebAuthn is not configured on this instance" },
      { status: 503 },
    );
  }

  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId!;

  const body = await req.json().catch(() => null);

  // Phase 2: finish.
  if (body && typeof body === "object" && "response" in body) {
    const result = await finishAuthentication(userId, body.response);
    if (!result.ok) {
      log.warn("WebAuthn finishAuthentication failed", {
        userId,
        error: result.error,
      });
      await auditLog({
        userId,
        action: "webauthn.assertion.failed",
        resource: "webauthn",
        details: { error: result.error },
      });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await auditLog({
      userId,
      action: "webauthn.assertion.ok",
      resource: "webauthn",
      details: {},
    });
    return NextResponse.json({ ok: true });
  }

  // Phase 1: issue authentication options.
  const result = await startAuthentication(userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, options: result.options });
}
