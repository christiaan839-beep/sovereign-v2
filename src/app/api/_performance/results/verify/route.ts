/**
 * POST /api/performance/results/verify
 *
 * PUBLIC, no-auth, rate-limited result-verifier. Caller passes a
 * `BenchmarkResult`; engine validates against the target's structural
 * rules + returns either an attestation skeleton (ready for the
 * platform to sign) or a procurement-readable rejection.
 *
 * THIS ENDPOINT DOES NOT SIGN. Signing requires the platform's
 * Ed25519 key (R44 getPlatformSigningKey) and lives in the runtime
 * adapter. This endpoint validates the SHAPE of a candidate
 * attestation and returns the canonical message that would be
 * signed.
 *
 * Procurement use case: "I have a benchmark result from my own
 * harness — would Sovereign accept it as valid?" Run the math,
 * confirm offline.
 *
 * Body:
 *   {
 *     result: BenchmarkResult,
 *     attestedAt?: string  (ISO 8601; defaults to now)
 *   }
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  findTargetById,
  validateBenchmarkResult,
  buildBenchmarkAttestationMessage,
  type BenchmarkResult,
} from "@/lib/performance";
import { applyRateLimit, rateLimitHeaders } from "@/lib/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  result?: unknown;
  attestedAt?: unknown;
}

export async function POST(request: Request) {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const rate = await applyRateLimit("/api/_performance/results/verify", {
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

  if (!body.result || typeof body.result !== "object") {
    return NextResponse.json(
      {
        error: "bad_request",
        details: "`result` (BenchmarkResult) is required",
      },
      { status: 400 },
    );
  }

  const result = body.result as BenchmarkResult;
  if (!result.targetId) {
    return NextResponse.json(
      {
        error: "bad_request",
        details: "`result.targetId` is required",
      },
      { status: 400 },
    );
  }

  const target = findTargetById(result.targetId);
  const validation = validateBenchmarkResult({ result, target });

  if (!validation.ok) {
    return NextResponse.json(
      {
        accepted: false,
        validation,
        verifierNote:
          "Same pure function as @sovereign/inspector and src/lib/performance/.",
      },
      { status: 200 },
    );
  }

  // target is non-undefined when validation.ok (validateBenchmarkResult
  // returns target_not_found otherwise).
  const attestedAt =
    typeof body.attestedAt === "string"
      ? body.attestedAt
      : new Date().toISOString();
  const message = buildBenchmarkAttestationMessage({
    target: target!,
    result,
    attestedAt,
  });

  return NextResponse.json(
    {
      accepted: true,
      target,
      attestationMessage: message,
      attestedAt,
      verifierNote:
        "The result conforms to all structural rules. To produce a signed attestation, the runtime adapter signs `attestationMessage` with the platform's Ed25519 key (R44 getPlatformSigningKey).",
    },
    { status: 200 },
  );
}
