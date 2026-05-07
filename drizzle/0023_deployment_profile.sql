-- ═══════════════════════════════════════════════════════════════════
--   0023 — Sovereign deployment profiles + per-tenant cost attribution
--
--   Two changes, both safe to re-run.
--
--   1) tenants.deployment_profile  text NOT NULL DEFAULT 'cloud'
--        cloud      → uses build.nvidia.com NIM API + Portkey + paid
--                     fallbacks (Claude, Gemini). Default for new sign-ups.
--        byo-gpu    → routes inference at NIM_LOCAL_BASE_URL (vLLM/SGLang
--                     on customer's own GPU). No data leaves the VPC.
--        air-gapped → Ollama-only. Refuses any external provider call.
--
--      The profile is read at request time inside src/lib/ai.ts and
--      gates which providers may be selected. This is the moat for
--      enterprise buyers: one boolean flips the platform from public-
--      cloud-shaped to on-prem-shaped without a code change.
--
--   2) usage.tenant_id  uuid REFERENCES tenants(id) ON DELETE CASCADE
--
--      Today usage rows record `user_id` only. For multi-seat tenants
--      that means we can't bill the workspace correctly — every seat
--      counts independently. Adding tenant_id lets the cost dashboard
--      aggregate per workspace and lets enforcement read against the
--      tenant's plan limits, not the seat's.
--
--      Backfill is intentionally NOT performed: legacy rows keep
--      tenant_id = NULL and the dashboard's "unattributed" bucket
--      surfaces them. New rows always carry the value.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "deployment_profile" text NOT NULL DEFAULT 'cloud';

-- Restrict to the three known values. Drop+recreate so re-running this
-- file picks up any future enum widening cleanly.
ALTER TABLE "tenants"
  DROP CONSTRAINT IF EXISTS "tenants_deployment_profile_check";

ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_deployment_profile_check"
  CHECK ("deployment_profile" IN ('cloud', 'byo-gpu', 'air-gapped'));


ALTER TABLE "usage"
  ADD COLUMN IF NOT EXISTS "tenant_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usage_tenant_id_fk'
  ) THEN
    ALTER TABLE "usage"
      ADD CONSTRAINT "usage_tenant_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "usage_tenant_id_idx" ON "usage" ("tenant_id");
