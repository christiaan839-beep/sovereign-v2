/**
 * @sovereign/inspector — edge-nodes module tests.
 *
 * Verifies cross-implementation agreement with src/lib/edge-nodes/.
 */

import { describe, it, expect } from "vitest";
import {
  StubEdgeNode,
  createEdgeNodeRegistry,
  createDefaultEdgeNodeRegistry,
  listEdgeNodes,
  findEdgeNodesByCapability,
  resolveRouting,
  preflightDispatch,
  dispatchReceiptLine,
  buildPreflightFailure,
  isRegistered,
  isValidCapability,
  createSoftwareEngineerStub,
  createAnalystStub,
  createOperatorStub,
  SOFTWARE_ENGINEER_EDGE_NODE_ID,
  ANALYST_EDGE_NODE_ID,
  OPERATOR_EDGE_NODE_ID,
} from "../src/edge-nodes.mjs";

// Fake non-stub for ranking tests
class FakeReal {
  constructor(id, manifest) {
    this.id = id;
    this.manifest = manifest;
  }
  describe() {
    return this.manifest;
  }
  async dispatch(req) {
    return {
      ok: true,
      edgeNodeId: this.id,
      capability: req.capability,
      output: {},
      durationMs: 42,
      costCents: 0,
      receiptLine: `[fake-real] ${this.id} ok`,
    };
  }
  async health() {
    return { status: "ready" };
  }
}

function realManifest(id, overrides = {}) {
  return {
    id,
    persona: "software-engineer",
    name: id,
    description: "fake real",
    capabilities: ["fix-github-issue"],
    upstreamProjects: [{ name: "fake", license: "MIT" }],
    deployment: "customer-cloud",
    costBand: "low",
    outputClass: "tenant-private",
    isStub: false,
    ...overrides,
  };
}

describe("isValidCapability — all 17 capabilities accepted", () => {
  it("accepts known capabilities", () => {
    expect(isValidCapability("fix-github-issue")).toBe(true);
    expect(isValidCapability("perform-data-migration")).toBe(true);
    expect(isValidCapability("spawn-subordinate-swarm")).toBe(true);
  });
  it("rejects unknown capability", () => {
    expect(isValidCapability("not-a-real-capability")).toBe(false);
  });
});

