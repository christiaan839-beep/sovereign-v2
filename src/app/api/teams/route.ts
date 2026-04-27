import { NextResponse } from "next/server";
import { getAvailableTeams } from "@/lib/agent-teams";

/**
 * GET /api/teams — List pre-built agent teams (war-room, content-council, deal-room).
 * Public read-only endpoint so the dashboard picker can render.
 */
export async function GET() {
  return NextResponse.json({ teams: getAvailableTeams() });
}
