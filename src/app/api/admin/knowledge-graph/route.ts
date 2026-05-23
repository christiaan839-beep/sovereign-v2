/**
 * GET /api/admin/knowledge-graph?userId=<id>
 *
 * Admin-only — returns the per-user knowledge-graph summary
 * (node counts by type, top-degree nodes, total edge count).
 * The graph is built incrementally on every signed agent_run
 * via the Wave 145 recordRunAsGraph hook in agent-factory.
 */
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { summariseGraph } from "@/lib/knowledge-graph";

const log = createLogger("admin-knowledge-graph");

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

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json({ error: "admin-only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json(
      { error: "userId query param required" },
      { status: 400 },
    );
  }

  const topN = Math.min(
    Math.max(Number.parseInt(url.searchParams.get("top") ?? "", 10) || 25, 1),
    100,
  );

  const summary = await summariseGraph(userId, topN);
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "private, max-age=60, s-maxage=60" },
  });
}
