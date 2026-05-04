-- 0018_finishing_tables.sql
--
-- Closes the schema-vs-migration drift identified during the v2 ship audit.
-- Creates four tables that are declared in src/db/schema.ts but were never
-- captured in a migration file:
--   - case_studies      (marketing-page CMS)
--   - cta_clicks        (launch-week funnel attribution)
--   - oauth_connections (per-user encrypted tokens for Slack/Gmail/HubSpot)
--   - stripe_events     (idempotency log for the Stripe webhook handler)
--
-- All `IF NOT EXISTS` so re-running on a partially-migrated database is safe.

CREATE TABLE IF NOT EXISTS "case_studies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "company" text NOT NULL,
  "industry" text,
  "outcome" text NOT NULL,
  "metric" text NOT NULL,
  "playbook" text NOT NULL,
  "body" text,
  "approved_by_company" boolean DEFAULT false NOT NULL,
  "published_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_case_studies_published_at"
  ON "case_studies" ("published_at");
CREATE INDEX IF NOT EXISTS "idx_case_studies_slug"
  ON "case_studies" ("slug");

CREATE TABLE IF NOT EXISTS "cta_clicks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cta_name" text NOT NULL,
  "source_path" text,
  "referrer_domain" text,
  "user_id_hash" text,
  "session_id" text,
  "user_agent_family" text,
  "clicked_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_cta_clicks_clicked_at"
  ON "cta_clicks" ("clicked_at");
CREATE INDEX IF NOT EXISTS "idx_cta_clicks_cta"
  ON "cta_clicks" ("cta_name");
CREATE INDEX IF NOT EXISTS "idx_cta_clicks_source_path"
  ON "cta_clicks" ("source_path");

CREATE TABLE IF NOT EXISTS "oauth_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "provider" text NOT NULL,
  "workspace_id" text NOT NULL,
  "workspace_name" text,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "scopes" text[],
  "bot_user_id" text,
  "installed_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_oauth_user_provider_workspace"
  ON "oauth_connections" ("user_id", "provider", "workspace_id");
CREATE INDEX IF NOT EXISTS "idx_oauth_user_provider"
  ON "oauth_connections" ("user_id", "provider");

CREATE TABLE IF NOT EXISTS "stripe_events" (
  "event_id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "status" text DEFAULT 'received' NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "error_message" text
);
