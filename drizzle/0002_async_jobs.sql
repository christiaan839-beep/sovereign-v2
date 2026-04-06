-- Async Job Queue
-- Fire-and-forget agent execution with Telegram notifications

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
