/**
 * POST /api/perception/plan
 *
 * PUBLIC, no-auth, rate-limited mesh-plan composer. Procurement
 * and developer teams hit this from CI to verify their perception
 * mesh specs build a sensible plan BEFORE invoking the model.
 *
 * Stateless. No model calls. Returns the deterministic plan that
 * `composePerceptionMesh` produces in pure code, plus the
 * cross-modal correlation rules echoed for transparency.
 *
 * Body shape:
 *   {
 *     spec: MeshSpec,
 *     inputs: MeshInputs,
 *     rules?: CorrelationRule[]   (echoed back; not evaluated here)
 *   }
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  composePerceptionMesh,
  type MeshSpec,
  type MeshInputs,
  type CorrelationRule,
} from "@/lib/perception/mesh";
import { applyRateLimit, rateLimitHeaders } from "@/lib/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  spec?: unknown;
  inputs?: unknown;
  rules?: unknown;
}

export async function POST(request: Request) {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const rate = await applyRateLimit("/api/_perception/plan", { ip });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: rate.resetInSeconds },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "bad_request", details: "Body must be JSON" },
      { status: 400 },
    );
  }
  if (!body.spec || typeof body.spec !== "object") {
    return NextResponse.json(
      { error: "bad_request", details: "`spec` (MeshSpec) is required" },
      { status: 400 },
    );
  }
  if (!body.inputs || typeof body.inputs !== "object") {
    return NextResponse.json(
      { error: "bad_request", details: "`inputs` (MeshInputs) is required" },
      { status: 400 },
    );
  }

  let plan;
  try {
    plan = composePerceptionMesh(
      body.spec as MeshSpec,
      body.inputs as MeshInputs,
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "bad_request",
        details: err instanceof Error ? err.message : "plan composition failed",
      },
      { status: 400 },
    );
  }

  const rulesEcho = Array.isArray(body.rules)
    ? (body.rules as CorrelationRule[])
    : [];

  return NextResponse.json(
    {
      plan,
      rulesEcho,
      verifierNote:
        "Same pure function as @sovereign/inspector and " +
        "src/lib/perception/mesh.ts. Plan is deterministic; replay locally to confirm.",
    },
    { status: 200 },
  );
}
