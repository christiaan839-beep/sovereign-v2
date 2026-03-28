import { research_ai } from "@/lib/ai";

export async function analyzeCompetitor(companyName: string) {
  const query = `${companyName} marketing strategy, pricing, weaknesses, recent news`;
  
  const prompt = `Analyze this competitor: ${companyName}.
Based on the live web search data provided, give me:
1. Core Value Proposition
2. Estimated Pricing Model
3. 3 Critical Weaknesses we can exploit
4. An aggressive counter-positioning strategy for our agency

Keep it ruthless, actionable, and formatted with clear markdown headers.`;

  // We use research_ai instead of standard ai to force a web search first
  const report = await research_ai(query, prompt, { 
    system: "You are the War Room AI. You analyze competitors and find their weak points using real-time internet data." 
  });

  return { companyName, report, timestamp: new Date().toISOString() };
}
