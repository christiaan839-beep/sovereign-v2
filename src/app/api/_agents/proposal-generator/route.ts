import { NextResponse } from "next/server";
import { runSwarm } from "@/lib/swarm";

/**
 * PROPOSAL GENERATOR — Input a client brief and get a full branded proposal.
 * Uses the Swarm (Creator/Critic) for elite output quality.
 */

export async function POST(request: Request) {
  try {
    const { client_name, project_type, requirements, budget_range, timeline } = await request.json();

    if (!client_name || !project_type) {
      return NextResponse.json({ error: "client_name and project_type are required." }, { status: 400 });
    }

    const start = Date.now();
    const { finalOutput, rounds } = await runSwarm({
      goal: `Generate a professional business proposal.

CLIENT: ${client_name}
PROJECT TYPE: ${project_type}
REQUIREMENTS: ${requirements || "Not specified — infer from project type"}
BUDGET RANGE: ${budget_range || "To be discussed"}
TIMELINE: ${timeline || "Standard delivery"}

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
      creatorSystem: "You are a proposal writer who has closed $50M+ in consulting deals. Your proposals are clear, visually structured, and always end with a strong call to action. You write for decision-makers who skim.",
      criticSystem: "You are a procurement officer. Check: Is the pricing clear? Are deliverables specific enough to hold the vendor accountable? Is there any vague language that could cause scope creep? If perfect, output FINAL_APPROVED.",
      maxRounds: 2,
    });

    return NextResponse.json({
      success: true,
      agent: "proposal-generator",
      client: client_name,
      project_type,
      proposal: finalOutput,
      swarm_rounds: rounds,
      duration_ms: Date.now() - start,
    });
  } catch (error) {
    return NextResponse.json({ error: "Proposal generator error", details: String(error) }, { status: 500 });
  }
}
