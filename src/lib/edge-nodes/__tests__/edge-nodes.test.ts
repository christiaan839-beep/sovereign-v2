/**
 * R120 — Edge Node Framework unit tests.
 *
 * Coverage:
 *   - StubEdgeNode: describe + dispatch + health all fail-closed
 *   - createEdgeNodeRegistry: empty + initial + duplicate-id rejected
 *   - listEdgeNodes: persona / capability / deployment / excludeStubs
 *   - listEdgeNodes: stable sort by id
 *   - findEdgeNodesByCapability: stub-penalty (real > stub even when
 *     stub has same capability score)
 *   - findEdgeNodesByCapability: deployment hybrid → 0.5 partial
 *   - findEdgeNodesByCapability: deployment mismatch → excluded
 *   - resolveRouting: route / no-match / all-stub paths
 *   - preflightDispatch: policy / cost / ACT / ACAT precedence
 *   - dispatchReceiptLine: success + failure shapes
 *   - buildPreflightFailure: receipt + reason wired correctly
 *   - snapshotEdgeNodeHealth: status rollup + worstStatus
 *   - edgeNodeRegistryStats: all categories sum to total
 *   - createDefaultEdgeNodeRegistry: 3 persona stubs registered
 *   - All three persona stubs cover at least 5 capabilities each
 */

import { describe, it, expect } from "vitest";
import {
  createEdgeNodeRegistry,
  listEdgeNodes,
  findEdgeNodesByCapability,
  edgeNodeRegistryStats,
  snapshotEdgeNodeHealth,
} from "../registry";
import {
  resolveRouting,
  preflightDispatch,
  dispatchReceiptLine,
  buildPreflightFailure,
} from "../dispatcher";
import { StubEdgeNode } from "../stub-edge-node";
import {
  createSoftwareEngineerStub,
  SOFTWARE_ENGINEER_EDGE_NODE_ID,
} from "../personas/software-engineer";
import {
  createAnalystStub,
  ANALYST_EDGE_NODE_ID,
} from "../personas/analyst";
import {
  createOperatorStub,
  OPERATOR_EDGE_NODE_ID,
} from "../personas/operator";
import {
  createDefaultEdgeNodeRegistry,
  type EdgeNode,
  type EdgeNodeManifest,
  type DispatchRequest,
  type DispatchResult,
  type EdgeNodeHealthStatus,
} from "..";

// ── Test helpers — minimal real (non-stub) Edge Node for ranking ──

class FakeRealEdgeNode implements EdgeNode {
  constructor(
    private readonly id: string,
    private readonly manifest: EdgeNodeManifest,
    private readonly dispatchOutput: Record<string, unknown> = {
      ok: true,
    },
  ) {}
  describe(): EdgeNodeManifest {
    return this.manifest;
  }
  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    return {
      ok: true,
      edgeNodeId: this.id,
      capability: request.capability,
      output: this.dispatchOutput,
      durationMs: 42,
      costCents: 0,
      receiptLine: `[fake-real] ${this.id} ok`,
    };
  }
  async health(): Promise<{
    status: EdgeNodeHealthStatus;
    detail?: string;
  }> {
    return { status: "ready" };
  }
}

