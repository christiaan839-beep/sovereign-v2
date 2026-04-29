-- Migration 0048: Agent Identity Manifests + KYA Registry.
--
-- Round 38 — closes the last major gap in the cryptographic agent-
-- trust stack. Each agent has a signed identity manifest declaring
-- ownership, capabilities, model provenance, code provenance, and
-- training-data declarations. Signed by the owner's CADC key.
--
-- See docs/adr/0006-agent-identity-manifests.md for full design.
--
-- THE KYA PATTERN (Know Your Agent):
--   Each manifest is publicly registrable + verifiable.
--   Federation peers can mirror.
--   Merchants verify cryptographically before accepting agent transactions.
--   Reputation systems (R40, future) are keyed by manifest ID.

CREATE TABLE IF NOT EXISTS agent_identity_manifests (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable agent identifier (kept stable across version chains).
  -- Multiple manifest rows may share agent_id (versions).
  agent_id        TEXT         NOT NULL,
  -- Version label declared by the manifest itself.
  version         TEXT         NOT NULL,
  -- Owner's userId.
  owner_user_id   TEXT         NOT NULL,
  -- Base64URL-encoded Ed25519 public key the manifest is signed with.
  -- Cross-references user_signing_keys.public_key (R34 CADC).
  owner_public_key TEXT        NOT NULL,
  -- The manifest data itself, as canonical JSON.
  -- Public-safe fields only (no email, no secrets).
  -- See ADR-0006 for the schema.
  manifest_json   JSONB        NOT NULL,
  -- The canonical message that was signed.
  manifest_message TEXT        NOT NULL,
  -- Base64URL Ed25519 signature over manifest_message.
  manifest_signature TEXT      NOT NULL,
  -- Chain hash linking to previous version (or "GENESIS").
  -- chain_hash = sha256(prev_chain_hash || manifest_message || manifest_signature)
  chain_hash      TEXT         NOT NULL,
  previous_manifest_hash TEXT,
  expires_at      TIMESTAMP    NOT NULL,
  -- Kill switch: signed revocation by the same owner_public_key.
  -- Once revoked, every verification of THIS manifest row fails.
  revoked_at      TIMESTAMP,
  revocation_message TEXT,
  revocation_signature TEXT,
  audit_log_id    TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  CONSTRAINT chain_hash_format CHECK (length(chain_hash) = 64),
  CONSTRAINT signature_nonempty CHECK (length(manifest_signature) > 0)
);

-- Find all versions of an agent's manifest.
CREATE INDEX IF NOT EXISTS idx_agent_identity_agent_versions
  ON agent_identity_manifests (agent_id, created_at);

-- Find currently-active manifest for an agent (most recent + not revoked + not expired).
CREATE INDEX IF NOT EXISTS idx_agent_identity_active
  ON agent_identity_manifests (agent_id, expires_at)
  WHERE revoked_at IS NULL;

-- Find manifests by owner (admin dashboard).
CREATE INDEX IF NOT EXISTS idx_agent_identity_owner
  ON agent_identity_manifests (owner_user_id, created_at);

-- Cross-instance verification: lookup by chain hash.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_identity_chain_hash
  ON agent_identity_manifests (chain_hash);
