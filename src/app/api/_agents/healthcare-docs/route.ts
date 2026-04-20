import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat } from "@/lib/nvidia";
import { withSelfHeal } from "@/lib/self-heal";
import { z } from "zod";

/**
 * HEALTHCARE-DOCS AGENT — Ambient clinical documentation from visit transcripts.
 *
 * Transforms a raw clinical encounter transcript into a structured SOAP note,
 * ICD-10 diagnostic codes, and CPT billing codes using NVIDIA Nemotron Ultra.
 *
 * HIPAA NOTICE: Output from this agent must NEVER be stored unencrypted.
 * All downstream storage must use AES-256 encryption at rest. Do not log
 * patient data to console, telemetry, or error tracking systems.
 *
 * Input:  { transcript: string, visitType: string, patientContext?: string }
 * Output: { soapNote, icd10Codes, cptCodes, billingReady, timeSaved }
 */

const INPUT_SCHEMA = z.object({
  transcript: z.string().min(10).max(20000),
  visitType: z.string().min(1).max(200),
  patientContext: z.string().max(2000).optional(),
  prompt: z.string().max(5000).optional(),
}).passthrough();

export const POST = createAgentRoute({
  name: "healthcare-docs",
  requiredFields: ["transcript", "visitType"],
  handler: withSelfHeal(async ({ input }) => {
    const transcript = input.transcript as string;
    const visitType = input.visitType as string;
    const patientContext = (input.patientContext as string) || "";

    const systemPrompt = `You are a board-certified clinical documentation specialist with 15+ years of experience in medical coding and SOAP note authoring. You operate under HIPAA compliance requirements.

Your job is to transform clinical encounter transcripts into perfectly structured documentation:
- SOAP notes that meet CMS quality documentation standards
- Accurate ICD-10-CM diagnosis codes (2024 fiscal year)
- Accurate CPT procedure codes with appropriate modifiers
- Billing-ready output that reduces claim denial rates

Rules:
- Never fabricate clinical findings not present in the transcript
- Flag ambiguities with [CLARIFY: ...] tags rather than guessing
- Use standard medical abbreviations (HPI, ROS, PMH, etc.)
- Output ONLY valid JSON, no markdown or explanation`;

    const userPrompt = `Analyze this ${visitType} encounter transcript and generate complete clinical documentation.

TRANSCRIPT:
${transcript}

${patientContext ? `PATIENT CONTEXT (non-PHI metadata only):\n${patientContext}` : ""}

Generate a comprehensive clinical documentation package. Return ONLY valid JSON:
{
  "soapNote": {
    "subjective": {
      "chiefComplaint": "...",
      "historyOfPresentIllness": "...",
      "reviewOfSystems": "...",
      "pastMedicalHistory": "...",
      "medications": [],
      "allergies": []
    },
    "objective": {
      "vitalSigns": "...",
      "physicalExamination": "...",
      "diagnosticResults": "..."
    },
    "assessment": {
      "primaryDiagnosis": "...",
      "differentialDiagnoses": [],
      "clinicalImpression": "..."
    },
    "plan": {
      "treatments": [],
      "medications": [],
      "followUp": "...",
      "patientEducation": "...",
      "referrals": []
    }
  },
  "icd10Codes": [
    {
      "code": "...",
      "description": "...",
      "type": "primary|secondary",
      "confidence": 0.95
    }
  ],
  "cptCodes": [
    {
      "code": "...",
      "description": "...",
      "units": 1,
      "modifier": "...",
      "rationale": "..."
    }
  ],
  "billingReady": true,
  "documentationFlags": [],
  "timeSaved": "estimated minutes of documentation time saved vs manual"
}`;

    const result = await nimChat(
      "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 4000, temperature: 0.2 }
    );

    let parsed;
    try {
      const cleaned = result.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Model returned non-JSON clinical documentation output");
    }

    if (!parsed.soapNote || !parsed.icd10Codes) {
      throw new Error("Incomplete clinical documentation generated — transcript may be too brief");
    }

    const icd10Count = (parsed.icd10Codes || []).length;
    const cptCount = (parsed.cptCodes || []).length;

    return {
      success: true,
      soapNote: parsed.soapNote,
      icd10Codes: parsed.icd10Codes || [],
      cptCodes: parsed.cptCodes || [],
      billingReady: parsed.billingReady ?? (icd10Count > 0 && cptCount > 0),
      documentationFlags: parsed.documentationFlags || [],
      timeSaved: parsed.timeSaved || "15-25 minutes",
      visitType,
      codeCount: { icd10: icd10Count, cpt: cptCount },
      // HIPAA: remind callers never to persist this unencrypted
      _hipaaNotice: "ENCRYPT_BEFORE_STORAGE",
    };
  }, { label: "healthcare-docs", maxRetries: 1, inputSchema: INPUT_SCHEMA }),
});
