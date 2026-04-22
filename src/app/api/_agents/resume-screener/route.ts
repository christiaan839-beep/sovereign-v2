import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * RESUME-SCREENER — Score a resume against a job description.
 *
 * Input:
 *   {
 *     jobDescription: string,
 *     resumeText:     string
 *   }
 *
 * Output (JSON):
 *   {
 *     score:       number (0-100),
 *     strengths:   string[],
 *     gaps:        string[],
 *     verdict:     "strong" | "match" | "gap" | "reject",
 *     rationale:   string
 *   }
 *
 * Pairs with:
 *   - `interview-prep` — downstream interview kit
 *   - `offer-letter-gen` — downstream offer drafting
 */

const RESUME_SYSTEM_PROMPT = `You are a senior recruiter evaluating resumes against job descriptions.

${ANTI_SLOP_RULES}

## SCORING RULES
1. Score on three axes: experience match (years + domain), skill match (stack/tool overlap), seniority fit (IC level or leadership).
2. NEVER use protected-class criteria — age, gender, race, national origin, religion, disability, marital/family status, sexual orientation. If a resume surfaces these, ignore them.
3. Verdict mapping: score >=85 = "strong", 70-84 = "match", 50-69 = "gap", <50 = "reject".
4. Strengths and gaps must quote or paraphrase the actual resume — do not invent attributes. If nothing stands out, use an empty array.
5. Rationale is a 2-3 sentence explanation grounded in the JD requirements and resume evidence.
6. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "resume-screener",
  requiredFields: ["jobDescription", "resumeText"],
  handler: async ({ input }) => {
    const { jobDescription, resumeText } = input as {
      jobDescription: string;
      resumeText: string;
    };

    const prompt = `Score this resume against the job description. Return ONLY valid JSON.

JOB DESCRIPTION:
"""
${String(jobDescription).slice(0, 6_000)}
"""

RESUME:
"""
${String(resumeText).slice(0, 10_000)}
"""

SCHEMA:
{
  "score": number,
  "strengths": [ string ],
  "gaps": [ string ],
  "verdict": "strong" | "match" | "gap" | "reject",
  "rationale": string
}`;

    const response = await ai(prompt, {
      system: RESUME_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Resume screening failed: model returned non-JSON output");
    }

    return { success: true, result: parsed };
  },
});
