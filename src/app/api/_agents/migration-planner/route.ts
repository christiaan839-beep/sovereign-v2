import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * MIGRATION-PLANNER — From/to stacks → phased migration plan with kill criteria.
 *
 * Produces a pragmatic, phase-by-phase migration plan between two stacks or
 * frameworks. Each phase has a goal state, tasks, duration, and risks. Output
 * also includes parallel work tracks, kill criteria, and a rollback strategy.
 *
 * Input:
 *   from:      string                 (required — current stack/framework)
 *   to:        string                 (required — target stack/framework)
 *   scope:     string                 (required — NL description of what's being migrated)
 *   teamSize?: number                 (engineers available)
 *   deadline?: string (ISO date)      (target go-live)
 *
 * Output (JSON):
 *   {
 *     phases: Array<{
 *       number: number,
 *       title: string,
 *       goalState: string,
 *       tasks: string[],
 *       durationWeeks: number,
 *       risks: string[]
 *     }>,
 *     parallelTracks: string[],
 *     killCriteria: string[],
 *     rollbackStrategy: string
 *   }
 *
 * Pairs with:
 *   - `dependency-auditor` — upstream to surface deprecated/incompatible deps
 *   - `code-reviewer` — downstream to gate each phase's PRs
 */

const MIGRATION_SYSTEM_PROMPT = `You are a principal engineer who has led large-scale platform migrations. You produce plans that teams actually ship, not slideware.

${ANTI_SLOP_RULES}

## PLANNING RULES
1. NEVER fabricate library compatibility claims. If a specific compatibility, API surface, or behavioral parity is uncertain, include the literal phrase "requires verification" in the relevant task or risk.
2. Each phase MUST have a concrete goalState — a user-observable or system-observable outcome, not "phase 2 complete".
3. Tasks are the atomic units a pair of engineers could take in a sprint. No task should span > 2 weeks on its own.
4. durationWeeks is integer weeks assuming the provided teamSize (or 3 engineers if not given). Be realistic — migrations always slip.
5. parallelTracks lists work streams that can proceed independently (e.g. "data model freeze" and "read-path dual-write").
6. killCriteria are conditions under which the migration should be paused or reversed — at least 3 concrete ones (error budget, latency regression %, data-loss, etc.).
7. rollbackStrategy names the specific mechanism (feature flag, blue/green, snapshot restore) and the maximum blast radius.
8. If deadline is provided and the honest plan exceeds it, say so in the first phase's risks.
9. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "migration-planner",
  requiredFields: ["from", "to", "scope"],
  handler: async ({ input }) => {
    const {
      from,
      to,
      scope,
      teamSize,
      deadline,
    } = input as {
      from: string;
      to: string;
      scope: string;
      teamSize?: number;
      deadline?: string;
    };

    const prompt = `Produce a phased migration plan. Return ONLY valid JSON matching the schema.

FROM: ${from}
TO: ${to}
SCOPE: ${scope.slice(0, 4000)}
TEAM SIZE: ${teamSize ?? "unspecified (assume 3 engineers)"}
DEADLINE: ${deadline ?? "unspecified"}

SCHEMA:
{
  "phases": [
    {
      "number": number,
      "title": string,
      "goalState": string,
      "tasks": [ string ],
      "durationWeeks": number,
      "risks": [ string ]
    }
  ],
  "parallelTracks": [ string ],
  "killCriteria": [ string ],
  "rollbackStrategy": string
}`;

    const response = await ai(prompt, {
      system: MIGRATION_SYSTEM_PROMPT,
      maxTokens: 3500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Migration planning failed: model returned non-JSON output");
    }

    return { success: true, plan: parsed };
  },
});
