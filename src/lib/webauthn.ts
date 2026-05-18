/**
 * SOVEREIGN MATRIX — WebAuthn step-up MFA (audit-2026-05).
 *
 * Hardware-key authentication for administrative actions. Required by
 * SOC 2 CC6.1, PCI 8.4.2, and HIPAA §164.312(d). Wraps
 * @simplewebauthn/server with Sovereign's storage layer.
 *
 * Two ceremonies:
 *   • Registration  — bind a new authenticator to a user
 *   • Authentication — prove possession before mutating admin state
 *
 * Storage: webauthn_credentials + webauthn_challenges tables (schema).
 * Challenges expire after 5 minutes and are deleted on consumption.
 *
 * Configuration:
 *   WEBAUTHN_RP_ID         — your domain (e.g. "sovereignmatrix.agency")
 *   WEBAUTHN_RP_NAME       — display name (default: "Sovereign Matrix")
 *   WEBAUTHN_ORIGIN        — full origin (e.g. "https://sovereignmatrix.agency")
 *   WEBAUTHN_REQUIRED      — "true" to refuse admin actions without it
 *
 * When `WEBAUTHN_REQUIRED=true`, `assertHasRecentMfa(userId)` returns
 * false if the user has no successful authentication in the last 15 min.
 * Routes can guard themselves with:
 *   if (!(await assertHasRecentMfa(userId))) return 403 "mfa-required";
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type VerifyAuthenticationResponseOpts,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "@/db";
import { webauthnCredentials, webauthnChallenges } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("webauthn");

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RECENT_MFA_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getRpConfig(): {
  rpID: string;
  rpName: string;
  origin: string;
} | null {
  const rpID = process.env.WEBAUTHN_RP_ID;
  const origin = process.env.WEBAUTHN_ORIGIN;
  if (!rpID || !origin) return null;
  return {
    rpID,
    rpName: process.env.WEBAUTHN_RP_NAME ?? "Sovereign Matrix",
    origin,
  };
}

export function isWebauthnConfigured(): boolean {
  return getRpConfig() !== null;
}

export function isWebauthnRequired(): boolean {
  return process.env.WEBAUTHN_REQUIRED === "true";
}

// ── Registration ──────────────────────────────────────────────────────

/**
 * Begin registration of a new hardware authenticator. Returns the
 * options the client passes to `navigator.credentials.create()`.
 */
export async function startRegistration(userId: string): Promise<
  | {
      ok: true;
      options: Awaited<ReturnType<typeof generateRegistrationOptions>>;
    }
  | { ok: false; error: string }
> {
  const cfg = getRpConfig();
  if (!cfg) return { ok: false, error: "webauthn-not-configured" };

  // Look up existing credentials so the authenticator refuses to
  // register the same key twice.
  const existing = await db
    .select({ credentialId: webauthnCredentials.credentialId })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId))
    .catch(() => []);

  const opts: GenerateRegistrationOptionsOpts = {
    rpName: cfg.rpName,
    rpID: cfg.rpID,
    userID: Buffer.from(userId, "utf8"),
    userName: userId,
    timeout: CHALLENGE_TTL_MS,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      type: "public-key" as const,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
      // Don't pin attachment — accept platform passkeys + cross-platform
      // hardware keys equally. Operators who require hardware-only can
      // set this via env in a follow-up.
    },
  };

  const options = await generateRegistrationOptions(opts);

  await persistChallenge(userId, options.challenge, "registration");

  return { ok: true, options };
}

/**
 * Verify the client's registration response and persist the new
 * credential. Consumes the challenge.
 */
export async function finishRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  label?: string,
): Promise<{ ok: true; credentialId: string } | { ok: false; error: string }> {
  const cfg = getRpConfig();
  if (!cfg) return { ok: false, error: "webauthn-not-configured" };

  const challenge = await consumeChallenge(userId, "registration");
  if (!challenge) return { ok: false, error: "challenge-expired-or-missing" };

  const opts: VerifyRegistrationResponseOpts = {
    response,
    expectedChallenge: challenge,
    expectedOrigin: cfg.origin,
    expectedRPID: cfg.rpID,
    requireUserVerification: true,
  };

  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verification = await verifyRegistrationResponse(opts);
  } catch (err) {
    log.warn("WebAuthn registration verify threw", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "verification-failed" };
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, error: "not-verified" };
  }

  const { credential } = verification.registrationInfo;
  const credentialId = credential.id;
  const publicKey = Buffer.from(credential.publicKey).toString("base64");

  await db.insert(webauthnCredentials).values({
    userId,
    credentialId,
    publicKey,
    signCounter: credential.counter,
    label: label ?? "hardware-key",
    transports: JSON.stringify(response.response.transports ?? []),
  });

  log.info("WebAuthn credential registered", { userId, credentialId, label });
  return { ok: true, credentialId };
}

// ── Authentication ────────────────────────────────────────────────────

/**
 * Begin an authentication ceremony — the client uses the returned
 * options with `navigator.credentials.get()` and posts the response to
 * `finishAuthentication()`.
 */
export async function startAuthentication(userId: string): Promise<
  | {
      ok: true;
      options: Awaited<ReturnType<typeof generateAuthenticationOptions>>;
    }
  | { ok: false; error: string }
