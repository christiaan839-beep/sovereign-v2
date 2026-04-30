/**
 * R162 Cross-Protocol Privilege Alignment — pure-function tests.
 *
 * Coverage:
 *   - Least-privilege default (no_mapping when no rule fires)
 *   - Single-rule + multi-rule grant aggregation
 *   - matchAuthScheme "*" wildcard
 *   - matchPeerId restriction
 *   - claim mismatch → no rule fires
 *   - scope_missing when grants don't cover required
 *   - happy path: peer claims map to scopes that satisfy tool
 *   - Audit-entry shape (R144 agent.cross_protocol_block)
 */

import { describe, it, expect } from "vitest";
import {
  bridgeAuthorization,
  REFUSE_ALL_POLICY,
  SOVEREIGN_INTERNAL_FINANCE_READ,
  type ScopeTranslationPolicy,
  type PeerAuthProfile,
} from "../cross-protocol-bridge";
import { buildToolDescriptor } from "@/lib/protocols/mcp/tool-descriptor";

const sampleTool = (requiredScopes = ["finance:read"]) =>
  buildToolDescriptor({
    id: "finance.list-accounts",
    name: "List Accounts",
    description: "Lists customer accounts.",
    inputSchemaShape: { type: "object", properties: {} },
    outputSchemaShape: { type: "object", properties: {} },
    requiredScopes,
    auditClass: "internal_read",
  });

const internalPeer: PeerAuthProfile = {
  peerId: "sov-other-agent",
  authScheme: "act-token",
  claims: ["sovereign-internal"],
};

