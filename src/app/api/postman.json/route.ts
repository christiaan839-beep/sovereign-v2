/**
 * GET /api/postman.json — Postman 2.1 collection for the public
 * verification API.
 *
 * Companion to /api/openapi.json. Where OpenAPI is the
 * machine-readable contract, this is the one-click "Import → Link
 * → paste URL" path that compliance teams + auditors actually use
 * during procurement.
 *
 * Postman, Insomnia, Hoppscotch, Bruno all accept Postman v2.1.0
 * Collection format. Postman has a specific quirk: importing via
 * URL only works with a v2.1 schema. The OpenAPI route doesn't
 * directly serve Postman so we hand-roll the collection JSON here.
 *
 * Edge-cached 5 min. Open CORS. Self-references the request origin
 * so preview deploys + white-label domains produce valid collections.
 */

import { NextResponse } from "next/server";

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
  const collection = {
    info: {
      _postman_id: "sovereign-matrix-verification-api",
      name: "Sovereign Matrix — Public Verification API",
      description: [
        "Cryptographically signed receipts for every AI agent run, with a public, no-auth verifier.",
        "",
        "Five endpoints. Open CORS. No API key required.",
        "",
        "See:",
        "- VAOS 1.0 spec: https://sovereignmatrix.agency/spec",
        "- OpenAPI 3.1 contract: https://sovereignmatrix.agency/api/openapi.json",
        "- MCP server: https://sovereignmatrix.agency/mcp",
      ].join("\n"),
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      {
        key: "host",
        value: origin,
        description: "Verifier host. Override for white-label deployments.",
      },
      {
        key: "receiptId",
        value: "00000000-0000-0000-0000-00000000abcd",
        description: "A receipt id you want to fetch / verify.",
      },
    ],
    item: [
      {
        name: "Verify a receipt's HMAC signature",
        request: {
          method: "POST",
          header: [{ key: "Content-Type", value: "application/json" }],
          url: {
            raw: "{{host}}/api/verify",
            host: ["{{host}}"],
            path: ["api", "verify"],
          },
          body: {
            mode: "raw",
            raw: JSON.stringify(
              {
                canonical: "<canonical-projection-string>",
                signature: "v1=<hex>",
              },
              null,
              2,
            ),
            options: { raw: { language: "json" } },
          },
          description:
            "Pass canonical + signature. Server recomputes HMAC-SHA256 and constant-time compares. Returns {valid: boolean}.",
        },
        response: [],
      },
      {
        name: "Fetch a receipt by id",
        request: {
          method: "GET",
          header: [],
          url: {
            raw: "{{host}}/api/agent-runs/{{receiptId}}",
            host: ["{{host}}"],
            path: ["api", "agent-runs", "{{receiptId}}"],
          },
          description:
            "Returns the full receipt: canonical, signature, agent name, model, duration, safety pipeline results, timestamps. Visibility-gated.",
        },
        response: [],
      },
      {
        name: "Freshest public receipt",
        request: {
          method: "GET",
          header: [],
          url: {
            raw: "{{host}}/api/agent-runs/latest-public",
            host: ["{{host}}"],
            path: ["api", "agent-runs", "latest-public"],
          },
          description:
            "The most recent receipt with visibility=public. Useful as a seed for verification demos. Returns {receipt: null} if none exist yet.",
        },
        response: [],
      },
      {
        name: "Public feed (up to 50)",
        request: {
          method: "GET",
          header: [],
          url: {
            raw: "{{host}}/api/agent-runs/recent-public?limit=10",
            host: ["{{host}}"],
            path: ["api", "agent-runs", "recent-public"],
            query: [{ key: "limit", value: "10" }],
          },
          description:
            "Block-explorer-style feed. Each row is a fingerprint summary — fetch the full receipt for canonical + signature.",
        },
        response: [],
      },
      {
        name: "Aggregate platform metrics",
        request: {
          method: "GET",
          header: [],
          url: {
            raw: "{{host}}/api/stats/public",
            host: ["{{host}}"],
            path: ["api", "stats", "public"],
          },
          description:
            "Lifetime signed-receipt count, public-receipt count, last 24h. Aggregate only — no PII.",
        },
        response: [],
      },
    ],
  };

  return NextResponse.json(collection, { headers: CORS_HEADERS });
}
