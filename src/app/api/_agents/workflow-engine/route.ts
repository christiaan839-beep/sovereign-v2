import { createAgentRoute } from "@/lib/agent-factory";
import { createLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/base-url";

const log = createLogger("workflow-engine");

/**
 * SOVEREIGN WORKFLOW ENGINE — Native visual automation (n8n alternative).
 *
 * Executes multi-step workflows defined as JSON node graphs.
 * Each node maps to an existing agent endpoint. Nodes execute
 * sequentially or in parallel based on dependencies.
 *
 * This replaces the need for external n8n/Zapier/Make by running
 * automation natively inside the platform with full agent access.
 *
 * Input: { workflow: { nodes: [...], edges: [...] }, trigger?: "manual" | "schedule" }
 * Output: { results: [...], duration, nodesExecuted }
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

interface WorkflowNode {
  id: string;
  type: string; // Agent endpoint key (e.g., "blog-gen", "translate", "flux-image")
  params: Record<string, string>; // Parameters for the agent
  dependsOn?: string[]; // IDs of nodes that must complete first
}

interface WorkflowEdge {
  from: string;
  to: string;
  transformOutput?: string; // JS expression to transform output before passing to next node
}

const AGENT_ENDPOINTS: Record<string, string> = {
  "blog-gen": "/api/_agents/blog-gen",
  translate: "/api/_agents/translate",
  "flux-image": "/api/_agents/flux-image",
  seo: "/api/_agents/seo-dominator",
  audit: "/api/_agents/audit",
  leads: "/api/_agents/leads",
  outbound: "/api/_agents/outbound",
  competitor: "/api/_agents/competitor-scan",
  "pii-guard": "/api/_agents/pii-guard",
  "content-safety": "/api/_agents/content-safety",
  "voice-synth": "/api/_agents/voice-synth",
  ocr: "/api/_agents/ocr",
  "code-sandbox": "/api/_agents/code-sandbox",
  "grounded-search": "/api/_agents/grounded-search",
  "deep-think": "/api/_agents/deep-think",
  "social-router": "/api/_agents/social-router",
  "page-builder": "/api/_agents/page-builder",
  "competitive-radar": "/api/_agents/competitive-radar",
  "url-context": "/api/_agents/url-context",
  embed: "/api/_agents/embed",
  rerank: "/api/_agents/rerank",
};

export const POST = createAgentRoute({
  name: "workflow-engine",
  requiredFields: ["workflow"],
  // Wave 131 M3 batch 21: memory hooks. Per-workflow-shape continuity —
  // prior runs of the same node sequence reveal failure modes
  // ("the rerank node 4 timed out at the same step") without re-running
  // the full DAG to discover the brittle stage.
  memory: {
    search: {
      query: (input) => {
        const wf = input.workflow as
          | { nodes?: Array<{ type?: string; id?: string }> }
          | undefined;
        const nodeShape = (wf?.nodes ?? [])
          .map((n) => n.type ?? "?")
          .slice(0, 8)
          .join("→");
        return `workflow ${nodeShape}`;
      },
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          nodesExecuted?: number;
          totalNodes?: number;
          durationMs?: number;
          results?: Record<
            string,
            { status?: "success" | "error"; durationMs?: number }
          >;
        };
        if (!r.results) return null;
        const failed = Object.entries(r.results)
          .filter(([, v]) => v.status === "error")
          .map(([id]) => id)
          .slice(0, 5)
          .join(",");
        return `workflow[${r.nodesExecuted ?? 0}/${r.totalNodes ?? 0} · ${r.durationMs ?? 0}ms${failed ? ` fail=${failed}` : ""}]`;
      },
      metadata: () => ({ kind: "workflow-engine" }),
    },
  },
  handler: async ({ input }) => {
    const workflow = input.workflow as {
      nodes: WorkflowNode[];
      edges?: WorkflowEdge[];
    };
    const nodes = workflow.nodes || [];
    const _edges = workflow.edges || [];

    if (nodes.length === 0) {
      return { error: "Workflow has no nodes." };
    }
    if (nodes.length > 20) {
      return { error: "Workflow limited to 20 nodes maximum." };
    }

    const baseUrl = getBaseUrl();
    const results: Record<
      string,
      { output: unknown; durationMs: number; status: "success" | "error" }
    > = {};
    const completed = new Set<string>();
    const startTime = Date.now();

    // Topological execution — respect dependencies
    let iterations = 0;
    while (completed.size < nodes.length && iterations < 30) {
      iterations++;

      // Find nodes ready to execute (all dependencies completed)
      const ready = nodes.filter(
        (n) =>
          !completed.has(n.id) &&
          (n.dependsOn || []).every((dep) => completed.has(dep)),
      );

      if (ready.length === 0 && completed.size < nodes.length) {
        return {
          error: "Workflow has circular dependencies or unresolvable nodes.",
          completed: Object.keys(results),
        };
      }

      // Execute ready nodes in parallel
      const execPromises = ready.map(async (node) => {
        const endpoint = AGENT_ENDPOINTS[node.type];
        if (!endpoint) {
          results[node.id] = {
            output: `Unknown agent type: ${node.type}`,
            durationMs: 0,
            status: "error",
          };
          completed.add(node.id);
          return;
        }

        // Resolve parameter references from upstream node outputs
        const resolvedParams: Record<string, string> = {};
        for (const [key, value] of Object.entries(node.params)) {
          if (
            typeof value === "string" &&
            value.startsWith("{{") &&
            value.endsWith("}}")
          ) {
            // Reference to upstream output: {{nodeId.field}}
            const ref = value.slice(2, -2).trim();
            const [refNodeId, ...fieldParts] = ref.split(".");
            const refOutput = results[refNodeId]?.output;
            if (refOutput && typeof refOutput === "object") {
              const fieldPath = fieldParts.join(".");
              resolvedParams[key] =
                getNestedValue(
                  refOutput as Record<string, unknown>,
                  fieldPath,
                ) || value;
            } else if (typeof refOutput === "string") {
              resolvedParams[key] = refOutput;
            } else {
              resolvedParams[key] = value;
            }
          } else {
            resolvedParams[key] = value;
          }
        }

        const nodeStart = Date.now();
        try {
          const res = await outboundFetchAsResponse(
            `${baseUrl}${endpoint}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resolvedParams),
              signal: AbortSignal.timeout(30000),
            },
            {
              ruleId: "agents.workflow-engine.route.1",
              allowedHosts: [new URL(baseUrl).hostname],
            },
          );

          const data = await res.json();
          results[node.id] = {
            output: data,
            durationMs: Date.now() - nodeStart,
            status: "success",
          };
          log.info("Workflow node completed", {
            nodeId: node.id,
            type: node.type,
            durationMs: Date.now() - nodeStart,
          });
        } catch (err) {
          results[node.id] = {
            output: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
            durationMs: Date.now() - nodeStart,
            status: "error",
          };
          log.warn("Workflow node failed", {
            nodeId: node.id,
            type: node.type,
            error: String(err),
          });
        }

        completed.add(node.id);
      });

      await Promise.all(execPromises);
    }

    return {
      results,
      nodesExecuted: completed.size,
      totalNodes: nodes.length,
      durationMs: Date.now() - startTime,
      availableAgents: Object.keys(AGENT_ENDPOINTS),
    };
  },
});

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (
      current &&
      typeof current === "object" &&
      part in (current as Record<string, unknown>)
    ) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return "";
    }
  }
  return typeof current === "string" ? current : JSON.stringify(current);
}
