/**
 * SOVEREIGN MATRIX — /api/commerce/verify (Wave 18 — ACP verify).
 *
 * Public ACP envelope verifier. A merchant or payment processor
 * receives the envelope, POSTs the full payload here, and gets back
 * a structured pass/fail with the failure reason named.
 *
 * No auth required — the verifier is a public utility, exactly like
 * /api/auditor/replay. The math is the math; no privileged data is
 * disclosed beyond what's already in the envelope the caller holds.
 *
 * Wire:
 *   POST /api/commerce/verify
 *   { envelope: AcpEnvelope }
 *   → 200 { ok: true, envelope, verifiedAt }
 *   → 200 { ok: false, reason, verifiedAt }
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyAcpEnvelope } from "@/lib/agentic-commerce";

const limiter = rateLimit({ interval: 60, limit: 120 });

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  let body: { envelope?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON with an `envelope` field" },
      { status: 400 },
    );
  }
  if (!body.envelope || typeof body.envelope !== "object") {
    return NextResponse.json(
      { error: "envelope is required" },
      { status: 400 },
    );
  }

  // The verify function is pure — no DB, no network. Returns a tagged
  // union we forward to the caller.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = verifyAcpEnvelope(body.envelope as any);
  return NextResponse.json(result, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
