/**
 * GET /api/admin/eval[?windowDays=N&samplesPerAgent=N&agent=name]
 *
 * Admin-only — runs the heuristic eval harness against recent
 * agent_runs rows and returns the per-agent quality report.
 *
 * Auth: Clerk session + email allowlist.
 *
 * Caching: 300-second edge cache. Eval scans are heavy enough that
 * tighter polling burns DB cycles without operator benefit.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { computeEvalReport } from "@/lib/eval-harness";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-eval");

const ADMIN_EMAILS = new Set<string>([
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
]);

const limiter = rateLimit({ interval: 60, limit: 12 });

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

function clampPositive(
  raw: string | null,
  def: number,
  min: number,
  max: number,
): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
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
  const windowDays = clampPositive(
    url.searchParams.get("windowDays"),
    7,
    1,
    90,
  );
  const samplesPerAgent = clampPositive(
    url.searchParams.get("samplesPerAgent"),
    20,
    1,
    100,
  );
  const agentFilter = url.searchParams.get("agent")?.trim() || undefined;

  const report = await computeEvalReport({
    windowDays,
    samplesPerAgent,
    agentFilter,
  });

  return NextResponse.json(report, {
    headers: {
      "Cache-Control": "private, max-age=300, s-maxage=300",
    },
  });
}
