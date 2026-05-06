-- ═══════════════════════════════════════════════════════════════════
--   0024 — Tenant kill-switch (safety / abuse / refund-on-cancel)
--
--   The "infrastructure-level kill switch" — a single column the
--   operator can flip to deny a tenant any further agent execution
--   without deleting their data, refunding manually, or paging the
--   on-call.
--
--   When `tenants.is_suspended = true`, the agent-factory refuses
--   the request before the handler runs and returns 423 Locked with
--   the suspension reason in the response body. The tenant's data,
--   subscriptions, and welcome page are unchanged — only execution
--   is paused.
--
--   Three columns:
--
--     is_suspended       boolean NOT NULL DEFAULT false
--                        the switch itself
--     suspension_reason  text
--                        free-form operator note surfaced to the
--                        end-user in the 423 response. Examples:
--                        "Refund processed, account paused",
--                        "Suspected automated abuse — see ticket #123",
--                        "Awaiting compliance review (export controls)"
--     suspended_at       timestamp
--                        when the flip happened, for audit and the
--                        admin "recently-suspended" filter
--
--   Audit trail: writes to this column should always go through
--   the suspend-tenant admin endpoint, which logs to `audit_logs`
--   with the operator's userId. Direct UPDATE is permitted (Neon
--   console) but the audit-log gap is the operator's responsibility.
--
--   Reversal: setting `is_suspended = false` restores execution
--   immediately — no other state has been mutated.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "is_suspended" boolean NOT NULL DEFAULT false;

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "suspension_reason" text;

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "suspended_at" timestamp;

-- Partial index — only the suspended rows. Tiny and cheap; powers
-- the admin /admin/tenants?suspended filter without scanning the
-- whole table once a workspace gets >1k tenants.
CREATE INDEX IF NOT EXISTS "tenants_is_suspended_idx"
  ON "tenants" ("is_suspended")
  WHERE "is_suspended" = true;
