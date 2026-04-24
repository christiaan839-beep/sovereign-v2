/**
 * GET /api/openapi  · GET /api/openapi.json
 *
 * Public OpenAPI 3.1 spec for the Sovereign Matrix API. Feeds:
 *   - Partner SDK generators (openapi-generator, Stainless, Speakeasy)
 *   - Interactive API explorer at /developers/api-explorer
 *   - Enterprise procurement checklists
 *
 * The spec is deterministic (introspected from static code) so a CDN
 * cache is safe. `Cache-Control: public, max-age=300` — 5 min is enough
 * to absorb traffic without letting a stale spec linger.
 */

import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi-spec";

export const runtime = "nodejs";
// Rebuild every 5 minutes. In-memory Node cache between builds because
// the agent registry is static — no DB calls here.
export const revalidate = 300;

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const spec = await buildOpenApiSpec(baseUrl);

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      // Permissive CORS — the spec is public info; SDK generators on
      // developer machines need to fetch it directly.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
