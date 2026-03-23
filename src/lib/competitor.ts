import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("competitor");

export interface CompetitorProfile {
  name: string;
  website?: string;
  socials?: string[];
}

export interface CompetitorAnalysis {
  competitor: string;
  strengths: string[];
  weaknesses: string[];
  recentMoves: string[];
  opportunities: string[];
  threatLevel: "low" | "medium" | "high";
  recommendation: string;
}

/** Run competitive intelligence analysis against a specific competitor */
export async function analyzeCompetitor(
  competitor: CompetitorProfile,
  yourBusiness: string
): Promise<CompetitorAnalysis> {
  const prompt = `Analyze this competitor relative to our business.

Our Business: ${yourBusiness}
Competitor: ${competitor.name}
${competitor.website ? `Website: ${competitor.website}` : ""}
${competitor.socials?.length ? `Socials: ${competitor.socials.join(", ")}` : ""}

Return JSON:
{
  "competitor": "name",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recentMoves": ["recent action or strategy change"],
  "opportunities": ["opportunity we can exploit"],
  "threatLevel": "low|medium|high",
  "recommendation": "specific action we should take"
}`;

  const text = await ai(prompt, {
    taskType: "analysis",
    system: "You are a competitive intelligence analyst. Be specific and actionable. Focus on exploitable gaps. Always return valid JSON.",
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in competitor analysis response");
  return JSON.parse(jsonMatch[0]);
}

/** Watch multiple competitors and generate threat alerts */
export async function watchCompetitors(
  competitors: CompetitorProfile[],
  yourBusiness: string
): Promise<{ analyses: CompetitorAnalysis[]; alerts: string[] }> {
  const analyses: CompetitorAnalysis[] = [];
  const alerts: string[] = [];

  for (const competitor of competitors) {
    try {
      const analysis = await analyzeCompetitor(competitor, yourBusiness);
      analyses.push(analysis);

      if (analysis.threatLevel === "high") {
        alerts.push(`HIGH THREAT: ${competitor.name} — ${analysis.recommendation}`);
      }
    } catch (e) {
      log.error(`Failed to analyze ${competitor.name}:`, e);
    }
  }

  return { analyses, alerts };
}

/** Generate a counter-strategy across all tracked competitors */
export async function generateCounterStrategy(
  analyses: CompetitorAnalysis[],
  yourBusiness: string
): Promise<string> {
  const summary = analyses.map(a =>
    `${a.competitor} (${a.threatLevel}): Strengths: ${a.strengths.join(", ")}. Weaknesses: ${a.weaknesses.join(", ")}`
  ).join("\n");

  return ai(
    `Based on this competitive landscape, create a counter-strategy.

Our Business: ${yourBusiness}

Competitors:
${summary}

Include:
1. Immediate actions (this week)
2. Short-term plays (this month)
3. Long-term positioning (this quarter)
4. Unique differentiators to emphasize
5. Pricing/packaging recommendations`,
    { taskType: "analysis", system: "You are a world-class strategist. Think like Sun Tzu meets modern growth hacking." }
  );
}