function makeRealManifest(
  id: string,
  overrides: Partial<EdgeNodeManifest> = {},
): EdgeNodeManifest {
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

// ── StubEdgeNode ──────────────────────────────────────────────────

describe("StubEdgeNode — fail-closed behavior", () => {
  const stub = createSoftwareEngineerStub();

  it("describe() reports isStub=true", () => {
    expect(stub.describe().isStub).toBe(true);
  });

  it("dispatch() refuses with edge_node_not_configured", async () => {
    const r = await stub.dispatch({
      userId: "u",
      capability: "fix-github-issue",
      task: { issueUrl: "https://example.com/x/y/issues/1" },
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

  it("manifest names the upstream projects (procurement transparency)", () => {
    const m = stub.describe();
    expect(m.upstreamProjects.length).toBeGreaterThan(0);
    const names = m.upstreamProjects.map((p) => p.name);
    expect(names).toContain("Trae Agent");
  });
});

// ── Registry construction ────────────────────────────────────────

describe("createEdgeNodeRegistry", () => {
  it("creates empty registry", () => {
    const r = createEdgeNodeRegistry();
    expect(r.size).toBe(0);
  });

  it("registers initial nodes by id", () => {
    const r = createEdgeNodeRegistry([
      createSoftwareEngineerStub(),
      createAnalystStub(),
    ]);
    expect(r.size).toBe(2);
    expect(r.has(SOFTWARE_ENGINEER_EDGE_NODE_ID)).toBe(true);
    expect(r.has(ANALYST_EDGE_NODE_ID)).toBe(true);
  });

  it("rejects duplicate ids at construction", () => {
    expect(() =>
      createEdgeNodeRegistry([
        createSoftwareEngineerStub(),
        createSoftwareEngineerStub(),
      ]),
    ).toThrow(/duplicate edge-node id/);
  });
});

// ── listEdgeNodes ────────────────────────────────────────────────

describe("listEdgeNodes — filtering + sorting", () => {
  const r = createDefaultEdgeNodeRegistry();

  it("returns all manifests sorted by id when no filter", () => {
    const list = listEdgeNodes(r);
    expect(list.length).toBe(3);
    const ids = list.map((m) => m.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("filters by persona", () => {
    expect(listEdgeNodes(r, { persona: "operator" }).length).toBe(1);
    expect(
      listEdgeNodes(r, { persona: "software-engineer" })[0].id,
    ).toBe(SOFTWARE_ENGINEER_EDGE_NODE_ID);
  });

  it("filters by capability", () => {
    const list = listEdgeNodes(r, {
      capability: "navigate-legacy-ui",
    });
    expect(list.length).toBe(1);
    expect(list[0].persona).toBe("operator");
  });

  it("filters by deployment", () => {
    const list = listEdgeNodes(r, { deployment: "customer-cloud" });
    expect(list.length).toBe(3);
  });

  it("excludeStubs hides stubs", () => {
    expect(listEdgeNodes(r, { excludeStubs: true }).length).toBe(0);
  });

  it("compound filter narrows correctly", () => {
    const list = listEdgeNodes(r, {
      persona: "analyst",
      capability: "build-knowledge-graph",
    });
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(ANALYST_EDGE_NODE_ID);
  });
});

// ── findEdgeNodesByCapability ranking ────────────────────────────

describe("findEdgeNodesByCapability — ranking", () => {
  it("real node outranks stub even with the same capability", () => {
    const real = new FakeRealEdgeNode(
      "fake-real",
      makeRealManifest("fake-real"),
    );
    const r = createEdgeNodeRegistry([real, createSoftwareEngineerStub()]);
    const matches = findEdgeNodesByCapability(r, "fix-github-issue");
    expect(matches[0].manifest.id).toBe("fake-real");
    expect(matches[0].isStub).toBe(false);
    expect(matches[1].isStub).toBe(true);
  });

  it("excludes nodes that don't have the capability", () => {
    const r = createEdgeNodeRegistry([createSoftwareEngineerStub()]);
    const matches = findEdgeNodesByCapability(
      r,
      "navigate-legacy-ui",
    );
    expect(matches.length).toBe(0);
  });

  it("hybrid deployment scores 0.5 vs 1.0 exact match", () => {
    const real = new FakeRealEdgeNode(
      "real-cust",
      makeRealManifest("real-cust", { deployment: "customer-cloud" }),
    );
    const realHybrid = new FakeRealEdgeNode(
      "real-hyb",
      makeRealManifest("real-hyb", { deployment: "hybrid" }),
    );
    const r = createEdgeNodeRegistry([real, realHybrid]);
    const matches = findEdgeNodesByCapability(
      r,
      "fix-github-issue",
      "customer-cloud",
    );
    expect(matches[0].manifest.id).toBe("real-cust");
    expect(matches[0].score).toBe(1.0);
    expect(matches[1].score).toBe(0.5);
  });

  it("deployment mismatch fully excludes non-hybrid", () => {
    const real = new FakeRealEdgeNode(
      "real-managed",
      makeRealManifest("real-managed", { deployment: "managed-cloud" }),
    );
    const r = createEdgeNodeRegistry([real]);
    const matches = findEdgeNodesByCapability(
      r,
      "fix-github-issue",
      "air-gapped",
    );
    expect(matches.length).toBe(0);
  });

  it("rationale describes the score components", () => {
    const r = createEdgeNodeRegistry([createSoftwareEngineerStub()]);
    const matches = findEdgeNodesByCapability(r, "fix-github-issue");
    expect(matches[0].rationale).toContain("STUB");
  });
});

// ── resolveRouting ──────────────────────────────────────────────

describe("resolveRouting", () => {
  it("returns no-match when no node supports the capability", () => {
    const r = createEdgeNodeRegistry([createSoftwareEngineerStub()]);
    const decision = resolveRouting(r, {
      capability: "navigate-legacy-ui",
    });
    expect(decision.kind).toBe("no-match");
  });

  it("returns all-stub when only stubs match", () => {
    const r = createDefaultEdgeNodeRegistry();
    const decision = resolveRouting(r, { capability: "fix-github-issue" });
    expect(decision.kind).toBe("all-stub");
  });

  it("routes to the highest-scored real node", () => {
    const real = new FakeRealEdgeNode(
      "real-cust",
      makeRealManifest("real-cust"),
    );
    const r = createEdgeNodeRegistry([real, createSoftwareEngineerStub()]);
    const decision = resolveRouting(r, {
      capability: "fix-github-issue",
    });
    expect(decision.kind).toBe("route");
    if (decision.kind === "route") {
      expect(decision.target.id).toBe("real-cust");
      expect(decision.alternatives.length).toBeGreaterThan(0);
    }
  });

  it("filters by persona when specified", () => {
    const real = new FakeRealEdgeNode(
      "real-analyst",
      makeRealManifest("real-analyst", {
        persona: "analyst",
        capabilities: ["fix-github-issue"],
      }),
    );
    const r = createEdgeNodeRegistry([real]);
    const decision = resolveRouting(r, {
      capability: "fix-github-issue",
      persona: "software-engineer",
    });
    expect(decision.kind).toBe("no-match");
  });
});

// ── preflightDispatch ──────────────────────────────────────────

describe("preflightDispatch — gate ordering", () => {
  const baseReq: DispatchRequest = {
    userId: "u",
    capability: "fix-github-issue",
    task: {},
  };

  it("policy deny short-circuits before cost", () => {
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

  it("policy require-act passes when actChainHash present", () => {
    const r = preflightDispatch({
      policy: { decision: "require-act" },
      cost: { decision: "proceed" },
      request: { ...baseReq, actChainHash: "abc" },
    });
    expect(r.ok).toBe(true);
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
    if (!r.ok) {
      expect(r.reason).toBe("budget_exhausted");
      expect(r.details).toContain("tenant cap");
    }
  });

  it("all gates pass → ok", () => {
    const r = preflightDispatch({
      policy: { decision: "allow" },
      cost: { decision: "proceed" },
      request: baseReq,
    });
    expect(r.ok).toBe(true);
  });
});

// ── dispatchReceiptLine + buildPreflightFailure ────────────────

describe("dispatchReceiptLine — receipt formats", () => {
  const req: DispatchRequest = {
    userId: "alice",
    capability: "fix-github-issue",
    task: {},
  };

  it("success line includes duration + cost", () => {
    const line = dispatchReceiptLine({
      request: req,
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

  it("failure line includes reason", () => {
    const line = dispatchReceiptLine({
      request: req,
      outcome: {
        ok: false,
        edgeNodeId: "stub-x",
        capability: "fix-github-issue",
        reason: "edge_node_not_configured",
        receiptLine: "ignored",
      },
    });
    expect(line).toContain("REFUSED");
    expect(line).toContain("edge_node_not_configured");
  });
});

describe("buildPreflightFailure", () => {
  it("renders a procurement-readable receipt", () => {
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
      expect(r.receiptLine).toContain("finance-tagged");
    }
  });
});

// ── snapshotEdgeNodeHealth + stats ──────────────────────────────

describe("snapshotEdgeNodeHealth", () => {
  it("captures every node's status + worstStatus rollup", async () => {
    const r = createDefaultEdgeNodeRegistry();
    const snap = await snapshotEdgeNodeHealth(r);
    expect(snap.entries.length).toBe(3);
    expect(snap.byStatus["not-configured"]).toBe(3);
    expect(snap.worstStatus).toBe("not-configured");
  });

  it("is robust to a single node throwing in health()", async () => {
    class ThrowingNode implements EdgeNode {
      describe(): EdgeNodeManifest {
        return makeRealManifest("throwing");
      }
      async dispatch(): Promise<DispatchResult> {
        return {
          ok: false,
          edgeNodeId: "throwing",
          capability: "fix-github-issue",
          reason: "internal_error",
          receiptLine: "x",
        };
      }
      async health(): Promise<{ status: EdgeNodeHealthStatus }> {
        throw new Error("boom");
      }
    }
    const r = createEdgeNodeRegistry([new ThrowingNode()]);
    const snap = await snapshotEdgeNodeHealth(r);
    expect(snap.byStatus.error).toBe(1);
    expect(snap.worstStatus).toBe("error");
  });
});

describe("edgeNodeRegistryStats", () => {
  it("totals match input + persona/deployment categories", () => {
    const r = createDefaultEdgeNodeRegistry();
    const stats = edgeNodeRegistryStats(r);
    expect(stats.total).toBe(3);
    expect(stats.byPersona["software-engineer"]).toBe(1);
    expect(stats.byPersona.analyst).toBe(1);
    expect(stats.byPersona.operator).toBe(1);
    expect(stats.byDeployment["customer-cloud"]).toBe(3);
    expect(stats.stubCount).toBe(3);
    expect(stats.configuredCount).toBe(0);
  });
});

// ── Persona-stub coverage ──────────────────────────────────────

describe("Default persona stubs", () => {
  it("software-engineer stub covers >=5 capabilities", () => {
    const m = createSoftwareEngineerStub().describe();
    expect(m.capabilities.length).toBeGreaterThanOrEqual(5);
    expect(m.capabilities).toContain("fix-github-issue");
  });

  it("analyst stub covers >=5 capabilities + traceable provenance", () => {
    const m = createAnalystStub().describe();
    expect(m.capabilities.length).toBeGreaterThanOrEqual(5);
    expect(m.capabilities).toContain("build-knowledge-graph");
    expect(m.upstreamProjects.some((p) => p.name === "Cognee")).toBe(true);
  });

  it("operator stub covers UI-automation capabilities + Tier-3 hint", () => {
    const m = createOperatorStub().describe();
    expect(m.capabilities).toContain("control-desktop-application");
    expect(m.capabilities).toContain("navigate-legacy-ui");
    expect(m.outputClass).toBe("confidential");
  });

  it("createDefaultEdgeNodeRegistry registers the three personas", () => {
    const r = createDefaultEdgeNodeRegistry();
    expect(r.has(SOFTWARE_ENGINEER_EDGE_NODE_ID)).toBe(true);
    expect(r.has(ANALYST_EDGE_NODE_ID)).toBe(true);
    expect(r.has(OPERATOR_EDGE_NODE_ID)).toBe(true);
  });
});

// ── Custom stub via configurator ──────────────────────────────

describe("StubEdgeNode — custom config path", () => {
  it("supports operator-defined personas", () => {
    const stub = new StubEdgeNode({
      id: "custom-1",
      manifestOverlay: {
        id: "custom-1",
        persona: "custom",
        name: "Custom Stub",
        description: "test",
        capabilities: ["compliance-report"],
        upstreamProjects: [{ name: "InternalTool", license: "Proprietary" }],
        deployment: "air-gapped",
        costBand: "free",
        outputClass: "confidential",
      },
    });
    expect(stub.describe().isStub).toBe(true);
    expect(stub.describe().persona).toBe("custom");
  });
});
