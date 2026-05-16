/**
 * SOVEREIGN MATRIX — /api/agent-tokens/[id]/status (Wave 16)
 *
 * Public read-only token-status lookup. No auth required — the
 * answer is "is this token id active, expired, or revoked?" which
 * is the question a verifier needs to ask before honoring the JWT.
 *
 * Safe to expose: we never echo the signature, never echo the user id,
 * never echo tenant secrets. Only the agent slug + lifecycle state.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getTokenStatus } from "@/lib/agent-tokens";

const limiter = rateLimit({ interval: 60, limit: 120 });

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = await limiter.check(req);
  if (limited) return limited;
  const { id } = await params;
  if (!/^[0-9a-f-]{20,64}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const status = await getTokenStatus(id);
  if (!status.exists) {
    return NextResponse.json({ exists: false }, { status: 404 });
  }
  return NextResponse.json(status, {
    headers: { "cache-control": "public, max-age=10" },
  });
}
