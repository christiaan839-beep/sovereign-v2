-- Playbook Runs — persistent multi-agent execution with live step tracking

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
