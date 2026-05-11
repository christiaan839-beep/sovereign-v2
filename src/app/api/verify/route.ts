/**
 * POST /api/verify — public signature verifier.
 *
 * Lets ANY third party (auditor, customer's compliance team, regulator)
 * confirm that an agent receipt is authentic, without ever needing access
 * to the signing key. The flow:
 *
 *   1. Reader fetches /api/agent-runs/[id] → gets `canonical` + `signature`
 *   2. Reader POSTs both to /api/verify
 *   3. Server recomputes HMAC-SHA256 over `canonical` and constant-time
 *      compares against `signature`
 *   4. Returns `{ valid: true|false }` + the agent name + timestamp
 *
 * This is the moat. No agent SaaS today lets a third party verify
 * an output cryptographically. We do — and the verifier itself is
 * server-bounded so the secret never leaves.
 *
 * Public endpoint (no auth) by design — verification is meant to be
 * a public good. Rate-limited at 60 req/min per IP to prevent abuse.
 */
import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/agent-runs";
import { rateLimit } from "@/lib/rate-limit";

const MAX_CANONICAL_BYTES = 32_000;

// `interval` is SECONDS (the rate-limit lib multiplies by 1000 internally).
// Bug history: this used to pass 60_000 by mistake, which made the bucket
// key roll over every ~16 hours — effectively no rate limiting against
// the abuse pattern this guards against. Don't change without reading
// src/lib/rate-limit.ts:46.
const limiter = rateLimit({ interval: 60, limit: 60 });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  // Rate limit by IP — prevents the verifier itself becoming a DoS surface
  const limited = await limiter.check(req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const { canonical, signature } = (body ?? {}) as {
    canonical?: unknown;
    signature?: unknown;
  };

  if (typeof canonical !== "string" || typeof signature !== "string") {
    return NextResponse.json(
      { error: "Both `canonical` and `signature` must be strings" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (canonical.length === 0 || canonical.length > MAX_CANONICAL_BYTES) {
    return NextResponse.json(
      {
        error: `canonical length must be in (0, ${MAX_CANONICAL_BYTES}]`,
      },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const valid = verifySignature(canonical, signature);

  // Surface a few fields from the canonical projection so callers
  // see what they verified, without re-parsing on the client.
  let agentName: string | undefined;
  let createdAt: string | undefined;
  let id: string | undefined;
  try {
    const parsed = JSON.parse(canonical) as Record<string, unknown>;
    if (typeof parsed.agentName === "string") agentName = parsed.agentName;
    if (typeof parsed.createdAt === "string") createdAt = parsed.createdAt;
    if (typeof parsed.id === "string") id = parsed.id;
  } catch {
    // Non-JSON canonical is acceptable — verify still works on raw strings.
  }

  return NextResponse.json(
    {
      valid,
      id,
      agentName,
      createdAt,
      algorithm: "HMAC-SHA256",
      canonicalVersion: 1,
    },
    { headers: CORS_HEADERS },
  );
}
