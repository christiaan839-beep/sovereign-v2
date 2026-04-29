/**
 * POST /api/control-plane/policy/evaluate
 *
 * PUBLIC, no-auth, rate-limited live policy evaluator. Procurement
 * teams hit this from CI to verify their policies behave correctly
 * before deploying.
 *
 * Same pure function shipped in @sovereign/inspector and
 * src/lib/control-plane/policy-engine.ts. Two paths to verification,
 * identical answers.
 *
 * Body shape:
 *   {
 *     policies: PolicyRule[],
 *     context: PolicyContext
 *   }
 *
 * Returns:
 *   200 { decision }
 *   400 { error: "bad_request", details }
 *   429 { error: "rate_limited" }
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  evaluatePolicies,
  type PolicyRule,
  type PolicyContext,
} from "@/lib/control-plane/policy-engine";
import { applyRateLimit, rateLimitHeaders } from "@/lib/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  policies?: unknown;
  context?: unknown;
}

export async function POST(request: Request) {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const rate = await applyRateLimit("/api/_control-plane/policy/evaluate", {
    ip,
  });
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
  if (!Array.isArray(body.policies)) {
    return NextResponse.json(
      {
        error: "bad_request",
        details: "`policies` must be an array of PolicyRule",
      },
      { status: 400 },
    );
  }
  if (!body.context || typeof body.context !== "object") {
    return NextResponse.json(
      { error: "bad_request", details: "`context` (PolicyContext) is required" },
      { status: 400 },
    );
  }

  // Defensive — caller may pass `now` as ISO string or omit.
  const ctx = body.context as PolicyContext;
  const rawNow = (ctx as unknown as { now?: unknown }).now;
  const normalizedCtx: PolicyContext = {
    ...ctx,
    now: typeof rawNow === "string" ? new Date(rawNow) : ctx.now,
  };

  const decision = evaluatePolicies(
    body.policies as PolicyRule[],
    normalizedCtx,
  );

  return NextResponse.json(
    {
      decision,
      verifierNote:
        "Same pure function as @sovereign/inspector and " +
        "src/lib/control-plane/policy-engine.ts. Run locally to confirm.",
    },
    { status: 200 },
  );
}
