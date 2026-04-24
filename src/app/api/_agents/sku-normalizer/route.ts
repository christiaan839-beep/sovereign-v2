/**
 * SKU Normalizer — take messy product titles / descriptions from multiple
 * vendors and emit a canonical product record that can be deduped across
 * catalogs.
 *
 * Retail + marketplace operators get the same SKU from 5 vendors with
 * 5 different titles:
 *   "BMW OEM Front Brake Pad Set 34-11-6-858-047"
 *   "BMW X3 Front Brakes Pads Kit  341168580 47"
 *   "OEM #34116858047 Brake Pad Set - BMW X3/X5"
 * All describe the same OEM brake pad. Humans spot this instantly;
 * algorithms struggle. This agent normalizes title + attributes + IDs
 * into a canonical record keyed on manufacturer-part-number.
 *
 * Output plugs into Shopify, Akeneo, NetSuite, Salsify catalog schemas.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";

const SYSTEM_PROMPT = `You are a retail SKU normalizer. Given a messy
product title + optional description, emit a canonical product record.

Output JSON:

{
  "canonical": {
    "title": "string",                      // cleaned title, no SEO cruft
    "brand": "string | null",
    "manufacturerPartNumber": "string | null",  // OEM / MPN, dashes normalized
    "upc": "string | null",                  // 12-digit UPC if present
    "gtin": "string | null",                 // 14-digit GTIN if present
    "asin": "string | null",                 // Amazon ASIN if present
    "category": "string | null",
    "subcategory": "string | null",
    "attributes": {
      "color": "string | null",
      "size": "string | null",
      "material": "string | null",
      "compatibleWith": ["string"],          // e.g. ["BMW X3 2011-2017", "BMW X5 2014-2018"]
      "pack": number | null,                  // units per pack
      "weight": { "value": number, "unit": "oz" | "lb" | "g" | "kg" } | null
    }
  },
  "signals": {
    "confidence": "high" | "medium" | "low",
    "dedupFingerprint": "string",             // stable hash-derivable key
    "likelyDuplicateOf": [
      "string"                                 // fingerprints this likely matches
    ]
  },
  "enrichment": {
    "suggestedTitle": "string",               // SEO-reasonable version
    "missingFields": ["string"],
    "dataQualityFlags": ["string"]             // e.g. "compatibleWith guessed from title, not verified"
  }
}

Rules:
  1. dedupFingerprint should be deterministic on (brand, MPN, UPC). If any
     of those are present, the fingerprint MUST include them. Format:
     "brand:mpn:upc" with unknowns as empty strings.
  2. NEVER invent MPN / UPC / GTIN. Only emit what's clearly in the input.
  3. Strip marketing suffixes ("2024 Updated Version", "Free Shipping",
     "Hot Sale", "Genuine") from the canonical title.
  4. Compatible-with lists should only include vehicles/models explicitly
     mentioned. Don't infer ("probably fits X Series" is NOT allowed).
  5. Return valid JSON only. No prose outside.`;

export const POST = createAgentRoute({
  name: "sku-normalizer",
  requiredFields: ["title"],
  handler: async ({ input }) => {
    const { title, description, vendor, rawAttributes } = input as {
      title: string;
      description?: string;
      vendor?: string;
      rawAttributes?: string;
    };

    const userMsg = [
      `Title: ${title.slice(0, 500)}`,
      vendor ? `Vendor: ${vendor}` : null,
      description ? `Description:\n${description.slice(0, 4000)}` : null,
      rawAttributes ? `Raw attributes:\n${rawAttributes.slice(0, 2000)}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const output = await nimChat(
      NIM_MODELS.reasoning,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      { maxTokens: 1800, temperature: 0.1 },
    );

    return {
      success: true,
      normalized: output,
      model: NIM_MODELS.reasoning,
      domain: "retail",
      samVersion: "1.0",
      category: "Ecommerce",
    };
  },
});
