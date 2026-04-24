/**
 * FNOL Intake — First Notice of Loss intake for insurance claims.
 *
 * The moment a policyholder calls in a loss, every insurer's workflow
 * runs the same 4 steps: (1) classify the claim type, (2) assess initial
 * severity, (3) route to the right adjuster, (4) draft a reservation of
 * rights if applicable. Today that's a human call-center rep. This agent
 * does the structural work in under a second so the rep can focus on
 * empathy + edge cases.
 *
 * Market context: US P&C insurance processes ~40M claims/year. FNOL
 * takes an average 12 minutes of rep time per call. Automating the
 * structured portion (~8 minutes) → $3B/year in saved labor.
 *
 * Output shape is designed to plug straight into Guidewire ClaimCenter,
 * Duck Creek Claims, and Origami Risk without transformation.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";

const SYSTEM_PROMPT = `You are an insurance FNOL (First Notice of Loss) intake specialist.
Your output is consumed by claim-management systems — be structural, not narrative.

Given the caller's incident description, return JSON with these fields EXACTLY:
  - claimType: one of "auto", "property", "liability", "workers-comp",
                     "marine", "aviation", "life", "health", "other"
  - lossDate: ISO-8601 date if mentioned, else null
  - lossTimeApprox: free text if a time is mentioned, else null
  - lossLocation: { address, city, state, country } — any fields you can extract
  - severityEstimate: one of "minor", "moderate", "major", "catastrophic", "unknown"
  - severityRationale: 1-2 sentences explaining the severity call
  - coveragePotentiallyTriggered: array of likely policy sections
                                  (e.g. ["collision", "property-damage-liability"])
  - injuriesReported: boolean
  - policeReportReferenced: boolean
  - thirdPartiesInvolved: array of { party, role } objects
  - initialReserveSuggestionUsd: integer estimate, or null if not inferable
  - redFlags: array of items that warrant SIU (Special Investigation Unit)
              escalation — inconsistencies, timing concerns, prior claim history
  - nextActions: ordered array of things the adjuster should do next
                 (e.g. ["Request photos", "Contact police for report #"])
  - reservationOfRightsRecommended: boolean + rationale if true

Rules:
  - Do NOT make up facts. If a field isn't supported, return null or [].
  - Severity "catastrophic" is for total-loss or fatality events only.
  - Red flags are for trends a human would recognize — don't cry wolf.
  - Return valid JSON with no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "fnol-intake",
  requiredFields: ["description"],
  handler: async ({ input }) => {
    const { description, policyNumber, claimantName } = input as {
      description: string;
      policyNumber?: string;
      claimantName?: string;
    };

    const userMsg = [
      claimantName ? `Claimant: ${claimantName}` : null,
      policyNumber ? `Policy #: ${policyNumber}` : null,
      `Incident description: ${description.slice(0, 6000)}`,
    ]
      .filter(Boolean)
      .join("\n");

    const output = await nimChat(
      NIM_MODELS.reasoning,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      { maxTokens: 1800, temperature: 0.1 },
    );

    return {
      success: true,
      fnol: output,
      model: NIM_MODELS.reasoning,
      domain: "insurance",
      samVersion: "1.0",
      category: "Insurance",
    };
  },
});
