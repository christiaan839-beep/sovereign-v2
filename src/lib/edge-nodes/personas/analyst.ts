/**
 * ANALYST EDGE NODE — pre-built stub.
 *
 * The procurement-readable persona for a research + reasoning swarm.
 * Wraps the upstream open-source stack: Kimi K2.6 1T MoE (orchestrates
 * up to 300 sub-agents per published claims), Cognee (hybrid vector +
 * knowledge-graph memory layer with traceable provenance), Qualixar
 * OS (universal LLM-driven team designer).
 *
 * Stub-only today; specific integration ships as R124-R126 (Kimi K2.6
 * model loader, Cognee adapter, Qualixar bridge). See
 * docs/EDGE-NODE-FRAMEWORK.md.
 *
 * Procurement framing: "an autonomous research team that ingests
 * documents, builds knowledge graphs, plans queries, and produces
 * executive summaries — all with full provenance traceability via
 * Cognee + R26 audit chain."
 */

import { StubEdgeNode } from "../stub-edge-node";

export const ANALYST_EDGE_NODE_ID = "analyst-default";

export function createAnalystStub(): StubEdgeNode {
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
        {
          name: "Qualixar OS",
          license: "Elastic License 2.0",
        },
      ],
      deployment: "customer-cloud",
      costBand: "medium",
      outputClass: "tenant-private",
      regulatoryNotes: [
        "GDPR Art. 30 (records of processing) — Cognee's traceable provenance maps directly.",
        "SOX 404 (controls over financial reporting) — applicable for finance-domain compliance reports.",
      ],
    },
    detailsOverride:
      "Analyst Edge Node is stub-only by default. Wire up Kimi K2.6 model serving + Cognee graph + Qualixar OS team designer and replace this stub via the registry. See docs/EDGE-NODE-FRAMEWORK.md (R124-R126).",
  });
}
