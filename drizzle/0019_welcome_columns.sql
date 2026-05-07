-- 0019_welcome_columns.sql
-- Welcome-page columns on tenants. Populated per-customer by the
-- operator immediately after the setup payment lands. Powers
-- /welcome/[tenant_id] — the first-60-seconds-of-trust kickoff page.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_first_name"     text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_loom_url"       text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_kickoff_url"    text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_slack_url"      text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_doc_url"        text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "welcome_first_delivery" date;
