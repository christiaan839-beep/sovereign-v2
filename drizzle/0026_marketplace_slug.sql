-- Migration 0026: add `slug` column to marketplace_agents for
-- user-facing URLs like /marketplace/extract-invoice.
--
-- SAM v1.0 submissions carry a `slug` field in the manifest already,
-- so new rows get theirs populated by persistSubmission(). Legacy rows
-- are backfilled from manifest_raw->>'slug' where available; rows with
-- no SAM provenance remain slug=NULL and are unreachable by slug URL
-- (they stay reachable by UUID via the existing marketplace code).
--
-- The partial unique index (WHERE slug IS NOT NULL) enforces
-- uniqueness among populated slugs while allowing multiple legacy
-- rows to keep their NULL slug without colliding.

ALTER TABLE marketplace_agents
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill from manifest_raw (safe to re-run; WHERE skips already-set rows).
UPDATE marketplace_agents
SET slug = manifest_raw->>'slug'
WHERE manifest_raw IS NOT NULL
  AND manifest_raw->>'slug' IS NOT NULL
  AND slug IS NULL;

-- Unique among non-null values; many NULL rows can coexist.
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_slug_unique
  ON marketplace_agents (slug)
  WHERE slug IS NOT NULL;
