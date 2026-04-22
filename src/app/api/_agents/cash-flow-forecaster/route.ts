import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * CASH-FLOW-FORECASTER — Historical transactions → 90-day cash-flow projection.
 *
 * Takes a series of historical transactions (income and expenses) and projects
 * forward with best/likely/worst scenarios, risks, and recommendations.
 *
 * Input:
 *   transactions: Array<{ date, amount, category, recurring? }>  (required)
 *   horizonDays?: number (30-180, default 90)
 *   startingBalance?: number
 *
 * Output (JSON):
 *   {
 *     projection: Array<{ date, expectedBalance, inflow, outflow }>,
 *     bestCase: number,
 *     likelyCase: number,
 *     worstCase: number,
 *     risks: string[],
 *     recommendations: string[]
 *   }
 *
 * Pairs with:
 *   - `expense-categorizer` — upstream to classify transaction categories
 *   - `invoice-extractor` — upstream to pull invoice data
 */

const CASH_FLOW_SYSTEM_PROMPT = `You are a CFO / corporate controller with deep experience in cash-flow planning for small-to-mid-market businesses.

${ANTI_SLOP_RULES}

## FORECASTING RULES
1. Recurring expenses (rent, payroll, subscriptions flagged recurring=true) are modeled as DEFINITE — they occur on schedule.
2. One-off transactions are PROBABILISTIC — sample from the historical distribution to project variance.
3. Best/worst case spread MUST reflect the historical volatility of one-off items, not arbitrary ±10% bands.
4. Flag every month (or period) where the worst-case balance dips below zero as a risk, with the specific month named.
5. Recommendations are ACTIONABLE (e.g. "negotiate 30-day terms with X vendor", not "reduce costs").
6. Never invent categories that weren't in the input. Aggregate sensibly if categories overlap.
7. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

type Transaction = {
  date: string;
  amount: number;
  category: string;
  recurring?: boolean;
};

export const POST = createAgentRoute({
  name: "cash-flow-forecaster",
  requiredFields: ["transactions"],
  handler: async ({ input }) => {
    const {
      transactions,
      horizonDays = 90,
      startingBalance = 0,
    } = input as {
      transactions: Transaction[];
      horizonDays?: number;
      startingBalance?: number;
    };

    const clampedHorizon = Math.max(30, Math.min(180, horizonDays));

    const prompt = `Forecast cash flow over the next ${clampedHorizon} days based on these historical transactions. Return ONLY valid JSON matching the schema.

STARTING BALANCE: ${startingBalance}
HORIZON: ${clampedHorizon} days

TRANSACTIONS:
${JSON.stringify(transactions.slice(0, 500), null, 2)}

SCHEMA:
{
  "projection": [ { "date": string, "expectedBalance": number, "inflow": number, "outflow": number } ],
  "bestCase": number,
  "likelyCase": number,
  "worstCase": number,
  "risks": [ string ],
  "recommendations": [ string ]
}`;

    const response = await ai(prompt, {
      system: CASH_FLOW_SYSTEM_PROMPT,
      maxTokens: 3000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Cash-flow forecast failed: model returned non-JSON output");
    }

    return { success: true, forecast: parsed };
  },
});
