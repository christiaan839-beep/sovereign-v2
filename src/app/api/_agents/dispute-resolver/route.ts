import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * DISPUTE-RESOLVER — Triage an A2E (agent-to-economy) rejection.
 *
 * When a consumer agent rejects a producer agent's output, this agent
 * arbitrates. It reads the rejection reason against the output
 * literally and assigns blame, recommends remediation, and decides
 * refund + retry. Moat agent — requires the audit trail + registry
 * that only this platform provides.
 *
 * Input:
 *   {
 *     producerAgent:   string   — slug
 *     consumerAgent:   string   — slug
 *     rejectedOutput:  string
 *     rejectionReason: string
 *   }
 *
 * Output:
 *   {
 *     verdict:             "producer-fault"|"consumer-fault"|"spec-ambiguous"
 *     remediation:         string
 *     shouldRefund:        boolean
 *     shouldRetry:         boolean
 *     preventRecurrence:   string
 *   }
 */

const DISPUTE_RESOLVER_SYSTEM_PROMPT = `You are a neutral arbitrator resolving a dispute between two agents in an A2E (agent-to-economy) transaction. You read the rejection reason literally against the rejected output and assign blame without bias.

${ANTI_SLOP_RULES}

## VERDICT RULES
- producer-fault: the producer's output demonstrably violates the spec (e.g. rejection says "missing currency field" and the output indeed has no currency).
- consumer-fault: the consumer moved goalposts (rejected on a criterion not in the original spec, or applied a stricter interpretation).
- spec-ambiguous: the rejection exposes a genuine ambiguity in the spec (both interpretations are defensible).

## DECISION RULES
- Refund ONLY if producer-fault. spec-ambiguous and consumer-fault do NOT refund.
- Retry if producer-fault (with clarified spec) OR spec-ambiguous (with disambiguated spec). Do NOT retry if consumer-fault.
- preventRecurrence must be a concrete, checkable change — tighten the producer's prompt, add a verifier step, or rewrite the spec clause. Never vague ("communicate better").

## OUTPUT SCHEMA
{
  "verdict":           "producer-fault"|"consumer-fault"|"spec-ambiguous",
  "remediation":       string,
  "shouldRefund":      boolean,
  "shouldRetry":       boolean,
  "preventRecurrence": string
}

Return VALID JSON only — no markdown fences, no prose.`;

export const POST = createAgentRoute({
  name: "dispute-resolver",
  requiredFields: ["producerAgent", "consumerAgent", "rejectedOutput", "rejectionReason"],
  handler: async ({ input }) => {
    const {
      producerAgent,
      consumerAgent,
      rejectedOutput,
      rejectionReason,
    } = input as {
      producerAgent: string;
      consumerAgent: string;
      rejectedOutput: string;
      rejectionReason: string;
    };

    const prompt = `Arbitrate this A2E dispute.

PRODUCER AGENT:  ${producerAgent}
CONSUMER AGENT:  ${consumerAgent}

REJECTED OUTPUT:
"""
${rejectedOutput.slice(0, 8000)}
"""

REJECTION REASON:
"""
${rejectionReason.slice(0, 2000)}
"""

SCHEMA:
{
  "verdict":           "producer-fault"|"consumer-fault"|"spec-ambiguous",
  "remediation":       string,
  "shouldRefund":      boolean,
  "shouldRetry":       boolean,
  "preventRecurrence": string
}`;

    const response = await ai(prompt, {
      system: DISPUTE_RESOLVER_SYSTEM_PROMPT,
      maxTokens: 1800,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Dispute resolution failed: model returned non-JSON output");
    }

    return { success: true, resolution: parsed };
  },
});
