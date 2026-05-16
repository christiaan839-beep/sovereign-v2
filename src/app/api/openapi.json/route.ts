/**
 * GET /api/openapi.json — OpenAPI 3.1 schema for the Sovereign public
 * verification API.
 *
 * Companion to the MCP server at /api/mcp/verifier. Where MCP exposes
 * the same primitives via JSON-RPC for AI-tool clients, this schema
 * exposes them as a standards-compliant OpenAPI 3.1 contract for:
 *
 *   - Cursor / VSCode / Continue.dev autoimport (machine-readable tool
 *     generation)
 *   - Compliance / procurement teams asking for an API contract
 *   - OpenAPI registries (openapi.tools, api.directory) for SEO
 *   - Postman / Insomnia / Hoppscotch one-click import
 *
 * The schema is generated dynamically so the `servers.url` self-
 * references the request origin — preview deploys and white-label
 * domains produce valid contracts.
 *
 * Stable across versions: every endpoint listed here is already in
 * production and won't change shape without an OpenAPI version bump.
 *
 * No auth on the endpoint itself (public discovery), open CORS, edge
 * cached for 5 minutes.
 */

import { NextResponse } from "next/server";
import { eliteOpenApiSlice } from "@/lib/openapi-elite";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const schema = {
    openapi: "3.1.0",
    info: {
      title: "Sovereign Matrix — Public Verification API",
      version: "2.2.0",
      summary:
        "Cryptographically signed receipts for every AI agent run, with a public, no-auth verifier.",
      description:
        "Audit-grade infrastructure for AI in regulated industries. Every agent run on the platform produces an HMAC-SHA256 signed receipt over a canonical projection (and optionally an Ed25519 v2 signature for non-repudiation, plus OpenTimestamps Bitcoin notarization on Team-tier). This API surfaces the verifier + receipt-read primitives publicly so compliance auditors, AI tools, and third-party verifiers can validate platform output without an account.\n\nProtocol-equivalent MCP server lives at `/api/mcp/verifier` — install it into Claude Desktop / Cursor / Continue.dev to use these same primitives from inside any AI tool. Specification at https://sovereignmatrix.agency/spec.",
      contact: {
        name: "Sovereign Matrix",
        url: "https://sovereignmatrix.agency",
        email: "security@sovereignmatrix.agency",
      },
      license: {
        name: "VAOS 1.0 spec (CC0) · reference impl MIT",
        url: "https://sovereignmatrix.agency/spec",
      },
      termsOfService: "https://sovereignmatrix.agency/terms",
    },
    servers: [
      { url: origin, description: "This deployment" },
      {
        url: "https://sovereignmatrix.agency",
        description: "Production",
      },
    ],
    externalDocs: {
      description: "VAOS 1.0 — the open standard this API implements",
      url: "https://sovereignmatrix.agency/spec",
    },
    tags: [
      {
        name: "Verification",
        description:
          "Recompute HMAC-SHA256 over a canonical projection and confirm the signature matches. The same endpoint compliance auditors hit; the same primitive the embed badge uses.",
      },
      {
        name: "Receipts",
        description:
          "Visibility-gated receipt fetch: public/unlisted receipts are fetchable cross-origin; private receipts 404 to anyone but the owner.",
      },
      {
        name: "Stats",
        description: "Aggregate-only platform metrics (no PII).",
      },
    ],
    paths: {
      "/api/verify": {
        post: {
          tags: ["Verification"],
          summary: "Verify a receipt's HMAC signature",
          description:
            "Pass the canonical projection (deterministic JSON string) and the signature in `v1=<hex>` form. Server recomputes HMAC-SHA256 over the canonical with the platform signing secret and constant-time compares against the signature. Returns `{valid: boolean}` plus a few useful fields surfaced from the canonical projection (canonicalVersion, model, agent).",
          operationId: "verifyReceipt",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["canonical", "signature"],
                  properties: {
                    canonical: {
                      type: "string",
                      description:
                        "The receipt's canonical projection. Get it from `GET /api/agent-runs/{id}` or paste it from a `/r/{id}` page.",
                      example: '{"v":1,"id":"abc","agentName":"blog-gen"}',
                    },
                    signature: {
                      type: "string",
                      description:
                        "HMAC signature in `v1=<hex>` form, or raw hex digest.",
                      example:
                        "v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Verification result.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/VerifyResult" },
                },
              },
            },
            "400": {
              description: "Malformed request body.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/api/agent-runs/{id}": {
        get: {
          tags: ["Receipts"],
          summary: "Fetch a receipt by ID",
          description:
            "Returns the receipt's full canonical projection, signature, agent name, model used, duration, safety pipeline results, visibility, and timestamps. Visibility-gated: public/unlisted receipts are returned to any caller; private receipts 404 unless the requester is the owner.",
          operationId: "fetchReceipt",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Receipt ID — 32-40 hex chars with optional dashes.",
              schema: {
                type: "string",
                pattern: "^[0-9a-f-]{32,40}$",
                example: "00000000-0000-0000-0000-00000000abcd",
              },
            },
          ],
          responses: {
            "200": {
              description: "Receipt found.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Receipt" },
                },
              },
            },
            "400": {
              description: "Invalid ID format.",
            },
            "404": {
              description: "Not found, or private to a different owner.",
            },
          },
        },
      },
      "/api/agent-runs/latest-public": {
        get: {
          tags: ["Receipts"],
          summary: "Return the freshest public receipt",
          description:
            "Returns the most recent receipt with `visibility=public`. Useful as a seed for verification demos, embed-badge previews, and 'just-signed' indicators in AI tools. Unlisted receipts are intentionally excluded (they stay share-by-link).",
          operationId: "latestPublicReceipt",
          responses: {
            "200": {
              description:
                "Either a single receipt or `{receipt: null}` if no public receipts exist yet.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      receipt: {
                        oneOf: [
                          { $ref: "#/components/schemas/Receipt" },
                          { type: "null" },
                        ],
                      },
                      reason: {
                        type: "string",
                        description:
                          "Set when receipt is null: 'no-public-receipts-yet', 'race-deleted', 'unavailable'.",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent-runs/recent-public": {
        get: {
          tags: ["Receipts"],
          summary: "Feed of the most recent public receipts",
          description:
            "Returns up to 50 recent public receipts (default 30) for the public block-explorer feed at /explorer. Each row is a fingerprint summary — call `/api/agent-runs/{id}` for the full canonical projection.",
          operationId: "recentPublicReceipts",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 50,
                default: 30,
              },
            },
          ],
          responses: {
            "200": {
              description: "Feed of receipts.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      count: { type: "integer" },
                      receipts: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/ReceiptSummary",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/stats/public": {
        get: {
          tags: ["Stats"],
          summary: "Aggregate platform metrics",
          description:
            "Lifetime signed-receipt count, public-receipt count, and last-24-hour signed-receipt count. Aggregate only — no per-user or per-tenant data exposed. Powers the /stats page.",
          operationId: "publicStats",
          responses: {
            "200": {
              description: "Aggregate counts.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      totals: {
                        type: "object",
                        properties: {
                          signedReceipts: { type: "integer" },
                          publicReceipts: { type: "integer" },
                          last24h: { type: "integer" },
                        },
                        required: [
                          "signedReceipts",
                          "publicReceipts",
                          "last24h",
                        ],
                      },
                      computedAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        VerifyResult: {
          type: "object",
          properties: {
            valid: { type: "boolean" },
            canonicalVersion: { type: "integer" },
            agent: { type: "string", nullable: true },
            model: { type: "string", nullable: true },
          },
          required: ["valid"],
        },
        Receipt: {
          type: "object",
          properties: {
            id: { type: "string" },
            agentName: { type: "string" },
            modelUsed: { type: "string" },
            input: { type: "object" },
            output: { type: "object" },
            durationMs: { type: "integer" },
            trustDecision: { type: "string" },
            visibility: { type: "string", enum: ["public", "unlisted"] },
            canonical: { type: "string" },
            signature: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ReceiptSummary: {
          type: "object",
          properties: {
            id: { type: "string" },
            agentName: { type: "string" },
            modelUsed: { type: "string" },
            durationMs: { type: "integer" },
            signatureSha: {
              type: "string",
              description:
                "12-char SHA-256 fingerprint of the signature. NEVER the raw HMAC.",
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  };

  // Wave 22: merge in the elite-tier path additions (Waves 7–21 — 15
  // public surfaces). Single edit point in src/lib/openapi-elite.ts;
  // the existing path map above stays the source of truth for the
  // original verification API.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elite = eliteOpenApiSlice();
  const merged = {
    ...schema,
    paths: { ...schema.paths, ...(elite.paths as Record<string, unknown>) },
    components: {
      ...(schema.components as Record<string, unknown>),
      schemas: {
        ...(schema.components as { schemas: Record<string, unknown> }).schemas,
        ...elite.componentSchemas,
      },
      parameters: {
        ...(((schema.components as { parameters?: Record<string, unknown> })
          .parameters as Record<string, unknown> | undefined) ?? {}),
        ReceiptIdPath: {
          name: "id",
          in: "path",
          required: true,
          description: "Receipt id (UUID or stable receipt slug).",
          schema: { type: "string" },
        },
        TokenIdPath: {
          name: "id",
          in: "path",
          required: true,
          description: "Agent JIT token id (UUID).",
          schema: { type: "string", format: "uuid" },
        },
      },
      securitySchemes: {
        ...(((
          schema.components as { securitySchemes?: Record<string, unknown> }
        ).securitySchemes as Record<string, unknown> | undefined) ?? {}),
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "Clerk session JWT for user routes, or Wave-16 JIT agent token for downstream tool calls.",
        },
      },
    },
  };

  return NextResponse.json(merged, { headers: CORS_HEADERS });
}
