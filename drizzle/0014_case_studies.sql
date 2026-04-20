-- Case studies table — the piece of infrastructure the static
-- /customers page is waiting for. When the first customer signs off
-- on publication, we insert a row here and /customers picks it up
-- automatically. No code change required per case study.
--
-- Fields are intentionally terse:
--   slug, company, industry, outcome (the HEADLINE result), metric
--   (the NUMBER that caught the HN reader's eye), playbook (which
--   workflow delivered it), body (the full Markdown narrative),
--   published_at (NULL means draft; non-NULL means live).
--
-- Honest-number discipline: we never publish a row with a metric
-- like "closed more deals" — the metric column should ALWAYS be a
-- specific number. That's enforced at the API layer, not the schema.

CREATE TABLE IF NOT EXISTS "case_studies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL UNIQUE,
  "company" TEXT NOT NULL,
  "industry" TEXT,
  "outcome" TEXT NOT NULL,            -- one-line result, e.g. "50 qualified leads in 72 hours"
  "metric" TEXT NOT NULL,             -- the NUMBER that leads the card, e.g. "$12,400 in pipeline"
  "playbook" TEXT NOT NULL,           -- which playbook delivered (Lead Blitz / etc.)
  "body" TEXT,                         -- full markdown narrative (rendered on /customers/[slug])
  "approved_by_company" BOOLEAN NOT NULL DEFAULT FALSE,
  "published_at" TIMESTAMP,            -- NULL = draft; only non-null rows appear on /customers
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_case_studies_published_at"
  ON "case_studies" ("published_at" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "idx_case_studies_slug"
  ON "case_studies" ("slug");
