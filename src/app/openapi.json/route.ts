/**
 * GET /openapi.json — current OpenAPI 3.0.3 spec for the platform.
 *
 * Cached for 5 minutes at the edge — the spec is only re-derived when
 * the build artifact rolls. Customers can `openapi-typescript` /
 * `openapi-generator` against this URL to codegen typed clients in
 * any language.
 */
import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi-spec";

export async function GET(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = host ? `${proto}://${host}` : "https://sovereignmatrix.agency";

  const spec = buildOpenApiSpec(origin);

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
