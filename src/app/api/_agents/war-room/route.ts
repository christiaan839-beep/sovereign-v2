import { auth } from "@clerk/nextjs/server";
import { createAgentRoute } from "@/lib/agent-factory";
import { runAgentTeam, getAvailableTeams } from "@/lib/agent-teams";

/**
 * WAR ROOM — Multi-agent debate and synthesis.
 *
 * Deploys a team of specialized agents that analyze independently,
 * debate adversarially, and synthesize a unified battle plan.
 *
 * POST /api/agents/war-room
 *   { objective: "Analyze competitor HubSpot", team?: "war-room" | "content-council" | "deal-room" }
 */
export const POST = createAgentRoute({
  name: "war-room",
  requiredFields: ["objective"],
  handler: async ({ input }) => {
    const objective = input.objective as string;
    const team = (input.team as string) || "war-room";
    const context = input.context as string | undefined;

    // If user asks for available teams, return the list
    if (objective === "list-teams") {
      return { teams: getAvailableTeams() };
    }

    const result = await runAgentTeam({ objective, team, context });

    return {
      team: result.team,
      objective: result.objective,
      perspectives: result.perspectives,
      debateRounds: result.debate.length,
      synthesis: result.synthesis,
      confidence: result.confidence,
      duration: `${result.duration}ms`,
      agents: result.perspectives.map(p => p.role),
    };
  },
});
