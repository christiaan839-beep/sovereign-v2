/**
 * GROWTH PULSE — Vertical 3 cornerstone deliverable.
 *
 * Designed for the single-owner / 1–20 person SMB in South Africa,
 * Nigeria, Kenya, Egypt, or any emerging-market locale where USD-only
 * AI tools are priced out of reach. Bills in ZAR (R349 / month tier).
 *
 * One business → five locale-aware monthly assets:
 *
 *   1. Local SEO checklist — Google Business Profile, locale-specific
 *      keywords, NAP consistency, Maps optimisation steps.
 *   2. Four social posts in the business's voice (Instagram caption,
 *      Facebook post, LinkedIn update, X post). Locale + currency
 *      aware (Rands, not dollars).
 *   3. Customer re-engagement email targeting dormant customers.
 *   4. WhatsApp broadcast template — Africa's dominant SMB channel,
 *      written in opt-in friendly tone, with the right segmentation cue.
 *   5. ZAR / NGN / KES "limited offer" card — a specific promotion in
 *      local currency with end-date suggestion + redemption mechanic.
 *
 * Why this deliverable:
 *   African SMBs are sat on a real gap — every well-funded competitor
 *   (Lindy, Manus, Sintra) bills in USD and writes for US/EU markets.
 *   Sovereign's value prop here is not "more agents" but "an AI tool
 *   that knows my market, my currency, my channel mix." That's the
 *   moat USD-only competitors can't replicate without rebuilding their
 *   billing layer + content models.
 *
 * Architecture mirrors agency-packet + sourcing-sprint:
 *   - Single safety pipeline at the createAgentRoute boundary.
 *   - Five pure async generators called via Promise.allSettled.
 *   - Locale + currency parameters flow through every system prompt.
 */
import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";
import { savePacket } from "@/lib/packet-store";
import { z } from "zod";

const log = createLogger("growth-pulse");

// ─── Input schema ──────────────────────────────────────────────────────────

