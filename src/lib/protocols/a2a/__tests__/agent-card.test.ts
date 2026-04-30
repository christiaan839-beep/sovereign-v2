/**
 * R160 A2A Agent Card — pure-function tests.
 */

import { describe, it, expect } from "vitest";
import {
  A2A_AUTH_SCHEMES,
  buildAgentCard,
  canonicalEncodeAgentCard,
  computeAgentCardFingerprint,
  validateAgentCard,
  buildAgentCardAuditEntry,
  nextHandshakeState,
  isTerminalHandshakeState,
} from "../agent-card";

const sampleCard = (overrides = {}) => ({
  protocolVersion: "1.0" as const,
  id: "sov-finance-bot",
  name: "Sovereign Finance Bot",
  description: "A finance reconciliation agent.",
  supplier: "Sovereign Matrix",
  capabilities: ["reconcile", "audit-trail-export"],
  endpoints: { rpc: "https://api.sovereignmatrix.agency/agents/finance-bot/rpc" },
  authSchemes: ["act-token" as const],
  publishedAt: "2026-04-30T00:00:00.000Z",
  ...overrides,
});

describe("A2A_AUTH_SCHEMES taxonomy", () => {
  it("declares the canonical 6 auth schemes", () => {
    expect(A2A_AUTH_SCHEMES).toEqual([
      "none",
      "api-key",
      "oauth2",
      "mutual-tls",
      "act-token",
      "acat-mandate",
    ]);
  });
});

describe("canonicalEncodeAgentCard", () => {
  it("is deterministic", () => {
    const a = canonicalEncodeAgentCard(sampleCard());
    const b = canonicalEncodeAgentCard(sampleCard());
    expect(a).toBe(b);
  });

  it("is invariant under capability order", () => {
    const a = canonicalEncodeAgentCard(sampleCard({ capabilities: ["a", "b"] }));
    const b = canonicalEncodeAgentCard(sampleCard({ capabilities: ["b", "a"] }));
    expect(a).toBe(b);
  });

  it("excludes description from the canonical encoding (surface-only field)", () => {
    const a = canonicalEncodeAgentCard(sampleCard({ description: "Original" }));
    const b = canonicalEncodeAgentCard(sampleCard({ description: "Edited" }));
    expect(a).toBe(b);
  });

  it("changes when id changes", () => {
    const a = canonicalEncodeAgentCard(sampleCard({ id: "a-bot" }));
    const b = canonicalEncodeAgentCard(sampleCard({ id: "b-bot" }));
    expect(a).not.toBe(b);
  });
});

describe("computeAgentCardFingerprint", () => {
  it("is a 64-char hex SHA-256", () => {
    const fp = computeAgentCardFingerprint(sampleCard());
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches identical inputs", () => {
    expect(computeAgentCardFingerprint(sampleCard())).toBe(
      computeAgentCardFingerprint(sampleCard()),
    );
  });
});

describe("buildAgentCard", () => {
  it("produces a card with valid fingerprint", () => {
    const card = buildAgentCard(sampleCard());
    expect(card.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(validateAgentCard(card).ok).toBe(true);
  });
});

describe("validateAgentCard", () => {
  const goodCard = () => buildAgentCard(sampleCard());

  it("ok on a fresh card", () => {
    expect(validateAgentCard(goodCard()).ok).toBe(true);
  });

  it("rejects wrong protocolVersion", () => {
    const card = goodCard();
    (card as { protocolVersion: string }).protocolVersion = "0.9";
    const v = validateAgentCard(card);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("invalid_protocol_version");
  });

  it("rejects malformed id (non-kebab)", () => {
    const card = goodCard();
    card.id = "Bad_ID";
    const v = validateAgentCard(card);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("invalid_id");
  });

  it("accepts a single-character id", () => {
    const card = buildAgentCard(sampleCard({ id: "a" }));
    expect(validateAgentCard(card).ok).toBe(true);
  });

  it("rejects empty name", () => {
    const card = goodCard();
    card.name = "";
    const v = validateAgentCard(card);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing_name");
  });

  it("rejects empty capabilities array", () => {
    const card = buildAgentCard(sampleCard({ capabilities: [] }));
    const v = validateAgentCard(card);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("no_capabilities");
  });

  it("rejects unknown auth scheme", () => {
    const card = goodCard();
    (card.authSchemes as string[]) = ["bogus"];
    const v = validateAgentCard(card);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("invalid_auth_scheme");
  });

  it("rejects non-HTTPS rpc endpoint", () => {
    const card = buildAgentCard(
      sampleCard({ endpoints: { rpc: "http://insecure.example/agent" } }),
    );
    const v = validateAgentCard(card);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("rpc_endpoint_not_https");
  });

  it("rejects fingerprint tampering", () => {
    const card = goodCard();
    card.fingerprint = "0".repeat(64);
    const v = validateAgentCard(card);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("fingerprint_mismatch");
  });
});

describe("buildAgentCardAuditEntry", () => {
  it("emits agent.governance_consult with phase=agent-card", () => {
    const card = buildAgentCard(sampleCard());
    const entry = buildAgentCardAuditEntry(card);
    expect(entry.action).toBe("agent.governance_consult");
    expect(entry.resource).toBe("agent-card:sov-finance-bot");
    expect(entry.details.phase).toBe("agent-card");
    expect(entry.details.fingerprint).toBe(card.fingerprint);
    expect(entry.details.capabilityCount).toBe(2);
  });
});

describe("A2A handshake state machine", () => {
  it("invited + initiate-handshake → challenged", () => {
    expect(nextHandshakeState("invited", "initiate-handshake")).toBe("challenged");
  });

  it("challenged + verify-credential-ok → authenticated", () => {
    expect(nextHandshakeState("challenged", "verify-credential-ok")).toBe("authenticated");
  });

  it("challenged + verify-credential-fail → error", () => {
    expect(nextHandshakeState("challenged", "verify-credential-fail")).toBe("error");
  });

  it("challenged + submit-credential stays challenged (verification still pending)", () => {
    expect(nextHandshakeState("challenged", "submit-credential")).toBe("challenged");
  });

  it("authenticated + initiate-handshake → established", () => {
    expect(nextHandshakeState("authenticated", "initiate-handshake")).toBe("established");
  });

  it("established + issue-challenge → challenged (mid-session re-auth)", () => {
    expect(nextHandshakeState("established", "issue-challenge")).toBe("challenged");
  });

  it("any non-terminal + close-session → closed", () => {
    expect(nextHandshakeState("invited", "close-session")).toBe("closed");
    expect(nextHandshakeState("authenticated", "close-session")).toBe("closed");
    expect(nextHandshakeState("established", "close-session")).toBe("closed");
  });

  it("any non-terminal + protocol-violation → error", () => {
    expect(nextHandshakeState("invited", "protocol-violation")).toBe("error");
    expect(nextHandshakeState("established", "protocol-violation")).toBe("error");
  });

  it("terminal states (closed/error) stay terminal", () => {
    expect(nextHandshakeState("closed", "initiate-handshake")).toBe("closed");
    expect(nextHandshakeState("error", "verify-credential-ok")).toBe("error");
  });

  it("invalid event in state returns error", () => {
    expect(nextHandshakeState("invited", "verify-credential-ok")).toBe("error");
  });

  it("isTerminalHandshakeState classifies closed and error as terminal", () => {
    expect(isTerminalHandshakeState("closed")).toBe(true);
    expect(isTerminalHandshakeState("error")).toBe(true);
    expect(isTerminalHandshakeState("invited")).toBe(false);
    expect(isTerminalHandshakeState("established")).toBe(false);
  });
});
