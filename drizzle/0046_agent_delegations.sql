-- Migration 0046: Cryptographic Agent Delegation Chain (CADC).
--
-- Round 34 — the trust primitive nobody has shipped. Every agent
-- action is cryptographically signed by a user-delegated Ed25519 key
-- pair. A third party can verify ANY action without trusting the
-- platform — they fetch the public key, the signature, and the
-- chained audit hash, and verify the signature locally.
--
-- THE TRUST CHAIN:
--
--   user_signing_keys
--     ↓ (user signs delegation)
--   agent_delegations (user grants agent the right to act)
--     ↓ (agent signs each action with its OWN keypair)
--   agent_action_signatures (per-action signature + chain hash)
--     ↓ (linked to)
--   audit_logs (R26 hash chain — the immutable trail)
--
-- THIS COMPOSES with everything we've shipped:
--   * R26 audit chain — every delegation event is an audit row
--   * R27 cost-runaway — delegation has its own scope (max_cents)
--   * R28 A2E — delegation propagates via X-A2E-Depth + X-Agent-Sig headers
--   * R30 spend cards — delegation is the AUTHORIZATION for spend
--   * R33 multi-stage HITL — high-stakes delegations route through HITL
--
-- KILL SWITCH: revoking a delegation = signing a revocation message
-- with the SAME user key. Recorded in the chain. Once revoked, every
-- agent action that cites this delegation FAILS verification — no
-- matter where it's checked, by whom.
--
-- WHAT MAKES THIS NOVEL: third-party verifiability. An external
-- auditor can:
--   1. Download the public delegation row
--   2. Verify the user's signature locally (using their public key)
--   3. Verify the agent's action signature locally
--   4. Verify the audit chain hash matches
--   5. Confirm the delegation isn't revoked
-- All without calling our API. SOVEREIGN servers cannot lie about
-- what was authorized — the cryptography is the truth.

-- ─── User signing keys (Ed25519 public keys registered by users) ───
CREATE TABLE IF NOT EXISTS user_signing_keys (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  -- Base64URL-encoded Ed25519 public key (32 bytes raw → 43 chars b64url).
  public_key      TEXT         NOT NULL,
  -- Optional human-readable label ("My laptop", "YubiKey 1", etc.)
  label           TEXT,
  -- A user can register multiple keys (rotation, multi-device).
  -- One key MUST be marked primary; the API enforces this.
  is_primary      BOOLEAN      NOT NULL DEFAULT false,
  -- Set when the user retires this key (e.g. lost device).
  -- Retired keys CAN still verify past delegations they signed —
  -- this preserves the chain integrity. They cannot sign NEW ones.
  retired_at      TIMESTAMP,
  retire_reason   TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_signing_keys_user
  ON user_signing_keys (user_id, retired_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_signing_keys_pubkey
  ON user_signing_keys (public_key);


-- ─── Agent delegations (user grants agent the right to act) ─────────
CREATE TABLE IF NOT EXISTS agent_delegations (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  agent_name      TEXT         NOT NULL,
  -- Foreign-key by convention (no FK to allow soft-delete of keys).
  signing_key_id  UUID         NOT NULL,
  -- The agent gets its OWN ed25519 keypair. The user signs the agent's
  -- public key + scope + expiry, and stores both. The agent uses its
  -- private key to sign actions; the platform verifies actions against
  -- the agent's public key, then verifies that public key is properly
  -- signed by the user via the delegation row.
  agent_public_key TEXT        NOT NULL,
  -- Scope: what is the agent allowed to do? Free-form JSON for now;
  -- a future pure-function evaluator (similar to api-key-scopes.ts)
  -- will lock this down. Examples: {"max_cents": 5000, "allowed_actions": ["read", "summarize"]}
  scope           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- The delegation message that was SIGNED by the user. Format:
  --   "v1\nuser:{userId}\nagent:{agentName}\npubkey:{agentPublicKey}\nscope:{scopeJsonHash}\nissued:{iso}\nexpires:{iso}"
  -- This is what the user_signature applies to. Verifiers reconstruct
  -- this string and verify against signing_key_id's public key.
  delegation_message TEXT      NOT NULL,
  -- Base64URL-encoded Ed25519 signature (64 bytes raw → 86 chars b64url).
  user_signature  TEXT         NOT NULL,
  expires_at      TIMESTAMP    NOT NULL,
  -- Kill switch: when set, the delegation is revoked. The revocation
  -- itself is signed by the same user_signing_key — see revocation_message
  -- and revocation_signature below. A delegation with revoked_at set
  -- MUST have a valid revocation signature; the verifier checks both.
  revoked_at      TIMESTAMP,
  revocation_message TEXT,
  revocation_signature TEXT,
  -- Hash chain into the audit log. The audit chain (R26) records
  -- {action: "delegation.grant", details: {id, message, signature, ...}}
  -- linking this delegation cryptographically to the platform's
  -- immutable trail.
  audit_log_id    TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_delegations_user
  ON agent_delegations (user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_agent_delegations_agent_active
  ON agent_delegations (agent_name, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_delegations_pubkey
  ON agent_delegations (agent_public_key);


-- ─── Agent action signatures (per-action proof) ────────────────────
-- Each agent action gets a signature for verifiable provenance. The
-- agent signs an action_digest (sha256 of the canonical action shape)
-- with its delegated private key. Verifiers can:
--   1. Reconstruct the action_digest
--   2. Verify the agent_signature against the agent's public key
--   3. Verify the agent's public key is properly delegated (via parent
--      delegation row)
--   4. Verify the chain hash matches expected (tampering breaks chain)
CREATE TABLE IF NOT EXISTS agent_action_signatures (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id   UUID         NOT NULL,
  -- Hash of canonical action representation. Pure function; verifier
  -- reconstructs from the action's known fields.
  action_digest   TEXT         NOT NULL,
  -- Signature over action_digest by agent's private key.
  agent_signature TEXT         NOT NULL,
  -- Chain hash: sha256(prev_chain_hash || action_digest || agent_signature).
  -- Tampering with any past row breaks the chain forward.
  chain_hash      TEXT         NOT NULL,
  -- Cross-link to the audit log + execution audit log.
  audit_log_id    TEXT,
  execution_audit_id TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_action_sigs_delegation
  ON agent_action_signatures (delegation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_action_sigs_chain
  ON agent_action_signatures (chain_hash);
