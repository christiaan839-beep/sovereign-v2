import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * PRODUCT-DESCRIPTION-WRITER — Generate e-commerce product page copy
 * tailored to Shopify / Amazon / Etsy / generic marketplaces.
 *
 * Input:
 *   {
 *     productName:   string,
 *     features:      string | string[],
 *     targetMarket:  string,
 *     platform?:     "shopify" | "amazon" | "etsy" | "generic",
 *     brandVoice?:   string
 *   }
 *
 * Output:
 *   {
 *     shortDescription:    string,
 *     longDescription:     string,
 *     bulletPoints:        string[],
 *     seoTitle:            string,
 *     seoMetaDescription:  string
 *   }
 *
 * Pairs with:
 *   - `seo-keyword-finder` — upstream keyword intel
 *   - `image-gen` — product photography
 */

const PRODUCT_SYSTEM_PROMPT = `You are a senior e-commerce copywriter shipping high-converting product pages.

${ANTI_SLOP_RULES}

## COPY RULES
1. Lead with benefit, not feature. "Wakes you up without the jitters" beats "Contains 80mg caffeine".
2. Platform tuning:
   - Amazon: heavy on bullets; bullets do the selling; long description lighter.
   - Shopify: narrative long description; tell a story; lifestyle-first.
   - Etsy: emphasize craft, material, maker story, dimensions, handmade detail.
   - generic: balanced approach.
3. Never fabricate ingredients, certifications, awards, or materials that weren't provided. If a feature wasn't given, do not invent one.
4. SEO title: ~60 chars, keyword-front-loaded. SEO meta: ~155 chars, compelling click-through.
5. Bullet points: 5 items, each starts with a benefit verb (e.g. "Eliminates", "Fits", "Lasts").

## OUTPUT FORMAT
Return five sections separated by the literal delimiters below.
===SHORT===
<1-2 sentence hook>
===LONG===
<2-4 paragraph narrative>
===BULLETS===
<five bullet lines, one per line>
===SEO_TITLE===
<60-char SEO title>
===SEO_META===
<155-char meta description>`;

export const POST = createAgentRoute({
  name: "product-description-writer",
  requiredFields: ["productName", "features", "targetMarket"],
  handler: async ({ input }) => {
    const { productName, features, targetMarket, platform, brandVoice } =
      input as {
        productName: string;
        features: string | string[];
        targetMarket: string;
        platform?: string;
        brandVoice?: string;
      };

    const featuresText = Array.isArray(features)
      ? features.map((f) => `- ${f}`).join("\n")
      : String(features);

    const prompt = `Write product page copy.

Product: ${productName}
Platform: ${platform ?? "generic"}
Target market: ${targetMarket}
Brand voice: ${brandVoice ?? "professional, confident"}

Features:
${featuresText}`;

    const response = await ai(prompt, {
      system: PRODUCT_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    const raw = String(response);
    const shortDescription =
      raw.split("===SHORT===")[1]?.split("===LONG===")[0]?.trim() ?? "";
    const longDescription =
      raw.split("===LONG===")[1]?.split("===BULLETS===")[0]?.trim() ?? "";
    const bulletsRaw =
      raw.split("===BULLETS===")[1]?.split("===SEO_TITLE===")[0]?.trim() ?? "";
    const seoTitle =
      raw.split("===SEO_TITLE===")[1]?.split("===SEO_META===")[0]?.trim() ?? "";
    const seoMetaDescription = raw.split("===SEO_META===")[1]?.trim() ?? "";

    const bulletPoints = bulletsRaw
      .split("\n")
      .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
      .filter((line) => line.length > 0);

    return {
      success: true,
      result: {
        shortDescription,
        longDescription,
        bulletPoints,
        seoTitle,
        seoMetaDescription,
      },
    };
  },
});
