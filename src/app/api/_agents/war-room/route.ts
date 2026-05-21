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
  // Wave 117 M3 batch 12: memory hooks. Per-objective debate compounding
  // — past war-room verdicts on similar objectives let the team surface
  // which arguments held up vs which got revised, instead of re-running
  // the full debate from scratch.
  memory: {
    search: {
      query: (input) => {
        const obj = typeof input.objective === "string" ? input.objective : "";
        const team = typeof input.team === "string" ? input.team : "war-room";
        return `war-room ${team} ${obj.slice(0, 120)}`;
      },
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          objective?: string;
          verdict?: string;
          consensus?: string;
          confidence?: number;
        };
        if (!r.verdict && !r.consensus) return null;
        const head = (r.verdict ?? r.consensus ?? "")
          .slice(0, 220)
          .replace(/\s+/g, " ");
        return `verdict: ${head}${r.confidence ? ` (conf=${r.confidence})` : ""}`;
      },
      metadata: () => ({ kind: "war-room" }),
    },
  },
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
      agents: result.perspectives.map((p) => p.role),
    };
  },
});