describe("bridgeAuthorization — least-privilege default", () => {
  it("REFUSE_ALL_POLICY blocks everything with no_mapping", () => {
    const r = bridgeAuthorization({
      peer: internalPeer,
      tool: sampleTool(),
      policy: REFUSE_ALL_POLICY,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("no_mapping");
      expect(r.grantedScopes).toEqual([]);
      expect(r.matchedRules).toEqual([]);
    }
  });

  it("audit entry on no_mapping uses agent.cross_protocol_block (R144)", () => {
    const r = bridgeAuthorization({
      peer: internalPeer,
      tool: sampleTool(),
      policy: REFUSE_ALL_POLICY,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.auditEntry.action).toBe("agent.cross_protocol_block");
      expect(r.auditEntry.resource).toBe(
        "peer:sov-other-agent->mcp-tool:finance.list-accounts",
      );
      expect(r.auditEntry.details.reason).toBe("no_mapping");
    }
  });
});

describe("bridgeAuthorization — single rule", () => {
  it("ok when peer claims trigger a matching rule that grants required scope", () => {
    const r = bridgeAuthorization({
      peer: internalPeer,
      tool: sampleTool(),
      policy: [SOVEREIGN_INTERNAL_FINANCE_READ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.grantedScopes).toEqual(["finance:read"]);
      expect(r.matchedRules).toHaveLength(1);
      expect(r.matchedRules[0].ruleId).toBe("sov.internal.finance-read");
    }
  });

  it("scope_missing when matched rule grants insufficient scope", () => {
    const tool = sampleTool(["finance:write:reconciliation"]);
    const r = bridgeAuthorization({
      peer: internalPeer,
      tool,
      policy: [SOVEREIGN_INTERNAL_FINANCE_READ], // only grants finance:read
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("scope_missing");
      expect(r.scopeEvaluation?.ok).toBe(false);
    }
  });

  it("rule does NOT fire when claim missing", () => {
    const peer: PeerAuthProfile = {
      peerId: "p",
      authScheme: "act-token",
      claims: ["wrong-claim"],
    };
    const r = bridgeAuthorization({
      peer,
      tool: sampleTool(),
      policy: [SOVEREIGN_INTERNAL_FINANCE_READ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_mapping");
  });

  it("rule does NOT fire when authScheme mismatches", () => {
    const peer: PeerAuthProfile = {
      peerId: "p",
      authScheme: "oauth2",
      claims: ["sovereign-internal"],
    };
    const r = bridgeAuthorization({
      peer,
      tool: sampleTool(),
      policy: [SOVEREIGN_INTERNAL_FINANCE_READ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_mapping");
  });
});

describe("bridgeAuthorization — multi-rule grant aggregation", () => {
  it("union of grants covers a tool requiring two scopes from two different rules", () => {
    const policy: ScopeTranslationPolicy = [
      {
        id: "rule.read",
        description: "read",
        matchAuthScheme: "*",
        matchClaim: "claim-a",
        grants: ["finance:read"],
      },
      {
        id: "rule.write",
        description: "write",
        matchAuthScheme: "*",
        matchClaim: "claim-b",
        grants: ["finance:write:reconciliation"],
      },
    ];
    const peer: PeerAuthProfile = {
      peerId: "p",
      authScheme: "act-token",
      claims: ["claim-a", "claim-b"],
    };
    const tool = sampleTool(["finance:read", "finance:write:reconciliation"]);
    const r = bridgeAuthorization({ peer, tool, policy });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.matchedRules).toHaveLength(2);
      expect(r.grantedScopes).toContain("finance:read");
      expect(r.grantedScopes).toContain("finance:write:reconciliation");
    }
  });

  it("dedupe granted scopes across rules", () => {
    const policy: ScopeTranslationPolicy = [
      {
        id: "rule.a",
        description: "",
        matchAuthScheme: "*",
        matchClaim: "claim-a",
        grants: ["finance:read"],
      },
      {
        id: "rule.b",
        description: "",
        matchAuthScheme: "*",
        matchClaim: "claim-b",
        grants: ["finance:read"], // same as rule.a
      },
    ];
    const peer: PeerAuthProfile = {
      peerId: "p",
      authScheme: "act-token",
      claims: ["claim-a", "claim-b"],
    };
    const r = bridgeAuthorization({ peer, tool: sampleTool(), policy });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Deduped to single occurrence
      expect(r.grantedScopes).toEqual(["finance:read"]);
      expect(r.matchedRules).toHaveLength(2);
    }
  });
});

describe("bridgeAuthorization — matchPeerId restriction", () => {
  it("rule with matchPeerId fires only for that specific peer", () => {
    const policy: ScopeTranslationPolicy = [
      {
        id: "rule.peer-specific",
        description: "",
        matchAuthScheme: "*",
        matchClaim: "claim",
        matchPeerId: "specific-peer",
        grants: ["finance:read"],
      },
    ];
    const correctPeer: PeerAuthProfile = {
      peerId: "specific-peer",
      authScheme: "act-token",
      claims: ["claim"],
    };
    const wrongPeer: PeerAuthProfile = {
      peerId: "other-peer",
      authScheme: "act-token",
      claims: ["claim"],
    };
    const correctResult = bridgeAuthorization({ peer: correctPeer, tool: sampleTool(), policy });
    const wrongResult = bridgeAuthorization({ peer: wrongPeer, tool: sampleTool(), policy });
    expect(correctResult.ok).toBe(true);
    expect(wrongResult.ok).toBe(false);
  });
});

describe("bridgeAuthorization — privilege-escalation defense (the threat model)", () => {
  it("peer with low-privilege claim cannot invoke a tool requiring high-privilege scope", () => {
    // The exact threat: peer authenticated through A2A with "user" claim
    // tries to invoke finance:write:reconciliation. Only an "internal"
    // claim grants write; user claim only grants read.
    const policy: ScopeTranslationPolicy = [
      {
        id: "rule.user-read",
        description: "users get read-only finance",
        matchAuthScheme: "*",
        matchClaim: "user",
        grants: ["finance:read"],
      },
      {
        id: "rule.internal-write",
        description: "internal callers get write",
        matchAuthScheme: "act-token",
        matchClaim: "sovereign-internal",
        grants: ["finance:write:reconciliation"],
      },
    ];
    const userPeer: PeerAuthProfile = {
      peerId: "user-peer",
      authScheme: "oauth2",
      claims: ["user"],
    };
    const reconcileTool = sampleTool(["finance:write:reconciliation"]);
    const r = bridgeAuthorization({ peer: userPeer, tool: reconcileTool, policy });
    // The user-read rule fires (granting finance:read), but the tool
    // requires finance:write:reconciliation which the user does NOT
    // have. Result: scope_missing — the privilege-escalation attempt
    // is blocked at the bridge.
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("scope_missing");
      expect(r.matchedRules).toHaveLength(1);
      expect(r.grantedScopes).toEqual(["finance:read"]);
    }
  });
});
