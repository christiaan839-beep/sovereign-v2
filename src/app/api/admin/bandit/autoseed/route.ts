/**
 * POST /api/admin/bandit/autoseed
 *
 * Discovers (agent × model) pairs from recent agent_runs history
 * and auto-seeds Beta(1,1) bandit arms for any pair not already
 * registered. Eliminates the manual `POST /api/admin/bandit` step.
 *
 * Body: { windowDays?, minSamples? } — both optional.
 * Admin-gated.
 */
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { runAutoSeed } from "@/lib/bandit-autoseed";

const log = createLogger("admin-bandit-autoseed");

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

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json({ error: "admin-only" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const windowDays =
    typeof body.windowDays === "number" ? body.windowDays : undefined;
  const minSamples =
    typeof body.minSamples === "number" ? body.minSamples : undefined;

  const summary = await runAutoSeed({ windowDays, minSamples });
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store" },
  });
}

// Vercel Cron friendly — GET also works
export const GET = POST;
