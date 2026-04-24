/**
 * Menu Digitizer — extract structured menu items from a restaurant
 * menu image.
 *
 * Fields are shaped for POS / delivery-platform intake: each item
 * carries description, price, and any dietary tags (vegan, gf, etc.).
 * Closes a vertical-depth gap for restaurant operations.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

const MenuItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  currency: z.string().optional().describe("ISO 4217"),
  category: z.string().optional().describe("e.g. Appetizers, Entrées, Drinks"),
  dietaryTags: z
    .array(
      z.enum([
        "vegan",
        "vegetarian",
        "gluten_free",
        "dairy_free",
        "nut_free",
        "halal",
        "kosher",
        "organic",
        "spicy",
      ]),
    )
    .default([]),
  allergensNoted: z
    .array(z.string())
    .default([])
    .describe("Free-text allergen notes visible on the menu"),
});

const MenuSchema = z.object({
  restaurantName: z.string().optional(),
  menuType: z
    .enum(["dine_in", "takeout", "delivery", "breakfast", "lunch", "dinner", "unknown"])
    .default("unknown"),
  currency: z.string().optional().describe("Fallback if items don't specify"),
  items: z.array(MenuItemSchema),
  sections: z
    .array(z.string())
    .default([])
    .describe("Section headings in display order"),
  missingFields: z.array(z.string()).default([]),
});

const EXTRACTION_PROMPT = `You are a restaurant menu extractor for POS / delivery-platform intake.

Return JSON with:
  - restaurantName                (if the menu displays it)
  - menuType                      (enum above; use "unknown" if unclear)
  - currency                      (ISO 4217 code inferred from price format)
  - sections                      (headings in display order)
  - items                         (every menu item)
  - missingFields

Each item has:
  - name                          (the dish/drink name as printed)
  - description                   (one-line from the menu, optional)
  - priceCents                    (INTEGER CENTS — "$14.50" = 1450)
  - currency                      (per-item override if prices differ)
  - category                      (section name the item appears under)
  - dietaryTags                   (from the enum: vegan, vegetarian,
                                   gluten_free, dairy_free, nut_free,
                                   halal, kosher, organic, spicy)
  - allergensNoted                (free-text notes like "contains peanuts")

Rules:
  - CENTS ONLY for prices.
  - Preserve section order — downstream UIs render by position.
  - Skip prices listed as "market price" or "MP" — omit priceCents for those.
  - If this is not a menu, return items:[] + missingFields:["not a menu"].`;

export const POST = createVisionAgentRoute({
  name: "menu-digitizer",
  model: "ocr",
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: MenuSchema,
  extraMeta: { samVersion: "1.0", category: "Ecommerce" },
});
