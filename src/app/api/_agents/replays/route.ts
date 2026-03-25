import { NextResponse } from "next/server";
import { getReplayStore, getReplayById } from "@/lib/agent-reliability";

/**
 * EXECUTION REPLAY API — Returns stored agent execution replays
 * for auditing, debugging, and client transparency.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const replay = getReplayById(id);
    if (!replay) {
      return NextResponse.json({ error: "Replay not found." }, { status: 404 });
    }
    return NextResponse.json({ replay });
  }

  const replays = getReplayStore();
  const stats = {
    total: replays.length,
    success: replays.filter(r => r.status === "success").length,
    failed: replays.filter(r => r.status === "failed").length,
    fallback: replays.filter(r => r.status === "fallback").length,
    circuit_broken: replays.filter(r => r.status === "circuit-broken").length,
    avg_duration_ms: replays.length > 0
      ? Math.round(replays.reduce((s, r) => s + r.duration_ms, 0) / replays.length)
      : 0,
  };

  return NextResponse.json({
    status: "Execution Replay Engine — Active",
    stats,
    recent_replays: replays.slice(-20).reverse(),
  });
}
