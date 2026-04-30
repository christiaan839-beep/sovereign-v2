/**
 * @sovereign/inspector — Edge Node Framework (R120).
 *
 * Pure-function port of src/lib/edge-nodes/{registry,dispatcher,
 * stub-edge-node,personas/*}.ts to standalone Node ESM. Same registry
 * semantics, same dispatch routing, same fail-closed stub posture.
 *
 * Strategic property: a customer or auditor can verify OFFLINE that
 * the platform's edge-node registry would have routed a specific
 * dispatch request the way the production audit chain says it did.
 * No Sovereign network call required.
 *
 * Coverage:
 *   - createEdgeNodeRegistry (rejects duplicates)
 *   - listEdgeNodes (5-dimension filtering, stable sort)
 *   - findEdgeNodesByCapability (capability × deployment × stub-penalty)
 *   - resolveRouting (route / no-match / all-stub)
 *   - preflightDispatch (R100 → R37 → R91 → R102 ordering)
 *   - dispatchReceiptLine + buildPreflightFailure
 *   - StubEdgeNode (fail-closed default)
 *   - 3 persona stub factories (software-engineer / analyst / operator)
 *   - createDefaultEdgeNodeRegistry
 */

// ── Types are documented but not enforced — JSDoc for clarity ────

/** @typedef {"software-engineer" | "analyst" | "operator" | "custom"} EdgeNodePersona */
/** @typedef {"air-gapped" | "customer-cloud" | "managed-cloud" | "hybrid"} EdgeNodeDeployment */
/** @typedef {"ready" | "configured-but-unreachable" | "not-configured" | "error"} EdgeNodeHealthStatus */

// ── Capability validation ────────────────────────────────────────

const VALID_CAPABILITIES = new Set([
  "fix-github-issue",
  "open-pull-request",
  "review-pull-request",
  "run-test-suite",
  "refactor-codebase",
  "ingest-documents",
  "build-knowledge-graph",
  "answer-research-question",
  "generate-executive-summary",
  "compliance-report",
  "control-desktop-application",
  "fill-web-form",
  "navigate-legacy-ui",
  "perform-data-migration",
  "monitor-screen-feed",
  "spawn-subordinate-swarm",
  "produce-evidence-bundle",
]);

export function isValidCapability(c) {
  return VALID_CAPABILITIES.has(c);
}

// ── StubEdgeNode (fail-closed default) ────────────────────────────

export class StubEdgeNode {
  constructor(cfg) {
    this.cfg = cfg;
  }
  describe() {
    return { ...this.cfg.manifestOverlay, isStub: true };
  }
  async dispatch(request) {
    const upstreams = this.cfg.manifestOverlay.upstreamProjects
      .map((u) => u.name)
      .join(" / ");
    const details =
      this.cfg.detailsOverride ??
      `Edge Node "${this.cfg.id}" is a stub. Wire up an upstream integration (${upstreams}) and replace via the registry.`;
    return {
      ok: false,
      edgeNodeId: this.cfg.id,
      capability: request.capability,
      reason: "edge_node_not_configured",
      details,
      receiptLine: `dispatch refused — edge node ${this.cfg.id} is a stub (${upstreams})`,
    };
  }
  async health() {
    return {
      status: "not-configured",
      detail: `stub — wire up ${this.cfg.manifestOverlay.upstreamProjects.map((u) => u.name).join(", ")}`,
    };
  }
}

// ── Persona stub factories (must mirror TS source) ────────────────

export const SOFTWARE_ENGINEER_EDGE_NODE_ID = "software-engineer-default";
export const ANALYST_EDGE_NODE_ID = "analyst-default";
export const OPERATOR_EDGE_NODE_ID = "operator-default";

export function createSoftwareEngineerStub() {
  return new StubEdgeNode({
    id: SOFTWARE_ENGINEER_EDGE_NODE_ID,
    manifestOverlay: {
      id: SOFTWARE_ENGINEER_EDGE_NODE_ID,
      persona: "software-engineer",
      name: "Software Engineer Edge Node (default stub)",
      description:
        "Autonomous coding swarm — takes a feature request or bug report and delivers tested, reviewed, merge-ready code changes. Wraps Trae Agent + AgentFlow + Werkstatt under the Sovereign trust substrate (R26 audit + R100 policy + R102 cost + R37 ACT).",
      capabilities: [
        "fix-github-issue",
        "open-pull-request",
        "review-pull-request",
        "run-test-suite",
        "refactor-codebase",
        "spawn-subordinate-swarm",
      ],
      upstreamProjects: [
        {
          name: "Trae Agent",
          license: "Open Source (per upstream)",
          url: "https://github.com/bytedance/trae-agent",
        },
        { name: "AgentFlow", license: "MIT" },
        { name: "Werkstatt", license: "MIT" },
      ],
      deployment: "customer-cloud",
      costBand: "medium",
      outputClass: "tenant-private",
      regulatoryNotes: [
        "SOC 2 CC8.1 (change management) — Werkstatt enforces plan/review/test gates pre-merge.",
      ],
    },
    detailsOverride:
      "Software Engineer Edge Node is stub-only by default. Wire up Trae Agent + AgentFlow + Werkstatt deployments and replace this stub via the registry.",
  });
}

