-- ═══════════════════════════════════════════════════════════════════
--   Sovereign Matrix — pending migrations bundled for one-shot apply.
--
--   Paste this whole file into Neon Console → SQL Editor → Run.
--   Safe to re-run: every statement uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
--
--   Mirrors:
--     drizzle/0002_async_jobs.sql
--     drizzle/0003_playbook_runs.sql
--     drizzle/0004_remaining_tables.sql
--     drizzle/0018_voice_consent.sql        (compliance-critical)
--     drizzle/0019_welcome_columns.sql      (Loom-driven onboarding)
--     drizzle/0020_customer_deliveries.sql  (Monday delivery system of record)
--     drizzle/0021_webhook_events.sql       (webhook idempotency)
--     drizzle/0022_friday_letters.sql       (DB-backed Friday Letters)
-- ═══════════════════════════════════════════════════════════════════


-- ═══ 0002 — Async Job Queue ════════════════════════════════════════
-- Fire-and-forget agent execution with Telegram notifications.

CREATE TABLE IF NOT EXISTS "jobs" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"          text NOT NULL,
  "goal"             text NOT NULL,
  "status"           text NOT NULL DEFAULT 'pending',
  "progress"         integer DEFAULT 0,
  "result"           text,
  "error"            text,
  "agents_used"      text,
  "notify_telegram"  boolean DEFAULT false,
  "telegram_chat_id" text,
  "started_at"       timestamp,
  "completed_at"     timestamp,
  "duration_ms"      integer,
  "created_at"       timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_jobs_user"    ON "jobs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_status"  ON "jobs" ("status");
CREATE INDEX IF NOT EXISTS "idx_jobs_created" ON "jobs" ("created_at");


-- ═══ 0003 — Playbook Runs ══════════════════════════════════════════
-- Persistent multi-agent execution with per-step tracking.

CREATE TABLE IF NOT EXISTS "playbook_runs" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"          text NOT NULL,
  "playbook_id"      text NOT NULL,
  "playbook_name"    text NOT NULL,
  "inputs"           text NOT NULL DEFAULT '{}',
  "status"           text NOT NULL DEFAULT 'running',
  "step_count"       integer NOT NULL DEFAULT 0,
  "steps_succeeded"  integer NOT NULL DEFAULT 0,
  "steps_failed"     integer NOT NULL DEFAULT 0,
  "duration_ms"      integer,
  "notify_telegram"  boolean DEFAULT false,
  "telegram_chat_id" text,
  "created_at"       timestamp DEFAULT now(),
  "completed_at"     timestamp
);

CREATE TABLE IF NOT EXISTS "playbook_run_steps" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id"        uuid NOT NULL REFERENCES "playbook_runs"("id") ON DELETE CASCADE,
  "step_index"    integer NOT NULL,
  "agent_name"    text NOT NULL,
  "reason"        text,
  "status"        text NOT NULL DEFAULT 'pending',
  "result"        text,
  "error"         text,
  "duration_ms"   integer,
  "started_at"    timestamp,
  "completed_at"  timestamp
);

CREATE INDEX IF NOT EXISTS "idx_playbook_runs_user"    ON "playbook_runs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_playbook_runs_status"  ON "playbook_runs" ("status");
CREATE INDEX IF NOT EXISTS "idx_playbook_runs_created" ON "playbook_runs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_playbook_steps_run"    ON "playbook_run_steps" ("run_id");


-- ═══ 0004 — Remaining tables (graph memory, audit, workflows) ══════

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_goal"     text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_industry" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "company_url"         text;

CREATE TABLE IF NOT EXISTS "graph_nodes" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"     text NOT NULL,
  "node_type"   text NOT NULL,
  "label"       text NOT NULL,
  "properties"  text NOT NULL DEFAULT '{}',
  "confidence"  integer DEFAULT 100,
  "embedding"   text,
  "created_at"  timestamp DEFAULT now(),
  "updated_at"  timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "graph_edges" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"     text NOT NULL,
  "source_id"   uuid NOT NULL REFERENCES "graph_nodes"("id") ON DELETE CASCADE,
  "target_id"   uuid NOT NULL REFERENCES "graph_nodes"("id") ON DELETE CASCADE,
  "edge_type"   text NOT NULL,
  "weight"      integer DEFAULT 100,
  "properties"  text NOT NULL DEFAULT '{}',
  "confidence"  integer DEFAULT 100,
  "created_at"  timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_graph_nodes_user"   ON "graph_nodes" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_graph_nodes_type"   ON "graph_nodes" ("node_type");
