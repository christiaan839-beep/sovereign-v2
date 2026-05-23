-- Wave 126 — Persistent agent sessions
--
-- Long-running agent workflows (multi-turn closer conversations,
-- lead-blitz across multiple days, audit-resume-from-checkpoint)
-- need durable state that survives process restarts + cold starts.
--
-- Apply via Neon SQL Editor:
--   psql $DATABASE_URL -f drizzle/0026_agent_sessions.sql
--
-- Idempotent — re-running is safe (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "agent_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "agent_name" text NOT NULL,
  -- active | done | failed | abandoned. Free text; agents define their own terminal states.
  "status" text DEFAULT 'active' NOT NULL,
  -- JSON blob — agent-defined state shape. Cap 64 KB per row (enforced in lib).
  "state" text DEFAULT '{}' NOT NULL,
  -- Array of step records (JSON-encoded). Capped at 50 entries by appendStep.
  "steps" text DEFAULT '[]' NOT NULL,
  "step_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_touched_at" timestamp DEFAULT now() NOT NULL,
  -- TTL — operator's cleanup cron deletes rows where now() > expires_at.
  "expires_at" timestamp
);

-- User-scoped reads sorted by recency.
CREATE INDEX IF NOT EXISTS "idx_agent_sessions_user" ON "agent_sessions"("user_id", "last_touched_at");
-- Per-agent listings (admin dashboards).
CREATE INDEX IF NOT EXISTS "idx_agent_sessions_agent" ON "agent_sessions"("agent_name");
-- Status filter (active sessions count, etc).
CREATE INDEX IF NOT EXISTS "idx_agent_sessions_status" ON "agent_sessions"("status");
-- TTL cleanup cron uses this.
CREATE INDEX IF NOT EXISTS "idx_agent_sessions_expires" ON "agent_sessions"("expires_at");
