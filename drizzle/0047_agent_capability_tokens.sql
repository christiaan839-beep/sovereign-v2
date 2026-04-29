-- Migration 0047: Agent Capability Tokens (ACTs).
--
-- Round 37 — the next-generation primitive on top of R34 CADC.
-- ACTs are Macaroon-pattern attenuatable capability tokens for AI
-- agents. See docs/adr/0005-agent-capability-tokens.md for full
-- design rationale.
--
-- THE TRUST SHAPE
--
--   user (R34 user_signing_keys.public_key)
--     ↓ mints root token
--   ACT v0 (issuer=user, subject=agent, caveats=[max_cents:5000])
--     ↓ agent A attenuates (adds caveats)
--   ACT v1 (issuer=agent_A, subject=agent_B, caveats=[+merchant:Airline])
--     ↓ agent B attenuates further
--   ACT v2 (issuer=agent_B, subject=merchant_endpoint,
--           caveats=[+max_cents:300, +expires:24h])
--     ↓ merchant endpoint validates EVERY level
--   ✓ Authorized for this transaction
--
-- VERIFIABLE OFFLINE: any holder of the chain + the root issuer's
-- public key can verify the entire chain without contacting the
-- platform. This is what enables cross-instance commerce (R36
-- federation): a token minted on instance A is verified by a peer
-- on instance B using A's public key from /.well-known/sovereign-trust.

CREATE TABLE IF NOT EXISTS agent_capability_tokens (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The original (root) token in this chain. NULL for root tokens
  -- themselves; set for every attenuation. Lets us pull a complete
  -- chain by following parent_id back to root.
  root_id         UUID,
  -- Direct parent in the attenuation chain. NULL for root.
  parent_id       UUID,
  -- Who minted this token? Public key (b64url Ed25519). For root
  -- tokens, this is the user's CADC public key. For attenuated
  -- tokens, this is the parent token's subject (the previous holder).
  issuer_public_key TEXT       NOT NULL,
  -- Who holds / can use this token? Public key (b64url Ed25519).
  -- For root tokens, this is the agent's keypair. For attenuated
  -- tokens, this is the next-level holder.
  subject_public_key TEXT      NOT NULL,
  -- The caveats this token carries. JSONB so the schema can extend
  -- without migrations. Built-in caveats:
  --   { max_cents: number, expires_at: ISO, allowed_merchants: string[],
  --     allowed_actions: string[], merchant_categories: string[] }
  -- Custom caveats may be added; the verifier evaluates ALL caveats
  -- and ALL must pass.
  caveats         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- The canonical message that was signed. Reconstructable from
  -- {issuer, subject, caveats, parent_chain_hash, issued_at}.
  -- Stored for forensic transparency.
  token_message   TEXT         NOT NULL,
  -- Ed25519 signature over token_message by the issuer's private key.
  signature       TEXT         NOT NULL,
  -- Hash chain: sha256(parent_chain_hash || token_message || signature).
  -- Tampering with any past token breaks every subsequent chain hash.
  chain_hash      TEXT         NOT NULL,
  expires_at      TIMESTAMP    NOT NULL,
  -- Set when the user revokes via signed revocation message. After
  -- revocation, all tokens in this chain (including descendants) FAIL
  -- verification. The revocation must be signed by the ROOT issuer's
  -- key (the user's R34 key) — sub-agents cannot forge revocations.
  revoked_at      TIMESTAMP,
  revocation_signature TEXT,
  -- Cross-link to audit log (every mint/attenuate is hash-chained).
  audit_log_id    TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  CONSTRAINT chain_hash_format CHECK (length(chain_hash) = 64),
  CONSTRAINT signature_nonempty CHECK (length(signature) > 0)
);

-- Find all tokens in a chain by root_id.
CREATE INDEX IF NOT EXISTS idx_act_root
  ON agent_capability_tokens (root_id, created_at);

-- Walk parent → child during verification.
CREATE INDEX IF NOT EXISTS idx_act_parent
  ON agent_capability_tokens (parent_id);

-- Find a token by its chain hash (for federation cross-instance lookup).
CREATE UNIQUE INDEX IF NOT EXISTS idx_act_chain_hash
  ON agent_capability_tokens (chain_hash);

-- Active-token queries by subject.
CREATE INDEX IF NOT EXISTS idx_act_subject_active
  ON agent_capability_tokens (subject_public_key, expires_at)
  WHERE revoked_at IS NULL;

-- Cleanup: expired tokens past 30 days are eligible for archival.
CREATE INDEX IF NOT EXISTS idx_act_expiry
  ON agent_capability_tokens (expires_at);
