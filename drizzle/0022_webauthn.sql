-- Sovereign Matrix — WebAuthn step-up MFA tables (audit-2026-05).
--
-- Paste into Neon Console → SQL Editor. Idempotent (IF NOT EXISTS).
-- Pairs with src/db/schema.ts (webauthnCredentials + webauthnChallenges)
-- and src/lib/webauthn.ts.

CREATE TABLE IF NOT EXISTS "webauthn_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "credential_id" text NOT NULL UNIQUE,
  "public_key" text NOT NULL,
  "sign_counter" integer NOT NULL DEFAULT 0,
  "label" text NOT NULL DEFAULT 'hardware-key',
  "transports" text NOT NULL DEFAULT '[]',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "last_used_at" timestamp,
  "revoked_at" timestamp
);

CREATE INDEX IF NOT EXISTS "idx_webauthn_user"
  ON "webauthn_credentials" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_webauthn_cred"
  ON "webauthn_credentials" ("credential_id");

CREATE TABLE IF NOT EXISTS "webauthn_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "challenge" text NOT NULL,
  "ceremony" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_webauthn_challenges_user_ceremony"
  ON "webauthn_challenges" ("user_id", "ceremony", "expires_at");
