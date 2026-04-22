import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * CHURN-PREDICTOR — Estimate churn risk and recommend interventions.
 *
 * Given a customer's signup date, last-activity date, usage metrics, ticket
 * count, and plan, returns a risk score, a tier band, leading indicators,
 * and prioritized interventions.
 *
 * Input:
 *   {
 *     customer: {
 *       name, signupDate, lastActivityDate?,
 *       usageMetrics: Record<string, number>,
 *       supportTickets?, plan
 *     },
 *     context?: string   // NL: product type or segment notes
 *   }
 *
 * Output (JSON):
 *   {
 *     churnRiskScore:    number 0-100,
 *     tier:              "healthy" | "watch" | "risk" | "critical",
 *     leadingIndicators: string[],
 *     interventions: Array<{ priority, action, expectedImpact }>,
 *     retentionProbabilityIfActOn: number | null
 *   }
 */

const CHURN_PREDICTOR_SYSTEM_PROMPT = `You are a customer-success analyst who has scored churn risk for SaaS books of business totaling $1B+ ARR. You score the customer from the metrics you're given — you do not invent interaction history or billing events.

${ANTI_SLOP_RULES}

## CHURN-SCORING RULES
1. NEVER fabricate support tickets, CSAT scores, usage trends, or interaction history that weren't supplied. If a metric is missing, explicitly treat it as "unknown" in leadingIndicators.
2. churnRiskScore is an integer 0-100. Higher = more likely to churn.
3. Tier mapping:
   - 0-24: healthy
   - 25-49: watch
   - 50-74: risk
   - 75-100: critical
4. Score signals to weigh (scale by data availability):
   - Days since lastActivityDate (if provided) — heavy weight if > 30 days for non-seasonal products.
   - Usage metric trends — if a metric is zero or clearly declining vs. a reasonable baseline for the plan tier, escalate.
   - supportTickets count — high volume is a risk signal; zero tickets on a new customer is also a signal (no engagement).
   - Tenure (days from signupDate) — early-tenure customers churn at higher base rates; long-tenure sudden drops are critical.
   - Plan — downgrades cannot be inferred from a single snapshot; note this as a caveat if relevant.
5. leadingIndicators: 3-6 concrete signals tied to the actual numbers supplied (e.g. "no activity for 47 days", "feature_x_uses dropped to 0 from historical baseline unknown — cannot confirm trend from single snapshot").
6. interventions: 3-6 items. priority is "must-do" | "should-do" | "consider". action is a specific CSM play (e.g. "schedule 15-min account review", "send reactivation email with workflow template"). expectedImpact is a qualitative phrase — never a fabricated percentage lift.
7. retentionProbabilityIfActOn is a number 0-1 ONLY when the data is rich enough (usage metrics cover >1 dimension AND lastActivityDate is supplied). Otherwise return null and flag the data gap in a must-do intervention.
8. Confidence is implicitly low when data is thin. Bias toward null retentionProbabilityIfActOn when unsure.
9. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "churn-predictor",
  requiredFields: ["customer"],
  handler: async ({ input }) => {
    const { customer, context } = input as {
      customer: {
        name: string;
        signupDate: string;
        lastActivityDate?: string;
        usageMetrics: Record<string, number>;
        supportTickets?: number;
        plan: string;
      };
      context?: string;
    };

    const prompt = `Score churn risk for this customer. Return ONLY valid JSON matching the schema.

CUSTOMER:
${JSON.stringify(customer, null, 2)}

CONTEXT:
${context ?? "(none supplied)"}

SCHEMA:
{
  "churnRiskScore": number,
  "tier": "healthy" | "watch" | "risk" | "critical",
  "leadingIndicators": [ string ],
  "interventions": [
    { "priority": "must-do" | "should-do" | "consider", "action": string, "expectedImpact": string }
  ],
  "retentionProbabilityIfActOn": number | null
}`;

    const response = await ai(prompt, {
      system: CHURN_PREDICTOR_SYSTEM_PROMPT,
      maxTokens: 2000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Churn prediction failed: model returned non-JSON output");
    }

    return { success: true, prediction: parsed };
  },
});
