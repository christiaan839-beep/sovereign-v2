import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * INVOICE-EXTRACTOR — Extract structured data from invoice text.
 *
 * Takes an invoice's OCR'd text or raw content and returns a typed
 * JSON object with vendor, totals, line items, dates, and tax info.
 *
 * Input:
 *   { text: string }               — Invoice text (from OCR or pasted)
 *
 * Output (JSON):
 *   {
 *     vendor:      { name, address?, email?, phone?, taxId? },
 *     invoice:     { number, date, dueDate?, currency },
 *     lineItems:   Array<{ description, quantity, unitPrice, total }>,
 *     totals:      { subtotal, tax, total },
 *     confidence:  number (0-1),
 *     warnings:    string[]   // e.g. "line item #3 total mismatch"
 *   }
 *
 * Pairs with:
 *   - `florence-ocr` — upstream PDF → text
 *   - `expense-categorizer` — downstream categorization
 */

const INVOICE_SYSTEM_PROMPT = `You are an accounts-payable specialist trained to extract structured data from invoice documents with surgical precision.

${ANTI_SLOP_RULES}

## EXTRACTION RULES
1. Never fabricate values. If a field is absent or unreadable, return null — not a guess.
2. Line-item totals MUST equal quantity × unitPrice. If they don't, include a warning but preserve what the document actually says.
3. Sum of line totals MUST equal subtotal; subtotal + tax MUST equal grand total. Flag any discrepancy in warnings[].
4. Currency codes use ISO 4217 ("USD", "EUR", "ZAR"). If only a symbol ($, £, €, R) is shown, infer conservatively and note in warnings.
5. Dates are ISO 8601 (YYYY-MM-DD). If ambiguous (e.g. "03/04/2026" could be March or April), infer from surrounding locale clues and flag in warnings.
6. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "invoice-extractor",
  requiredFields: ["text"],
  handler: async ({ input }) => {
    const { text } = input as { text: string };

    const prompt = `Extract structured data from this invoice. Return ONLY valid JSON matching the schema.

INVOICE TEXT:
"""
${text.slice(0, 15_000)}
"""

SCHEMA:
{
  "vendor": { "name": string, "address": string|null, "email": string|null, "phone": string|null, "taxId": string|null },
  "invoice": { "number": string, "date": string, "dueDate": string|null, "currency": string },
  "lineItems": [ { "description": string, "quantity": number, "unitPrice": number, "total": number } ],
  "totals": { "subtotal": number, "tax": number, "total": number },
  "confidence": number,
  "warnings": [ string ]
}`;

    const response = await ai(prompt, {
      system: INVOICE_SYSTEM_PROMPT,
      maxTokens: 2000,
      model: "claude", // Claude reliable at structured extraction
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Invoice extraction failed: model returned non-JSON output");
    }

    return { success: true, extracted: parsed };
  },
});
