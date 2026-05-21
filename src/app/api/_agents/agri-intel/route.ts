import { createAgentRoute } from "@/lib/agent-factory";
import { research_ai } from "@/lib/ai";
import { nimChat } from "@/lib/nvidia";
import { withSelfHeal } from "@/lib/self-heal";
import { z } from "zod";

/**
 * AGRI-INTEL AGENT — Precision agriculture intelligence and decision support.
 *
 * Combines live web research (weather forecasts, commodity market prices, pest
 * alerts, agronomic extension advisories) with NVIDIA Nemotron Ultra analysis
 * to deliver actionable planting, pest management, and market timing
 * recommendations for a given crop, location, and season.
 *
 * Input:  { cropType: string, location: string, seasonalData?: string, soilData?: string }
 * Output: { plantingRecommendations, pestRisks, marketPriceOutlook, yieldForecast, actionItems }
 */

const INPUT_SCHEMA = z
  .object({
    cropType: z.string().min(1).max(200),
    location: z.string().min(1).max(300),
    seasonalData: z.string().max(2000).optional(),
    soilData: z.string().max(2000).optional(),
    prompt: z.string().max(5000).optional(),
  })
  .passthrough();

export const POST = createAgentRoute({
  name: "agri-intel",
  requiredFields: ["cropType", "location"],
  // Wave-111.1 batch 4: memory hooks. Per-crop + per-location
  // intelligence compounds season-over-season — last season's
  // pest events, yield, and market timing inform this season's
  // planting + IPM decisions.
  memory: {
    search: {
      query: (input) =>
        `agri-intel crop:${input.cropType ?? ""} location:${input.location ?? ""}`,
      limit: 3,
    },
    store: {
      extract: (result, input) => {
        const r = result as { actionItems?: string[]; yieldForecast?: string };
        const actions = (r.actionItems ?? []).slice(0, 3).join("; ");
        if (!actions && !r.yieldForecast) return null;
        return `${input.cropType ?? ""} in ${input.location ?? ""}: yield ${r.yieldForecast ?? "?"}. actions: ${actions}`;
      },
      metadata: (input) => ({
        cropType: String(input.cropType ?? ""),
        location: String(input.location ?? ""),
        kind: "agri-intel",
      }),
    },
  },
  handler: withSelfHeal(
    async ({ input, pastContextAsPrompt }) => {
      const cropType = input.cropType as string;
      const location = input.location as string;
      const seasonalData = (input.seasonalData as string) || "";
      const soilData = (input.soilData as string) || "";

      // Step 1: Live research — weather, markets, pest alerts, advisories
      let webResearch = "";
      try {
        webResearch = await research_ai(
          `${cropType} farming ${location} weather forecast pest alerts commodity prices 2026`,
          `Find current and forecast information relevant to ${cropType} farming in ${location}. Include: (1) recent weather patterns and 30-day forecast, (2) current commodity spot prices and futures for ${cropType}, (3) active pest or disease alerts for the region, (4) any drought or flooding advisories, (5) recent agronomic extension recommendations. Focus on actionable, current data.`,
        );
      } catch {
        webResearch = "";
      }

      // Step 2: Deep agronomic analysis
      const systemPrompt = `You are a precision agriculture scientist and agronomist with expertise in crop science, integrated pest management, soil health, and commodity markets. You have worked with extension services across multiple growing regions and have deep knowledge of both conventional and regenerative agriculture practices.

Your analysis integrates:
- Agronomic best practices for the specific crop and region
- Climate and soil interaction effects on yield
- Integrated pest management (IPM) frameworks
- Commodity market fundamentals and price drivers
- Risk-adjusted decision making for farm operators

Output ONLY valid JSON. Never invent specific data — if research is unavailable, provide evidence-based ranges and flag as estimated.`;

      const userPrompt = `Generate a comprehensive precision agriculture intelligence report for the following operation.

CROP TYPE: ${cropType}
LOCATION: ${location}
${seasonalData ? `SEASONAL/WEATHER DATA PROVIDED:\n${seasonalData}` : ""}
${soilData ? `SOIL DATA PROVIDED:\n${soilData}` : ""}

LIVE RESEARCH DATA:
${webResearch || "Live research unavailable — base analysis on agronomic best practices for this crop/region combination. Flag all estimates as ESTIMATED."}

Produce a full agri-intelligence report. Return ONLY valid JSON:
{
  "plantingRecommendations": {
    "optimalWindow": "...",
    "varietyRecommendations": [],
    "spacingAndDensity": "...",
    "seedTreatments": [],
    "irrigationStrategy": "...",
    "fertilizerProgram": {
      "nitrogen": "...",
      "phosphorus": "...",
      "potassium": "...",
      "micronutrients": []
    }
  },
  "pestRisks": [
    {
      "pest": "...",
      "riskLevel": "high|medium|low",
      "peakRiskWindow": "...",
      "monitoringProtocol": "...",
      "controlOptions": []
    }
  ],
  "marketPriceOutlook": {
    "currentSpotPrice": "...",
    "thirtyDayTrend": "bullish|bearish|neutral",
    "keyPriceDrivers": [],
    "harvestWindowRecommendation": "...",
    "storageVsImmediateSale": "..."
  },
  "yieldForecast": {
    "estimatedYield": "...",
    "yieldRange": { "low": "...", "high": "..." },
    "confidenceLevel": "high|medium|low",
    "keyRiskFactors": []
  },
  "actionItems": [
    {
      "action": "...",
      "priority": "immediate|this-week|this-month",
      "rationale": "..."
    }
  ],
  "researchGrounded": ${webResearch.length > 100}
}`;

      const result = await nimChat(
        "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { maxTokens: 4000, temperature: 0.4 },
      );

      let parsed;
      try {
        const cleaned = result
          .replace(/```json?\n?/g, "")
          .replace(/```/g, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error("Model returned non-JSON agri-intel output");
      }

      if (!parsed.plantingRecommendations || !parsed.actionItems) {
        throw new Error(
          "Incomplete agriculture intelligence generated — crop/location may be too vague",
        );
      }

      return {
        success: true,
        plantingRecommendations: parsed.plantingRecommendations,
        pestRisks: parsed.pestRisks || [],
        marketPriceOutlook: parsed.marketPriceOutlook || {},
        yieldForecast: parsed.yieldForecast || {},
        actionItems: parsed.actionItems || [],
        researchGrounded: webResearch.length > 100,
        cropType,
        location,
      };
    },
    { label: "agri-intel", maxRetries: 1, inputSchema: INPUT_SCHEMA },
  ),
});
