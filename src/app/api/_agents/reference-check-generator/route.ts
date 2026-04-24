/**
 * Reference Check Generator — draft structured, legally-defensible
 * reference-check questions tailored to a candidate + role.
 *
 * Modern reference checks aren't "would you rehire this person" anymore.
 * Legal counsel (especially in California, NY, MA) advises behavioral
 * questions that elicit FACTS not opinions — to stay defensible in
 * discrimination suits. This agent drafts the interview guide.
 *
 * Output structure plugs into Checkster / HireRight / SkillSurvey APIs.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";

const SYSTEM_PROMPT = `You are a reference-check interview-guide drafter.
Given a candidate's role + specific competencies to probe, return structured
interview questions that are legally defensible (US employment law) and
behavioral (elicit facts, not opinions).

Output JSON:

{
  "context": {
    "candidateRole": "string",
    "candidateName": "string | null",
    "referenceTitle": "string | null",     // "former manager" etc.
    "recommendedDurationMin": number        // typically 15-30
  },
  "sections": [
    {
      "name": "string",                      // "Work relationship", "Core competencies", etc.
      "purpose": "string",                   // one-line what we're validating
      "questions": [
        {
          "text": "string",                  // the question itself
          "type": "behavioral" | "factual" | "situational",
          "probeFor": ["string"],            // signals we're listening for
          "redFlags": ["string"],            // answers that warrant follow-up
          "legalNote": "string | null"        // e.g. "Don't ask about protected classes"
        }
      ]
    }
  ],
  "avoidTopicsList": [
    "string"                                  // explicit "don't ask" list
                                              // (age, religion, marital status,
                                              //  disability, national origin, etc.)
  ],
  "closingScript": "string"                   // professional wrap-up paragraph
}

Rules:
  1. Every question must be behavioral OR situational (NOT "what do you
     think of X" — they elicit opinion, not fact). Use STAR format prompts.
  2. Include the federal "avoid list" in avoidTopicsList by default.
     Add state-specific items if the user mentions jurisdiction.
  3. Each section should have 3-5 questions max. A full interview ≤ 20.
  4. Closing should remind the reference their responses will be kept
     confidential except as required by law.
  5. Return valid JSON only. No prose outside.`;

export const POST = createAgentRoute({
  name: "reference-check-generator",
  requiredFields: ["role", "competencies"],
  handler: async ({ input }) => {
    const { role, competencies, jurisdiction, candidateName } = input as {
      role: string;
      competencies: string;
      jurisdiction?: string;
      candidateName?: string;
    };

    const userMsg = [
      `Role: ${role}`,
      `Competencies to probe: ${competencies}`,
      jurisdiction ? `Jurisdiction: ${jurisdiction}` : null,
      candidateName ? `Candidate: ${candidateName}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const output = await nimChat(
      NIM_MODELS.reasoning,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      { maxTokens: 2400, temperature: 0.2 },
    );

    return {
      success: true,
      interviewGuide: output,
      model: NIM_MODELS.reasoning,
      domain: "recruiting",
      samVersion: "1.0",
      category: "Recruiting",
      disclaimer:
        "Advisory draft. Final question set should be reviewed by legal counsel for the specific jurisdiction before use in hiring decisions.",
    };
  },
});
