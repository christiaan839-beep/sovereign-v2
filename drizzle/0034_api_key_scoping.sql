-- Migration 0034: per-API-key permission scoping.
--
-- WHY: The api_keys table gates access on `plan` (free/pro/enterprise)
-- but every key within a plan has the same permissions — a pro key can
-- hit any agent, read any data, mutate any resource. Least-privilege
-- architecture says: a data-export key should be read-only; a CI
-- integration key should only hit the 3 agents the pipeline uses.
--
-- SHAPE:
--   scopes         — jsonb array of permission strings. Supported:
--                      "agent:read"    — invoke any agent (GET only)
--                      "agent:execute" — invoke any agent (POST)
--                      "agent:execute:<slug>" — invoke a specific agent
--                      "data:read"     — read dashboards, status, metrics
--                      "data:write"    — modify user settings, bundles
--                      "admin"         — admin-only endpoints (rare)
--                    NULL scopes = legacy "full-access" key (backward compat).
--                    Empty array [] = key with no permissions (revoked in practice).
--
--   allowed_agents — jsonb array of slugs this key can invoke. Tighter
--                    than scopes — if set, ONLY these slugs are callable
--                    regardless of agent:execute permission. Used for
--                    vendor-scoped keys ("this key only runs icd10-coder
--                    and prior-auth-drafter").
--
--   allowed_ips    — jsonb array of CIDR blocks. NULL = any IP.
--                    Pattern: ["203.0.113.0/24", "198.51.100.42/32"].
--                    Enforced in auth-guard before the key's rate limit
--                    (so a compromised key can't be used from a rogue IP).
--
-- BACKWARD COMPAT: existing keys have NULL scopes / NULL allowed_agents /
-- NULL allowed_ips — interpreted as "legacy full-access" by the enforcer.
-- Users opt into tighter scoping by editing a key in the dashboard.

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes JSONB;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS allowed_agents JSONB;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS allowed_ips JSONB;

-- Index supports the per-key allow-list lookup during auth.
CREATE INDEX IF NOT EXISTS api_keys_scopes_idx
  ON api_keys USING gin (scopes);
