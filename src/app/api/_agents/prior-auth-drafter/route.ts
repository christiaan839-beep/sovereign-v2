/**
 * Prior Authorization drafter — assemble a prior-auth request packet
 * from patient + clinical data.
 *
 * Prior authorization is the #1 cited source of physician burnout
 * (per AMA surveys). Medical practices spend ~$11B/year processing
 * PAs, averaging 45 minutes of staff time per request. Payer denial
 * rates run 20-30% on first submission, driving retry cycles.
 *
 * This agent drafts the clinical justification + structured form
 * data. A nurse or PA reviews and submits — the tedious drafting is
 * automated.
 *
 * Downstream: output is shaped to fit CoverMyMeds, Rhyme, and
 * Surescripts PA submission APIs so it can be submitted automatically
 * once approved by a human.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";

const SYSTEM_PROMPT = `You are a prior-authorization (PA) request drafter for
US healthcare. You draft the clinical justification and populate the
structured request fields. A licensed provider reviews before submission.

Given: patient clinical data + proposed treatment + payer + diagnosis,
return JSON with this shape:

{
  "requestSummary": {
    "service": "string",        // CPT code + service name
    "diagnosis": "string",       // ICD-10 code + description
    "payer": "string",
    "planName": "string | null",
    "providerName": "string",
    "providerNpi": "string | null",
    "facilityName": "string | null",
    "urgencyLevel": "routine" | "urgent" | "emergent"
  },
  "clinicalJustification": {
    "summaryParagraph": "string",   // 3-5 sentences. Plain English.
    "medicalNecessityPoints": [
      "string"                        // bulleted evidence points
    ],
    "treatmentHistoryTried": [
      {
        "treatment": "string",
        "durationWeeks": number,
        "outcome": "string"            // "inadequate response", "intolerable side effects", etc.
      }
    ],
    "guidelineCitations": [
      "string"                        // e.g. "2024 ACR guidelines recommend biologic therapy for RA with inadequate DMARD response"
    ],
    "expectedOutcome": "string"
  },
  "clinicalEvidenceChecklist": [
    {
      "item": "string",               // "Recent HbA1c", "Failed step therapy docs", "Imaging report"
      "status": "included" | "missing" | "requested"
    }
  ],
  "payerSpecificConsiderations": {
    "stepTherapyRequired": boolean,
    "quantityLimitsApply": boolean,
    "siteOfServiceRestriction": "string | null",
    "formularyTier": "string | null",
    "expectedTurnaroundBusinessDays": number
  },
  "appealPreparationNotes": "string",  // what to retain in case of denial
  "qualityScore": {
    "completeness": 0-100,
    "missingItems": ["string"],
    "recommendation": "submit" | "gather-more-evidence" | "consider-peer-to-peer"
  }
}

Rules:
  1. NEVER fabricate clinical data. If the input doesn't support a claim,
     mark it "missing" in clinicalEvidenceChecklist.
  2. Draft in professional, clinically literate language. Avoid hedging
     ("patient may have benefited") — say what the record supports.
  3. Cite ONLY real guidelines. If you're unsure of exact wording, say
     "per [society] guidelines on [condition]" without inventing a quote.
  4. Tier urgency honestly. "Emergent" triggers payer fast-tracks and
     should only be used for same-day medical-necessity cases.
  5. Return valid JSON only. No prose outside the JSON.

This output requires licensed-provider review before submission to any payer.`;

export const POST = createAgentRoute({
  name: "prior-auth-drafter",
  requiredFields: ["patientData", "proposedTreatment", "diagnosis"],
  handler: async ({ input }) => {
    const { patientData, proposedTreatment, diagnosis, payerName, urgency } =
      input as {
        patientData: string;
        proposedTreatment: string;
        diagnosis: string;
        payerName?: string;
        urgency?: "routine" | "urgent" | "emergent";
      };

    const userMsg = [
      `Diagnosis: ${diagnosis}`,
      `Proposed treatment: ${proposedTreatment}`,
      payerName ? `Payer: ${payerName}` : null,
      urgency ? `Urgency: ${urgency}` : null,
      `Patient clinical data (de-identified):\n${patientData.slice(0, 6000)}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const output = await nimChat(
      NIM_MODELS.reasoning,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      { maxTokens: 2800, temperature: 0.1 },
    );

    return {
      success: true,
      priorAuth: output,
      model: NIM_MODELS.reasoning,
      domain: "healthcare-coding",
      samVersion: "1.0",
      category: "Healthcare",
      disclaimer:
        "Drafts only. A licensed provider must review and sign before submission to any payer.",
    };
  },
});
