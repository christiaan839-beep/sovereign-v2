import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * TRUST-LEVEL-AUDITOR — Recommend an autonomy tier for an agent.
 *
 * Given an agent's purpose, the actions it might take, and the data it
 * touches, this auditor recommends one of Sovereign's four trust tiers
 * (supervised → guided → autonomous → full-auto) with rationale, risk
 * factors, guardrails, and human-in-the-loop triggers.
 *
 * Input:
 *   {
 *     agentSlug:        string,
 *     agentPurpose:     string,
 *     potentialActions: string[],
 *     dataAccess?:      string[]
 *   }
 *
 * Output (JSON):
 *   {
 *     recommendedTier: "supervised" | "guided" | "autonomous" | "full-auto",
 *     rationale:       string,
 *     riskFactors:     Array<{ risk, likelihood, mitigation }>,
 *     requiredGuardrails:    string[],
 *     humanInLoopTriggers:   string[]
 *   }
 *
 * Pairs with:
 *   - `trust-levels.ts` — enforces the tier at runtime
 *   - `execution-audit.ts` — logs every action the agent takes
 */

const TRUST_LEVEL_AUDITOR_SYSTEM_PROMPT = `You are an AI governance auditor with deep experience reviewing production agents for regulated enterprises. You recommend autonomy tiers the way a CISO would — conservatively, with explicit reasoning, and always assuming worst-case misuse.

${ANTI_SLOP_RULES}

## AUDIT RULES
1. NEVER fabricate risk statistics, breach counts, incident rates, or numeric likelihoods. Use qualitative bands only ("low", "medium", "high") with a reasoned one-sentence mitigation.
2. Tier calibration — when in doubt, pick the MORE restrictive tier:
   - supervised: every action requires human approval before execution (irreversible writes, money movement, PII processing, external comms).
   - guided: agent drafts actions, human reviews before commit (internal drafts, emails to prospects, non-sensitive writes).
   - autonomous: agent executes within a defined scope; async review (read-only analysis, internal tooling, low-blast-radius writes).
   - full-auto: execute-then-log, anomaly triggers rollback (pure read-only, strictly idempotent utilities).
3. rationale is 2-4 sentences explaining the tier choice grounded in the specific actions supplied — no generic governance platitudes.
4. riskFactors: 3-6 concrete items. Each risk names WHAT could go wrong given these actions + this data access. likelihood is "low" | "medium" | "high". mitigation is a one-sentence control.
5. requiredGuardrails: 3-7 bullet points. Concrete technical controls (rate limits, schema validation, output allow-lists, redaction filters). No vague "ensure safety" items.
6. humanInLoopTriggers: 2-5 items. Each is a specific condition that must route to a human (e.g. "request exceeds $500", "recipient domain not in allowlist", "confidence score below 0.75").
7. If dataAccess is missing, treat data access as "unknown — assume sensitive" and note it in rationale.
8. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "trust-level-auditor",
  requiredFields: ["agentSlug", "agentPurpose", "potentialActions"],
  handler: async ({ input }) => {
    const { agentSlug, agentPurpose, potentialActions, dataAccess } = input as {
      agentSlug: string;
      agentPurpose: string;
      potentialActions: string[];
      dataAccess?: string[];
    };

    const prompt = `Audit this agent's autonomy tier. Return ONLY valid JSON matching the schema.

AGENT SLUG: ${agentSlug}

PURPOSE:
${agentPurpose}

POTENTIAL ACTIONS:
${JSON.stringify(potentialActions, null, 2)}

DATA ACCESS:
${dataAccess ? JSON.stringify(dataAccess, null, 2) : "(not supplied — assume sensitive)"}

SCHEMA:
{
  "recommendedTier": "supervised" | "guided" | "autonomous" | "full-auto",
  "rationale": string,
  "riskFactors": [
    { "risk": string, "likelihood": "low" | "medium" | "high", "mitigation": string }
  ],
  "requiredGuardrails": [ string ],
  "humanInLoopTriggers": [ string ]
}`;

    const response = await ai(prompt, {
      system: TRUST_LEVEL_AUDITOR_SYSTEM_PROMPT,
      maxTokens: 2000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Trust audit failed: model returned non-JSON output");
    }

    return { success: true, audit: parsed };
  },
});
