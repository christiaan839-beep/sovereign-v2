import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * ABANDONED-CART-WINBACK — Generate a win-back email sequence for an abandoned cart.
 *
 * Given cart contents and a short customer persona hint, returns a timed
 * email sequence (usually 3 emails) with subject, body, CTA, and a toggle
 * for when to surface a discount placeholder.
 *
 * Input:
 *   {
 *     cartContents:     Array<{ productName, price, quantity }>,
 *     customerHint:     string,   // NL: purchase history or persona
 *     brandVoice?:      string,
 *     discountAllowed?: boolean   // default true
 *   }
 *
 * Output (JSON):
 *   {
 *     sequence: Array<{
 *       sendAfterHours, subject, body, cta,
 *       includesDiscount, offerIfApplicable
 *     }>,
 *     predictedRecoveryRate: string,
 *     toneJustification:     string,
 *     exitCriteria:          string[]
 *   }
 */

const ABANDONED_CART_WINBACK_SYSTEM_PROMPT = `You are a retention-email copywriter who has recovered $80M of abandoned-cart revenue across e-commerce brands. You write emails that feel human — not a discount dump in a glittery template.

${ANTI_SLOP_RULES}

## WIN-BACK RULES
1. NEVER fabricate specific discount amounts, order numbers, or customer history. Use the placeholder {DISCOUNT_CODE} in copy, and note in offerIfApplicable exactly how the brand should configure it (e.g. "10% off threshold orders only", "free-shipping code, no discount needed").
2. Predictions (predictedRecoveryRate) MUST be ranges, not point numbers — e.g. "8-14% recovery typical for single-item carts in this category". No made-up lift percentages.
3. Sequence: exactly 3 emails by default, spaced 1h → 24h → 72h after abandonment. If discountAllowed is false, skip the discount ask entirely (all three includesDiscount = false).
4. includesDiscount is true ONLY on the third email when discountAllowed is true. Earlier emails MUST rely on value reminders, not price cuts.
5. offerIfApplicable is null when includesDiscount is false. When true, it is a one-sentence note naming the offer type and any restrictions the merchant should apply — NOT a dollar amount.
6. subject: under 50 characters. No emojis unless customerHint indicates a playful brand voice.
7. body: 60-120 words. One CTA. No reply-hungry postscripts stacking multiple asks.
8. cta: action-first, max 5 words (e.g. "Finish your order", "See your saved cart").
9. toneJustification: 1-2 sentences connecting tone to the supplied brandVoice and customerHint. If brandVoice is missing, default to "warm, direct, low-pressure" and say so.
10. exitCriteria: 2-4 items describing when to stop the sequence (e.g. "customer completes checkout", "customer unsubscribes", "cart contents change", "7 days elapse").
11. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "abandoned-cart-winback",
  requiredFields: ["cartContents", "customerHint"],
  handler: async ({ input }) => {
    const { cartContents, customerHint, brandVoice, discountAllowed } = input as {
      cartContents: Array<{ productName: string; price: number; quantity: number }>;
      customerHint: string;
      brandVoice?: string;
      discountAllowed?: boolean;
    };

    const discountPolicy = discountAllowed === false ? false : true;

    const prompt = `Write a win-back email sequence for this abandoned cart. Return ONLY valid JSON matching the schema.

CART CONTENTS:
${JSON.stringify(cartContents, null, 2)}

CUSTOMER HINT:
${customerHint}

BRAND VOICE:
${brandVoice ?? "(not supplied — default to warm, direct, low-pressure)"}

DISCOUNT ALLOWED: ${discountPolicy}

SCHEMA:
{
  "sequence": [
    {
      "sendAfterHours": number,
      "subject": string,
      "body": string,
      "cta": string,
      "includesDiscount": boolean,
      "offerIfApplicable": string | null
    }
  ],
  "predictedRecoveryRate": string,
  "toneJustification": string,
  "exitCriteria": [ string ]
}`;

    const response = await ai(prompt, {
      system: ABANDONED_CART_WINBACK_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Cart win-back generation failed: model returned non-JSON output");
    }

    return { success: true, winback: parsed };
  },
});
