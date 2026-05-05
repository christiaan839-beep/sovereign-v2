-- 0018_voice_consent.sql
-- Persistent recording-consent log for the voice-calling feature.
--
-- Replaces an in-memory `Map` in src/lib/voice-service.ts that lost
-- consent state on every server restart — a compliance risk
-- (US two-party-consent states require provable affirmative consent
-- before recording).
--
-- One row per (phone_number, user_email) tuple. Last write wins.

CREATE TABLE IF NOT EXISTS "voice_consent" (
  "phone_number"   text NOT NULL,
  "user_email"     text NOT NULL DEFAULT '',
  "consented"      boolean NOT NULL,
  "source"         text DEFAULT 'manual',  -- manual | webhook | api
  "ip_address"     text,
  "user_agent"     text,
  "recorded_at"    timestamp NOT NULL DEFAULT now(),
  "expires_at"     timestamp,             -- optional: auto-revoke after N days
  CONSTRAINT "voice_consent_pkey" PRIMARY KEY ("phone_number", "user_email")
);

CREATE INDEX IF NOT EXISTS "idx_voice_consent_phone"
  ON "voice_consent" USING btree ("phone_number");
CREATE INDEX IF NOT EXISTS "idx_voice_consent_recorded"
  ON "voice_consent" USING btree ("recorded_at" DESC);
