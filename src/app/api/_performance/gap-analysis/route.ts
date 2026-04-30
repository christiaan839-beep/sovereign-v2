/**
 * POST /api/performance/gap-analysis
 *
 * PUBLIC, no-auth, rate-limited gap-analysis evaluator. Caller passes
 * a target id + history of results; engine returns a procurement-
 * readable gap report (status + drift + linear time-to-target +
 * reproducibility flag).
 *
 * Stateless. Same pure function shipped in @sovereign/inspector. CI
 * pipelines hit this to verify that their target trajectory is
 * tracking properly.
 *
 * Body:
 *   {
 *     targetId: string,
 *     history: BenchmarkResult[],
 *     asOf?: string (ISO 8601)
 *   }
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  findTargetById,
  gapReport,
  type BenchmarkResult,
} from "@/lib/performance";
import { applyRateLimit, rateLimitHeaders } from "@/lib/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  targetId?: unknown;
  history?: unknown;
  asOf?: unknown;
}

export async function POST(request: Request) {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const rate = await applyRateLimit("/api/_performance/gap-analysis", { ip });
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

  if (typeof body.targetId !== "string") {
    return NextResponse.json(
      { error: "bad_request", details: "`targetId` (string) is required" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.history)) {
    return NextResponse.json(
      {
        error: "bad_request",
        details: "`history` must be an array of BenchmarkResult",
      },
      { status: 400 },
    );
  }

  const target = findTargetById(body.targetId);
  if (!target) {
    return NextResponse.json(
      {
        error: "bad_request",
        details: `target ${body.targetId} not in registry`,
      },
      { status: 400 },
    );
  }

  const asOf =
    typeof body.asOf === "string" ? new Date(body.asOf) : new Date();

  const report = gapReport({
    target,
    history: body.history as BenchmarkResult[],
    asOf,
  });

  return NextResponse.json(
    {
      report,
      verifierNote:
        "Same pure function as @sovereign/inspector and src/lib/performance/gap-analysis.ts. Linear extrapolation is least-squares on (days-since-epoch, measured value) — replayable offline.",
    },
    { status: 200 },
  );
}
