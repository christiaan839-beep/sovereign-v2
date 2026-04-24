/**
 * Safety incident reporter — convert a free-text or voice-transcribed
 * incident description into an OSHA-compliant report draft.
 *
 * OSHA recordability is binary but legally consequential. Incorrectly
 * recorded incidents → DART rate errors → higher workers' comp premiums
 * + potential citations during inspections. Correctly recorded ones →
 * lower EMR and competitive bid position for GCs + manufacturers.
 *
 * Every US employer with >10 employees must keep OSHA 300 Log. Large
 * GCs record hundreds of incidents per year. Getting the record right
 * takes a safety manager ~30-60 minutes per incident today.
 *
 * This agent drafts: the 300 Log row, the 301 incident report
 * narrative, and suggested root-cause classification using the
 * Swiss Cheese / Reason model.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";

const SYSTEM_PROMPT = `You are an OSHA 300 / 301 safety-incident reporter.

Given an incident narrative (from a foreman, supervisor, or worker), return
JSON matching this shape:

{
  "osha300LogRow": {
    "caseNumber": "string | null",
    "employeeName": "string | null",
    "jobTitle": "string | null",
    "dateOfInjury": "string | null",    // ISO-8601
    "whereEventOccurred": "string",
    "injuryOrIllnessDescription": "string",  // <= 200 chars, plain
    "classification": "death" | "days-away" | "job-transfer-restriction" |
                       "other-recordable" | "not-recordable",
    "daysAwayFromWork": number | null,
    "daysJobTransferOrRestriction": number | null,
    "injuryType": "injury" | "skin-disorder" | "respiratory" | "poisoning" |
                   "hearing-loss" | "other-illness"
  },
  "osha301Narrative": {
    "howInjuryOccurred": "string",       // paragraph form
    "whatWasEmployeeDoing": "string",
    "whatHappened": "string",
    "whatWasInjury": "string",
    "whatObjectOrSubstance": "string | null",
    "timeEmployeeBeganWork": "string | null",
    "timeOfEvent": "string | null",
    "physicianFacility": "string | null"
  },
  "recordabilityAnalysis": {
    "isRecordable": boolean,
    "rationale": "string",               // 1-2 sentence OSHA test
    "testsApplied": [
      "work-related"? "new-case"?
      "medical-treatment-beyond-first-aid"?
      "loss-of-consciousness"?
      "significant-injury-illness-diagnosed"?
    ],
    "privacyCaseFlag": boolean           // per 29 CFR 1904.29(b)(7)
  },
  "rootCauseAnalysis": {
    "immediateCause": "string",
    "contributingFactors": ["string"],
    "systemicFactors": ["string"],       // per Reason / Swiss Cheese
    "preventableVia": ["string"]
  },
  "correctiveActions": [
    {
      "action": "string",
      "owner": "string | null",
      "targetDate": "string | null",
      "priority": "immediate" | "high" | "medium" | "low"
    }
  ],
  "regulatoryNotifications": [
    {
      "agency": "OSHA" | "state-plan-OSHA" | "EPA" | "other",
      "required": boolean,
      "deadline": "string | null",       // e.g. "8 hours" for fatality
      "reason": "string"
    }
  ],
  "witnessList": [
    { "name": "string | null", "role": "string", "statement": "string | null" }
  ],
  "dataQualityNotes": [
    "string"                             // things the safety manager should
                                         // verify before submitting
  ]
}

Rules:
  1. Recordability test: apply 29 CFR 1904.5 (work-related), 1904.6 (new
     case), 1904.7 (general recording criteria) literally.
  2. First-aid-only events (29 CFR 1904.7(b)(5)(ii)) are NOT recordable.
     Examples: non-prescription meds at non-prescription strength, hot/cold
     compress, simple bandages.
  3. NEVER fabricate names, times, or locations. Mark unknown as null.
  4. Near-misses are NOT OSHA-recordable but ARE worth tracking —
     include them in rootCauseAnalysis even if recordability is false.
  5. For fatalities / hospitalizations: flag "OSHA" regulatoryNotifications
     with 8-hour and 24-hour deadlines per 29 CFR 1904.39.
  6. The narrative should read professionally. Avoid blame language
     ("operator failed to") — prefer factual description ("operator did
     not engage the guard before starting").
  7. Return valid JSON only. No prose outside.

This output is a DRAFT. A qualified safety professional must review before
filing OSHA Forms 300 or 301.`;

export const POST = createAgentRoute({
  name: "safety-incident-reporter",
  requiredFields: ["incidentDescription"],
  handler: async ({ input }) => {
    const { incidentDescription, location, projectName } = input as {
      incidentDescription: string;
      location?: string;
      projectName?: string;
    };

    const userMsg = [
      projectName ? `Project: ${projectName}` : null,
      location ? `Location: ${location}` : null,
      `Incident narrative:\n${incidentDescription.slice(0, 8000)}`,
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
      safetyReport: output,
      model: NIM_MODELS.reasoning,
      domain: "construction",
      samVersion: "1.0",
      category: "Real Estate",
      disclaimer:
        "Draft only. Filing requires review by a qualified safety professional. Recordability determinations are subject to OSHA interpretation.",
    };
  },
});