CREATE INDEX IF NOT EXISTS "idx_graph_nodes_label"  ON "graph_nodes" ("label");
CREATE INDEX IF NOT EXISTS "idx_graph_edges_user"   ON "graph_edges" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_graph_edges_source" ON "graph_edges" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_graph_edges_target" ON "graph_edges" ("target_id");
CREATE INDEX IF NOT EXISTS "idx_graph_edges_type"   ON "graph_edges" ("edge_type");

CREATE TABLE IF NOT EXISTS "affiliates" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"          text NOT NULL UNIQUE,
  "email"            text NOT NULL,
  "referral_code"    text NOT NULL UNIQUE,
  "commission_rate"  integer NOT NULL DEFAULT 20,
  "total_referrals"  integer NOT NULL DEFAULT 0,
  "total_earnings"   integer NOT NULL DEFAULT 0,
  "payout_method"    text DEFAULT 'paypal',
  "payout_details"   text,
  "status"           text NOT NULL DEFAULT 'active',
  "created_at"       timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "referrals" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "affiliate_id"      uuid NOT NULL REFERENCES "affiliates"("id") ON DELETE CASCADE,
  "referred_user_id"  text NOT NULL,
  "referred_email"    text NOT NULL,
  "plan"              text DEFAULT 'free',
  "revenue"           integer NOT NULL DEFAULT 0,
  "status"            text NOT NULL DEFAULT 'signed_up',
  "converted_at"      timestamp,
  "created_at"        timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_affiliates_code"      ON "affiliates" ("referral_code");
CREATE INDEX IF NOT EXISTS "idx_affiliates_user"      ON "affiliates" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_referrals_affiliate" ON "referrals" ("affiliate_id");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"     text NOT NULL,
  "action"      text NOT NULL,
  "resource"    text,
  "details"     text,
  "ip_address"  text,
  "created_at"  timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_audit_user"    ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_action"  ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "idx_audit_created" ON "audit_logs" ("created_at");

CREATE TABLE IF NOT EXISTS "error_logs" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message"     text NOT NULL,
  "stack"       text,
  "context"     text,
  "severity"    text NOT NULL DEFAULT 'medium',
  "user_id"     text,
  "agent_id"    text,
  "url"         text,
  "created_at"  timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_errors_severity" ON "error_logs" ("severity");
CREATE INDEX IF NOT EXISTS "idx_errors_created"  ON "error_logs" ("created_at");

CREATE TABLE IF NOT EXISTS "workflows" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"     text NOT NULL,
  "name"        text NOT NULL,
  "nodes"       text NOT NULL,
  "status"      text NOT NULL DEFAULT 'draft',
  "last_run_at" timestamp,
  "run_count"   integer NOT NULL DEFAULT 0,
  "created_at"  timestamp DEFAULT now(),
  "updated_at"  timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_workflows_user" ON "workflows" ("user_id");

CREATE TABLE IF NOT EXISTS "tenant_memories" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"        text NOT NULL,
  "agent_name"     text NOT NULL,
  "input_summary"  text,
  "output_summary" text,
  "tags"           text,
  "metadata"       text,
  "created_at"     timestamp DEFAULT now()
);


-- ═══ 0018 — Voice consent (compliance-critical) ════════════════════
-- Persistent recording-consent log; replaces an in-memory Map that
-- lost state on every server restart. Required before launching the
-- voice-calling feature in two-party-consent jurisdictions.

CREATE TABLE IF NOT EXISTS "voice_consent" (
  "phone_number"  text NOT NULL,
  "user_email"    text NOT NULL DEFAULT '',
  "consented"     boolean NOT NULL,
  "source"        text DEFAULT 'manual',
  "ip_address"    text,
  "user_agent"    text,
  "recorded_at"   timestamp NOT NULL DEFAULT now(),
  "expires_at"    timestamp,
  CONSTRAINT "voice_consent_pkey" PRIMARY KEY ("phone_number", "user_email")
);

