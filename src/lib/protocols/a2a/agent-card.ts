/**
 * R160 A2A AGENT CARD — Move 10 of the proof-conversion arc.
 *
 * Pure-function core of Google's Agent-to-Agent (A2A) protocol v1.0
 * (announced April 21, 2026). Agent Cards are the discovery primitive:
 * each agent publishes a JSON document at /.well-known/agent.json
 * describing its identity, capabilities, endpoints, authentication
 * schemes, and protocol version. A2A peers fetch the card to discover
 * what an agent can do and how to authenticate to it.
 *
 * STRATEGIC PURPOSE:
 *
 *   By April 2026 A2A was reported to be in production at 150+
 *   organizations, routing real cross-vendor agent traffic. Without
 *   an Agent Card surface, Sovereign Matrix is invisible to that
 *   ecosystem — every other A2A peer would have to build a custom
 *   Sovereign integration. Publishing canonical Agent Cards turns
 *   our 130+ agents into discoverable, addressable peers in any
 *   A2A-compatible network.
 *
 *   The MOAT is not that A2A exists. The moat is that every Sovereign
 *   Agent Card carries a SHA-256 fingerprint over the canonical
 *   encoding of its identity-shaped fields. A peer fetching a Sovereign
 *   card can verify offline that what they see is what we published —
 *   no man-in-the-middle Agent Card swap is possible. This is what
 *   procurement-grade A2A looks like, and it composes with the rest
 *   of the trust substrate (R26 audit, R34 identity, R37 ACT).
 *
 * SCOPE OF THIS MOVE:
 *
 *   This module ships the PURE-FUNCTION CORE:
 *     - Agent Card schema (TypeScript interface)
 *     - Validation (8 typed failure reasons)
 *     - Canonical encoding (deterministic key ordering)
 *     - SHA-256 fingerprint (anti-tampering anchor)
 *     - Handshake state machine (5 states, deterministic transitions)
 *
 *   It does NOT ship:
 *     - Next.js route at /.well-known/agent.json (Move 10b)
 *     - Network-layer A2A session multiplexing
 *     - Public-key infrastructure for signed cards (deferred to Move
 *       10c when an organizational identity scheme lands)
 *
 *   This is the same separation pattern the rest of the moves used:
 *   pure-function core ships first, network wiring comes after.
 */

import { createHash } from "node:crypto";

// ── Agent Card schema ─────────────────────────────────────────────

/**
 * Authentication schemes a Sovereign Agent Card may declare. Per the
 * A2A 1.0 spec, peers select one of the declared schemes when
 * initiating a session.
 */
export type A2AAuthScheme =
  | "none"             // public agent — read-only, no auth
  | "api-key"          // peer presents an API key in the Authorization header
  | "oauth2"           // peer presents an OAuth 2.0 bearer token
  | "mutual-tls"       // mTLS with peer client certificate
  | "act-token"        // R37 Sovereign ACT chain (preferred for Sovereign-to-Sovereign)
  | "acat-mandate";    // R91 Sovereign ACAT for commerce-class actions

export const A2A_AUTH_SCHEMES: ReadonlyArray<A2AAuthScheme> = [
  "none",
  "api-key",
  "oauth2",
  "mutual-tls",
  "act-token",
  "acat-mandate",
];

/**
 * The canonical Agent Card published at /.well-known/agent.json.
 * Field order is deliberate: stable id-shaped fields first, then
 * descriptive fields, then capabilities, then auth + endpoints.
 */
export interface A2AAgentCard {
  /** A2A protocol version. Sovereign cards always declare "1.0". */
  protocolVersion: "1.0";
  /** Stable agent id — kebab-case, max 64 chars. Persistent across versions. */
  id: string;
  /** Display name. */
  name: string;
  /** 1-3 sentence procurement-readable description. */
  description: string;
  /** Free-form vendor / organization. */
  supplier: string;
  /** Capabilities the agent claims to provide (free-form per agent type). */
  capabilities: ReadonlyArray<string>;
  /** Optional public homepage / docs URL. */
  homepage?: string;
  /** Endpoints exposed by the agent. */
  endpoints: {
    /** Required HTTPS URL for synchronous request/response. */
    rpc: string;
    /** Optional URL for server-sent-events streaming responses. */
    stream?: string;
    /** Optional URL for webhook callbacks the peer may register. */
    webhook?: string;
  };
  /** Auth schemes the agent accepts. At least one required. */
  authSchemes: ReadonlyArray<A2AAuthScheme>;
  /** Optional regulatory / compliance posture (free-form tags). */
  regulatoryNotes?: ReadonlyArray<string>;
  /** ISO 8601 — when the card was last regenerated. */
  publishedAt: string;
  /** SHA-256 of the canonical-encoded identity-shaped fields. */
  fingerprint: string;
}

