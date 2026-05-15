/**
 * SOVEREIGN MATRIX — Sandbox egress allowlist (Cook 108).
 *
 * Per-tool-call network policy for Cook 54 code-sandbox. Today the
 * tool passes `allowNetwork: boolean` through to the runner; this
 * module replaces that boolean with a structured policy so:
 *
 *   - "off": no network at all (most secure default)
 *   - "allowlist": only the supplied domains can be reached
 *   - "open": full network access (only for admin Tier-3 escalation)
 *
 * Pure module: produces an egress policy struct + a host-test
 * predicate. The runner adapter (Cook 78 e2b) consumes the policy
 * to configure its network proxy.
 */

import { isSafeUrl } from "@/lib/tools/built-in";

// ── Public types ──────────────────────────────────────────────────────────

export type EgressMode = "off" | "allowlist" | "open";

export interface EgressPolicy {
  mode: EgressMode;
  /** Bare hostnames (e.g. "api.openai.com"); ignored unless mode="allowlist". */
  allowedHosts: string[];
  /** Hard cap on total egress bytes per sandbox session. */
  maxEgressBytes: number;
  /** Hard cap on total outbound HTTP requests per session. */
  maxRequests: number;
}

export interface EgressViolation {
  reason:
    | "mode-off"
    | "host-not-allowed"
    | "non-https"
    | "ssrf-blocked"
    | "request-cap"
    | "byte-cap";
  message: string;
}

// ── Defaults ─────────────────────────────────────────────────────────────

const DEFAULT_BYTE_CAP = 50 * 1024 * 1024; // 50 MB
const DEFAULT_REQUEST_CAP = 100;

export const DEFAULT_POLICY: EgressPolicy = {
  mode: "off",
  allowedHosts: [],
  maxEgressBytes: DEFAULT_BYTE_CAP,
  maxRequests: DEFAULT_REQUEST_CAP,
};

// ── Allowlist construction ───────────────────────────────────────────────

/**
 * Build a policy. Bare hostnames are normalized to lowercase + stripped
 * of leading "www." to make the allowlist robust to capitalisation
 * and subdomain prefixes.
 */
export function buildPolicy(args: {
  mode: EgressMode;
  hosts?: string[];
  maxEgressBytes?: number;
  maxRequests?: number;
}): EgressPolicy {
  if (
    args.maxEgressBytes !== undefined &&
    (!Number.isFinite(args.maxEgressBytes) || args.maxEgressBytes <= 0)
  ) {
    throw new Error("buildPolicy: maxEgressBytes must be > 0");
  }
  if (
    args.maxRequests !== undefined &&
    (!Number.isFinite(args.maxRequests) || args.maxRequests <= 0)
  ) {
    throw new Error("buildPolicy: maxRequests must be > 0");
  }
  return {
    mode: args.mode,
    allowedHosts: (args.hosts ?? [])
      .map((h) =>
        h
          .toLowerCase()
          .trim()
          .replace(/^www\./, ""),
      )
      .filter((h) => h.length > 0),
    maxEgressBytes: args.maxEgressBytes ?? DEFAULT_BYTE_CAP,
    maxRequests: args.maxRequests ?? DEFAULT_REQUEST_CAP,
  };
}

// ── Test predicate ────────────────────────────────────────────────────────

/**
 * Decide whether a single URL is permitted under the policy. Returns
 * `null` when allowed; structured `EgressViolation` when blocked.
 */
export function testUrl(
  url: string,
  policy: EgressPolicy,
): EgressViolation | null {
  if (policy.mode === "off") {
    return {
      reason: "mode-off",
      message: "Sandbox network egress is disabled by policy",
    };
  }
  if (!isSafeUrl(url)) {
    return {
      reason: "ssrf-blocked",
      message: `URL blocked by SSRF guard: ${url}`,
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { reason: "ssrf-blocked", message: `Malformed URL: ${url}` };
  }
  if (parsed.protocol !== "https:") {
    return {
      reason: "non-https",
      message: `Only HTTPS egress is allowed; got ${parsed.protocol}`,
    };
  }
  if (policy.mode === "open") return null;
  // allowlist mode
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!policy.allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    return {
      reason: "host-not-allowed",
      message: `Host '${host}' is not in the allowlist`,
    };
  }
  return null;
}

// ── Session counter (runner-side) ─────────────────────────────────────────

/**
 * Tally request counts + bytes per session. Returns a violation when
 * caps are exceeded. Runner increments after each successful fetch.
 */
export interface SessionMeter {
  requests: number;
  bytes: number;
}

export function meterRequest(
  session: SessionMeter,
  policy: EgressPolicy,
  responseBytes: number,
): EgressViolation | null {
  session.requests++;
  session.bytes += Math.max(0, responseBytes);
  if (session.requests > policy.maxRequests) {
    return {
      reason: "request-cap",
      message: `Egress request cap exceeded (${policy.maxRequests})`,
    };
  }
  if (session.bytes > policy.maxEgressBytes) {
    return {
      reason: "byte-cap",
      message: `Egress byte cap exceeded (${policy.maxEgressBytes})`,
    };
  }
  return null;
}
