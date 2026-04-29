-- Migration 0051: Cryptographically-Signed Reliability Attestations.
--
-- Round 44 — the "most reliable, provably" round. Every 24h, the
-- platform signs an attestation summarizing the last 24h of health
-- snapshots + audit-chain integrity + provider availability. The
-- attestation is signed with the platform's master Ed25519 key.
--
-- See docs/adr/0009-signed-reliability-attestations.md.
--
-- The trust loop:
--   1. Platform computes 24h health summary from
--      platform_health_snapshots + audit_logs.
--   2. Platform signs the canonical attestation message.
--   3. The signed row is exposed via /api/health/reliability/attestation.
--   4. Customers run @sovereign/inspector reliability-verify <url>.
--   5. Inspector validates the signature offline against the published
--      platform public key.
--
-- Failure mode: if Sovereign ever fabricates a reliability claim
-- the customer's inspector catches it. Math is the truth, not our
-- word. Same trustless pattern as R34/R37/R38/R41/R42.

CREATE TABLE IF NOT EXISTS reliability_attestations (
  -- Auto UUID — multiple per day if the cron retries; latest wins
  -- for the public endpoint, but full history is preserved.
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The 24h window this attestation covers (always UTC midnights).
  window_start                TIMESTAMP    NOT NULL,
  window_end                  TIMESTAMP    NOT NULL,
  -- Aggregate metrics over the window.
  total_health_snapshots      INTEGER      NOT NULL DEFAULT 0,
  passing_health_snapshots    INTEGER      NOT NULL DEFAULT 0,
  failing_health_snapshots    INTEGER      NOT NULL DEFAULT 0,
  -- Audit chain integrity at the close of the window. NULL if
  -- the verifier wasn't run.
  audit_chain_intact          BOOLEAN,
  audit_chain_total_rows      INTEGER,
  audit_chain_first_broken_id TEXT,
  -- Computed uptime percentage [0, 100] over the window.
  uptime_pct                  NUMERIC(5,2) NOT NULL,
  -- Whether the platform met the published reliability commitment
  -- (default: 99.9% across the rolling 24h window).
  met_commitment              BOOLEAN      NOT NULL,
  commitment_threshold_pct    NUMERIC(5,2) NOT NULL DEFAULT 99.90,
  -- Canonical signed message (line-separated, deterministic).
  -- The exact string the signer signed; verifiers reconstruct it.
  attestation_message         TEXT         NOT NULL,
  -- Base64URL Ed25519 signature over attestation_message, signed
  -- by the platform's master signing key.
  attestation_signature       TEXT         NOT NULL,
  -- The platform public key in effect at signing time, for forward-
  -- key-rotation safety. A verifier checks: signature is valid AND
  -- public key matches the currently-published platform key.
  platform_public_key         TEXT         NOT NULL,
  -- sha256 chain hash for tamper detection. R26 pattern reused.
  -- chain_hash = sha256(prev_chain_hash || message || signature).
  previous_chain_hash         TEXT,
  chain_hash                  TEXT         NOT NULL,
  -- When the attestation was computed + signed.
  created_at                  TIMESTAMP    NOT NULL DEFAULT NOW(),
  CONSTRAINT uptime_in_range
    CHECK (uptime_pct >= 0 AND uptime_pct <= 100),
  CONSTRAINT commitment_threshold_in_range
    CHECK (commitment_threshold_pct >= 0 AND commitment_threshold_pct <= 100),
  CONSTRAINT window_ordered
    CHECK (window_end > window_start)
);

-- Find the latest attestation for the public endpoint.
CREATE INDEX IF NOT EXISTS idx_reliability_attestations_recent
  ON reliability_attestations (created_at DESC);

-- Find by window for forensics / customer SLA dispute resolution.
CREATE INDEX IF NOT EXISTS idx_reliability_attestations_window
  ON reliability_attestations (window_end DESC, window_start);

-- Index for chain-walking (audit-chain-integrity verification of
-- the attestation chain itself).
CREATE INDEX IF NOT EXISTS idx_reliability_attestations_chain
  ON reliability_attestations (chain_hash);
