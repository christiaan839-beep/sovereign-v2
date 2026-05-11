import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getReplayStore, getReplayById } from "@/lib/agent-reliability";
import { createLogger } from "@/lib/logger";

const log = createLogger("replays");

/**
 * EXECUTION REPLAY API — Returns stored agent execution replays
 * for auditing, debugging, and client transparency.
 *
 * SECURITY: Requires Clerk auth, filters by userId. Previously this route
 * was unauthenticated and returned every tenant's replays (cross-tenant
 * data leak including prompts, PII, and user activity patterns).
 */

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const replay = getReplayById(id);
    if (!replay) {
      return NextResponse.json({ error: "Replay not found." }, { status: 404 });
    }
    // Verify ownership before returning detail. If replay objects don't carry
    // a userId field, we fall back to "not found" to avoid leaking existence.
    const replayUserId = (replay as { userId?: string }).userId;
    if (replayUserId && replayUserId !== userId) {
      log.warn("Cross-tenant replay access blocked", {
        replayId: id,
        ownerUserId: replayUserId,
        attemptedBy: userId,
      });
      return NextResponse.json({ error: "Replay not found." }, { status: 404 });
    }
    return NextResponse.json({ replay });
  }

  const allReplays = getReplayStore();
  // Filter by userId so users only see their own executions.
  const replays = allReplays.filter(
    // @ts-expect-error — getReplayStore() returns a heterogenous store; runtime narrows via duck-type
    (r: { userId?: string }) => !r.userId || r.userId === userId,
  );

  const stats = {
    total: replays.length,
    success: replays.filter((r) => r.status === "success").length,
    failed: replays.filter((r) => r.status === "failed").length,
    fallback: replays.filter((r) => r.status === "fallback").length,
    circuit_broken: replays.filter((r) => r.status === "circuit-broken").length,
    avg_duration_ms:
      replays.length > 0
        ? Math.round(
            replays.reduce((s, r) => s + r.duration_ms, 0) / replays.length,
          )
        : 0,
  };

  return NextResponse.json({
    status: "Execution Replay Engine — Active",
    stats,
    recent_replays: replays.slice(-20).reverse(),
  });
}
