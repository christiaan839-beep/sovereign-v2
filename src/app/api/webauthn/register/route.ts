/**
 * SOVEREIGN MATRIX — /api/webauthn/register (audit-2026-05).
 *
 * Hardware-key registration ceremony.
 *
 *   POST /api/webauthn/register
 *     → 200 { ok: true, options: PublicKeyCredentialCreationOptionsJSON }
 *     Client passes `options` to navigator.credentials.create() and POSTs
 *     the resulting RegistrationResponseJSON back to this same endpoint
 *     under the "finish" body shape.
 *
 *   POST /api/webauthn/register { response: RegistrationResponseJSON, label? }
 *     → 200 { ok: true, credentialId } on success
 *     → 400 on verification failure
 *
 * Auth: requires Clerk session — only the signed-in user can register
 * their own credential. Admin endpoints will later require step-up MFA
 * against the credentials registered here.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import {
  startRegistration,
  finishRegistration,
  isWebauthnConfigured,
} from "@/lib/webauthn";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("webauthn-register");

const limiter = rateLimit({ interval: 60, limit: 10 });

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
  // Phase 2: the client posted a registration response.
  if (body && typeof body === "object" && "response" in body) {
    const label =
      typeof body.label === "string" && body.label.length <= 64
        ? body.label
        : undefined;
    const result = await finishRegistration(userId, body.response, label);
    if (!result.ok) {
      log.warn("WebAuthn finishRegistration failed", {
        userId,
        error: result.error,
      });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await auditLog({
      userId,
      action: "webauthn.credential.registered",
      resource: `webauthn:${result.credentialId}`,
      details: { label: label ?? "hardware-key" },
    });
    return NextResponse.json({
      ok: true,
      credentialId: result.credentialId,
    });
  }

  // Phase 1: issue registration options to the client.
  const result = await startRegistration(userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }
  return NextResponse.json({ ok: true, options: result.options });
}
