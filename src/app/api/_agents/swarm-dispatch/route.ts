/**
 * SOVEREIGN MATRIX — Swarm Dispatch (Wave 119).
 *
 * Wires `src/lib/swarm-protocol.ts` (299 LOC, previously zero callers
 * per BACKLOG) into a real, factory-wrapped agent. The platform now has
 * a public, auth-gated, audit-logged way to fan an objective out to N
 * registered agents in parallel and apply a consensus mechanism over
 * their outputs.
 *
 * This is the agent-to-agent dispatch primitive the marketing claim of
 * "multi-agent OS with parallel fan-out" requires runtime backing for.
 *
 * Tools available downstream:
 *   - `claudeToolUse` agents can declare swarm-dispatch as a tool to
 *     decompose hard problems into parallel sub-investigations.
 *   - `dag-executor` playbooks can use it as a single merge-node step
 *     where the synthesis is best/merge/vote/debate (instead of
 *     hand-writing the merge as smart-router prompt boilerplate).
 *
 * Input (Zod-validated):
 *   {
 *     goal: string,                    // what the swarm is attacking
 *     agents: string[] | object[],     // 2-8 registered agent slugs
 *     consensus?: "best" | "merge" | "vote" | "debate"
 *     minAgentsRequired?: number,      // hard floor before consensus runs
 *     timeoutMs?: number               // per-swarm wall clock (default 60s)
 *   }
 *
 * Safety envelope (inherited from createAgentRoute factory):
 *   - Rate limit + jailbreak detect + content safety on `goal`
 *   - Per-user memory hooks (cross-task panel-composition compounding)
 *   - Signed receipt on the swarm result
 *   - 5-layer output verifier on `finalOutput`
 *   - Per-step calls go through the AGENT factory recursively, so each
 *     sub-agent inherits the same envelope. Defense in depth.
 *
 * Hard limits (defense vs runaway fan-out):
 *   - Min 2 / max 8 agents — too few = degenerate, too many = blast
 *     radius (8 × per-agent budget = 480s default wall clock, capped
 *     here at totalTimeoutMs which the factory enforces too).
 *   - Reject unknown agent slugs at validation time so a typo doesn't
 *     burn the budget on a 404 cascade.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { executeSwarm, type ConsensusMode } from "@/lib/swarm-protocol";
import { AGENT_SLUGS } from "@/lib/agent-slugs";

const CONSENSUS_MODES = ["best", "merge", "vote", "debate"] as const;

const KNOWN_SLUGS = new Set<string>(AGENT_SLUGS);

const agentSpec = z.union([
  z.string().min(1).max(80),
  z.object({
    name: z.string().min(1).max(80),
    params: z.record(z.string(), z.unknown()).optional(),
  }),
]);

const schema = z
  .object({
    goal: z.string().min(8, "Goal must be at least 8 characters").max(2000),
    agents: z
      .array(agentSpec)
      .min(2, "Swarm needs at least 2 agents to produce consensus")
      .max(8, "Swarm capped at 8 agents to bound fan-out blast radius"),
    consensus: z.enum(CONSENSUS_MODES).optional().default("merge"),
    minAgentsRequired: z.number().int().min(1).max(8).optional().default(1),
    timeoutMs: z
      .number()
      .int()
      .min(5_000)
      .max(120_000)
      .optional()
      .default(60_000),
    prompt: z.string().optional(),
  })
  .refine(
    (d) =>
      d.agents.every((a) => {
        const name = typeof a === "string" ? a : a.name;
        return KNOWN_SLUGS.has(name);
      }),
    {
      message:
        "Every agent in the swarm must be a registered slug — see /agents for the public list.",
    },
  )
  .refine((d) => d.minAgentsRequired <= d.agents.length, {
    message: "minAgentsRequired cannot exceed the number of agents supplied.",
  });

export const POST = createAgentRoute({
  name: "swarm-dispatch",
  schema,
  // Memory hooks — per-goal-class panel composition history compounds.
  // The model can favour proven swarms over fresh combinations.
  memory: {
    search: {
      query: (input) =>
        `swarm-dispatch ${String(input.goal ?? "").slice(0, 120)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          consensus?: ConsensusMode;
          confidence?: number;
          agentsUsed?: string[];
          agentsSucceeded?: number;
          agentsFailed?: number;
        };
        if (!r.agentsUsed?.length) return null;
        const panel = r.agentsUsed.slice(0, 6).join(", ");
        return `swarm[${r.consensus ?? "?"}] panel=[${panel}] ok=${r.agentsSucceeded ?? "?"}/${(r.agentsSucceeded ?? 0) + (r.agentsFailed ?? 0)} conf=${r.confidence ?? "?"}`;
      },
      metadata: () => ({ kind: "swarm-dispatch" }),
    },
  },
  handler: async ({ input }) => {
    const parsed = schema.parse(input);

    // Normalize the mixed-shape Zod array into the discriminated shape
    // executeSwarm expects (all-string OR all-object). Wrapping every
    // string in `{ name }` is the cheapest way to satisfy both branches.
    const normalisedAgents = parsed.agents.map((a) =>
      typeof a === "string" ? { name: a } : { name: a.name, params: a.params },
    );

    const result = await executeSwarm({
      goal: parsed.goal,
      agents: normalisedAgents,
      consensus: parsed.consensus,
      minAgentsRequired: parsed.minAgentsRequired,
      timeoutMs: parsed.timeoutMs,
    });

    // Tag agentsUsed onto the response so the memory extractor + downstream
    // observability tools have it without re-parsing agentOutputs.
    const agentsUsed = result.agentOutputs.map((o) => o.agent);

    return {
      goal: result.goal,
      consensus: result.consensus,
      output: result.finalOutput,
      confidence: result.confidence,
      agentsUsed,
      agentsSucceeded: result.agentsSucceeded,
      agentsFailed: result.agentsFailed,
      totalDurationMs: result.totalDurationMs,
      // Trim per-agent outputs so the wave-119 signed receipt stays bounded.
      perAgent: result.agentOutputs.map((o) => ({
        agent: o.agent,
        success: o.success,
        quality: o.quality,
        durationMs: o.durationMs,
        output: o.success ? o.output.slice(0, 1500) : undefined,
        error: o.success ? undefined : o.error,
      })),
    };
  },
});
