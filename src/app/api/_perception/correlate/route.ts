/**
 * POST /api/perception/correlate
 *
 * PUBLIC, no-auth, rate-limited cross-modal correlation evaluator.
 * Caller passes per-node outputs + rules; engine returns the
 * correlation signals.
 *
 * Stateless. The math is the truth — same pure function shipped
 * in @sovereign/inspector. CI pipelines hit this to verify the
 * correlation rules behave correctly against synthetic outputs.
 *
 * Body shape:
 *   {
 *     outputs: MeshNodeOutput[],
 *     rules: CorrelationRule[]
 *   }
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  correlateAcrossNodes,
  type MeshNodeOutput,
  type CorrelationRule,
} from "@/lib/perception/mesh";
import { applyRateLimit, rateLimitHeaders } from "@/lib/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  outputs?: unknown;
  rules?: unknown;
}

export async function POST(request: Request) {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const rate = await applyRateLimit("/api/_perception/correlate", { ip });
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
  if (!Array.isArray(body.outputs)) {
    return NextResponse.json(
      {
        error: "bad_request",
        details: "`outputs` must be an array of MeshNodeOutput",
      },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.rules)) {
    return NextResponse.json(
      {
        error: "bad_request",
        details: "`rules` must be an array of CorrelationRule",
      },
      { status: 400 },
    );
  }

  const signals = correlateAcrossNodes(
    body.outputs as MeshNodeOutput[],
    body.rules as CorrelationRule[],
  );

  return NextResponse.json(
    {
      signals,
      verifierNote:
        "Same pure function as @sovereign/inspector and " +
        "src/lib/perception/mesh.ts. Run locally to confirm.",
    },
    { status: 200 },
  );
}
