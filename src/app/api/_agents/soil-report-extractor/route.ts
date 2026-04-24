/**
 * Soil report extractor — extract structured nutrient data from a
 * soil test lab PDF (A&L Labs, Spectrum Analytic, Waypoint, etc.).
 *
 * Farm operations receive 10-50 soil reports per season. The data is
 * needed to generate variable-rate fertilizer prescriptions, lime
 * recommendations, and cover-crop decisions. Today that data is
 * manually keyed into John Deere Operations Center, Climate FieldView,
 * or SMS Ag by a farm office admin.
 *
 * Competitive context: AgVend and CropX have partial OCR. None offer
 * a standalone agent. This is a clean whitespace play.
 *
 * Output format is compatible with John Deere's Soil Test Results JSON
 * schema so it can be imported directly into Operations Center.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

const NutrientReadingSchema = z.object({
  nutrient: z.string().describe("e.g. 'Phosphorus (P)', 'Potassium (K)', 'Calcium'"),
  value: z.number(),
  unit: z.string().describe("e.g. 'ppm', 'lbs/ac', 'meq/100g'"),
  rating: z
    .enum(["very-low", "low", "medium", "high", "very-high", "optimum", "unknown"])
    .optional(),
  labMethod: z.string().optional().describe("e.g. 'Bray-1', 'Mehlich-3', 'Olsen'"),
});

const SoilReportSchema = z.object({
  lab: z
    .object({
      name: z.string().optional(),
      reportNumber: z.string().optional(),
      accreditation: z.string().optional().describe("e.g. 'NAPT', 'ALP'"),
    })
    .optional(),
  grower: z
    .object({
      name: z.string().optional(),
      farmName: z.string().optional(),
      fieldId: z.string().optional(),
    })
    .optional(),
  sampleDate: z.string().optional().describe("ISO-8601"),
  reportDate: z.string().optional().describe("ISO-8601"),
  sampleDepthInches: z.number().optional(),
  texture: z
    .string()
    .optional()
    .describe("e.g. 'Silt loam', 'Sandy clay', 'Clay loam'"),
  ph: z.number().optional(),
  bufferPh: z.number().optional(),
  organicMatterPct: z.number().optional(),
  cecMeqPer100g: z.number().optional().describe("Cation Exchange Capacity"),
  baseSaturationPct: z
    .object({
      calcium: z.number().optional(),
      magnesium: z.number().optional(),
      potassium: z.number().optional(),
      sodium: z.number().optional(),
      hydrogen: z.number().optional(),
    })
    .optional(),
  macroNutrients: z.array(NutrientReadingSchema).default([]),
  micronutrients: z.array(NutrientReadingSchema).default([]),
  salinityDsPerMeter: z.number().optional(),
  labRecommendations: z
    .object({
      limeRateTonsPerAcre: z.number().optional(),
      nPoundsPerAcre: z.number().optional(),
      p2O5PoundsPerAcre: z.number().optional(),
      k2OPoundsPerAcre: z.number().optional(),
      sulfurPoundsPerAcre: z.number().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  missingFields: z.array(z.string()).default([]),
});

const EXTRACTION_PROMPT = `You are a soil-test-report data extractor for precision agriculture.

Extract the structured nutrient data from the lab report image. Return JSON matching
the schema. Rules:

  - pH is always a decimal (6.5 not 65).
  - Organic matter is a percentage (e.g. 3.2 not 0.032).
  - Nutrient ratings ("Low", "Med", "High") must be normalized to the enum.
  - "Very Low" maps to "very-low". "Med" or "M" maps to "medium". "Opt" maps to "optimum".
  - Preserve the lab's unit of measure — DON'T convert ppm to lbs/ac silently.
  - Lab recommendations (lime, N, P2O5, K2O) are normalized to pounds-per-acre.
  - Boron, copper, iron, manganese, zinc go in micronutrients.
  - N, P, K, Ca, Mg, S go in macroNutrients.
  - CEC is reported in meq/100g (sometimes cmol+/kg — same value).
  - If a value is illegible, omit it + add the field path to missingFields.
  - If the document is not a soil test, return { missingFields: ["not-a-soil-report"] }.`;

export const POST = createVisionAgentRoute({
  name: "soil-report-extractor",
  model: "document",
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: SoilReportSchema,
  extraMeta: { samVersion: "1.0", category: "Agriculture" },
});