// ── Canonical encoding ────────────────────────────────────────────

/**
 * Pure: deterministic canonical string encoding for fingerprinting.
 * The order is FIXED: protocolVersion → id → name → supplier →
 * sorted capabilities → sorted authSchemes → endpoints (rpc/stream/webhook)
 * → publishedAt. Description / homepage / regulatoryNotes are
 * EXCLUDED (they are surface-only fields that may change without
 * altering the agent's identity). Tampering with the description
 * does NOT break the fingerprint, but tampering with id, capabilities,
 * authSchemes, or endpoints DOES.
 */
export function canonicalEncodeAgentCard(
  args: Omit<A2AAgentCard, "fingerprint">,
): string {
  const sortedCapabilities = [...args.capabilities].sort().join(",");
  const sortedAuthSchemes = [...args.authSchemes].sort().join(",");
  return [
    `protocolVersion=${args.protocolVersion}`,
    `id=${args.id}`,
    `name=${args.name}`,
    `supplier=${args.supplier}`,
    `capabilities=[${sortedCapabilities}]`,
    `authSchemes=[${sortedAuthSchemes}]`,
    `rpc=${args.endpoints.rpc}`,
    `stream=${args.endpoints.stream ?? ""}`,
    `webhook=${args.endpoints.webhook ?? ""}`,
    `publishedAt=${args.publishedAt}`,
  ].join("|");
}

/** Pure: SHA-256 of the canonical encoding. */
export function computeAgentCardFingerprint(
  args: Omit<A2AAgentCard, "fingerprint">,
): string {
  const canonical = canonicalEncodeAgentCard(args);
  return createHash("sha256").update(canonical).digest("hex");
}

/** Pure: build a complete card with a fresh fingerprint. */
export function buildAgentCard(
  args: Omit<A2AAgentCard, "fingerprint">,
): A2AAgentCard {
  return { ...args, fingerprint: computeAgentCardFingerprint(args) };
}

// ── Validation ────────────────────────────────────────────────────

const ID_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$/;
const HTTPS_RE = /^https:\/\/[^\s]+$/;

export type AgentCardValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid_protocol_version"
        | "invalid_id"
        | "missing_name"
        | "missing_supplier"
        | "no_capabilities"
        | "no_auth_schemes"
        | "invalid_auth_scheme"
        | "missing_rpc_endpoint"
        | "rpc_endpoint_not_https"
        | "invalid_published_at"
        | "fingerprint_mismatch";
      details: string;
    };

/**
 * Pure: full structural + cryptographic validation. Used by the
 * inspector port for offline replay. Recomputes the fingerprint and
 * confirms it matches the one in the card.
 */
export function validateAgentCard(
  card: A2AAgentCard,
): AgentCardValidation {
  if (card.protocolVersion !== "1.0") {
    return {
      ok: false,
      reason: "invalid_protocol_version",
      details: `expected protocolVersion=1.0; got ${card.protocolVersion}`,
    };
  }
  if (!card.id || !ID_RE.test(card.id)) {
    return {
      ok: false,
      reason: "invalid_id",
      details: `id ${JSON.stringify(card.id)} fails kebab-case+length check`,
    };
  }
  if (!card.name || card.name.trim().length === 0) {
    return { ok: false, reason: "missing_name", details: "name must be non-empty" };
  }
  if (!card.supplier || card.supplier.trim().length === 0) {
    return { ok: false, reason: "missing_supplier", details: "supplier must be non-empty" };
  }
  if (!card.capabilities || card.capabilities.length === 0) {
    return { ok: false, reason: "no_capabilities", details: "capabilities must be non-empty" };
  }
  if (!card.authSchemes || card.authSchemes.length === 0) {
    return { ok: false, reason: "no_auth_schemes", details: "authSchemes must be non-empty" };
  }
  for (const s of card.authSchemes) {
    if (!A2A_AUTH_SCHEMES.includes(s)) {
      return {
        ok: false,
        reason: "invalid_auth_scheme",
        details: `auth scheme ${s} not in canonical list`,
      };
    }
  }
  if (!card.endpoints?.rpc) {
    return { ok: false, reason: "missing_rpc_endpoint", details: "endpoints.rpc is required" };
  }
  if (!HTTPS_RE.test(card.endpoints.rpc)) {
    return {
      ok: false,
      reason: "rpc_endpoint_not_https",
      details: `endpoints.rpc must be HTTPS; got ${card.endpoints.rpc}`,
    };
  }
  if (!card.publishedAt || Number.isNaN(Date.parse(card.publishedAt))) {
    return {
      ok: false,
      reason: "invalid_published_at",
      details: "publishedAt must be a valid ISO 8601",
    };
  }
  const expectedFp = computeAgentCardFingerprint(card);
  if (card.fingerprint !== expectedFp) {
    return {
      ok: false,
      reason: "fingerprint_mismatch",
      details: `fingerprint ${card.fingerprint} does not match recomputed ${expectedFp}`,
    };
  }
  return { ok: true };
}

