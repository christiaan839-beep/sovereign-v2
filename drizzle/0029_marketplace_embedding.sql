-- Migration 0029: semantic-search embedding column on marketplace_agents.
--
-- Stores a 2048-dim vector produced by nvidia/llama-3.2-nv-embedqa-1b-v2
-- as JSONB for portability — we can run cosine-similarity search
-- entirely in app code without the pg_vector extension.
--
-- When the agent count exceeds ~10k rows, the natural upgrade path is:
--   1. Install pg_vector: CREATE EXTENSION IF NOT EXISTS vector;
--   2. ALTER TABLE marketplace_agents ADD COLUMN embedding_vec vector(2048);
--   3. Backfill from embedding jsonb
--   4. Drop the jsonb column + index the vector column
--
-- Until then, JSONB + in-memory cosine is simpler and fast enough.
-- At 200 agents × 2048 floats, each embedding is ~16 KB uncompressed;
-- a full-table fetch is <5 MB, well under Neon's HTTP limits.

ALTER TABLE marketplace_agents
  ADD COLUMN IF NOT EXISTS embedding JSONB,
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- Fast filter to "agents that have embeddings" (search skips the rest).
CREATE INDEX IF NOT EXISTS idx_marketplace_has_embedding
  ON marketplace_agents ((embedding IS NOT NULL))
  WHERE embedding IS NOT NULL;
