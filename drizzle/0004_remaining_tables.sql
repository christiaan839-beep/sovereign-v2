-- Combined migration: tables from schema.ts not yet in Neon
-- Covers: graph memory, affiliates, audit/error logs, workflows, tenant memories
-- Also: tenant onboarding columns

-- ═══ Tenant Onboarding Columns ═══
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_goal" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_industry" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "company_url" text;

-- ═══ Graph Memory Fabric ═══

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

-- ═══ Affiliate / Referral Program ═══

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

-- ═══ Audit Logs (SOC 2 Compliance) ═══

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

-- ═══ Error Monitoring ═══

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

-- ═══ Workflow Builder ═══

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

-- ═══ Tenant Memory ═══

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
