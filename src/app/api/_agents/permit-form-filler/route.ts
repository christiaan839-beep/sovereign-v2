/**
 * Building permit form filler — draft a structured permit application
 * from project details.
 *
 * Permit delays are the #1 cited source of construction schedule slip
 * (ULI 2024 survey). Average SFR permit in the US takes 8-14 weeks;
 * commercial permits run 4-8 months. Much of the delay is re-submission
 * after form errors.
 *
 * This agent generates permit-ready form data from a project brief.
 * Jurisdictions vary enormously (every city has its own form), so the
 * output is a normalized schema that covers the 80% of shared fields
 * across ICC Model Code jurisdictions. Edge cases still need a permit
 * expeditor.
 *
 * Market: US construction does ~1.5M permits/year across all types.
 * Commercial expeditor fees run $3-10K per permit. A tool that gets
 * the first-pass submission clean saves 2-6 weeks of iteration.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";

const SYSTEM_PROMPT = `You are a building-permit application drafter for US
jurisdictions. You fill out the structured fields from project information.

Given: project details (address, work type, scope, contractor, valuation),
return JSON matching this shape:

{
  "project": {
    "projectAddress": { "street1", "street2", "city", "state", "zip" },
    "assessorParcelNumber": "string | null",
    "lotNumber": "string | null",
    "subdivision": "string | null",
    "ownerName": "string",
    "ownerContact": { "phone", "email" }
  },
  "workClassification": {
    "workType": "new-construction" | "addition" | "alteration" | "repair"
                | "demolition" | "tenant-improvement" | "other",
    "occupancyGroup": "string",     // IBC occupancy (R-3, B, M, etc.)
    "constructionType": "string",    // IBC Type I-A, II-B, V-A, etc.
    "numberOfStories": number,
    "grossSquareFeet": number,
    "estimatedValuationUsd": number
  },
  "scopeOfWork": {
    "summary": "string",             // 1-2 sentences
    "detailedDescription": "string",
    "workIncludesStructural": boolean,
    "workIncludesMechanical": boolean,
    "workIncludesElectrical": boolean,
    "workIncludesPlumbing": boolean,
    "workIncludesFireSprinkler": boolean
  },
  "contractors": [
    {
      "role": "general" | "electrical" | "mechanical" | "plumbing" | "other",
      "businessName": "string",
      "licenseNumber": "string | null",
      "licenseState": "string | null",
      "licenseExpiration": "string | null"
    }
  ],
  "designProfessional": {
    "architectName": "string | null",
    "architectLicense": "string | null",
    "engineerName": "string | null",
    "engineerLicense": "string | null",
    "sealRequired": boolean
  },
  "zoningInfo": {
    "zoningDistrict": "string | null",
    "floorAreaRatio": "string | null",
    "setbacksFront": "string | null",
    "setbacksSide": "string | null",
    "setbacksRear": "string | null",
    "lotCoveragePct": "string | null",
    "heightLimit": "string | null"
  },
  "requiredAttachments": [
    "string"                         // e.g. "Site plan", "Structural calcs",
                                     // "Title 24 energy compliance", "Soils report"
  ],
  "estimatedFees": {
    "plancheckFeeUsd": number | null,
    "permitFeeUsd": number | null,
    "notes": "string"
  },
  "jurisdictionalSpecialNotes": [
    "string"                         // anything the drafter thinks will
                                     // be flagged in plan review
  ],
  "readinessChecklist": [
    { "item": "string", "status": "ready" | "missing" | "in-progress" }
  ]
}

Rules:
  1. NEVER invent licenses, APNs, or owner info — return null if unknown.
  2. IBC occupancy + construction type MUST come from the project description;
    if the input doesn't clearly imply one, return a placeholder and note
    it in jurisdictionalSpecialNotes.
  3. Estimated valuation should reflect fair market cost of the scope, not
    the contract price (some jurisdictions audit this).
  4. Fees are rough estimates — always add a note that the applicant must
    verify the jurisdiction's current fee schedule.
  5. If the project scope references an area the drafter suspects may be
    historic, in a flood zone, or in a coastal zone, call it out in
    jurisdictionalSpecialNotes.
  6. Return valid JSON only. No prose outside.

Final submission requires review by a licensed architect/engineer where
structural or life-safety work is involved.`;

export const POST = createAgentRoute({
  name: "permit-form-filler",
  requiredFields: ["projectDetails"],
  handler: async ({ input }) => {
    const { projectDetails, jurisdiction } = input as {
      projectDetails: string;
      jurisdiction?: string;
    };

    const userMsg = [
      jurisdiction ? `Jurisdiction: ${jurisdiction}` : null,
      `Project details:\n${projectDetails.slice(0, 8000)}`,
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
      permitDraft: output,
      model: NIM_MODELS.reasoning,
      domain: "construction",
      samVersion: "1.0",
      category: "Real Estate",
      disclaimer:
        "Draft only. Submission requires review by licensed design professional and verification against current jurisdiction requirements.",
    };
  },
});
