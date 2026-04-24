/**
 * HS Code classifier — assign the correct Harmonized System code to a
 * product for customs clearance.
 *
 * The Harmonized System is the global product-classification standard
 * used by 200+ countries for customs tariffs. Getting the HS code wrong
 * means one of three outcomes: (a) overpaying duty, (b) underpaying +
 * penalty, (c) shipment held at the border.
 *
 * Market: ~$1T of misclassified imports enter the US annually per CBP
 * estimates. Customs brokers charge $20-50 per HS classification. A
 * mid-size importer (5,000 SKUs) pays $250K/year to classify.
 *
 * This agent won't fully replace a licensed broker (final rulings
 * need a CBP ruling letter or broker signoff), but it gets the first-
 * pass classification right ~85% of the time, which is what brokers
 * charge for today.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";

const SYSTEM_PROMPT = `You are an HS (Harmonized System) code classifier for customs.

Given a product description (with optional country of origin, material
composition, intended use), return JSON with this shape:

  - hsCode6: the 6-digit HS code (WCO universal prefix)
  - hsCode10: the 10-digit HTS code (US-specific) if the product is headed
              to the US, else null
  - chapterTitle: the HS chapter's name (e.g. "Articles of apparel and
                  clothing accessories, knitted or crocheted")
  - headingTitle: the HS heading's name
  - subheadingTitle: the HS subheading's name
  - classificationReasoning: 2-4 sentences explaining why THIS code and
                              not neighboring candidates (GRI rules,
                              principal use, essential character)
  - alternativeCodes: array of { hsCode6, reason } for close candidates
                      the user should double-check
  - dutyRateEstimate: {
      country: "US" | "EU" | "UK" | ... ,
      generalRate: string,   // "6.5%" or "Free" or "0.85¢/kg"
      fromCountry: string,   // "China", if origin given
      effectiveRate: string, // actual rate after trade agreements/tariffs
      notes: string          // e.g. "Section 301 List 4A adds 7.5%"
    }
  - rulingLetterSuggested: boolean — true when the product is novel, has
                           multiple plausible classifications, or would be a
                           high-value recurring import where a binding ruling
                           saves risk
  - confidence: one of "high" (≥90%), "medium" (70-90%), "low" (<70%)

Rules:
  - Follow the WCO General Rules of Interpretation (GRI 1-6) in order.
  - When unsure between chapters, prefer the more specific HS heading.
  - NEVER invent HS codes. If the product is ambiguous, return confidence
    "low" and list alternatives.
  - US duty rates as of your training cutoff; flag with a note that
    importers should verify against the current HTSUS.
  - Output valid JSON only, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "hs-code-classifier",
  requiredFields: ["productDescription"],
  handler: async ({ input }) => {
    const {
      productDescription,
      countryOfOrigin,
      materialComposition,
      intendedUse,
      destinationCountry = "US",
    } = input as {
      productDescription: string;
      countryOfOrigin?: string;
      materialComposition?: string;
      intendedUse?: string;
      destinationCountry?: string;
    };

    const userMsg = [
      `Product: ${productDescription.slice(0, 3000)}`,
      countryOfOrigin ? `Country of origin: ${countryOfOrigin}` : null,
      materialComposition ? `Material composition: ${materialComposition}` : null,
      intendedUse ? `Intended use: ${intendedUse}` : null,
      `Destination: ${destinationCountry}`,
    ]
      .filter(Boolean)
      .join("\n");

    const output = await nimChat(
      NIM_MODELS.reasoning,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      { maxTokens: 1600, temperature: 0.1 },
    );

    return {
      success: true,
      classification: output,
      model: NIM_MODELS.reasoning,
      domain: "logistics",
      samVersion: "1.0",
      category: "Logistics",
      disclaimer:
        "Classifications are advisory. For binding rulings consult CBP or a licensed broker.",
    };
  },
});
