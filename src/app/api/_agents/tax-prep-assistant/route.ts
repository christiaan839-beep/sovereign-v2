import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * TAX-PREP-ASSISTANT — Income + expenses → tax summary, deduction leads, and red flags.
 *
 * Takes a breakdown of income sources and expenses and produces a summary
 * (total income, total deductible, estimated taxable income), a list of
 * deduction opportunities with confidence ratings, audit red flags, and a
 * mandatory professional-advice disclaimer.
 *
 * IMPORTANT: this agent is advisory only. Every response includes a disclaimer
 * reminding the user it is not a replacement for a licensed tax professional.
 *
 * Input:
 *   income:    Array<{ source: string, amount: number, type: "w2"|"1099"|"business"|"investment"|"other" }>  (required)
 *   expenses:  Array<{ category: string, amount: number, description: string }>                              (required)
 *   jurisdiction?:  "US"|"SA"|"UK"|"EU"|"other"         (default "US")
 *   filingStatus?:  string                              (e.g. "single", "married_jointly")
 *
 * Output (JSON):
 *   {
 *     summary: { totalIncome: number, totalDeductible: number, estimatedTaxableIncome: number },
 *     deductionOpportunities: Array<{
 *       category: string,
 *       amount: number,
 *       form: string,
 *       confidence: "high"|"medium"|"low"
 *     }>,
 *     redFlags: string[],
 *     disclaimer: string
 *   }
 *
 * Pairs with:
 *   - `expense-categorizer` — upstream to cleanly categorize raw transactions
 *   - `invoice-extractor`  — upstream to surface deductible business invoices
 */

const TAX_SYSTEM_PROMPT = `You are a tax-preparation assistant — not a tax attorney, not a CPA. You organize numbers and surface likely deduction categories, while making uncertainty explicit at every step.

${ANTI_SLOP_RULES}

## TAX RULES
1. NEVER fabricate tax rates, bracket thresholds, or refund amounts. Do NOT output a dollar-amount "tax owed" or "refund" — compute only totalIncome, totalDeductible, and estimatedTaxableIncome (= totalIncome - totalDeductible).
2. NEVER invent form numbers. For US jurisdiction, use only real forms you're confident about (Schedule C, Schedule A, Form 8283, etc.). If uncertain, set form="requires verification" and confidence="low".
3. For non-US jurisdictions (SA, UK, EU, other), DO NOT guess form names. Set form to a generic description like "local business-expense schedule" and confidence="low".
4. Every deductionOpportunity MUST be traceable to an item in the input expenses[]. Do not invent categories.
5. confidence ratings:
   - high   = clearly allowable for the stated jurisdiction and type (e.g. W2 standard deduction)
   - medium = commonly deducted but depends on facts (home office, vehicle)
   - low    = aggressive or jurisdiction-uncertain — flag in redFlags too
6. redFlags list audit-risk items: round numbers, high business-meal ratios, commingled personal/business, loss-year patterns, etc. Be specific ("Home office deduction claimed without square-footage evidence") not generic ("aggressive deductions").
7. disclaimer field MUST include the literal sentence: "Not a replacement for a licensed tax professional."
8. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

type IncomeEntry = {
  source: string;
  amount: number;
  type: "w2" | "1099" | "business" | "investment" | "other";
};
type ExpenseEntry = { category: string; amount: number; description: string };
type Jurisdiction = "US" | "SA" | "UK" | "EU" | "other";

export const POST = createAgentRoute({
  name: "tax-prep-assistant",
  requiredFields: ["income", "expenses"],
  handler: async ({ input }) => {
    const {
      income,
      expenses,
      jurisdiction = "US",
      filingStatus,
    } = input as {
      income: IncomeEntry[];
      expenses: ExpenseEntry[];
      jurisdiction?: Jurisdiction;
      filingStatus?: string;
    };

    const prompt = `Produce a tax-prep summary. Return ONLY valid JSON matching the schema.

JURISDICTION: ${jurisdiction}
FILING STATUS: ${filingStatus ?? "unspecified"}

INCOME:
${JSON.stringify(income.slice(0, 200), null, 2)}

EXPENSES:
${JSON.stringify(expenses.slice(0, 500), null, 2)}

SCHEMA:
{
  "summary": {
    "totalIncome": number,
    "totalDeductible": number,
    "estimatedTaxableIncome": number
  },
  "deductionOpportunities": [
    {
      "category": string,
      "amount": number,
      "form": string,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "redFlags": [ string ],
  "disclaimer": string
}

REMINDER: disclaimer MUST include the sentence "Not a replacement for a licensed tax professional."`;

    const response = await ai(prompt, {
      system: TAX_SYSTEM_PROMPT,
      maxTokens: 2800,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Tax prep failed: model returned non-JSON output");
    }

    // Defense-in-depth: even if the model omits the disclaimer, we enforce it.
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "disclaimer" in (parsed as Record<string, unknown>)
    ) {
      const obj = parsed as Record<string, unknown>;
      const d = typeof obj.disclaimer === "string" ? obj.disclaimer : "";
      if (!d.includes("Not a replacement for a licensed tax professional")) {
        obj.disclaimer = `${d}${d ? " " : ""}Not a replacement for a licensed tax professional.`.trim();
      }
    }

    return { success: true, taxPrep: parsed };
  },
});
