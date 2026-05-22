/**
 * GET /api/admin/cohorts[?windowDays=N]
 *
 * Admin-only — returns the per-tenant cohort report from agent_runs.
 * Used by the /dashboard/admin/cohorts page.
 *
 * Auth: Clerk session + email allowlist via isAdmin(). Anyone else
 * gets 403. Public diligence numbers live at /api/status/metrics
 * and /api/status/metrics/extended — cohort data is operator-only
 * because it identifies users by Clerk id.
 *
 * Caching: 60-second edge cache. The underlying agent_runs scan is
 * not cheap; tighter polling is wasted DB cycles. Admin UI polls at
 * the same cadence on the page.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { computeCohorts } from "@/lib/cohort-analytics";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-cohorts");

const ADMIN_EMAILS = new Set<string>([
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
]);

const limiter = rateLimit({ interval: 60, limit: 60 });

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

function clampWindow(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return 90;
  return Math.min(Math.max(n, 7), 365);
}

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "admin-only" },
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = new URL(req.url);
  const windowDays = clampWindow(url.searchParams.get("windowDays"));

  const report = await computeCohorts(windowDays);

  return NextResponse.json(report, {
    headers: {
      "Cache-Control": "private, max-age=60, s-maxage=60",
    },
  });
}
