-- Sovereign Matrix — agent_tokens (Wave 16).
-- Per-agent JIT identity tokens. Pairs with src/lib/agent-tokens.ts.
-- Paste into Neon Console SQL Editor. Idempotent.

CREATE TABLE IF NOT EXISTS "agent_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_slug" text NOT NULL,
  "tenant_id" uuid REFERENCES "tenants" ("id") ON DELETE CASCADE,
  "user_id" text,
  "scopes" text NOT NULL DEFAULT '[]',
  "scheme" text NOT NULL DEFAULT 'v1',
  "expires_at" timestamp NOT NULL,
  "issued_at" timestamp NOT NULL DEFAULT now(),
  "revoked_at" timestamp,
  "revoke_reason" text
);

CREATE INDEX IF NOT EXISTS "idx_agent_tokens_agent"
  ON "agent_tokens" ("agent_slug");
CREATE INDEX IF NOT EXISTS "idx_agent_tokens_tenant"
  ON "agent_tokens" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_agent_tokens_expires"
  ON "agent_tokens" ("expires_at");
