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


-- ═══ Verification ══════════════════════════════════════════════════
-- After running, this query should return 13 rows:

SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (
  'jobs','playbook_runs','playbook_run_steps','graph_nodes','graph_edges',
  'affiliates','referrals','audit_logs','error_logs','workflows',
  'tenant_memories','voice_consent','tenants'
) ORDER BY tablename;
