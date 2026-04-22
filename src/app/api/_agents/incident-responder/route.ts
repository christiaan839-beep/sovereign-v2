import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * INCIDENT-RESPONDER — Triage a security or availability incident and
 * produce a structured runbook: immediate actions, investigation steps,
 * communication draft, rollback plan, postmortem questions.
 *
 * Input:
 *   { incidentDescription: string, severity?: "SEV1"|"SEV2"|"SEV3", affectedSystems?: string[] }
 *
 * Output (JSON):
 *   {
 *     severity:              string,
 *     immediateActions:      string[],
 *     investigationSteps:    string[],
 *     communicationDraft:    string,
 *     rollbackPlan:          string,
 *     postMortemQuestions:   string[]
 *   }
 *
 * Pairs with:
 *   - `phishing-detector` — upstream classifier if incident started as a phish
 *   - `security-auditor-code` — followup audit after fix lands
 */

const INCIDENT_SYSTEM_PROMPT = `You are a senior SRE with incident-command experience. You run the runbook cold — prioritize stopping the bleed, communicating early, then investigating, then fixing, then learning.

${ANTI_SLOP_RULES}

## INCIDENT-COMMAND PRIORITY ORDER
1. Stop the bleed — contain or roll back before you understand root cause.
2. Communicate — status page, internal channel, affected customers (if known).
3. Investigate — preserve logs, timelines, surface hypotheses.
4. Fix — durable remediation, not just a silencer.
5. Postmortem — blameless, systemic, with action items that outlive the ticket.

## SEVERITY CALIBRATION
- SEV1 — production down, customer data at risk, active exploitation. Page leadership.
- SEV2 — degraded service, partial outage, or elevated risk. Page on-call.
- SEV3 — minor issue, no customer impact, or self-recovering. Log and monitor.

If severity is not supplied, infer from description. If borderline between SEV1 and SEV2, choose SEV1 — over-paging is recoverable, under-paging is not.

## RULES
1. Never assume intent. If an incident looks malicious, document observed behavior, do not attribute to a person or actor in the runbook — that is a later investigation step.
2. immediateActions[] must be executable NOW, not aspirational. First action is usually "Acknowledge page; assign incident commander." or "Disable feature flag X" or "Roll back deployment Y".
3. investigationSteps[] are ordered — each step should be runnable and produce evidence.
4. communicationDraft is the actual message you would post to a status page or customer-facing channel. Plain language, no speculation, what we know + what we are doing + next update time.
5. rollbackPlan is concrete: the exact revert, who owns it, how to verify success. If no rollback is safe, say so and describe the safest alternative.
6. postMortemQuestions[] probe systemic causes — "Why did monitoring not catch this?" not "Why did X break?".

Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "incident-responder",
  requiredFields: ["incidentDescription"],
  handler: async ({ input }) => {
    const { incidentDescription, severity, affectedSystems } = input as {
      incidentDescription: string;
      severity?: string;
      affectedSystems?: string[];
    };

    const prompt = `Triage this incident and produce a structured runbook. Return ONLY valid JSON.

DECLARED SEVERITY: ${severity ?? "not declared — infer from description"}

AFFECTED SYSTEMS: ${(affectedSystems ?? []).join(", ") || "not specified"}

INCIDENT DESCRIPTION:
"""
${incidentDescription.slice(0, 10_000)}
"""

SCHEMA:
{
  "severity": string,
  "immediateActions": [ string ],
  "investigationSteps": [ string ],
  "communicationDraft": string,
  "rollbackPlan": string,
  "postMortemQuestions": [ string ]
}`;

    const response = await ai(prompt, {
      system: INCIDENT_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Incident response generation failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
