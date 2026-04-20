import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat } from "@/lib/nvidia";
import { withSelfHeal } from "@/lib/self-heal";
import { z } from "zod";

/**
 * PRIOR-AUTH AGENT — Prior authorization letter generation and denial prevention.
 *
 * The single biggest administrative burden in US healthcare: prior authorization.
 * This agent generates complete, insurer-specific prior auth letters, anticipates
 * the top denial reasons for the specific payer/procedure combination, and suggests
 * the supporting documentation most likely to secure approval on first submission.
 *
 * HIPAA NOTICE: Output from this agent must NEVER be stored unencrypted.
 * All downstream storage must use AES-256 encryption at rest.
 *
 * Input:  { procedure: string, diagnosis: string, insurancePlan: string, patientHistory?: string }
 * Output: { authLetter, denialRisks, supportingDocs, estimatedApprovalChance }
 */

const INPUT_SCHEMA = z.object({
  procedure: z.string().min(1).max(500),
  diagnosis: z.string().min(1).max(1000),
  insurancePlan: z.string().min(1).max(300),
  patientHistory: z.string().max(3000).optional(),
  prompt: z.string().max(5000).optional(),
}).passthrough();

export const POST = createAgentRoute({
  name: "prior-auth",
  requiredFields: ["procedure", "diagnosis", "insurancePlan"],
  handler: withSelfHeal(async ({ input }) => {
    const procedure = input.procedure as string;
    const diagnosis = input.diagnosis as string;
    const insurancePlan = input.insurancePlan as string;
    const patientHistory = (input.patientHistory as string) || "";

    const systemPrompt = `You are a prior authorization specialist with deep expertise in US health insurance appeals, medical necessity criteria, and payer-specific coverage policies. You have 20+ years of experience in healthcare revenue cycle management.

Your expertise covers:
- CMS and commercial payer prior authorization requirements
- Medical necessity documentation standards (MCG, InterQual criteria)
- Common denial reasons by procedure category and payer type
- Evidence-based clinical literature citations that support approvals
- Step therapy, fail-first, and alternative treatment documentation

Critical rules:
- Write letters in formal medical-legal style
- Never fabricate patient data — use placeholders like [PATIENT_NAME], [DOB], [MEMBER_ID]
- Base denial risk analysis on real payer behavior patterns
- Supporting documentation suggestions must be clinically relevant
- Output ONLY valid JSON, no markdown`;

    const userPrompt = `Generate a complete prior authorization package for the following case.

REQUESTED PROCEDURE: ${procedure}
DIAGNOSIS: ${diagnosis}
INSURANCE PLAN: ${insurancePlan}
${patientHistory ? `PATIENT CLINICAL HISTORY:\n${patientHistory}` : "No patient history provided — use conservative clinical assumptions."}

Generate a complete prior auth package. Return ONLY valid JSON:
{
  "authLetter": {
    "subject": "...",
    "salutation": "Dear Medical Director,",
    "body": "...",
    "medicalNecessityArgument": "...",
    "clinicalCriteriaMet": [],
    "supportingLiterature": [],
    "closingStatement": "...",
    "attachmentsList": []
  },
  "denialRisks": [
    {
      "reason": "...",
      "probability": "high|medium|low",
      "preemptiveResponse": "..."
    }
  ],
  "supportingDocs": [
    {
      "document": "...",
      "purpose": "...",
      "priority": "required|recommended|optional"
    }
  ],
  "estimatedApprovalChance": {
    "percentage": 0,
    "rationale": "...",
    "keyFactors": []
  },
  "appealStrategy": "...",
  "urgencyFlag": "routine|urgent|emergent"
}`;

    const result = await nimChat(
      "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 4000, temperature: 0.3 }
    );

    let parsed;
    try {
      const cleaned = result.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Model returned non-JSON prior auth output — likely hit token limit");
    }

    if (!parsed.authLetter) {
      throw new Error("Prior auth letter not generated — input may be insufficient");
    }

    return {
      success: true,
      authLetter: parsed.authLetter,
      denialRisks: parsed.denialRisks || [],
      supportingDocs: parsed.supportingDocs || [],
      estimatedApprovalChance: parsed.estimatedApprovalChance || { percentage: 0, rationale: "Insufficient data" },
      appealStrategy: parsed.appealStrategy || "",
      urgencyFlag: parsed.urgencyFlag || "routine",
      procedure,
      insurancePlan,
      // HIPAA: remind callers never to persist this unencrypted
      _hipaaNotice: "ENCRYPT_BEFORE_STORAGE",
    };
  }, { label: "prior-auth", maxRetries: 1, inputSchema: INPUT_SCHEMA }),
});
