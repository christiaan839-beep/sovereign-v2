-- Migration 0043: Agent execution traces.
--
-- WHY: Round 30 — Agentic Core. Every agent run currently leaves a
-- single audit_log envelope ("agent X ran in 2.3s, success"). The
-- INTERNAL steps — which model was called, which tool was invoked,
-- how long each took, what cost each — are opaque.
--
-- Without per-step traces:
--   * Debugging a slow run requires re-execution + log inspection
--   * Cost attribution is whole-run, not per-step
--   * Customer trust artifact ("show me how it reasoned") is impossible
--   * A/B testing prompt changes lacks a baseline to compare against
--   * Eval drift detection has no per-step signal
--
-- SHAPE:
--   agent_traces — one row per execution. Spans live in JSONB
--   (capped at 1MB) so simple queries can read the whole trace
--   in one fetch without joining a high-cardinality spans table.
--
--   Span structure (in JSONB):
--   {
--     id: "span_abc",
--     parentId: "span_xyz" | null,
--     kind: "model_call" | "tool_call" | "agent_call" | "decision",
--     name: "nim:nemotron" | "tavily:search" | "leads-agent" | "if-empty-route",
--     startMs: 0,           // ms relative to trace start
--     durationMs: 1234,
--     costCents: 2,         // estimated, may be 0 for free providers
--     inputBytes: 320,
--     outputBytes: 1820,
--     error?: "string"      // present iff this span failed
--   }
--
-- RETENTION: traces are retained 30 days by default; admin can
-- pin specific traces (referenced from a customer dispute) by
-- setting retain_until to NULL.

CREATE TABLE IF NOT EXISTS agent_traces (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Cross-link to execution_audit_log row. NULL when the trace was
  -- captured but the audit log write failed (defensive — never lose
  -- the trace because the audit log had a hiccup).
  audit_id        TEXT,
  user_id         TEXT         NOT NULL,
  agent_name      TEXT         NOT NULL,
  -- Total duration of the trace, ms. Sum of root-level spans plus
  -- coordination overhead.
  total_duration_ms  INTEGER   NOT NULL,
  total_cost_cents   INTEGER   NOT NULL DEFAULT 0,
  -- Cap the JSONB at 1MB worth of spans. JSONB compresses well so
  -- this is typically 100-500 spans of average detail.
  spans           JSONB        NOT NULL,
  -- Total span count for quick filtering (avoid jsonb_array_length on every read).
  span_count      INTEGER      NOT NULL,
  -- Roll-up of any error in the trace. NULL on full success; set
  -- to the first error message when any span failed.
  first_error     TEXT,
  retain_until    TIMESTAMP    NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Forensic index — find recent traces for a tenant (replay UI).
CREATE INDEX IF NOT EXISTS idx_agent_traces_user_recent
  ON agent_traces (user_id, created_at DESC);

-- Cost-attribution index — find expensive traces.
CREATE INDEX IF NOT EXISTS idx_agent_traces_cost
  ON agent_traces (total_cost_cents DESC, created_at DESC);

-- Cleanup index — the retention cron deletes traces past retain_until.
CREATE INDEX IF NOT EXISTS idx_agent_traces_retention
  ON agent_traces (retain_until) WHERE retain_until IS NOT NULL;

-- Cross-reference index — pull a trace by its audit ID (replay viewer
-- already has audit_id; this lets us fetch the matching trace in O(log n)).
CREATE INDEX IF NOT EXISTS idx_agent_traces_audit
  ON agent_traces (audit_id) WHERE audit_id IS NOT NULL;