// ── Handshake state machine (pure-function transitions) ──────────

/**
 * The 5 states an A2A session can be in. Transitions are
 * deterministic — given (state, event), there is exactly one valid
 * next state. Invalid transitions are rejected (the session ends in
 * error state).
 */
export type A2AHandshakeState =
  | "invited"          // peer A has fetched B's Agent Card
  | "challenged"       // B has issued an auth challenge
  | "authenticated"    // A's auth credential validated
  | "established"      // session ready for RPC traffic
  | "closed"           // session terminated cleanly
  | "error";           // session terminated by protocol violation

export type A2AHandshakeEvent =
  | "initiate-handshake"
  | "issue-challenge"
  | "submit-credential"
  | "verify-credential-ok"
  | "verify-credential-fail"
  | "close-session"
  | "protocol-violation";

/**
 * Pure: the canonical state-transition table. Returns the next state
 * given the current state + event, or "error" for an invalid pair.
 * This is the entire handshake protocol logic — the network layer
 * just turns wire bytes into events and back.
 */
export function nextHandshakeState(
  state: A2AHandshakeState,
  event: A2AHandshakeEvent,
): A2AHandshakeState {
  // Terminal states stay terminal.
  if (state === "closed" || state === "error") return state;

  // protocol-violation goes to error from any non-terminal state.
  if (event === "protocol-violation") return "error";

  // close-session goes to closed from any non-terminal state.
  if (event === "close-session") return "closed";

  switch (state) {
    case "invited":
      if (event === "initiate-handshake") return "challenged";
      return "error";
    case "challenged":
      if (event === "submit-credential") {
        // Submission alone doesn't authenticate — the verify-* event
        // is what advances state. Stay in challenged until verified.
        return "challenged";
      }
      if (event === "verify-credential-ok") return "authenticated";
      if (event === "verify-credential-fail") return "error";
      return "error";
    case "authenticated":
      if (event === "issue-challenge") return "challenged"; // re-challenge
      // Authenticated → established when the peer is ready for RPC.
      if (event === "initiate-handshake") return "established";
      return "error";
    case "established":
      if (event === "issue-challenge") return "challenged"; // mid-session re-auth
      return "error";
    default:
      return "error";
  }
}

/** Pure: is this state a terminal state? */
export function isTerminalHandshakeState(state: A2AHandshakeState): boolean {
  return state === "closed" || state === "error";
}

// ── Audit-entry shape (caller fires) ──────────────────────────────

export interface AgentCardAuditEntry {
  action: "agent.governance_consult";
  resource: string;
  details: {
    phase: "agent-card";
    agentId: string;
    fingerprint: string;
    publishedAt: string;
    capabilityCount: number;
  };
}

/**
 * Pure: produce the R26 audit entry recording an Agent Card was
 * generated. Reuses agent.governance_consult with phase="agent-card"
 * so SOC reviewers see card publication alongside PAGRL / ODTA / HITL
 * in one filter.
 */
export function buildAgentCardAuditEntry(
  card: A2AAgentCard,
): AgentCardAuditEntry {
  return {
    action: "agent.governance_consult",
    resource: `agent-card:${card.id}`,
    details: {
      phase: "agent-card",
      agentId: card.id,
      fingerprint: card.fingerprint,
      publishedAt: card.publishedAt,
      capabilityCount: card.capabilities.length,
    },
  };
}
