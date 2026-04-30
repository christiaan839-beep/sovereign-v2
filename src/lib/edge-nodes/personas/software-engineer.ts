/**
 * SOFTWARE ENGINEER EDGE NODE — pre-built stub.
 *
 * The procurement-readable persona for an autonomous coding swarm.
 * Wraps the upstream open-source stack: Trae Agent (ByteDance,
 * SWE-Bench Verified leader at the time of writing), AgentFlow's
 * Planner-Executor-Verifier-Generator modules, and Werkstatt's
 * pre-merge engineering-discipline gates.
 *
 * This file ships a STUB — fail-closed default. Operators wire up
 * the real Trae / AgentFlow / Werkstatt deployments via the
 * registry before a dispatch will succeed. See the integration
 * roadmap in docs/EDGE-NODE-FRAMEWORK.md (R121-R123).
 *
 * Why this is shipped as a stub today:
 *
 *   - Trae Agent + AgentFlow + Werkstatt have moving APIs. Pinning
 *     a specific version + harness in this file would lie about
 *     what we actually tested.
 *   - The stub captures the procurement-grade SURFACE — what
 *     capabilities the Edge Node will offer, what license the
 *     upstreams use, what deployment posture we recommend.
 *   - Customers can REPLACE the stub with their own integration
 *     today. The framework guarantees policy + cost + audit + ACT
 *     wrapping regardless of the implementation.
 */

import { StubEdgeNode } from "../stub-edge-node";

export const SOFTWARE_ENGINEER_EDGE_NODE_ID = "software-engineer-default";

export function createSoftwareEngineerStub(): StubEdgeNode {
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
        {
          name: "AgentFlow",
          license: "MIT",
        },
        {
          name: "Werkstatt",
          license: "MIT",
        },
      ],
      deployment: "customer-cloud",
      costBand: "medium",
      outputClass: "tenant-private",
      regulatoryNotes: [
        "SOC 2 CC8.1 (change management) — Werkstatt enforces plan/review/test gates pre-merge.",
      ],
    },
    detailsOverride:
      "Software Engineer Edge Node is stub-only by default. Wire up Trae Agent + AgentFlow + Werkstatt deployments and replace this stub via the registry. See docs/EDGE-NODE-FRAMEWORK.md (R121-R123) for the integration plan.",
  });
}
