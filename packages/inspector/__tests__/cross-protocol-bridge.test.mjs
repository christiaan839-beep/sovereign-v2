import { describe, it, expect } from "vitest";
import {
  bridgeAuthorization,
  verifyBridgeAuthorization,
  REFUSE_ALL_POLICY,
} from "../src/cross-protocol-bridge.mjs";
import { computeToolFingerprint } from "../src/mcp.mjs";

const sampleTool = (requiredScopes = ["finance:read"]) => {
  const base = {
    id: "finance.list",
    name: "List",
    description: "x",
    inputSchemaShape: { type: "object", properties: {} },
    outputSchemaShape: { type: "object", properties: {} },
    requiredScopes,
    auditClass: "internal_read",
  };
  return { ...base, fingerprint: computeToolFingerprint(base) };
};

const peer = {
  peerId: "p",
  authScheme: "act-token",
  claims: ["sovereign-internal"],
};

describe("inspector cross-protocol bridge — least-privilege default", () => {
  it("REFUSE_ALL_POLICY blocks with no_mapping", () => {
    const r = bridgeAuthorization({
      peer,
      tool: sampleTool(),
      policy: REFUSE_ALL_POLICY,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no_mapping");
    expect(r.auditEntry.action).toBe("agent.cross_protocol_block");
  });
});

describe("inspector cross-protocol bridge — happy path", () => {
  it("ok when matched rule grants required scope", () => {
    const r = bridgeAuthorization({
      peer,
      tool: sampleTool(),
      policy: [
        {
          id: "r1",
          description: "internal read",
          matchAuthScheme: "act-token",
          matchClaim: "sovereign-internal",
          grants: ["finance:read"],
        },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.grantedScopes).toEqual(["finance:read"]);
  });
});

describe("inspector cross-protocol bridge — privilege escalation defense", () => {
  it("user claim cannot invoke a write-required tool", () => {
    const r = bridgeAuthorization({
      peer: { peerId: "user-p", authScheme: "oauth2", claims: ["user"] },
      tool: sampleTool(["finance:write:reconciliation"]),
      policy: [
        {
          id: "user-rule",
          description: "users get read",
          matchAuthScheme: "*",
          matchClaim: "user",
          grants: ["finance:read"],
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("scope_missing");
  });
});

describe("verifyBridgeAuthorization", () => {
  it("ok when claim matches replay", () => {
    const input = {
      peer,
      tool: sampleTool(),
      policy: [
        {
          id: "r",
          description: "x",
          matchAuthScheme: "*",
          matchClaim: "sovereign-internal",
          grants: ["finance:read"],
        },
      ],
    };
    const claim = bridgeAuthorization(input);
    expect(verifyBridgeAuthorization({ input, claimed: { ok: claim.ok } }).ok).toBe(true);
  });

  it("flags ok mismatch", () => {
    const input = { peer, tool: sampleTool(), policy: REFUSE_ALL_POLICY };
    const v = verifyBridgeAuthorization({ input, claimed: { ok: true } });
    expect(v.ok).toBe(false);
  });
});
