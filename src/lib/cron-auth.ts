import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Verify a Vercel Cron / external trigger request.
 *
 * Returns null when authorized, or a 401 NextResponse when denied.
 * Fails CLOSED: if CRON_SECRET is unset, every request is rejected.
 * Uses timingSafeEqual to prevent length-oracle timing attacks.
 */
export function verifyCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { error: "Unauthorized", reason: "CRON_SECRET not configured" },
      { status: 401 },
    );
  }

  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;

  // Pad to equal length so timingSafeEqual doesn't throw on mismatch.
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Run a dummy compare so the code path takes constant time regardless.
    timingSafeEqual(b, b);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
