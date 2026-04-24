/**
 * API key scope enforcement — least-privilege for machine access.
 *
 * Paired with migration 0034 which adds `scopes`, `allowed_agents`,
 * `allowed_ips` jsonb columns to `api_keys`.
 *
 * USAGE
 * ─────
 * In an API route:
 *
 *   const gate = await requireApiKeyScope(req, {
 *     scope: "agent:execute",
 *     agentSlug: "icd10-coder",
 *   });
 *   if (!gate.ok) return gate.response;
 *   // ... proceed with the request, using gate.keyId for audit
 *
 * BACKWARD COMPAT: keys created before migration 0034 have NULL scope
 * fields; they're treated as legacy full-access. Users opt into scoping
 * by editing a key in the dashboard.
 *
 * IP ALLOWLIST
 * ────────────
 * `allowed_ips` is CIDR-based ("10.0.0.0/8", "203.0.113.42/32"). NULL =
 * any IP allowed. Enforced BEFORE scope checks — a rogue IP can't use
 * any of the key's permissions.
 */

import { NextResponse } from "next/server";
import { errorResponseNext } from "@/lib/error-codes";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-key-scopes");

export type ApiScope =
  | "agent:read"
  | "agent:execute"
  | `agent:execute:${string}`
  | "data:read"
  | "data:write"
  | "admin";

export interface ApiKeyRecord {
  id: string;
  userId: string;
  plan: string;
  scopes: string[] | null;
  allowedAgents: string[] | null;
  allowedIps: string[] | null;
}

/**
 * Check whether a key allows the requested action.
 * Returns `{ allowed: true }` or `{ allowed: false, reason: "..." }`.
 * Pure function (no DB, no request) so it's easy to unit-test.
 */
export function evaluateScope(
  key: ApiKeyRecord,
  required: {
    scope: Exclude<ApiScope, `agent:execute:${string}`>;
    agentSlug?: string;
    ipAddress?: string;
  },
): { allowed: true } | { allowed: false; reason: string } {
  // Phase 1 — IP allowlist (if set)
  if (Array.isArray(key.allowedIps) && key.allowedIps.length > 0) {
    if (!required.ipAddress) {
      return { allowed: false, reason: "ip_required" };
    }
    if (!isIpAllowed(required.ipAddress, key.allowedIps)) {
      return { allowed: false, reason: "ip_not_allowed" };
    }
  }

  // Phase 2 — scope check
  const scopes = key.scopes;

  // Legacy keys (pre-migration): full access. Log once so ops can see
  // drift over time, but don't block.
  if (scopes === null || scopes === undefined) {
    return { allowed: true };
  }

  // Empty array = revoked-in-place. Different from NULL semantically.
  if (scopes.length === 0) {
    return { allowed: false, reason: "no_scopes" };
  }

  // Admin scope is an escape hatch that bypasses per-action checks.
  if (scopes.includes("admin")) return { allowed: true };

  // Per-agent scope takes precedence over the generic agent:execute
  // scope. E.g., a key with ["agent:execute:icd10-coder"] cannot
  // invoke leads.
  if (required.scope === "agent:execute" && required.agentSlug) {
    const specific = `agent:execute:${required.agentSlug}`;
    if (scopes.includes(specific)) {
      // Still need to pass the allowedAgents allowlist if present.
      return checkAllowedAgents(key, required.agentSlug);
    }
    if (scopes.includes("agent:execute")) {
      return checkAllowedAgents(key, required.agentSlug);
    }
    return { allowed: false, reason: "missing_scope" };
  }

  // Simple scope match for non-agent paths.
  if (scopes.includes(required.scope)) return { allowed: true };

  return { allowed: false, reason: "missing_scope" };
}

function checkAllowedAgents(
  key: ApiKeyRecord,
  slug: string,
): { allowed: true } | { allowed: false; reason: string } {
  const list = key.allowedAgents;
  if (!list || list.length === 0) return { allowed: true };
  if (list.includes(slug)) return { allowed: true };
  return { allowed: false, reason: "agent_not_allowlisted" };
}

/**
 * IP CIDR matcher. Supports IPv4 "a.b.c.d/n" + exact-match "a.b.c.d".
 * IPv6 is not yet supported — in practice Vercel clients are IPv4 via
 * x-forwarded-for. If we find IPv6 clients in the wild, extend this.
 */
function isIpAllowed(ip: string, cidrs: string[]): boolean {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return false;
  for (const cidr of cidrs) {
    if (matchCidr(ipInt, cidr)) return true;
  }
  return false;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) {
    return null;
  }
  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    parts[3]
  );
}

function matchCidr(ipInt: number, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  if (!base) return false;
  const bits = bitsStr ? parseInt(bitsStr, 10) : 32;
  if (!Number.isFinite(bits) || bits < 0 || bits > 32) return false;
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  if (bits === 0) return true; // 0.0.0.0/0 = anywhere
  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/**
 * Request-level helper. Looks up the API key (via the caller's auth
 * state), enforces scope, returns a 403 NextResponse when denied.
 *
 * Note: actual key-lookup code lives in src/lib/auth-guard.ts — this
 * module stays pure-functional + unit-testable. Wire by having
 * auth-guard call evaluateScope() after loading the key record.
 */
export function buildScopeDeniedResponse(
  reason: string,
): NextResponse {
  log.info("api key scope denied", { reason });
  return errorResponseNext("forbidden", {
    detail: `API key lacks required permission (${reason})`,
  }) as unknown as NextResponse;
}
