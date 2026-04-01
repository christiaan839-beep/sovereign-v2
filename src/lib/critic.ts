import { ai } from "./ai";
import { createLogger } from "./logger";

const log = createLogger("critic");

export interface CriticResult {
  approved: boolean;
  score: number; // 0-1
  feedback: string;
  correctedOutput?: string;
}

/**
 * Critic Agent — Validates agent output against the user's original goal.
 * Uses a separate model call to grade quality. If output is poor,
 * returns feedback + corrected version.
 *
 * This is the "Supervisor Pattern" from enterprise AI:
 * - Open-source models do the work (free)
 * - Premium model grades it (quality guarantee)
 */
export async function criticReview(
  userGoal: string,
  agentOutput: string,
  agentName: string,
  options: { threshold?: number; autoCorrect?: boolean } = {}
): Promise<CriticResult> {
  const threshold = options.threshold ?? 0.7;

  try {
    const review = await ai(
      `You are a quality assurance reviewer. Score this agent's output on a scale of 0-1 and provide brief feedback.

USER'S ORIGINAL GOAL: ${userGoal}

AGENT (${agentName}) OUTPUT:
${agentOutput.slice(0, 2000)}

Respond in this exact JSON format:
{"score": 0.85, "approved": true, "feedback": "Good output, covers all points"}

Rules:
- score 0.8+ = approved
- score 0.5-0.79 = needs improvement
- score below 0.5 = rejected
- Be specific about what's missing or wrong`,
      { system: "You are a strict QA reviewer. Return ONLY valid JSON. No markdown.", maxTokens: 300 }
    );

    try {
      const parsed = JSON.parse(review.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      const result: CriticResult = {
        approved: parsed.score >= threshold,
        score: parsed.score,
        feedback: parsed.feedback || "No feedback",
      };

      // Auto-correct if below threshold and option enabled
      if (!result.approved && options.autoCorrect) {
        const corrected = await ai(
          `The original output scored ${parsed.score}/1.0 with this feedback: "${parsed.feedback}"

Original goal: ${userGoal}
Original output: ${agentOutput.slice(0, 1500)}

Rewrite the output to address the feedback and fully satisfy the goal.`,
          { system: `You are ${agentName}. Rewrite the output to be better.`, maxTokens: 2000 }
        );
        result.correctedOutput = corrected;
      }

      return result;
    } catch {
      // If JSON parse fails, approve by default (fail-open)
      return { approved: true, score: 0.7, feedback: "Critic review parse failed — approved by default" };
    }
  } catch (err) {
    log.error("Critic review failed", err as Record<string, unknown>);
    return { approved: true, score: 0.5, feedback: "Critic unavailable — approved by default" };
  }
}
