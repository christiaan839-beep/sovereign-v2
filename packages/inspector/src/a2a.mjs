/**
 * @sovereign/inspector — R160 A2A Agent Card (Move 10).
 *
 * Pure-function port of src/lib/protocols/a2a/agent-card.ts. A peer
 * fetching a Sovereign /.well-known/agent.json uses this module to
 * verify offline that the card is internally consistent + the
 * fingerprint matches the canonical encoding of identity-shaped fields.
 */

import { createHash } from "node:crypto";

export const A2A_AUTH_SCHEMES = [
  "none",
  "api-key",
  "oauth2",
  "mutual-tls",
  "act-token",
  "acat-mandate",
];

const ID_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$/;
const HTTPS_RE = /^https:\/\/[^\s]+$/;

export function canonicalEncodeAgentCard(args) {
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

export function computeAgentCardFingerprint(args) {
  return createHash("sha256").update(canonicalEncodeAgentCard(args)).digest("hex");
}

export function validateAgentCard(card) {
  if (card.protocolVersion !== "1.0") {
    return { ok: false, reason: "invalid_protocol_version", details: `expected 1.0; got ${card.protocolVersion}` };
  }
  if (!card.id || !ID_RE.test(card.id)) {
    return { ok: false, reason: "invalid_id", details: `id ${JSON.stringify(card.id)} fails kebab-case+length` };
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
      return { ok: false, reason: "invalid_auth_scheme", details: `${s} not canonical` };
    }
  }
  if (!card.endpoints?.rpc) {
    return { ok: false, reason: "missing_rpc_endpoint", details: "endpoints.rpc required" };
  }
  if (!HTTPS_RE.test(card.endpoints.rpc)) {
    return { ok: false, reason: "rpc_endpoint_not_https", details: `endpoints.rpc must be HTTPS; got ${card.endpoints.rpc}` };
  }
  if (!card.publishedAt || Number.isNaN(Date.parse(card.publishedAt))) {
    return { ok: false, reason: "invalid_published_at", details: "publishedAt must be ISO 8601" };
  }
  const expected = computeAgentCardFingerprint(card);
  if (card.fingerprint !== expected) {
    return { ok: false, reason: "fingerprint_mismatch", details: `${card.fingerprint} !== ${expected}` };
  }
  return { ok: true };
}

// ── Handshake state machine (mirror of platform) ────────────────

export function nextHandshakeState(state, event) {
  if (state === "closed" || state === "error") return state;
  if (event === "protocol-violation") return "error";
  if (event === "close-session") return "closed";
  switch (state) {
    case "invited":
      if (event === "initiate-handshake") return "challenged";
      return "error";
    case "challenged":
      if (event === "submit-credential") return "challenged";
      if (event === "verify-credential-ok") return "authenticated";
      if (event === "verify-credential-fail") return "error";
      return "error";
    case "authenticated":
      if (event === "issue-challenge") return "challenged";
      if (event === "initiate-handshake") return "established";
      return "error";
    case "established":
      if (event === "issue-challenge") return "challenged";
      return "error";
    default:
      return "error";
  }
}
