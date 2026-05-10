/**
 * OPENAPI SPEC BUILDER — generates a current OpenAPI 3.0 document
 * for the entire Sovereign Matrix HTTP surface.
 *
 * Three sections:
 *   1. Hand-curated platform endpoints (auth, agent-runs, verify, me/*).
 *      These have well-defined schemas and stable contracts.
 *   2. Generated agent endpoints — one path per slug in agent-slugs.ts.
 *      Inputs are advertised as `object` because the per-agent Zod
 *      schemas are runtime-only; clients can introspect them via the
 *      route's runtime 400 response on bad input.
 *   3. Receipt endpoints — the auditor surface (verify, agent-runs).
 *
 * The spec is what backs `/openapi.json`, and powers third-party
 * codegen via `openapi-generator`, `openapi-typescript`, etc.
 */

import { AGENT_SLUGS } from "@/lib/agent-slugs";
import { getAgentTier } from "@/lib/agent-tiers";

interface OpenApiPath {
  [method: string]: {
    summary?: string;
    description?: string;
    tags?: string[];
    operationId?: string;
    security?: Array<Record<string, string[]>>;
    parameters?: Array<{
      name: string;
      in: "path" | "query" | "header";
      required?: boolean;
      schema: { type: string };
      description?: string;
    }>;
    requestBody?: {
      required?: boolean;
      content: {
        "application/json": {
          schema: {
            type: string;
            properties?: Record<string, unknown>;
            additionalProperties?: boolean;
          };
        };
      };
    };
    responses: Record<
      string,
      {
        description: string;
        content?: {
          "application/json": {
            schema: { $ref?: string; type?: string };
          };
        };
      }
    >;
  };
}

