/**
 * SOVEREIGN MATRIX — MCP tool exporter (Cook 116).
 *
 * Surfaces the Tier 1-7 pure primitives (Cook 36-114) as
 * MCP-compatible tool descriptors so Claude Desktop / Cursor /
 * Continue / any MCP host can call them directly.
 *
 * Pure module: builds a `ToolDescriptor[]` you can pass to the
 * mcp-server JSON-RPC handler. NO I/O — actual invocation routes
 * through the existing primitives in src/lib/.
 */

import { z } from "zod";

// ── Public types ──────────────────────────────────────────────────────────

export interface McpToolDescriptor {
  /** Stable namespaced id ("sovereign/verify-claim"). */
  name: string;
  /** Short description shown to the model in its tool list. */
  description: string;
  /** JSONSchema for the args. Derived from the Zod input schema. */
  inputSchema: Record<string, unknown>;
  /** Stable category — UI grouping in MCP hosts. */
  category: McpCategory;
}

export type McpCategory =
  | "trust"
  | "verify"
  | "compliance"
  | "marketplace"
  | "billing"
  | "memory"
  | "workflow";

// ── Tool descriptors ─────────────────────────────────────────────────────

/**
 * Build the descriptor list. Pure — same registry every time. The
 * shape mirrors Cook 36's tool-registry, but these tools live in
 * MCP-space rather than agent-execution-space.
 */
export function buildMcpDescriptors(): McpToolDescriptor[] {
  return [
    {
      name: "sovereign/verify-claim",
      description:
        "Verify a claim against supplied sources. Composes Cook 41 hallucination detector + Cook 96 adversarial filter + Cook 97 output guard.",
      inputSchema: schemaFor(
        z.object({
          claim: z.string().min(8).max(2000),
          sources: z
            .array(
              z.object({
                id: z.string().min(1).max(120),
                body: z.string().min(1).max(8000),
              }),
            )
            .min(0)
            .max(20),
        }),
      ),
      category: "verify",
    },
    {
      name: "sovereign/audit-bias",
      description:
        "Score text across 4 fairness dimensions (gendered language, stereotyping, absolutist claims, demographic exclusion).",
      inputSchema: schemaFor(
        z.object({
          answer: z.string().min(1).max(20000),
        }),
      ),
      category: "verify",
    },
    {
      name: "sovereign/compliance-scorecard",
      description:
        "Return the framework scorecard for EU AI Act, NIST AI RMF, or ISO 42001. Implemented / partial / planned per control.",
      inputSchema: schemaFor(
        z.object({
          framework: z.enum(["eu-ai-act-annex-iv", "nist-ai-rmf", "iso-42001"]),
        }),
      ),
      category: "compliance",
    },
    {
      name: "sovereign/soc2-posture",
      description:
        "Return the live SOC 2 control posture. Pass / warn / fail per rule across all 5 Trust Services Criteria.",
      inputSchema: schemaFor(z.object({})),
      category: "trust",
    },
    {
      name: "sovereign/quote-subscription",
      description:
        "Compute the cents charge for a fresh subscription. Monthly or annual cadence with banker's-rounded billing math.",
      inputSchema: schemaFor(
        z.object({
          planId: z.string().min(1),
          monthlyCents: z.number().int().min(1),
          cadence: z.enum(["monthly", "annual"]),
        }),
      ),
      category: "billing",
    },
    {
      name: "sovereign/render-attestation",
      description:
        "Generate a signed quarterly attestation letter for a tenant. PDF-ready markdown.",
      inputSchema: schemaFor(
        z.object({
          tenantId: z.string().min(1),
          tenantDisplayName: z.string().min(1),
          periodStart: z.string(),
          periodEnd: z.string(),
          frameworks: z
            .array(z.enum(["eu-ai-act-annex-iv", "nist-ai-rmf", "iso-42001"]))
            .min(1),
        }),
      ),
      category: "compliance",
    },
    {
      name: "sovereign/marketplace-list",
      description:
        "List published marketplace agents. Returns name, slug, description, per-run price, safety layers.",
      inputSchema: schemaFor(z.object({})),
      category: "marketplace",
    },
    {
      name: "sovereign/disclose-receipt-field",
      description:
        "Build a Merkle inclusion proof for a single receipt field. Auditor verifies the value without seeing the rest of the receipt.",
      inputSchema: schemaFor(
        z.object({
          receiptId: z.string().min(1),
          field: z.string().min(1),
        }),
      ),
      category: "trust",
    },
    {
      name: "sovereign/zk-pass-rate-claim",
      description:
        "Issue a ZK-lite pass-rate claim for a tenant period (Merkle root + aggregates, no per-run data).",
      inputSchema: schemaFor(
        z.object({
          tenantId: z.string().min(1),
          periodStart: z.string(),
          periodEnd: z.string(),
          threshold: z.number().min(0).max(1),
        }),
      ),
      category: "trust",
    },
    {
      name: "sovereign/workflow-validate",
      description:
        "Validate a visual-builder workflow graph + compile to executable WorkflowStep tree.",
      inputSchema: schemaFor(
        z.object({
          nodes: z.array(
            z.object({
              id: z.string(),
              kind: z.enum(["start", "agent", "branch", "merge", "end"]),
              label: z.string(),
              agentSlug: z.string().optional(),
              predicate: z.string().optional(),
            }),
          ),
          edges: z.array(
            z.object({
              id: z.string(),
              from: z.string(),
              to: z.string(),
              armLabel: z.string().optional(),
            }),
          ),
        }),
      ),
      category: "workflow",
    },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function schemaFor<T>(schema: z.ZodType<T>): Record<string, unknown> {
  // Lightweight JSONSchema-like serializer. Production wires
  // zod-to-json-schema when packaging the MCP bundle.
  type ZodWithDef = z.ZodType<T> & { _def?: { typeName?: string } };
  const def = (schema as ZodWithDef)._def;
  return {
    type: "object",
    "x-zod-type": def?.typeName ?? "Unknown",
  };
}

/** Stable lookup by name — used by the MCP handler to route calls. */
export function findDescriptor(name: string): McpToolDescriptor | undefined {
  return buildMcpDescriptors().find((d) => d.name === name);
}

/** Group descriptors by category for UI rendering. */
export function groupByCategory(
  descriptors: McpToolDescriptor[],
): Record<McpCategory, McpToolDescriptor[]> {
  const out: Record<McpCategory, McpToolDescriptor[]> = {
    trust: [],
    verify: [],
    compliance: [],
    marketplace: [],
    billing: [],
    memory: [],
    workflow: [],
  };
  for (const d of descriptors) {
    out[d.category].push(d);
  }
  return out;
}
