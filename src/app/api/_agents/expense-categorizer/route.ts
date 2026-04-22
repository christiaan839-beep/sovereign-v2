import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * EXPENSE-CATEGORIZER — Classify bank/credit-card transactions into
 * accounting categories (IRS Schedule C taxonomy).
 *
 * Input:
 *   { transaction: string }    — free-text charge description
 *
 * Output (JSON):
 *   {
 *     category:          string,
 *     subcategory:       string,
 *     deductibleLikely:  boolean,
 *     confidence:        number (0-1),
 *     rationale:         string
 *   }
 *
 * Pairs with:
 *   - `invoice-extractor` — upstream line items
 *   - `tax-deduction-finder` — downstream tax optimization
 */

const EXPENSE_SYSTEM_PROMPT = `You are a trained accountant who categorizes business expenses using the IRS Schedule C taxonomy.

${ANTI_SLOP_RULES}

## CATEGORIZATION RULES
1. Use canonical IRS Schedule C categories: Advertising, Car & Truck, Commissions, Contract Labor, Depreciation, Insurance, Interest, Legal & Professional, Office Expense, Rent (Vehicle/Equipment), Rent (Other), Repairs, Supplies, Taxes & Licenses, Travel, Meals (50%), Utilities, Wages, Other.
2. If the transaction is ambiguous, cannot be confidently mapped, or looks personal, return category "Unclassified" with a rationale explaining what's unclear — NEVER guess.
3. deductibleLikely is TRUE only when the charge is clearly ordinary-and-necessary for a typical business. Personal-sounding charges (groceries, personal entertainment) MUST be false.
4. confidence is your own calibrated probability, not the model's eagerness. If uncertain, use <= 0.5.
5. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "expense-categorizer",
  requiredFields: ["transaction"],
  handler: async ({ input }) => {
    const { transaction } = input as { transaction: string };

    const prompt = `Classify this transaction. Return ONLY valid JSON.

TRANSACTION:
"""
${String(transaction).slice(0, 2_000)}
"""

SCHEMA:
{
  "category": string,
  "subcategory": string,
  "deductibleLikely": boolean,
  "confidence": number,
  "rationale": string
}`;

    const response = await ai(prompt, {
      system: EXPENSE_SYSTEM_PROMPT,
      maxTokens: 700,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Expense categorization failed: model returned non-JSON output");
    }

    return { success: true, result: parsed };
  },
});