describe("StubEdgeNode — fail-closed posture", () => {
  const stub = createSoftwareEngineerStub();
  it("describe() reports isStub=true", () => {
    expect(stub.describe().isStub).toBe(true);
  });
  it("dispatch() refuses with edge_node_not_configured", async () => {
    const r = await stub.dispatch({
      userId: "u",
      capability: "fix-github-issue",
      task: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("edge_node_not_configured");
      expect(r.receiptLine).toContain("stub");
    }
  });
  it("health() returns not-configured", async () => {
    const h = await stub.health();
    expect(h.status).toBe("not-configured");
  });
});

describe("createEdgeNodeRegistry", () => {
  it("creates empty registry", () => {
    expect(createEdgeNodeRegistry().size).toBe(0);
  });
  it("rejects duplicate ids at construction", () => {
    expect(() =>
      createEdgeNodeRegistry([
        createSoftwareEngineerStub(),
        createSoftwareEngineerStub(),
      ]),
    ).toThrow(/duplicate edge-node id/);
  });
  it("createDefaultEdgeNodeRegistry registers 3 personas", () => {
    const r = createDefaultEdgeNodeRegistry();
    expect(r.size).toBe(3);
    expect(r.has(SOFTWARE_ENGINEER_EDGE_NODE_ID)).toBe(true);
    expect(r.has(ANALYST_EDGE_NODE_ID)).toBe(true);
    expect(r.has(OPERATOR_EDGE_NODE_ID)).toBe(true);
  });
});

describe("listEdgeNodes — filters", () => {
  const r = createDefaultEdgeNodeRegistry();
  it("returns sorted list", () => {
    const list = listEdgeNodes(r);
    expect(list.length).toBe(3);
    expect(list).toEqual([...list].sort((a, b) => a.id.localeCompare(b.id)));
  });
  it("filters by persona", () => {
    expect(listEdgeNodes(r, { persona: "operator" }).length).toBe(1);
  });
  it("filters by capability", () => {
    expect(listEdgeNodes(r, { capability: "navigate-legacy-ui" }).length).toBe(
      1,
    );
  });
  it("excludeStubs hides all default stubs", () => {
    expect(listEdgeNodes(r, { excludeStubs: true }).length).toBe(0);
  });
});

describe("findEdgeNodesByCapability — stub-penalty + deployment", () => {
  it("real outranks stub with same capability", () => {
    const real = new FakeReal("fake-real", realManifest("fake-real"));
    const r = createEdgeNodeRegistry([real, createSoftwareEngineerStub()]);
    const matches = findEdgeNodesByCapability(r, "fix-github-issue");
    expect(matches[0].manifest.id).toBe("fake-real");
    expect(matches[0].isStub).toBe(false);
    expect(matches[1].isStub).toBe(true);
  });
  it("hybrid deployment scores 0.5 vs 1.0 exact", () => {
    const real = new FakeReal(
      "real-cust",
      realManifest("real-cust", { deployment: "customer-cloud" }),
    );
    const realHyb = new FakeReal(
      "real-hyb",
      realManifest("real-hyb", { deployment: "hybrid" }),
    );
    const r = createEdgeNodeRegistry([real, realHyb]);
    const matches = findEdgeNodesByCapability(
      r,
      "fix-github-issue",
      "customer-cloud",
    );
    expect(matches[0].score).toBe(1.0);
    expect(matches[1].score).toBe(0.5);
  });
  it("deployment mismatch fully excludes non-hybrid", () => {
    const real = new FakeReal(
      "real-managed",
      realManifest("real-managed", { deployment: "managed-cloud" }),
    );
    const r = createEdgeNodeRegistry([real]);
    expect(
      findEdgeNodesByCapability(r, "fix-github-issue", "air-gapped").length,
    ).toBe(0);
  });
});

describe("resolveRouting — route / no-match / all-stub", () => {
  it("returns no-match when no node supports capability", () => {
    const r = createEdgeNodeRegistry([createSoftwareEngineerStub()]);
    expect(resolveRouting(r, { capability: "navigate-legacy-ui" }).kind).toBe(
      "no-match",
    );
  });
  it("returns all-stub when only stubs match", () => {
    const r = createDefaultEdgeNodeRegistry();
    expect(resolveRouting(r, { capability: "fix-github-issue" }).kind).toBe(
      "all-stub",
    );
  });
  it("routes to highest-scoring real node", () => {
    const real = new FakeReal("real-x", realManifest("real-x"));
    const r = createEdgeNodeRegistry([real, createSoftwareEngineerStub()]);
    const decision = resolveRouting(r, { capability: "fix-github-issue" });
    expect(decision.kind).toBe("route");
    if (decision.kind === "route") {
      expect(decision.target.id).toBe("real-x");
    }
  });
});

describe("preflightDispatch — gate ordering", () => {
  const baseReq = { userId: "u", capability: "fix-github-issue", task: {} };

  it("policy deny short-circuits", () => {
    const r = preflightDispatch({
      policy: { decision: "deny", reason: "blocked" },
      cost: { decision: "proceed" },
      request: baseReq,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("policy_denied");
  });
  it("policy require-act fails when actChainHash missing", () => {
    const r = preflightDispatch({
      policy: { decision: "require-act" },
      cost: { decision: "proceed" },
      request: baseReq,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("act_required");
  });
  it("policy require-acat fails when acatChainHash missing", () => {
    const r = preflightDispatch({
      policy: { decision: "require-acat" },
      cost: { decision: "proceed" },
      request: baseReq,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("acat_required");
  });
  it("budget exhausted refused after policy ok", () => {
    const r = preflightDispatch({
      policy: { decision: "allow" },
      cost: { decision: "deny", reason: "tenant cap exceeded" },
      request: baseReq,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("budget_exhausted");
  });
  it("all gates pass → ok", () => {
    expect(
      preflightDispatch({
        policy: { decision: "allow" },
        cost: { decision: "proceed" },
        request: baseReq,
      }).ok,
    ).toBe(true);
  });
});

describe("dispatchReceiptLine + buildPreflightFailure", () => {
  it("success line includes duration + cost", () => {
    const line = dispatchReceiptLine({
      request: { userId: "alice", capability: "fix-github-issue", task: {} },
      outcome: {
        ok: true,
        edgeNodeId: "real-x",
        capability: "fix-github-issue",
        output: {},
        durationMs: 1234,
        costCents: 50,
        receiptLine: "ignored",
      },
    });
    expect(line).toContain("alice");
    expect(line).toContain("1234ms");
    expect(line).toContain("50¢");
  });
  it("buildPreflightFailure renders procurement-readable receipt", () => {
    const r = buildPreflightFailure({
      edgeNodeId: "x",
      request: { userId: "u", capability: "fix-github-issue", task: {} },
      preflight: {
        ok: false,
        reason: "policy_denied",
        details: "finance-tagged tier-2",
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("policy_denied");
      expect(r.receiptLine).toContain("REFUSED preflight");
    }
  });
});

describe("Persona stubs — coverage", () => {
  it("software-engineer covers ≥5 capabilities", () => {
    expect(
      createSoftwareEngineerStub().describe().capabilities.length,
    ).toBeGreaterThanOrEqual(5);
  });
  it("analyst names Cognee + Kimi K2.6 in upstreams", () => {
    const m = createAnalystStub().describe();
    expect(m.upstreamProjects.some((p) => p.name === "Cognee")).toBe(true);
    expect(m.upstreamProjects.some((p) => p.name.includes("Kimi"))).toBe(true);
  });
  it("operator output class is confidential (Tier 3)", () => {
    expect(createOperatorStub().describe().outputClass).toBe("confidential");
  });
});

describe("isRegistered", () => {
  it("returns true for registered slug", () => {
    const r = createDefaultEdgeNodeRegistry();
    expect(isRegistered(SOFTWARE_ENGINEER_EDGE_NODE_ID, r)).toBe(true);
  });
  it("returns false for unknown slug", () => {
    const r = createDefaultEdgeNodeRegistry();
    expect(isRegistered("not-a-real-agent", r)).toBe(false);
  });
});
