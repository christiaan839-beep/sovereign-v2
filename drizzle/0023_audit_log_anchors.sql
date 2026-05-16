-- Sovereign Matrix — audit-log Bitcoin anchor table (audit-2026-05 Wave 9).
--
-- Paste into Neon Console → SQL Editor. Idempotent (IF NOT EXISTS).
-- Pairs with src/db/schema.ts (auditLogAnchors) and
-- src/lib/audit-log-anchor.ts. Populated daily by the
-- /api/_cron/audit-log-anchor route registered in vercel.json.

CREATE TABLE IF NOT EXISTS "audit_log_anchors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chain_head" text NOT NULL,
  "row_count" integer NOT NULL DEFAULT 0,
  "proofs" text NOT NULL DEFAULT '[]',
  "failures" text NOT NULL DEFAULT '[]',
  "ok" boolean NOT NULL DEFAULT false,
  "attested_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_audit_anchor_head"
  ON "audit_log_anchors" ("chain_head");

CREATE INDEX IF NOT EXISTS "idx_audit_anchor_time"
  ON "audit_log_anchors" ("attested_at");