export const growthPulseSchema = z.object({
  businessName: z.string().min(2).max(80),
  businessDescription: z.string().min(20).max(2000),
  industry: z.string().min(2).max(80),
  /** Where the business operates — informs SEO, currency, channel mix. */
  locale: z
    .enum([
      "ZA",
      "NG",
      "KE",
      "EG",
      "GH",
      "ZM",
      "ZW",
      "BW",
      "MA",
      "TN",
      "global-emerging",
    ])
    .default("ZA"),
  /** Currency to bill the offer card in. Auto-derived from locale if absent. */
  currency: z.enum(["ZAR", "NGN", "KES", "EGP", "GHS", "USD"]).optional(),
  /** Brand voice the social posts should match. */
  brandVoice: z
    .enum(["warm", "professional", "casual", "playful", "direct"])
    .default("warm"),
  /** Top 1–3 services the business sells (anchors the offer card). */
  topServices: z.array(z.string().min(2).max(80)).min(1).max(3),
  /** Optional URL — sharpens the local-SEO checklist. */
  websiteUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type GrowthPulseInput = z.infer<typeof growthPulseSchema>;

// ─── Output types ──────────────────────────────────────────────────────────

export interface SeoChecklist {
  priorityFix: string;
  items: Array<{ task: string; why: string; estimatedMinutes: number }>;
  localKeywords: string[];
}

export interface SocialPost {
  platform: "Instagram" | "Facebook" | "LinkedIn" | "X";
  caption: string;
  hashtags: string[];
  charCount: number;
}

export interface ReEngagementEmail {
  subject: string;
  body: string;
  segment: string;
}

export interface WhatsappBroadcast {
  template: string;
  segmentationCue: string;
  optInDisclaimer: string;
  charCount: number;
}

export interface OfferCard {
  headline: string;
  description: string;
  priceLabel: string;
  validUntilSuggestion: string;
  redemptionMechanic: string;
  currency: GrowthPulseInput["currency"];
}

export interface GrowthPulse {
  business: { name: string; locale: string; currency: string };
  generatedAt: string;
  durationMs: number;
  brandVoice: GrowthPulseInput["brandVoice"];
  seo: SeoChecklist | null;
  socialPosts: SocialPost[] | null;
  reEngagementEmail: ReEngagementEmail | null;
  whatsapp: WhatsappBroadcast | null;
  offer: OfferCard | null;
  errors: Array<{ asset: string; message: string }>;
}

// ─── Locale → currency / context mapping ──────────────────────────────────

const LOCALE_CURRENCY: Record<
  GrowthPulseInput["locale"],
  "ZAR" | "NGN" | "KES" | "EGP" | "GHS" | "USD"
> = {
  ZA: "ZAR",
  NG: "NGN",
  KE: "KES",
  EG: "EGP",
  GH: "GHS",
  ZM: "USD",
  ZW: "USD",
  BW: "USD",
  MA: "USD",
  TN: "USD",
  "global-emerging": "USD",
};

const LOCALE_CONTEXT: Record<GrowthPulseInput["locale"], string> = {
  ZA: "South Africa. Cape Town / Joburg / Durban metros. Reference Pick n Pay, Takealot, Yoco where contextually right. Use 'load-shedding' if relevant. Date format DD/MM/YYYY. Decimals with comma, thousands with space (R1 250,00).",
  NG: "Nigeria. Lagos / Abuja / Port Harcourt. WhatsApp dominates SMB-to-customer channels. Reference 'naija' colloquially when tone fits. Date DD/MM/YYYY.",
  KE: "Kenya. Nairobi / Mombasa. M-Pesa is the default payment rail; reference it where relevant. Sheng-aware but professional default.",
  EG: "Egypt. Cairo / Alexandria. Primarily Arabic-speaking — output in English unless Arabic is requested explicitly. Reference Ramadan / Eid timings if seasonally relevant.",
  GH: "Ghana. Accra / Kumasi. Mobile money via MTN MoMo / Vodafone Cash. Date DD/MM/YYYY.",
  ZM: "Zambia. Lusaka. Mobile money widespread. Date DD/MM/YYYY.",
  ZW: "Zimbabwe. Harare. USD pricing common; ZWL volatility means USD is often safer for offer cards.",
  BW: "Botswana. Gaborone. Pula (BWP) — but offer cards in USD given small market size.",
  MA: "Morocco. Casablanca / Rabat. French + Arabic + English context.",
  TN: "Tunisia. Tunis. French + Arabic + English context.",
  "global-emerging":
    "Generic emerging-market context. Bias toward mobile-first, WhatsApp / Telegram channels, USD pricing for international acceptance.",
};

const VOICE_GUIDE: Record<GrowthPulseInput["brandVoice"], string> = {
  warm: "Warm and human. First-name energy. Genuine without being sappy.",
  professional:
    "Crisp, confident, expert-but-accessible. Short sentences and concrete numbers.",
  casual:
    "Conversational, light, contractions welcome. Speak like a smart friend.",
  playful: "Witty, punny, energetic. Lean into local references when they fit.",
  direct: "Punchy, opinionated, no hedge words. Short paragraphs.",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function commonContextBlock(input: GrowthPulseInput): string {
  return `BUSINESS: ${input.businessName} — ${input.businessDescription}
INDUSTRY: ${input.industry}
LOCALE CONTEXT: ${LOCALE_CONTEXT[input.locale]}
VOICE: ${VOICE_GUIDE[input.brandVoice]}
TOP SERVICES: ${input.topServices.join(", ")}
${input.websiteUrl ? `WEBSITE: ${input.websiteUrl}` : ""}`;
}

function parseJsonOrThrow<T>(raw: string, asset: string): T {
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/u, "")
    .replace(/\s*```\s*$/u, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    log.warn("growth-pulse asset returned non-JSON", {
      asset,
      raw: cleaned.slice(0, 300),
    });
    throw new Error(
      `${asset}: model returned non-JSON (${(err as Error).message})`,
    );
  }
}

export function resolveCurrency(
  input: GrowthPulseInput,
): GrowthPulseInput["currency"] {
  return input.currency ?? LOCALE_CURRENCY[input.locale];
}

// ─── Asset generators ──────────────────────────────────────────────────────

export async function generateSeo(
  input: GrowthPulseInput,
): Promise<SeoChecklist> {
  const system = `You are a local-SEO specialist for emerging-market SMBs.

${commonContextBlock(input)}

Output ONLY valid JSON:
{
  "priorityFix": "string — the ONE highest-impact fix for this business this month",
  "items": [
    { "task": "string — concrete action", "why": "string — 1 sentence", "estimatedMinutes": number }
    /* exactly 6 items */
  ],
  "localKeywords": ["string", ...] /* 5-8 keywords combining service + location, e.g. "plumber Cape Town", "salon Sea Point" */
}

Items must be specific and concrete: "Add NAP to footer with consistent format" beats "improve SEO."
Estimated minutes should be honest: most local-SEO fixes take 5-30 minutes each.

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai("Produce the local-SEO checklist JSON.", {
    system,
    maxTokens: 1100,
    taskType: "analysis",
  });
  const parsed = parseJsonOrThrow<SeoChecklist>(raw, "seo");
  if (!Array.isArray(parsed.items) || parsed.items.length < 5) {
    throw new Error("SEO checklist returned fewer than 5 items.");
  }
  return parsed;
}

export async function generateSocialPosts(
  input: GrowthPulseInput,
): Promise<SocialPost[]> {
  const system = `You write organic social posts for an SMB in this locale.

${commonContextBlock(input)}

Output ONLY a valid JSON array of exactly 4 objects:
[
  {
    "platform": "Instagram" | "Facebook" | "LinkedIn" | "X",
    "caption": "string — platform-appropriate length (Instagram 150-300 chars, Facebook 100-250, LinkedIn 200-450, X ≤270 chars)",
    "hashtags": ["string", ...] /* 3-6 hashtags, locale-aware */
  }
]

Posts must:
- Match the locale (currency in Rands not dollars where relevant; local references where natural).
- Match the voice guide.
- Each one has a single concrete asset: a customer story, a service highlight, a behind-the-scenes moment, or a question to engage.
- Hashtags should mix one branded, one local (#CapeTownBusiness etc), and a few service-specific.

Return ONLY the JSON array. No prose, no fence.`;

  const raw = await ai("Produce 4 social posts.", {
    system,
    maxTokens: 1400,
    taskType: "creative",
  });
  const parsed = parseJsonOrThrow<Array<Omit<SocialPost, "charCount">>>(
    raw,
    "socialPosts",
  );
  if (!Array.isArray(parsed) || parsed.length < 4) {
    throw new Error("Social-posts generator returned fewer than 4 posts.");
  }
  return parsed.slice(0, 4).map((p) => ({
    platform: p.platform,
    caption: p.caption,
    hashtags: p.hashtags,
    charCount: p.caption.length,
  }));
}

export async function generateReEngagementEmail(
  input: GrowthPulseInput,
): Promise<ReEngagementEmail> {
  const system = `You write re-engagement emails to customers who haven't bought in 90+ days.

${commonContextBlock(input)}

Output ONLY valid JSON:
{
  "subject": "string — 5-8 words, curiosity-driven, no spam triggers",
  "body": "string — 100-180 words, 2-3 short paragraphs, ONE specific CTA",
  "segment": "string — one sentence describing who this email is for"
}

The email should:
- Acknowledge time has passed without being awkward.
- Lead with what's NEW since they last engaged (not a discount).
- End with one specific next step.
- Not start with "I hope this email finds you well" or "circling back."

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai("Produce the re-engagement email.", {
    system,
    maxTokens: 800,
    taskType: "creative",
  });
  return parseJsonOrThrow<ReEngagementEmail>(raw, "reEngagementEmail");
}

export async function generateWhatsapp(
  input: GrowthPulseInput,
): Promise<WhatsappBroadcast> {
  const system = `You write WhatsApp Business broadcast templates that don't feel spammy.

${commonContextBlock(input)}

WhatsApp is the dominant SMB-to-customer channel in many emerging markets. The template must:
- Be short (under 600 chars). WhatsApp users skim.
- Open with the customer's first name placeholder: {{first_name}}.
- Lead with value, not the offer.
- End with a clear opt-out instruction (compliance: WhatsApp requires this for marketing broadcasts).
- Suggest a segment to send this to (e.g. "Customers who purchased in Q1 but not since").

Output ONLY valid JSON:
{
  "template": "string — the message body with {{first_name}} placeholder",
  "segmentationCue": "string — who this should be sent to",
  "optInDisclaimer": "string — short opt-out line included in the template"
}

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai("Produce the WhatsApp template.", {
    system,
    maxTokens: 700,
    taskType: "creative",
  });
  const parsed = parseJsonOrThrow<Omit<WhatsappBroadcast, "charCount">>(
    raw,
    "whatsapp",
  );
  return { ...parsed, charCount: parsed.template.length };
}

export async function generateOfferCard(
  input: GrowthPulseInput,
): Promise<OfferCard> {
  const currency = resolveCurrency(input);
  const system = `You design limited-time offer cards for SMBs.

${commonContextBlock(input)}
CURRENCY: ${currency}

Output ONLY valid JSON:
{
  "headline": "string — ≤60 chars, punchy",
  "description": "string — 2-3 sentences max",
  "priceLabel": "string — exact price label using ${currency} symbol/format (e.g. R349, ₦4,500, KSh 1,200, $19)",
  "validUntilSuggestion": "string — recommend an end date (eg 'End of next month' or specific calendar event)",
  "redemptionMechanic": "string — exact mechanic: 'Use code XYZ at checkout', 'Mention this offer in WhatsApp', 'Show this card in store'"
}

The offer should anchor on ONE of the top services, not all of them.
Currency formatting must match the locale: South Africa uses 'R' before number with no space (R349); Nigeria '₦' or 'NGN'; Kenya 'KSh'; Egypt 'E£' or 'EGP'.

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai("Produce the offer card.", {
    system,
    maxTokens: 600,
    taskType: "creative",
  });
  const parsed = parseJsonOrThrow<Omit<OfferCard, "currency">>(raw, "offer");
  return { ...parsed, currency };
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

export async function buildGrowthPulse(
  input: GrowthPulseInput,
): Promise<GrowthPulse> {
  const start = Date.now();
  const currency = resolveCurrency(input);

  const [seoR, socialR, emailR, waR, offerR] = await Promise.allSettled([
    generateSeo(input),
    generateSocialPosts(input),
    generateReEngagementEmail(input),
    generateWhatsapp(input),
    generateOfferCard(input),
  ]);

  const errors: GrowthPulse["errors"] = [];
  const recordError = (asset: string, r: PromiseSettledResult<unknown>) => {
    if (r.status === "rejected") {
      errors.push({
        asset,
        message:
          r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  };
  recordError("seo", seoR);
  recordError("socialPosts", socialR);
  recordError("reEngagementEmail", emailR);
  recordError("whatsapp", waR);
  recordError("offer", offerR);

  return {
    business: {
      name: input.businessName,
      locale: input.locale,
      currency: currency || "USD",
    },
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    brandVoice: input.brandVoice,
    seo: seoR.status === "fulfilled" ? seoR.value : null,
    socialPosts: socialR.status === "fulfilled" ? socialR.value : null,
    reEngagementEmail: emailR.status === "fulfilled" ? emailR.value : null,
    whatsapp: waR.status === "fulfilled" ? waR.value : null,
    offer: offerR.status === "fulfilled" ? offerR.value : null,
    errors,
  };
}

// ─── Route export ──────────────────────────────────────────────────────────

export const POST = createAgentRoute({
  name: "growth-pulse",
  schema: growthPulseSchema,
  useCritic: false,
  handler: async ({ input, userId }) => {
    const parsed = growthPulseSchema.parse(input);
    const pulse = await buildGrowthPulse(parsed);

    const packetId = await savePacket({
      userId,
      kind: "growth-pulse",
      input: parsed,
      output: pulse as unknown as Record<string, unknown>,
      errorCount: pulse.errors.length,
      durationMs: pulse.durationMs,
    });

    return {
      ...(pulse as unknown as Record<string, unknown>),
      packetId,
    };
  },
});
