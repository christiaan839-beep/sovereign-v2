/**
 * GET /api/admin/merkle-root[?date=YYYY-MM-DD]
 *
 * Returns the daily Merkle root + leaf count for the requested UTC
 * day (defaults to yesterday). Admin-gated like the rest of the
 * /api/admin/* surface.
 *
 * Once an operator publishes the root (Git release / IPFS / Twitter),
 * anyone holding a receipt for that day can verify membership
 * without trusting Sovereign's servers — see
 * `src/lib/merkle-receipts.ts` for the verifier.
 */
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { buildDailyRoot } from "@/lib/merkle-receipts";

const log = createLogger("admin-merkle-root");

const ADMIN_EMAILS = new Set<string>([
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
]);

const limiter = rateLimit({ interval: 60, limit: 30 });

async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    return ADMIN_EMAILS.has(email);
  } catch (err) {
    log.warn("admin check failed", { error: String(err) });
    return false;
  }
}

function parseDate(raw: string | null): Date {
  if (!raw) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  }
  const yr = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10) - 1;
  const dy = Number.parseInt(m[3], 10);
  return new Date(Date.UTC(yr, mo, dy));
}

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json({ error: "admin-only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dateParam = parseDate(url.searchParams.get("date"));
  const summary = await buildDailyRoot(dateParam);

  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "private, max-age=300, s-maxage=300",
    },
  });
}
