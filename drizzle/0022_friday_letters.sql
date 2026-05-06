-- 0022_friday_letters.sql
-- Operator-authored Friday Letters published at /letters and
-- /letters/[slug]. Lifts letters from a static src/lib/letters.ts
-- array (which required a Vercel deploy per publish) into the DB
-- so the STANDARDS.md §06 weekly cadence stays sustainable.
--
-- Slug uniqueness enforced at the DB level so a typo can't shadow
-- a published URL. status='draft'|'published' so the writer UI
-- can save in-progress drafts without surfacing them publicly.

CREATE TABLE IF NOT EXISTS "friday_letters" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug"            text NOT NULL UNIQUE,
  "date"            date NOT NULL,
  "title"           text NOT NULL,
  "preview"         text NOT NULL,
  "body"            text NOT NULL,
  "status"          text NOT NULL DEFAULT 'draft',
  "author_user_id"  text,
  "published_at"    timestamp,
  "created_at"      timestamp NOT NULL DEFAULT now(),
  "updated_at"      timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_friday_letters_slug"
  ON "friday_letters" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "idx_friday_letters_date"
  ON "friday_letters" USING btree ("date" DESC);
CREATE INDEX IF NOT EXISTS "idx_friday_letters_status"
  ON "friday_letters" USING btree ("status");
