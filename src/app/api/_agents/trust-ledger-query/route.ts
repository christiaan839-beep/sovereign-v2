import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * TRUST-LEDGER-QUERY — NL questions → parameterized SQL over the audit trail.
 *
 * Input:
 *   { question: string, timeRange?: { start: string, end: string } }
 *
 * Output (JSON):
 *   {
 *     sql: string,
 *     explanation: string,
 *     estimatedRows: number|null,
 *     tablesAccessed: string[]
 *   }
 *
 * A2E moat agent: gives trust & safety teams natural-language access to
 * the tamper-evident execution ledger.
 */

const TRUST_LEDGER_SYSTEM_PROMPT = `You are a trust & safety analyst. You translate plain-English questions about agent runs, verifications, and trust decisions into safe, parameterized SQL.

${ANTI_SLOP_RULES}

## AVAILABLE TABLES
- execution_audit — every agent action. Columns: id, tenant_id, agent_slug, action, actor_user_id, ip, input_hash, output_hash, verified_layers, trust_decision, created_at.
- playbook_runs — orchestrated multi-agent runs. Columns: id, tenant_id, playbook_slug, status, started_at, finished_at, total_duration_ms, error.
- agent_stats_daily — rolled-up daily stats. Columns: day, tenant_id, agent_slug, runs, successes, failures, avg_duration_ms, avg_quality_score.

## QUERY RULES
1. SELECT only. NEVER emit INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, or CREATE. If the user asks for a mutation, refuse in explanation and return an empty sql string.
2. Use parameterized placeholders ($1, $2, ...) for any user-supplied value. If a timeRange is given, wire it to $1/$2.
3. Always include a tenant_id filter when the question scopes to the caller's own data — assume $tenant is injected at the infrastructure layer and use placeholder $tenant.
4. estimatedRows is your best guess based on the filters (null if truly unknown).
5. tablesAccessed lists every table referenced in the FROM/JOIN clauses.
6. explanation describes what the query returns in one sentence.
7. Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "trust-ledger-query",
  requiredFields: ["question"],
  handler: async ({ input }) => {
    const { question, timeRange } = input as {
      question: string;
      timeRange?: { start: string; end: string };
    };

    const prompt = `Translate this trust & safety question into safe SQL. Return ONLY valid JSON.

QUESTION:
"""
${question.slice(0, 4_000)}
"""

TIME RANGE: ${timeRange ? JSON.stringify(timeRange) : "none supplied — omit time filter unless implied by the question"}

SCHEMA:
{
  "sql": string,
  "explanation": string,
  "estimatedRows": number|null,
  "tablesAccessed": [ string ]
}`;

    const response = await ai(prompt, {
      system: TRUST_LEDGER_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Trust ledger query failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
