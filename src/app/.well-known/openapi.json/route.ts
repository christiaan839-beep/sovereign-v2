/**
 * SOVEREIGN MATRIX — /.well-known/openapi.json (Cook 132).
 *
 * Auto-publishes a discoverable OpenAPI 3.1 contract at the standard
 * well-known location so every external developer integrates against
 * the same canonical schema.
 *
 * Sourced from the MCP tool descriptors (Cook 116) so /api endpoints
 * + MCP capabilities stay in sync — single source of truth.
 */

import { NextResponse } from "next/server";
import { buildMcpDescriptors } from "@/lib/mcp-tools-export";

export const dynamic = "force-static";
export const revalidate = 3600;

interface OpenAPIPath {
  post?: {
    operationId: string;
    summary: string;
    description: string;
    tags: string[];
    requestBody?: {
      required: boolean;
      content: { "application/json": { schema: Record<string, unknown> } };
    };
    responses: Record<
      string,
      { description: string; content?: Record<string, unknown> }
    >;
  };
}

export async function GET() {
  const descriptors = buildMcpDescriptors();
  const paths: Record<string, OpenAPIPath> = {};

  for (const d of descriptors) {
    const path = `/api/${d.name.replace("sovereign/", "")}`;
    paths[path] = {
      post: {
        operationId: d.name.replace(/[^a-zA-Z0-9]+/g, "_"),
        summary: d.description.split(".")[0],
        description: d.description,
        tags: [d.category],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: d.inputSchema },
          },
        },
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          "400": { description: "Invalid input" },
          "401": { description: "Unauthorized" },
          "429": { description: "Rate-limited" },
          "500": { description: "Server error" },
        },
      },
    };
  }

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Sovereign Matrix Public API",
      version: "1.0.0",
      description:
        "Cryptographically-receipted AI agent platform. Every endpoint returns a signed receipt that can be replayed for audit verification.",
      contact: {
        name: "Sovereign Matrix",
        url: "https://sovereignmatrix.agency",
      },
      license: {
        name: "Commercial",
        url: "https://sovereignmatrix.agency/terms",
      },
    },
    servers: [
      {
        url: "https://sovereignmatrix.agency",
        description: "Production",
      },
    ],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "PAT — Personal Access Token (sk_pat_...)",
        },
      },
      schemas: {
        Receipt: {
          type: "object",
          required: ["receiptId", "signature", "headline", "body"],
          properties: {
            receiptId: { type: "string", description: "Stable identifier" },
            signature: {
              type: "string",
              description:
                "VAOS wire signature: `v1=<hex-HMAC>` (legacy) | `v2=<base64-Ed25519>` | `v3=<base64-Ed25519>.<base64-ML-DSA-65>` (FIPS 204 dual-sign).",
            },
            headline: { type: "string" },
            body: { type: "string" },
            citations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  url: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: "trust", description: "Live SOC 2 + framework coverage" },
      { name: "verify", description: "Verify a claim against sources" },
      { name: "compliance", description: "Framework scorecards + attestation" },
      { name: "marketplace", description: "3rd-party agent listings" },
      { name: "billing", description: "Subscription pricing math" },
      { name: "memory", description: "Per-tenant RAG memory" },
      { name: "workflow", description: "Multi-agent workflow DSL" },
    ],
    paths,
  };

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
