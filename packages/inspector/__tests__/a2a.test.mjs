import { describe, it, expect } from "vitest";
import {
  A2A_AUTH_SCHEMES,
  validateAgentCard,
  computeAgentCardFingerprint,
  nextHandshakeState,
} from "../src/a2a.mjs";

const sampleCard = (overrides = {}) => {
  const base = {
    protocolVersion: "1.0",
    id: "sov-x",
    name: "Sov X",
    description: "x",
    supplier: "Sovereign",
    capabilities: ["x"],
    endpoints: { rpc: "https://example.com/rpc" },
    authSchemes: ["act-token"],
    publishedAt: "2026-04-30T00:00:00.000Z",
    ...overrides,
  };
  return { ...base, fingerprint: computeAgentCardFingerprint(base) };
};

describe("inspector A2A — auth schemes", () => {
  it("declares 6 canonical schemes", () => {
    expect(A2A_AUTH_SCHEMES.length).toBe(6);
  });
});

describe("inspector A2A — validateAgentCard", () => {
  it("ok on a fresh card", () => {
    expect(validateAgentCard(sampleCard()).ok).toBe(true);
  });

  it("rejects fingerprint tampering", () => {
    const card = sampleCard();
    card.fingerprint = "0".repeat(64);
    const v = validateAgentCard(card);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("fingerprint_mismatch");
  });

  it("rejects http:// rpc", () => {
    const v = validateAgentCard(sampleCard({ endpoints: { rpc: "http://x" } }));
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("rpc_endpoint_not_https");
  });
});

describe("inspector A2A — handshake state machine", () => {
  it("invited→challenged on initiate-handshake", () => {
    expect(nextHandshakeState("invited", "initiate-handshake")).toBe("challenged");
  });

  it("challenged→authenticated on verify-credential-ok", () => {
    expect(nextHandshakeState("challenged", "verify-credential-ok")).toBe("authenticated");
  });

  it("any state→closed on close-session", () => {
    expect(nextHandshakeState("authenticated", "close-session")).toBe("closed");
  });

  it("any state→error on protocol-violation", () => {
    expect(nextHandshakeState("authenticated", "protocol-violation")).toBe("error");
  });

  it("terminal states stay terminal", () => {
    expect(nextHandshakeState("closed", "initiate-handshake")).toBe("closed");
  });
});
