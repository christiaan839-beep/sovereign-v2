-- ═══════════════════════════════════════════════════════════════════
-- 0017: Semantic Memory — vector embeddings for intelligent recall
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds embedding storage to tenant_memories so the platform can do
-- semantic similarity search (not just keyword match).
--
-- Embedding vectors are stored as JSON text arrays (1024-dim float32).
-- This works without pgvector extension. When migrating to pgvector:
--   ALTER TABLE tenant_memories ALTER COLUMN embedding_json TYPE vector(1024)
--   USING embedding_json::vector;
--
-- Also adds:
--   - importance_score: 0.0-1.0 float, agents/playbooks can mark high-value memories
--   - memory_type: "execution" | "insight" | "preference" | "fact"
--   - source_agent: the agent that created the memory
--   - session_id: groups memories from the same user session
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE tenant_memories
  ADD COLUMN IF NOT EXISTS embedding_json TEXT,
  ADD COLUMN IF NOT EXISTS importance_score REAL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS memory_type TEXT DEFAULT 'execution',
  ADD COLUMN IF NOT EXISTS source_agent TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Index for fast retrieval by type
CREATE INDEX IF NOT EXISTS idx_tenant_memories_type ON tenant_memories(memory_type);
-- Index for importance-ranked retrieval (most important first)
CREATE INDEX IF NOT EXISTS idx_tenant_memories_importance ON tenant_memories(user_id, importance_score DESC);
-- Index for session grouping
CREATE INDEX IF NOT EXISTS idx_tenant_memories_session ON tenant_memories(session_id) WHERE session_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 0017b: Credits & A2E Economy tables
-- ═══════════════════════════════════════════════════════════════════

-- User credit balances
CREATE TABLE IF NOT EXISTS user_credits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL UNIQUE,
  balance_cents   INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_spent  INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(user_id);

-- Credit transactions ledger (immutable append-only)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,          -- positive = credit, negative = debit
  transaction_type TEXT NOT NULL,            -- "earn" | "spend" | "refund" | "purchase" | "a2e_hire" | "a2e_earn"
  description     TEXT,
  agent_id        TEXT,                      -- which agent was hired (for a2e transactions)
  run_id          TEXT,                      -- execution run that caused this
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_agent ON credit_transactions(agent_id) WHERE agent_id IS NOT NULL;

-- A2E Agent hire log — when one agent hires another
CREATE TABLE IF NOT EXISTS a2e_hire_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_user_id  TEXT NOT NULL,
  hired_agent_id  TEXT NOT NULL,             -- marketplace agent slug
  hiring_agent    TEXT,                      -- which agent initiated the hire
  cost_cents      INTEGER NOT NULL,
  run_id          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | running | complete | failed
  result_preview  TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  completed_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_a2e_hire_user ON a2e_hire_log(hiring_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_a2e_hire_agent ON a2e_hire_log(hired_agent_id);
