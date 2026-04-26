import { NextResponse } from "next/server";
import { withMetering } from "@/lib/metered-endpoint";
import { runAgentTeam, getAvailableTeams } from "@/lib/agent-teams";
import { z } from "zod";

const TEAM_KEYS = getAvailableTeams().map((t) => t.key) as [
  string,
  ...string[],
];

const RUN_SCHEMA = z.object({
  team: z.enum(TEAM_KEYS),
  objective: z.string().min(10).max(4000),
  context: z.string().max(8000).optional(),
});

/**
 * POST /api/teams/run — Execute a multi-agent team debate + synthesis.
 * Metered (one team run = one quota unit). Cost-controlled by P3:
 * parallel analyses on Cerebras, debate rounds on NIM, only synthesis on Gemini.
 */
export const POST = withMetering("teams-run", async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const parsed = RUN_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { team, objective, context } = parsed.data;

  const result = await runAgentTeam({
    objective,
    team: team as Parameters<typeof runAgentTeam>[0]["team"],
    context,
  });

  return NextResponse.json({ success: true, result });
});