export function buildOpenApiSpec(origin: string) {
  const paths: Record<string, OpenApiPath> = {};

  // ─── Platform: signed receipts + verify ───
  paths["/api/agent-runs"] = {
    get: {
      summary: "List your recent agent runs",
      description:
        "Returns the caller's most recent agent runs as a paged list. Cursor-based; pass the previous response's `nextCursor` to fetch the next page.",
      tags: ["Receipts"],
      operationId: "listAgentRuns",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "limit",
          in: "query",
          schema: { type: "integer" },
          description: "Page size, clamped to [1, 200]. Defaults to 50.",
        },
        {
          name: "cursor",
          in: "query",
          schema: { type: "string" },
          description: "Receipt id to page after.",
        },
      ],
      responses: {
        "200": {
          description: "Page of receipts",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReceiptList" },
            },
          },
        },
        "401": { description: "Unauthenticated" },
      },
    },
  };

  paths["/api/agent-runs/{id}"] = {
    get: {
      summary: "Fetch a single signed receipt",
      description:
        "Returns the full receipt including canonical projection and HMAC signature. Private receipts require auth as the owner; public/unlisted are readable by anyone with the id.",
      tags: ["Receipts"],
      operationId: "getAgentRun",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "Receipt",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Receipt" },
            },
          },
        },
        "404": { description: "Not found or private" },
      },
    },
  };

  paths["/api/agent-runs/{id}/publish"] = {
    post: {
      summary: "Change a receipt's visibility",
      description:
        "Owner-only. Flips visibility between private | unlisted | public.",
      tags: ["Receipts"],
      operationId: "publishAgentRun",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                visibility: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Visibility updated" },
        "401": { description: "Unauthenticated" },
        "404": { description: "Not yours or not found" },
      },
    },
  };

  paths["/api/agent-runs/{id}/replay"] = {
    post: {
      summary: "Replay a stored run",
      description:
        "Re-invokes the original agent with the original input. The new run's canonical projection embeds `_replayedFrom: <id>` so the parent link is part of the signature.",
      tags: ["Receipts"],
      operationId: "replayAgentRun",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "New agent output + replayOf reference",
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
        "401": { description: "Unauthenticated" },
        "403": { description: "Not yours" },
        "404": { description: "Original not found" },
      },
    },
  };

  paths["/api/verify"] = {
    post: {
      summary: "Verify a receipt signature",
      description:
        "Public, no-auth endpoint. Recomputes HMAC-SHA256 over the supplied canonical projection and constant-time compares against the signature. Lets any third party — auditor, customer compliance, regulator — confirm a receipt is authentic without server access to the signing key.",
      tags: ["Receipts"],
      operationId: "verifyReceipt",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                canonical: { type: "string" },
                signature: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Verification result",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VerifyResult" },
            },
          },
        },
        "400": { description: "Malformed body" },
        "429": { description: "Rate limited" },
      },
    },
  };

  // ─── Privacy / GDPR / POPIA ───
  paths["/api/me/export"] = {
    get: {
      summary: "Export all data we hold about you",
      description:
        "GDPR Art. 15 + 20 + POPIA s.23 right of access. Returns every row keyed to the caller across 30 user-scoped tables as a downloadable JSON.",
      tags: ["Privacy"],
      operationId: "exportMyData",
      security: [{ bearerAuth: [] }],
      responses: {
        "200": { description: "JSON dump (Content-Disposition: attachment)" },
        "401": { description: "Unauthenticated" },
      },
    },
  };

  paths["/api/me/delete"] = {
    post: {
      summary: "Permanently delete all user-keyed data",
      description:
        'GDPR Art. 17 + POPIA s.24 right of erasure. Strict body guard: `{ confirm: "DELETE" }`. Cascades across 30+ tables.',
      tags: ["Privacy"],
      operationId: "deleteMyData",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { confirm: { type: "string" } },
            },
          },
        },
      },
      responses: {
        "200": { description: "Deletion summary per table" },
        "400": { description: "Confirmation missing or wrong" },
        "401": { description: "Unauthenticated" },
      },
    },
  };

  // ─── API key management ───
  paths["/api/keys"] = {
    get: {
      summary: "List your API keys",
      tags: ["API Keys"],
      operationId: "listApiKeys",
      security: [{ bearerAuth: [] }],
      responses: { "200": { description: "Key list (no secrets)" } },
    },
    post: {
      summary: "Create a new API key",
      tags: ["API Keys"],
      operationId: "createApiKey",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { label: { type: "string" } },
            },
          },
        },
      },
      responses: {
        "201": {
          description:
            "New key — full secret returned ONCE. Save it now; the API will only ever return the prefix afterward.",
        },
      },
    },
    delete: {
      summary: "Revoke an API key",
      tags: ["API Keys"],
      operationId: "revokeApiKey",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { keyId: { type: "string" } },
            },
          },
        },
      },
      responses: { "200": { description: "Revoked" } },
    },
  };

  // ─── Public agent registry (used by SDK auto-discovery) ───
  paths["/api/agents"] = {
    get: {
      summary: "List all callable agents on this deployment",
      description:
        "Returns the slug, name, category, and tier (core | experimental | deprecated) of every agent. The SDK uses this to enumerate available agents at runtime.",
      tags: ["Agents"],
      operationId: "listAgents",
      responses: {
        "200": {
          description: "Agent registry",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AgentList" },
            },
          },
        },
      },
    },
  };

  // ─── Generated: one POST path per agent slug ───
  for (const slug of AGENT_SLUGS) {
    const tier = getAgentTier(slug);
    paths[`/api/_agents/${slug}`] = {
      post: {
        summary: `Invoke the "${slug}" agent`,
        description: `Tier: ${tier}. Returns the agent's structured output plus an automatically generated \`_receipt\` field carrying the verifiable run id, signature, and url. Per-agent input schema is enforced at runtime — invalid bodies receive a 400 with a Zod error message.`,
        tags: [
          "Agents",
          tier === "core" ? "Core agents" : "Experimental agents",
        ],
        operationId: `runAgent_${slug.replace(/-/g, "_")}`,
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Agent output (shape varies per agent)",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": { description: "Validation error" },
          "401": { description: "Unauthenticated" },
          "402": { description: "Plan does not include this agent" },
          "403": { description: "Verifier blocked the output" },
          "429": { description: "Rate / plan limit" },
        },
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Sovereign Matrix API",
      version: "2.0.0",
      description:
        "Audit-grade AI agent platform. Every agent invocation produces a cryptographically signed, verifiable receipt. The receipt is shareable, replayable, and verifiable by any third party.",
      contact: {
        name: "Sovereign Matrix",
        url: origin,
      },
      license: {
        name: "All rights reserved",
      },
    },
    servers: [{ url: origin }],
    tags: [
      {
        name: "Core agents",
        description: "Curated, marketed, individually tested.",
      },
      {
        name: "Experimental agents",
        description:
          "Long-tail tools — shipped, factory-tested, not yet promoted.",
      },
      {
        name: "Receipts",
        description: "Verifiable agent-run receipts and verification.",
      },
      { name: "API Keys", description: "Bearer token management." },
      {
        name: "Privacy",
        description: "GDPR Art. 15/17/20 + POPIA Sec. 23/24 endpoints.",
      },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Clerk JWT or Sovereign API key (sk_sovereign_...)",
        },
      },
      schemas: {
        Receipt: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            agentName: { type: "string" },
            modelUsed: { type: "string" },
            input: { type: "object", additionalProperties: true },
            output: { type: "object", additionalProperties: true },
            safetyResult: { type: "object", additionalProperties: true },
            durationMs: { type: "integer" },
            trustDecision: { type: "string" },
            visibility: {
              type: "string",
              enum: ["private", "public", "unlisted"],
            },
            signature: { type: "string", description: "v1=<sha256-hex>" },
            canonical: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ReceiptList: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/Receipt" },
            },
            nextCursor: { type: "string", nullable: true },
          },
        },
        VerifyResult: {
          type: "object",
          properties: {
            valid: { type: "boolean" },
            id: { type: "string" },
            agentName: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            algorithm: { type: "string", enum: ["HMAC-SHA256"] },
            canonicalVersion: { type: "integer" },
          },
        },
        AgentList: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slug: { type: "string" },
                  name: { type: "string" },
                  tier: {
                    type: "string",
                    enum: ["core", "experimental", "deprecated"],
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
