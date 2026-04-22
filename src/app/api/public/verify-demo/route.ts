/**
 * POST /api/public/verify-demo
 *
 * Runs the real 5-layer Sovereign Matrix output verifier
 * (jailbreak → PII → content → quality → critic) against user-submitted
 * text and returns a per-layer pass/fail report for the landing v2
 * Verification section (§05).
 *
 * Why this one DOES invoke the real pipeline (unlike router-demo):
 *   - LlamaGuard runs at ~$0.0001 per call via NIM.
 *   - PII + content + quality checks are zero-cost regex/heuristics.
 *   - At 5 calls/hour/IP rate limit, worst-case cost per IP is
 *     $0.0005/hr — negligible.
 *   - The demonstrated VALUE is the actual verification running on
 *     the visitor's own input, not a canned example.
 *
 * Request:  { text: string }    (1-500 chars)
 * Response: {
 *   approved: boolean,
 *   layers: Array<{ name, passed, reason? }>,
 *   totalMs: number,
 *   blockReason?: string,
 * }
 *
 * Rate limit: 5/hour/IP via public-verify-demo rule.
 * Cache-Control: no-store (every verification is input-dependent).
 * Never 500s; 400 on input issues, 503 on verifier failure.
 *
 * Audit: every call is logged to the execution-audit trail with
 * agentName="public-verify-demo" so we have a record of demo usage
 * patterns (useful for abuse detection). Tenant id is the public
 * demo user id.
 */

import { NextResponse } from "next/server";
import { verifyOutput } from "@/lib/output-verifier";
import { PUBLIC_DEMO_USER_ID } from "@/lib/tenant-scope";

interface LayerResult {
  name: string;
  passed: boolean;
  reason?: string;
}

export async function POST(request: Request): Promise<Response> {
  let textValue: string;
  try {
    const body = (await request.json()) as { text?: unknown };
    if (typeof body.text !== "string") {
      return NextResponse.json(
        { error: "text must be a string" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    textValue = body.text.trim();
  } catch {
    return NextResponse.json(
      { error: "invalid json body" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (textValue.length < 1 || textValue.length > 500) {
    return NextResponse.json(
      { error: "text must be 1–500 characters" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const start = Date.now();
    const result = await verifyOutput({
      agentName: "public-verify-demo",
      modelUsed: "user-submission",
      tenantId: PUBLIC_DEMO_USER_ID,
      prompt: "(public demo — no agent prompt)",
      output: textValue,
    });
    const totalMs = Date.now() - start;

    const safety = result.safetyResult;
    const layers: LayerResult[] = [
      {
        name: "jailbreak",
        passed: safety.jailbreak === "pass",
        reason: safety.jailbreak === "fail" ? result.blockReason : undefined,
      },
      {
        name: "pii",
        passed: safety.pii === "pass",
        reason: safety.pii === "fail" ? "PII pattern detected (email/phone/SSN/credit-card)" : undefined,
      },
      {
        name: "content",
        passed: safety.content === "pass",
        reason: safety.content === "fail" ? result.blockReason : undefined,
      },
      {
        name: "quality",
        passed: typeof safety.quality === "number" ? safety.quality >= 40 : true,
        reason:
          typeof safety.quality === "number" && safety.quality < 40
            ? `Quality score ${safety.quality}/100 below threshold 40`
            : undefined,
      },
      {
        name: "critic",
        passed: safety.critic === "pass",
        reason: safety.critic === "fail" ? "Critic flagged output quality" : undefined,
      },
    ];

    return NextResponse.json(
      {
        approved: result.approved,
        layers,
        totalMs,
        blockReason: result.blockReason,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/public/verify-demo] failed", err);
    return NextResponse.json(
      { error: "verifier temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