export function createAnalystStub() {
  return new StubEdgeNode({
    id: ANALYST_EDGE_NODE_ID,
    manifestOverlay: {
      id: ANALYST_EDGE_NODE_ID,
      persona: "analyst",
      name: "Analyst Edge Node (default stub)",
      description:
        "Autonomous research swarm — ingests documents, builds traceable knowledge graphs, plans research queries, and produces executive-grade summaries. Wraps Kimi K2.6 + Cognee + Qualixar OS under the Sovereign trust substrate.",
      capabilities: [
        "ingest-documents",
        "build-knowledge-graph",
        "answer-research-question",
        "generate-executive-summary",
        "compliance-report",
        "spawn-subordinate-swarm",
        "produce-evidence-bundle",
      ],
      upstreamProjects: [
        {
          name: "Kimi K2.6 (Moonshot)",
          license: "Modified MIT (weights-available)",
        },
        {
          name: "Cognee",
          license: "MIT",
          url: "https://github.com/topoteretes/cognee",
        },
        { name: "Qualixar OS", license: "Elastic License 2.0" },
      ],
      deployment: "customer-cloud",
      costBand: "medium",
      outputClass: "tenant-private",
      regulatoryNotes: [
        "GDPR Art. 30 (records of processing) — Cognee's traceable provenance maps directly.",
        "SOX 404 — applicable for finance-domain compliance reports.",
      ],
    },
    detailsOverride:
      "Analyst Edge Node is stub-only by default. Wire up Kimi K2.6 + Cognee + Qualixar OS and replace this stub via the registry.",
  });
}

export function createOperatorStub() {
  return new StubEdgeNode({
    id: OPERATOR_EDGE_NODE_ID,
    manifestOverlay: {
      id: OPERATOR_EDGE_NODE_ID,
      persona: "operator",
      name: "Operator Edge Node (default stub)",
      description:
        "UI-automation workforce — sees screens via vision-language models, controls applications, fills forms, navigates legacy enterprise UIs. Wraps UI-TARS-desktop + CUA + Understudy under the Sovereign trust substrate. Tier 3 by default; HITL-required for prod-tagged resources.",
      capabilities: [
        "control-desktop-application",
        "fill-web-form",
        "navigate-legacy-ui",
        "perform-data-migration",
        "monitor-screen-feed",
        "produce-evidence-bundle",
      ],
      upstreamProjects: [
        {
          name: "UI-TARS-desktop",
          license: "Apache 2.0",
          url: "https://github.com/bytedance/UI-TARS-desktop",
        },
        { name: "CUA", license: "MIT" },
        { name: "Understudy", license: "MIT" },
      ],
      deployment: "customer-cloud",
      costBand: "high",
      outputClass: "confidential",
      regulatoryNotes: [
        "SOC 2 CC8.1 — UI-driven changes route through HITL gates by default.",
        "HIPAA Security Rule 45 CFR 164.312 — applicable when Operator touches PHI-bearing apps.",
      ],
    },
    detailsOverride:
      "Operator Edge Node is stub-only by default. Wire up CUA + UI-TARS-desktop + Understudy and replace this stub via the registry.",
  });
}

// ── Pure: registry construction ────────────────────────────────────

export function createEdgeNodeRegistry(initial = []) {
  const r = new Map();
  for (const node of initial) {
    const m = node.describe();
    if (r.has(m.id)) {
      throw new Error(
        `duplicate edge-node id ${m.id} during registry construction`,
      );
    }
    r.set(m.id, node);
  }
  return r;
}

export function createDefaultEdgeNodeRegistry() {
  return createEdgeNodeRegistry([
    createSoftwareEngineerStub(),
    createAnalystStub(),
    createOperatorStub(),
  ]);
}

// ── Pure: list with filters ──────────────────────────────────────

