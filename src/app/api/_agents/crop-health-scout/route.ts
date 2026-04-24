/**
 * Crop health scout — analyze a field photo for disease, pest, nutrient,
 * and water-stress indicators.
 *
 * Scouting is a $3B/year service industry in US row crops alone.
 * Certified Crop Advisors (CCAs) charge $8-15/acre/year to walk fields
 * and diagnose problems visually. A mid-size farm (2,000 acres) pays
 * $20-30K/year for scouting services.
 *
 * This agent turns any smartphone into a first-pass scouting tool.
 * It won't fully replace a CCA — ground-truth diagnosis matters for
 * costly fungicide decisions — but it triages which fields need a
 * human visit vs. which look fine.
 *
 * Crops supported in the prompt: corn, soybeans, wheat, cotton, canola,
 * rice, potato, tomato, grape, citrus. The model handles others but
 * with lower confidence.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

const HealthFlagSchema = z.object({
  category: z.enum([
    "disease",
    "insect-pest",
    "weed-pressure",
    "nutrient-deficiency",
    "water-stress",
    "herbicide-injury",
    "mechanical-damage",
    "weather-damage",
    "unknown",
  ]),
  specificIssue: z.string().describe("e.g. 'Northern corn leaf blight', 'Aphid'"),
  severityLevel: z.enum(["trace", "low", "moderate", "high", "severe"]),
  confidence: z.enum(["low", "medium", "high"]),
  visualEvidence: z.string().describe("What in the image led to this call"),
  recommendedAction: z.string().describe("Next step (scout-more / treat / ignore)"),
  treatmentWindow: z.string().optional().describe("e.g. 'Apply within 5 days'"),
});

const CropHealthSchema = z.object({
  likelyCrop: z.string().optional(),
  growthStage: z
    .string()
    .optional()
    .describe("e.g. 'V6' (corn), 'R2' (soy), 'Heading'"),
  overallHealth: z.enum(["excellent", "good", "fair", "poor", "critical", "unknown"]),
  estimatedYieldImpactPct: z
    .number()
    .optional()
    .describe("Rough range low-end if no action taken"),
  flags: z.array(HealthFlagSchema).default([]),
  whatLooksGood: z.array(z.string()).default([]),
  scoutingRecommendation: z.enum([
    "no-action",
    "recheck-in-7-days",
    "recheck-in-48-hours",
    "schedule-cca-visit",
    "immediate-action-required",
  ]),
  followUpQuestionsForFarmer: z.array(z.string()).default([]),
  analysisCaveats: z
    .string()
    .describe(
      "What the photo couldn't tell you — e.g. 'Underside of leaves not visible; rust sporulation couldn't be confirmed'",
    ),
});

const EXTRACTION_PROMPT = `You are a certified-crop-advisor-grade field-health analyst.

Given a field photo, return structured crop-health analysis. Rules:
  - Identify the CROP first. If unsure, say "unknown" — don't guess between
    corn and sorghum when leaves are similar.
  - Growth stage matters: many diseases only matter at certain stages.
  - Issues are categorized by the enum. "Unknown" is acceptable when leaf
    symptoms are ambiguous.
  - Confidence: "high" = classic textbook presentation; "medium" = likely
    but would want a ground check; "low" = could be multiple things.
  - Severity: calibrate by yield-loss potential at current stage.
  - Recommendations must be SPECIFIC: "apply fungicide X rate Y" is better
    than "consider treatment".
  - whatLooksGood is for positive signals — healthy canopy, good stand,
    etc. This helps the farmer know you looked at the whole photo.
  - If the image is not a crop, return overallHealth: "unknown" with a
    caveat explaining what you see instead.
  - This is ADVISORY — always note what the photo can't show.

Return valid JSON only, no prose outside.`;

export const POST = createVisionAgentRoute({
  name: "crop-health-scout",
  model: "multimodal",
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: CropHealthSchema,
  extraMeta: {
    samVersion: "1.0",
    category: "Agriculture",
    disclaimer:
      "Advisory scouting. Ground-truth confirmation by a certified crop advisor recommended before costly interventions.",
  },
});
