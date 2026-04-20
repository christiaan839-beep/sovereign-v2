-- CTA click tracking — which marketing surfaces actually drive
-- founder-access requests. During launch week this tells us whether
-- the hero CTA, the /customers page, or the /pricing page produces
-- the most "chat with the founder" clicks.
--
-- No PII beyond the user_id_hash (SHA-256 12-char prefix). Timestamp
-- + CTA name + source page + referrer (domain only) + session id
-- (browser-generated, not a Clerk session).

CREATE TABLE IF NOT EXISTS "cta_clicks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cta_name" TEXT NOT NULL,            -- "founder-cta" / "primary-hero" / "primary-final" / ...
  "source_path" TEXT,                   -- /pricing, /customers, etc.
  "referrer_domain" TEXT,               -- already-normalized hostname
  "user_id_hash" TEXT,                  -- SHA-256 first 12 chars of Clerk ID if authenticated
  "session_id" TEXT,                    -- browser-generated, not a Clerk session
  "user_agent_family" TEXT,             -- "chrome" / "safari" / "firefox" / "mobile-safari"
  "clicked_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_cta_clicks_clicked_at"
  ON "cta_clicks" ("clicked_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_cta_clicks_cta"
  ON "cta_clicks" ("cta_name", "clicked_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_cta_clicks_source_path"
  ON "cta_clicks" ("source_path");
