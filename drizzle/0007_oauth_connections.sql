-- OAuth connections for customer tools (Slack, Gmail, HubSpot, etc.)
-- See docs/adr/0003-slack-oauth-first-integration.md.

CREATE TABLE IF NOT EXISTS "oauth_connections" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        TEXT NOT NULL,
  "provider"       TEXT NOT NULL,
  "workspace_id"   TEXT NOT NULL,
  "workspace_name" TEXT,
  "access_token"   TEXT NOT NULL,   -- encrypted via safeEncrypt
  "refresh_token"  TEXT,            -- encrypted
  "scopes"         TEXT[],
  "bot_user_id"    TEXT,
  "installed_at"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "revoked_at"     TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_oauth_user_provider_workspace"
  ON "oauth_connections" ("user_id", "provider", "workspace_id");

CREATE INDEX IF NOT EXISTS "idx_oauth_user_provider"
  ON "oauth_connections" ("user_id", "provider");

-- RLS — same pattern as other tenant tables (see 0005_row_level_security.sql).
ALTER TABLE "oauth_connections" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oauth_connections_owner" ON "oauth_connections";
CREATE POLICY "oauth_connections_owner" ON "oauth_connections"
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