CREATE INDEX IF NOT EXISTS "idx_voice_consent_phone"
  ON "voice_consent" USING btree ("phone_number");
CREATE INDEX IF NOT EXISTS "idx_voice_consent_recorded"
  ON "voice_consent" USING btree ("recorded_at" DESC);


-- ═══ 0019 — Welcome columns on tenants ═════════════════════════════
-- Powers /welcome/[tenant_id] — Loom-driven onboarding page surfaced
-- to a customer the moment their setup payment lands.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_first_name"     text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_loom_url"       text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_kickoff_url"    text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_slack_url"      text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_doc_url"        text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_first_delivery" date;


-- ═══ 0020 — Customer deliveries (Monday delivery system of record) ═
-- One row per (tenant, delivery_date). delivery_date is the Monday
-- the batch is FOR. Required by the Monday-watchdog cron in
-- /api/_cron/delivery-watchdog.

CREATE TABLE IF NOT EXISTS "customer_deliveries" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"          uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "delivery_date"      date NOT NULL,
  "lead_count"         integer NOT NULL,
  "hand_reviewed_by"   text NOT NULL,
  "slack_message_url"  text,
  "notes"              text,
  "created_at"         timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_deliveries_tenant_date"
  ON "customer_deliveries" USING btree ("tenant_id", "delivery_date");

CREATE INDEX IF NOT EXISTS "idx_deliveries_date"
  ON "customer_deliveries" USING btree ("delivery_date");


-- ═══ 0021 — Webhook event idempotency ══════════════════════════════
-- Every inbound webhook (PayPal, Stripe, Clerk, Yoco) is fingerprinted
-- by (provider, event_id) and inserted BEFORE its side effects run.
-- Composite primary key is the dedupe lock — a duplicate event hits
-- 23505 and the handler short-circuits with 200 OK so the provider
-- stops retrying.

CREATE TABLE IF NOT EXISTS "webhook_events" (
  "provider"     text NOT NULL,
  "event_id"     text NOT NULL,
  "event_type"   text,
  "status"       text NOT NULL DEFAULT 'processing',
  "processed_at" timestamp,
  "error"        text,
  "received_at"  timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("provider", "event_id")
);

CREATE INDEX IF NOT EXISTS "idx_webhook_events_received"
  ON "webhook_events" USING btree ("received_at" DESC);


-- ═══ 0022 — Friday Letters (DB-backed cadence) ═════════════════════
-- Operator-authored weekly notes published at /letters and
-- /letters/[slug]. Lifts letters from a static src/lib/letters.ts
-- array into the DB so /admin/letters/new can publish without a
-- Vercel deploy. Slug uniqueness enforced at DB level.

CREATE TABLE IF NOT EXISTS "friday_letters" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug"            text NOT NULL UNIQUE,
  "date"            date NOT NULL,
  "title"           text NOT NULL,
  "preview"         text NOT NULL,
  "body"            text NOT NULL,
  "status"          text NOT NULL DEFAULT 'draft',
  "author_user_id"  text,
  "published_at"    timestamp,
  "created_at"      timestamp NOT NULL DEFAULT now(),
  "updated_at"      timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_friday_letters_slug"
  ON "friday_letters" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "idx_friday_letters_date"
  ON "friday_letters" USING btree ("date" DESC);
CREATE INDEX IF NOT EXISTS "idx_friday_letters_status"
  ON "friday_letters" USING btree ("status");


-- ═══ Verification ══════════════════════════════════════════════════
-- After running, this query should return 16 rows: the 15 tables
-- created by migrations 0002–0022 plus `tenants` (created in 0000,
-- listed here as a sanity check that the schema is reachable).

SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (
  'jobs','playbook_runs','playbook_run_steps','graph_nodes','graph_edges',
  'affiliates','referrals','audit_logs','error_logs','workflows',
  'tenant_memories','voice_consent','customer_deliveries','webhook_events',
  'friday_letters','tenants'
) ORDER BY tablename;

-- Optionally verify the welcome_* columns landed on tenants
-- (migration 0019). Should return 6 rows.
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='tenants'
   AND column_name LIKE 'welcome_%'
 ORDER BY column_name;
