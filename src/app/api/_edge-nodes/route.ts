/**
 * GET /api/edge-nodes
 *
 * PUBLIC, machine-readable Edge Node registry feed. Procurement
 * teams, auditors, ISVs, and competitors can fetch the full list
 * of registered Edge Nodes + their capability surface + their
 * stub/configured status.
 *
 * Query params:
 *   ?persona=software-engineer | analyst | operator | custom
 *   ?capability=fix-github-issue | ...
 *   ?deployment=air-gapped | customer-cloud | managed-cloud | hybrid
 *   ?excludeStubs=true     — show only configured (non-stub) nodes
 *   ?stats=true            — return registry stats summary
 *
 * Cached 5 min — registry contents change only on a deploy or
 * operator-side wiring change.
 */

import { NextResponse } from "next/server";
import {
  createDefaultEdgeNodeRegistry,
  listEdgeNodes,
  edgeNodeRegistryStats,
  type EdgeNodeCapability,
  type EdgeNodeDeployment,
  type EdgeNodePersona,
  type ListFilter,
} from "@/lib/edge-nodes";

export const runtime = "nodejs";
export const revalidate = 300;

const VALID_PERSONAS: ReadonlySet<EdgeNodePersona> = new Set([
  "software-engineer",
  "analyst",
  "operator",
  "custom",
]);

const VALID_DEPLOYMENTS: ReadonlySet<EdgeNodeDeployment> = new Set([
  "air-gapped",
  "customer-cloud",
  "managed-cloud",
  "hybrid",
]);

const VALID_CAPABILITIES: ReadonlySet<EdgeNodeCapability> = new Set([
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const registry = createDefaultEdgeNodeRegistry();

  if (params.get("stats") === "true") {
    const stats = edgeNodeRegistryStats(registry);
    return NextResponse.json(
      {
        stats,
        verifierNote:
          "Same pure function as @sovereign/inspector. Stats reflect the default registry — operator-deployed registries replace stubs and update these counts.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  }

  const filter: ListFilter = {};
  const personaParam = params.get("persona");
  if (personaParam && VALID_PERSONAS.has(personaParam as EdgeNodePersona)) {
    filter.persona = personaParam as EdgeNodePersona;
  }
  const deploymentParam = params.get("deployment");
  if (
    deploymentParam &&
    VALID_DEPLOYMENTS.has(deploymentParam as EdgeNodeDeployment)
  ) {
    filter.deployment = deploymentParam as EdgeNodeDeployment;
  }
  const capabilityParam = params.get("capability");
  if (
    capabilityParam &&
    VALID_CAPABILITIES.has(capabilityParam as EdgeNodeCapability)
  ) {
    filter.capability = capabilityParam as EdgeNodeCapability;
  }
  if (params.get("excludeStubs") === "true") filter.excludeStubs = true;

  const manifests = listEdgeNodes(registry, filter);
  return NextResponse.json(
    {
      total: manifests.length,
      filter,
      edgeNodes: manifests,
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
