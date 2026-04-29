-- Migration 0052: Anomaly Findings (R67 — wires R57 into production).
--
-- Stores findings emitted by the R57 anomaly detector. Each row is
-- one finding from one detector run, with severity + structured
-- details. The composition with R44 signed reliability attestations:
--
--   R57 detector → emits findings → INSERT INTO anomaly_findings
--                                 ↓
--   R44 cron → reads recent findings → derives auditChainIntact
--                                    → signs the attestation
--                                 ↓
--   /reliability page → surfaces findings to operators
--
-- Findings are immutable once written. Old findings can be archived
-- but not edited — same audit-trail philosophy as audit_logs.

CREATE TABLE IF NOT EXISTS anomaly_findings (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Detector run id — groups findings emitted in the same cron tick.
  detector_run_id       UUID         NOT NULL,
  -- One of: rate_spike / rate_drop / denial_rate_spike /
  -- chain_integrity_break / signature_failure_spike / novel_actor.
  kind                  TEXT         NOT NULL,
  -- One of: critical / warning / info.
  severity              TEXT         NOT NULL,
  -- Procurement-readable one-liner for ops dashboards.
  message               TEXT         NOT NULL,
  -- Structured details (agent, action, tenant, z-score, baselines, etc.).
  details_json          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- Timestamp the finding was emitted by the detector.
  emitted_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
  -- Optional reference to a remediation action (future round).
  remediated_at         TIMESTAMP,
  remediated_by         TEXT,

  CONSTRAINT severity_valid
    CHECK (severity IN ('critical', 'warning', 'info')),
  CONSTRAINT kind_valid
    CHECK (kind IN (
      'rate_spike',
      'rate_drop',
      'denial_rate_spike',
      'chain_integrity_break',
      'signature_failure_spike',
      'novel_actor'
    ))
);

-- Find recent findings for /reliability + /api/health/anomalies.
CREATE INDEX IF NOT EXISTS idx_anomaly_findings_recent
  ON anomaly_findings (emitted_at DESC);

-- Filter by severity (the "show me critical findings" query).
CREATE INDEX IF NOT EXISTS idx_anomaly_findings_severity
  ON anomaly_findings (severity, emitted_at DESC);

-- Group findings by detector run (for forensic reconstruction).
CREATE INDEX IF NOT EXISTS idx_anomaly_findings_run
  ON anomaly_findings (detector_run_id, emitted_at);

-- Filter by kind (e.g. "show me all chain_integrity_break events").
CREATE INDEX IF NOT EXISTS idx_anomaly_findings_kind
  ON anomaly_findings (kind, emitted_at DESC);