export function listEdgeNodes(registry, filter = {}) {
  const out = [];
  for (const [, node] of registry) {
    const m = node.describe();
    if (filter.persona && m.persona !== filter.persona) continue;
    if (
      filter.capability &&
      !m.capabilities.includes(filter.capability)
    )
      continue;
    if (filter.deployment && m.deployment !== filter.deployment)
      continue;
    if (filter.excludeStubs && m.isStub) continue;
    out.push(m);
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export function isRegistered(slug, registry) {
  return registry.has(slug);
}

// ── Pure: capability ranking ─────────────────────────────────────

export function findEdgeNodesByCapability(registry, capability, deployment) {
  const out = [];
  for (const [, node] of registry) {
    const m = node.describe();
    const base = m.capabilities.includes(capability) ? 1.0 : 0.0;
    if (base === 0.0) continue;
    let deploy = 1.0;
    if (deployment) {
      if (m.deployment === deployment) deploy = 1.0;
      else if (m.deployment === "hybrid") deploy = 0.5;
      else deploy = 0.0;
    }
    if (deploy === 0.0) continue;
    const stub = m.isStub ? 0.5 : 1.0;
    const score = base * deploy * stub;
    const rationale = [
      `capability ${capability} ${m.capabilities.includes(capability) ? "matched" : "missing"}`,
      deployment
        ? `deployment ${deployment} ${m.deployment === deployment ? "matched" : m.deployment === "hybrid" ? "partial" : "mismatched"}`
        : null,
      m.isStub ? "STUB (will fail closed)" : "configured",
    ]
      .filter((s) => s !== null)
      .join(" · ");
    out.push({ manifest: m, score, rationale, isStub: m.isStub });
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.manifest.id.localeCompare(b.manifest.id);
  });
  return out;
}

// ── Pure: routing decision ───────────────────────────────────────

export function resolveRouting(registry, request) {
  const candidates = findEdgeNodesByCapability(
    registry,
    request.capability,
    request.deployment,
  );
  const filtered = request.persona
    ? candidates.filter((c) => c.manifest.persona === request.persona)
    : candidates;

  if (filtered.length === 0) {
    return {
      kind: "no-match",
      reason: "no_node_supports_capability",
      capability: request.capability,
    };
  }
  const allStubs = filtered.every((c) => c.isStub);
  if (allStubs) {
    return {
      kind: "all-stub",
      best: filtered[0].manifest,
      reason: "only_stubs_available",
    };
  }
  const realFirst = filtered.find((c) => !c.isStub) ?? filtered[0];
  return {
    kind: "route",
    target: realFirst.manifest,
    score: realFirst.score,
    rationale: realFirst.rationale,
    alternatives: filtered.slice(0, 5).map((c) => ({
      manifest: c.manifest,
      score: c.score,
    })),
  };
}

// ── Pure: preflight dispatch (R100 / R102 / R37 / R91 ordering) ──

export function preflightDispatch(input) {
  if (input.policy.decision === "deny") {
    return {
      ok: false,
      reason: "policy_denied",
      details: input.policy.reason,
    };
  }
  if (input.policy.decision === "require-act") {
    if (!input.request.actChainHash) {
      return { ok: false, reason: "act_required" };
    }
  }
  if (input.policy.decision === "require-acat") {
    if (!input.request.acatChainHash) {
      return { ok: false, reason: "acat_required" };
    }
  }
  if (input.cost.decision === "deny") {
    return {
      ok: false,
      reason: "budget_exhausted",
      details: input.cost.reason,
    };
  }
  return { ok: true };
}

// ── Pure: receipt builders ───────────────────────────────────────

export function dispatchReceiptLine(input) {
  const { request, outcome } = input;
  const head = `[edge-node-dispatch] user=${request.userId} cap=${request.capability}`;
  if (outcome.ok) {
    return `${head} → ok via ${outcome.edgeNodeId} (${outcome.durationMs}ms, ${outcome.costCents}¢)`;
  }
  const detail = outcome.details ? ` — ${outcome.details}` : "";
  return `${head} → REFUSED via ${outcome.edgeNodeId} (${outcome.reason})${detail}`;
}

export function buildPreflightFailure(input) {
  const head = `[edge-node-dispatch] user=${input.request.userId} cap=${input.request.capability}`;
  return {
    ok: false,
    edgeNodeId: input.edgeNodeId,
    capability: input.request.capability,
    reason: input.preflight.reason,
    details: input.preflight.details,
    receiptLine: `${head} → REFUSED preflight (${input.preflight.reason})${
      input.preflight.details ? ` — ${input.preflight.details}` : ""
    }`,
  };
}
