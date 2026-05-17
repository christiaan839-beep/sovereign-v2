import { ai } from "@/lib/ai";
import type { AgentResult, Lead } from "@/types";

/** Lead nurture email sequence generator */
export async function generateNurtureSequence(lead: Lead): Promise<AgentResult & { emails: string[] }> {
  const stageMap: Record<string, string> = {
    cold: "pattern interrupt → value → social proof → scarcity → CTA",
    warm: "case study → ROI breakdown → book-a-call",
    hot: "limited-time offer → decision urgency close",
  };

  const structure = stageMap[lead.stage] || stageMap.warm;
  const emailCount = lead.stage === "cold" ? 5 : lead.stage === "warm" ? 3 : 2;

  const output = await ai(
    `Generate a ${emailCount}-email nurture sequence for:
NAME: ${lead.name}
COMPANY: ${lead.company || "Unknown"}
INDUSTRY: ${lead.industry || "Digital Marketing"}
STAGE: ${lead.stage}
STRUCTURE: ${structure}

For each email: subject line (with emoji), body (under 150 words), CTA button text. Separate with "--- EMAIL ---".`,
    {
      model: "nim",
      system: "You are an email strategist with 40%+ open rates. Direct, valuable, slightly provocative. Never say 'I hope this finds you well'.",
      maxTokens: 3000,
    }
  );

  const emails = output.split(/---\s*EMAIL\s*---/i).filter(e => e.trim());

  return { success: true, agent: "nurture", output, emails, timestamp: new Date().toISOString() };
}
