-- Add opt-in flag for the weekly intelligence report (Proposal R).
-- See src/app/api/cron/weekly-report/route.ts.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "weekly_report_opt_in" TEXT DEFAULT 'false';
