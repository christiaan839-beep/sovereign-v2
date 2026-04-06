import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { runSwarm } from "@/lib/swarm";

/**
 * PROPOSAL GENERATOR — Input a client brief and get a full branded proposal.
 * Uses the Swarm (Creator/Critic) for high output quality.
 */

const schema = z.object({
  client_name: z.string().max(200).optional(),
  client: z.string().max(200).optional(),
  project_type: z.string().max(200).optional(),
  service: z.string().max(200).optional(),
  product: z.string().max(200).optional(),
  requirements: z.string().max(5000).optional(),
  prompt: z.string().max(5000).optional(),
  budget_range: z.string().max(200).optional(),
  budget: z.string().max(200).optional(),
  timeline: z.string().max(200).optional(),
  context: z.string().max(5000).optional(),
}).refine(
  (d) => d.client_name || d.client || d.project_type || d.service || d.requirements || d.prompt,
  { message: "Provide at least a client name, project type, or requirements" }
);

export const POST = createAgentRoute({
  name: "proposal-generator",
  schema,
  handler: async ({ input }) => {
    const client_name = (input.client_name || input.client || "") as string;
    const project_type = (input.project_type || input.service || input.product || "") as string;
    const requirements = (input.requirements || input.prompt || "") as string;
    const budget_range = (input.budget_range || input.budget || "") as string;
    const timeline = (input.timeline || "") as string;
    const context = (input.context || "") as string;

    const start = Date.now();
    const { finalOutput, rounds } = await runSwarm({
      goal: `Generate a professional business proposal.

CLIENT: ${client_name || "Prospective Client"}
PROJECT TYPE: ${project_type || "Consulting Services"}
REQUIREMENTS: ${requirements || "Not specified — infer from project type"}
BUDGET RANGE: ${budget_range || "To be discussed"}
TIMELINE: ${timeline || "Standard delivery"}
${context ? `\nCONTEXT FROM PREVIOUS RESEARCH:\n${context.slice(0, 3000)}` : ""}

OUTPUT STRUCTURE:
1. EXECUTIVE SUMMARY (100 words — what we're proposing and why)
2. UNDERSTANDING OF NEEDS (150 words — demonstrate we understand their pain)
3. PROPOSED SOLUTION (300 words — what we will build/deliver, broken into phases)
4. DELIVERABLES TABLE (list each deliverable with estimated hours)
5. TIMELINE (Gantt-style milestones with dates)
6. INVESTMENT (pricing tiers: Standard, Premium, Enterprise)
7. WHY US (100 words — differentiation)
8. NEXT STEPS (clear CTA with scheduling link)

Write in confident but warm professional tone. No jargon. No filler.`,
      creatorSystem: "You are a proposal writer who has closed $50M+ in consulting deals. Your proposals are clear, visually structured, and always end with a strong call to action.",
      criticSystem: "You are a procurement officer. Check: Is the pricing clear? Are deliverables specific enough? Is there vague language that could cause scope creep? If perfect, output FINAL_APPROVED.",
      maxRounds: 2,
    });

    return {
      success: true,
      agent: "proposal-generator",
      client: client_name,
      project_type,
      proposal: finalOutput,
      swarm_rounds: rounds,
      duration_ms: Date.now() - start,
    };
  },
});