> {
  const cfg = getRpConfig();
  if (!cfg) return { ok: false, error: "webauthn-not-configured" };

  const creds = await db
    .select({
      credentialId: webauthnCredentials.credentialId,
      transports: webauthnCredentials.transports,
    })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId))
    .catch(() => []);

  if (creds.length === 0) {
    return { ok: false, error: "no-credentials-registered" };
  }

  const options = await generateAuthenticationOptions({
    rpID: cfg.rpID,
    timeout: CHALLENGE_TTL_MS,
    userVerification: "required",
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      type: "public-key" as const,
      transports: parseTransports(c.transports),
    })),
  });

  await persistChallenge(userId, options.challenge, "authentication");
  return { ok: true, options };
}

/**
 * Verify an authentication response. On success, updates the credential's
 * signCounter and lastUsedAt. Counter regression → revokes the row.
 */
export async function finishAuthentication(
  userId: string,
  response: AuthenticationResponseJSON,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = getRpConfig();
  if (!cfg) return { ok: false, error: "webauthn-not-configured" };

  const challenge = await consumeChallenge(userId, "authentication");
  if (!challenge) return { ok: false, error: "challenge-expired-or-missing" };

  const credentialId = response.id;
  const [row] = await db
    .select()
    .from(webauthnCredentials)
    .where(
      and(
        eq(webauthnCredentials.userId, userId),
        eq(webauthnCredentials.credentialId, credentialId),
      ),
    )
    .catch(() => []);
  if (!row) return { ok: false, error: "credential-not-found" };
  if (row.revokedAt) return { ok: false, error: "credential-revoked" };

  const opts: VerifyAuthenticationResponseOpts = {
    response,
    expectedChallenge: challenge,
    expectedOrigin: cfg.origin,
    expectedRPID: cfg.rpID,
    credential: {
      id: row.credentialId,
      publicKey: new Uint8Array(Buffer.from(row.publicKey, "base64")),
      counter: row.signCounter,
      transports: parseTransports(row.transports),
    },
    requireUserVerification: true,
  };

  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verification = await verifyAuthenticationResponse(opts);
  } catch (err) {
    log.warn("WebAuthn authentication verify threw", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "verification-failed" };
  }
  if (!verification.verified) return { ok: false, error: "not-verified" };

  // Counter regression detection — a clone of a hardware key would have
  // an out-of-date counter. Lock the row if we see one go backwards.
  if (
    verification.authenticationInfo.newCounter > 0 &&
    verification.authenticationInfo.newCounter <= row.signCounter
  ) {
    await db
      .update(webauthnCredentials)
      .set({ revokedAt: new Date() })
      .where(eq(webauthnCredentials.id, row.id));
    log.error("WebAuthn counter regression — credential revoked", {
      userId,
      credentialId,
      oldCounter: row.signCounter,
      newCounter: verification.authenticationInfo.newCounter,
    });
    return { ok: false, error: "counter-regression-detected" };
  }

  await db
    .update(webauthnCredentials)
    .set({
      signCounter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    })
    .where(eq(webauthnCredentials.id, row.id));

  return { ok: true };
}

/**
 * True iff the user successfully completed a WebAuthn authentication
 * within the last 15 minutes. The recommended guard for admin endpoints
 * when `WEBAUTHN_REQUIRED=true`.
 */
export async function assertHasRecentMfa(userId: string): Promise<boolean> {
  const cfg = getRpConfig();
  if (!cfg) {
    // If WebAuthn is not configured at all, fall open ONLY when not
    // required by env. Defense-in-depth: dev environments don't need
    // hardware keys; production with WEBAUTHN_REQUIRED=true blocks.
    return !isWebauthnRequired();
  }
  const since = new Date(Date.now() - RECENT_MFA_WINDOW_MS);
  const rows = await db
    .select({ id: webauthnCredentials.id })
    .from(webauthnCredentials)
    .where(
      and(
        eq(webauthnCredentials.userId, userId),
        gt(webauthnCredentials.lastUsedAt, since),
      ),
    )
    .limit(1)
    .catch(() => []);
  return rows.length > 0;
}

// ── Internals ─────────────────────────────────────────────────────────

async function persistChallenge(
  userId: string,
  challenge: string,
  ceremony: "registration" | "authentication",
): Promise<void> {
  await db.insert(webauthnChallenges).values({
    userId,
    challenge,
    ceremony,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
}

async function consumeChallenge(
  userId: string,
  ceremony: "registration" | "authentication",
): Promise<string | null> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(webauthnChallenges)
    .where(
      and(
        eq(webauthnChallenges.userId, userId),
        eq(webauthnChallenges.ceremony, ceremony),
        gt(webauthnChallenges.expiresAt, now),
      ),
    )
    .orderBy(webauthnChallenges.createdAt)
    .limit(1)
    .catch(() => []);
  if (!row) return null;
  // One-shot — delete on consumption to prevent replay.
  await db
    .delete(webauthnChallenges)
    .where(eq(webauthnChallenges.id, row.id))
    .catch(() => {
      /* non-blocking */
    });
  return row.challenge;
}

function parseTransports(
  raw: string,
): ("usb" | "ble" | "nfc" | "internal" | "hybrid")[] | undefined {
  try {
    const arr = JSON.parse(raw) as string[];
    return arr.filter((t) =>
      ["usb", "ble", "nfc", "internal", "hybrid"].includes(t),
    ) as ("usb" | "ble" | "nfc" | "internal" | "hybrid")[];
  } catch {
    return undefined;
  }
}
