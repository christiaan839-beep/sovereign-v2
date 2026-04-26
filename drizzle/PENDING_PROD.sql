-- ════════════════════════════════════════════════════════════════════════════
-- SOVEREIGN MATRIX — Pending Production Migrations (0002 + 0003 + 0004)
-- ════════════════════════════════════════════════════════════════════════════
-- All statements are idempotent (`IF NOT EXISTS`) — safe to re-run.
-- Apply in Neon Console → SQL Editor, or run scripts/apply-pending-migrations.ts
--
-- Unblocks:
--   • /api/jobs (async_jobs)
--   • /api/playbooks/run (playbook_runs + playbook_run_steps)
--   • /api/referrals + affiliate flow (affiliates + referrals)
--   • /api/workflows (workflows)
--   • Audit + error log persistence
--   • Onboarding goal tracking on tenants
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 0002: Async Jobs ───
CREATE TABLE IF NOT EXISTS "jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "goal" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "progress" integer DEFAULT 0,
  "result" text,
  "error" text,
  "agents_used" text,
  "notify_telegram" boolean DEFAULT false,
  "telegram_chat_id" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "duration_ms" integer,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_jobs_user" ON "jobs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "jobs" ("status");
CREATE INDEX IF NOT EXISTS "idx_jobs_created" ON "jobs" ("created_at");

-- ─── 0003: Playbook Runs ───
CREATE TABLE IF NOT EXISTS "playbook_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "playbook_id" text NOT NULL,
  "playbook_name" text NOT NULL,
  "inputs" text NOT NULL DEFAULT '{}',
  "status" text NOT NULL DEFAULT 'running',
  "step_count" integer NOT NULL DEFAULT 0,
  "steps_succeeded" integer NOT NULL DEFAULT 0,
  "steps_failed" integer NOT NULL DEFAULT 0,
  "duration_ms" integer,
  "notify_telegram" boolean DEFAULT false,
  "telegram_chat_id" text,
  "created_at" timestamp DEFAULT now(),
  "completed_at" timestamp
);
CREATE TABLE IF NOT EXISTS "playbook_run_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "playbook_runs"("id") ON DELETE CASCADE,
  "step_index" integer NOT NULL,
  "agent_name" text NOT NULL,
  "reason" text,
  "status" text NOT NULL DEFAULT 'pending',
  "result" text,
  "error" text,
  "duration_ms" integer,
  "started_at" timestamp,
  "completed_at" timestamp
);
CREATE INDEX IF NOT EXISTS "idx_playbook_runs_user" ON "playbook_runs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_playbook_runs_status" ON "playbook_runs" ("status");
CREATE INDEX IF NOT EXISTS "idx_playbook_runs_created" ON "playbook_runs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_playbook_steps_run" ON "playbook_run_steps" ("run_id");

-- ─── 0004: Tenant onboarding columns ───
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_goal" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_industry" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "company_url" text;

-- ─── 0004: Graph memory fabric ───
CREATE TABLE IF NOT EXISTS "graph_nodes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "node_type" text NOT NULL,
  "label" text NOT NULL,
  "properties" text NOT NULL DEFAULT '{}',
  "confidence" integer DEFAULT 100,
  "embedding" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "graph_edges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "source_id" uuid NOT NULL REFERENCES "graph_nodes"("id") ON DELETE CASCADE,
  "target_id" uuid NOT NULL REFERENCES "graph_nodes"("id") ON DELETE CASCADE,
  "edge_type" text NOT NULL,
  "weight" integer DEFAULT 100,
  "properties" text NOT NULL DEFAULT '{}',
  "confidence" integer DEFAULT 100,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_graph_nodes_user" ON "graph_nodes" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_graph_nodes_type" ON "graph_nodes" ("node_type");
CREATE INDEX IF NOT EXISTS "idx_graph_nodes_label" ON "graph_nodes" ("label");
CREATE INDEX IF NOT EXISTS "idx_graph_edges_user" ON "graph_edges" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_graph_edges_source" ON "graph_edges" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_graph_edges_target" ON "graph_edges" ("target_id");
CREATE INDEX IF NOT EXISTS "idx_graph_edges_type" ON "graph_edges" ("edge_type");

-- ─── 0004: Affiliate / referral program ───
CREATE TABLE IF NOT EXISTS "affiliates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL UNIQUE,
  "email" text NOT NULL,
  "referral_code" text NOT NULL UNIQUE,
  "commission_rate" integer NOT NULL DEFAULT 20,
  "total_referrals" integer NOT NULL DEFAULT 0,
  "total_earnings" integer NOT NULL DEFAULT 0,
  "payout_method" text DEFAULT 'paypal',
  "payout_details" text,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "affiliate_id" uuid NOT NULL REFERENCES "affiliates"("id") ON DELETE CASCADE,
  "referred_user_id" text NOT NULL,
  "referred_email" text NOT NULL,
  "plan" text DEFAULT 'free',
  "revenue" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'signed_up',
  "converted_at" timestamp,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_affiliates_code" ON "affiliates" ("referral_code");
CREATE INDEX IF NOT EXISTS "idx_affiliates_user" ON "affiliates" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_referrals_affiliate" ON "referrals" ("affiliate_id");

-- ─── 0004: Audit logs ───
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "action" text NOT NULL,
  "resource" text,
  "details" text,
  "ip_address" text,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_audit_user" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_action" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "idx_audit_created" ON "audit_logs" ("created_at");

-- ─── 0004: Error logs ───
CREATE TABLE IF NOT EXISTS "error_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message" text NOT NULL,
  "stack" text,
  "context" text,
  "severity" text NOT NULL DEFAULT 'medium',
  "user_id" text,
  "agent_id" text,
  "url" text,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_errors_severity" ON "error_logs" ("severity");
CREATE INDEX IF NOT EXISTS "idx_errors_created" ON "error_logs" ("created_at");

-- ─── 0004: Workflow builder ───
CREATE TABLE IF NOT EXISTS "workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "nodes" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "last_run_at" timestamp,
  "run_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_workflows_user" ON "workflows" ("user_id");

-- ─── 0004: Tenant memory ───
CREATE TABLE IF NOT EXISTS "tenant_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "agent_name" text NOT NULL,
  "input_summary" text,
  "output_summary" text,
  "tags" text,
  "metadata" text,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_tenant_memories_user" ON "tenant_memories" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_memories_agent" ON "tenant_memories" ("agent_name");

-- ─── Scheduled runs (used by workflow execution) ───
CREATE TABLE IF NOT EXISTS "scheduled_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "workflow_id" uuid REFERENCES "workflows"("id") ON DELETE CASCADE,
  "playbook_id" text,
  "cron" text,
  "next_run_at" timestamp,
  "last_run_at" timestamp,
  "status" text NOT NULL DEFAULT 'active',
  "run_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_scheduled_runs_user" ON "scheduled_runs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_scheduled_runs_next" ON "scheduled_runs" ("next_run_at");
