/**
 * ICD-10-CM coder — suggest diagnosis codes from a clinical note.
 *
 * Every US healthcare encounter must be coded with ICD-10-CM diagnoses
 * before insurance will pay. A certified coder (AHIMA CCS) averages
 * 15 minutes per chart at $35/hour → ~$9 per chart. Large hospital
 * systems code millions of charts per year and face a national
 * shortage of certified coders.
 *
 * Market: US healthcare coding services are ~$20B/year. Coder
 * shortage is worsening: median years-of-experience rises while
 * new-coder supply stays flat. AI-assisted coding is the only
 * realistic path to meet demand.
 *
 * Regulatory: This is an ADVISORY tool. Final code selection requires
 * a certified coder or physician. The output is explicitly non-
 * diagnostic and the disclaimer is baked into the response payload.
 *
 * Safety invariants:
 *   - NEVER return a code that doesn't exist in ICD-10-CM 2026.
 *   - ALWAYS include the specificity level (category / sub-category).
 *   - FLAG "unspecified" codes — payers often reject them.
 *   - Return confidence per code for human review prioritization.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";

const SYSTEM_PROMPT = `You are an ICD-10-CM coding assistant for US healthcare.

Given a de-identified clinical note, suggest diagnosis codes. Return JSON:

{
  "primaryDiagnosis": {
    "icd10Code": "string",       // e.g. "E11.9"
    "description": "string",      // official ICD-10-CM descriptor
    "category": "string",         // e.g. "Endocrine, nutritional and metabolic"
    "confidence": "high" | "medium" | "low",
    "supportingEvidence": "string", // verbatim snippet(s) from the note
    "specificity": "full" | "unspecified" | "category-only",
    "hccCategory": "string | null"  // Hierarchical Condition Category if applicable
  },
  "secondaryDiagnoses": [ ...same shape... ],
  "queryableAmbiguities": [
    {
      "issue": "string",  // what's unclear
      "suggestedQuery": "string"  // what to ask the provider
    }
  ],
  "codingNotes": [
    "Any relevant coding-convention notes — e.g. 'Use additional code for
     associated condition', 'Sequencing guidance: ...', 'Excludes1 conflict
     with X'"
  ],
  "riskFlags": [
    // Things that should trigger pre-bill review:
    //  - Unspecified codes where more specific are codable
    //  - Codes that don't align with documented laterality
    //  - Missing present-on-admission indicators for inpatient
    //  - Hierarchical Condition Category opportunities
  ]
}

Rules:
  1. NEVER invent an ICD-10 code. If unsure between codes, return the one
     that is most clearly supported by documentation.
  2. Prefer the MOST SPECIFIC code supported by the documentation
     (laterality, severity, encounter type). Flag an opportunity to query
     the provider when more specificity would be codeable.
  3. Follow Official ICD-10-CM Guidelines for Coding and Reporting (2026).
     Respect Excludes1 / Excludes2 / Code First / Use additional code notes.
  4. Sequencing: the primaryDiagnosis is the condition chiefly responsible
     for the encounter per the documentation, NOT the most severe condition.
  5. For HCCs: flag codes that map to CMS-HCC or HHS-HCC categories —
     these are revenue-relevant for risk-adjusted payment models.
  6. Return valid JSON only. No prose outside the JSON.

This is ADVISORY output. Final coding requires a certified human coder.`;

export const POST = createAgentRoute({
  name: "icd10-coder",
  requiredFields: ["clinicalNote"],
  handler: async ({ input }) => {
    const { clinicalNote, encounterType } = input as {
      clinicalNote: string;
      encounterType?: "inpatient" | "outpatient" | "ed" | "telehealth";
    };

    const userMsg = [
      encounterType ? `Encounter type: ${encounterType}` : null,
      `Clinical note (de-identified):\n${clinicalNote.slice(0, 8000)}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const output = await nimChat(
      NIM_MODELS.reasoning,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      { maxTokens: 2400, temperature: 0.1 },
    );

    return {
      success: true,
      coding: output,
      model: NIM_MODELS.reasoning,
      domain: "healthcare-coding",
      samVersion: "1.0",
      category: "Healthcare",
      disclaimer:
        "Advisory only. Final code selection requires a certified coder or physician. This output is not a substitute for professional coding review.",
    };
  },
});
