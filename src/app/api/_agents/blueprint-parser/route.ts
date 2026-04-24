/**
 * Blueprint Parser — extract structured data from a construction
 * blueprint / floor-plan image.
 *
 * Unlocks construction + real-estate + facilities use cases. Output
 * is coordinate-aware (rooms, dimensions, door/window locations)
 * so downstream tools can render, simulate, or estimate on it.
 *
 * Caveat: blueprint OCR + spatial extraction is inherently approximate.
 * Confidence fields are surfaced so buyers know which measurements
 * to trust vs. verify manually.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

const RoomSchema = z.object({
  name: z.string().optional().describe("e.g. 'Bedroom 2', 'Master Bath'"),
  type: z
    .enum([
      "bedroom",
      "bathroom",
      "kitchen",
      "living",
      "dining",
      "office",
      "garage",
      "utility",
      "hallway",
      "closet",
      "other",
    ])
    .default("other"),
  lengthFeet: z.number().nonnegative().optional(),
  widthFeet: z.number().nonnegative().optional(),
  squareFeet: z.number().nonnegative().optional(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

const BlueprintSchema = z.object({
  scale: z
    .string()
    .optional()
    .describe("e.g. '1/4 inch = 1 foot' if visible on the blueprint"),
  totalSquareFeet: z.number().nonnegative().optional(),
  floorsShown: z.number().int().nonnegative().default(1),
  rooms: z.array(RoomSchema),
  doorsCount: z.number().int().nonnegative().optional(),
  windowsCount: z.number().int().nonnegative().optional(),
  bathroomsCount: z.number().nonnegative().optional(),
  bedroomsCount: z.number().int().nonnegative().optional(),
  legend: z
    .array(z.object({ symbol: z.string(), meaning: z.string() }))
    .default([])
    .describe("Symbols explained in the blueprint's legend"),
  qualityFlags: z
    .array(z.string())
    .default([])
    .describe("e.g. scale_missing, rotated_view, partial_page"),
  missingFields: z.array(z.string()).default([]),
  disclaimer: z
    .string()
    .default(
      "Blueprint extraction is approximate. Verify critical measurements before construction or compliance use.",
    ),
});

const EXTRACTION_PROMPT = `You are a construction blueprint / floor-plan extractor.

Extract structural + room data from the image and return JSON.

Top-level fields:
  - scale                    (e.g. "1/4 inch = 1 foot")
  - totalSquareFeet
  - floorsShown              (integer, default 1)
  - rooms                    (see RoomSchema below)
  - doorsCount, windowsCount
  - bathroomsCount           (0.5 allowed for half-baths)
  - bedroomsCount
  - legend                   (array of { symbol, meaning } from the key)
  - qualityFlags             (scale_missing, rotated_view, partial_page,
                              low_contrast, multiple_floors_overlaid, ...)
  - missingFields
  - disclaimer               (include verbatim — type default)

Each room has:
  - name                     (if labeled on the blueprint)
  - type                     (enum: bedroom, bathroom, kitchen, living,
                              dining, office, garage, utility, hallway,
                              closet, other)
  - lengthFeet, widthFeet, squareFeet (any you can derive)
  - confidence               (high / medium / low based on label clarity +
                              visible dimensions)

Rules:
  - Measurements in FEET, not inches (convert if necessary).
  - If the scale is illegible, still report rooms but leave dimensions
    off and flag scale_missing.
  - Don't fabricate measurements. If you can't derive a value,
    omit the field + add it to missingFields.
  - If this is not a blueprint / floor plan, return empty rooms +
    qualityFlags: ["not_a_blueprint"].`;

export const POST = createVisionAgentRoute({
  name: "blueprint-parser",
  model: "document",
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: BlueprintSchema,
  extraMeta: { samVersion: "1.0", category: "Real Estate" },
});
