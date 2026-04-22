-- drizzle/0024_agent_metadata_usecases_faq.sql
-- Thickens agent_metadata for the landing v2 /agents/[slug] detail pages
-- (Tier 1 gap T1-B). Adds:
--   use_cases         — JSON array of { title, description, exampleInput, exampleOutput }
--   faq               — JSON array of { question, answer }
--   sample_output_run_id — reference to a real playbook_runs.id to show as sample
--
-- All columns nullable: initial rollout seeds ~20 flagship agents;
-- remaining ~117 agents render their detail page without the new
-- sections until they're backfilled.

ALTER TABLE agent_metadata
  ADD COLUMN IF NOT EXISTS use_cases JSONB,
  ADD COLUMN IF NOT EXISTS faq JSONB,
  ADD COLUMN IF NOT EXISTS sample_output_run_id UUID;

CREATE INDEX IF NOT EXISTS idx_agent_metadata_sample_output_run_id
  ON agent_metadata (sample_output_run_id);
