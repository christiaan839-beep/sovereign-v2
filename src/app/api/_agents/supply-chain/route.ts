import { createAgentRoute } from "@/lib/agent-factory";
import { research_ai } from "@/lib/ai";
import { nimChat } from "@/lib/nvidia";
import { withSelfHeal } from "@/lib/self-heal";
import { z } from "zod";

/**
 * SUPPLY-CHAIN AGENT — Supply chain disruption detection and mitigation planning.
 *
 * Uses live web research to scan for signals of disruption (port closures, labor
 * actions, geopolitical events, factory incidents, weather events) affecting a
 * company's supplier network, then uses NVIDIA Nemotron Ultra to score risk,
 * identify alternative suppliers, and generate a mitigation playbook.
 *
 * Input:  { suppliers: string, products: string, region?: string, industry?: string }
 * Output: { riskScore, disruptions, alternativeSuppliers, mitigationPlan, urgencyLevel }
 */

const INPUT_SCHEMA = z.object({
  suppliers: z.string().min(1).max(2000),
  products: z.string().min(1).max(1000),
  region: z.string().max(300).optional(),
  industry: z.string().max(200).optional(),
  prompt: z.string().max(5000).optional(),
}).passthrough();

export const POST = createAgentRoute({
  name: "supply-chain",
  requiredFields: ["suppliers", "products"],
  handler: withSelfHeal(async ({ input }) => {
    const suppliers = input.suppliers as string;
    const products = input.products as string;
    const region = (input.region as string) || "global";
    const industry = (input.industry as string) || "general";

    // Step 1: Scan for disruption signals across news and trade sources
    let disruptionSignals = "";
    try {
      disruptionSignals = await research_ai(
        `supply chain disruption ${region} ${industry} 2026 port strikes logistics delays`,
        `Search for current supply chain disruption signals relevant to: suppliers (${suppliers}), products (${products}), region (${region}), industry (${industry}). Look for: (1) port closures or labor disputes, (2) factory fires or natural disasters affecting manufacturers, (3) shipping lane disruptions (Suez, Panama Canal, Red Sea), (4) raw material shortages, (5) geopolitical trade restrictions, (6) logistics provider capacity issues. Return specific, recent signals with dates where possible.`
      );
    } catch {
      disruptionSignals = "";
    }

    // Step 2: Analyze risk and generate mitigation plan
    const systemPrompt = `You are a supply chain risk analyst and logistics strategist with 20+ years of experience in global procurement, supplier diversification, and business continuity planning. You have advised Fortune 500 companies across manufacturing, retail, technology, and healthcare sectors.

Your analysis framework:
- SCRM (Supply Chain Risk Management) best practices
- Multi-tier supplier visibility and vulnerability mapping
- Total Cost of Ownership (TCO) in supplier switching analysis
- Inventory buffer and safety stock calculations
- Nearshoring vs. reshoring vs. diversification trade-offs
- Force majeure event probability assessment

Output ONLY valid JSON. Risk scores are 0-100 (0=no risk, 100=critical disruption).`;

    const userPrompt = `Analyze supply chain risks and generate a mitigation plan for the following operation.

SUPPLIER NETWORK: ${suppliers}
PRODUCTS/MATERIALS: ${products}
REGION: ${region}
INDUSTRY: ${industry}

LIVE DISRUPTION SIGNALS:
${disruptionSignals || "Live disruption intelligence unavailable — analyze based on known risk patterns for this supplier region/industry combination. Flag all assessments as ESTIMATED."}

Generate a comprehensive supply chain risk and mitigation report. Return ONLY valid JSON:
{
  "riskScore": 0,
  "riskCategory": "critical|high|medium|low",
  "disruptions": [
    {
      "type": "...",
      "description": "...",
      "affectedSuppliers": [],
      "severity": "critical|high|medium|low",
      "timeline": "...",
      "probabilityOfImpact": "high|medium|low",
      "estimatedLeadTimeImpact": "..."
    }
  ],
  "alternativeSuppliers": [
    {
      "category": "...",
      "suggestedRegions": [],
      "qualificationTimeEstimate": "...",
      "costDelta": "...",
      "riskReduction": "..."
    }
  ],
  "mitigationPlan": {
    "immediate": [],
    "shortTerm": [],
    "strategic": []
  },
  "inventoryRecommendations": {
    "safetyStockIncrease": "...",
    "criticalComponents": [],
    "bufferBudgetEstimate": "..."
  },
  "urgencyLevel": "immediate|this-week|this-month|monitor",
  "keyMetrics": {
    "suppliersAtRisk": 0,
    "estimatedRevenueAtRisk": "...",
    "recoveryTimeObjective": "..."
  },
  "researchGrounded": ${disruptionSignals.length > 100}
}`;

    const result = await nimChat(
      "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 4000, temperature: 0.3 }
    );

    let parsed;
    try {
      const cleaned = result.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Model returned non-JSON supply chain analysis output");
    }

    if (parsed.riskScore === undefined || !parsed.mitigationPlan) {
      throw new Error("Incomplete supply chain analysis — supplier/product description may be too vague");
    }

    return {
      success: true,
      riskScore: parsed.riskScore,
      riskCategory: parsed.riskCategory || "unknown",
      disruptions: parsed.disruptions || [],
      alternativeSuppliers: parsed.alternativeSuppliers || [],
      mitigationPlan: parsed.mitigationPlan || {},
      inventoryRecommendations: parsed.inventoryRecommendations || {},
      urgencyLevel: parsed.urgencyLevel || "monitor",
      keyMetrics: parsed.keyMetrics || {},
      researchGrounded: disruptionSignals.length > 100,
      suppliers,
      products,
      region,
    };
  }, { label: "supply-chain", maxRetries: 1, inputSchema: INPUT_SCHEMA }),
});
