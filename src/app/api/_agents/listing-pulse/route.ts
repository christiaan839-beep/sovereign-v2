/**
 * REAL-ESTATE LISTING PULSE — Vertical 4 cornerstone deliverable.
 *
 * Designed for the residential real-estate agent who lists 3–15
 * properties a quarter and currently spends a Saturday per listing
 * writing copy, scheduling open houses, and emailing buyer lists.
 *
 * One property → five production-ready listing assets:
 *
 *   1. MLS-grade listing description (≥ 250 words, structured: hook,
 *      key features, neighborhood, lifestyle, closing CTA).
 *   2. Open-house social posts: Instagram caption, Facebook post,
 *      WhatsApp invite (residential agents live in WhatsApp).
 *   3. Buyer-introduction email blast — for the agent's existing
 *      buyer list, segmented by "active buyers in this price band".
 *   4. Comparable-property analysis (3 comps with reasoning) — what
 *      similar properties sold for and how this listing differs.
 *   5. Suburb / neighborhood market update one-pager — talking points
 *      the agent can drop into Stories, voice notes, or a buyer call.
 *
 * Same architecture as the other three packets:
 *   - Single safety pipeline at the createAgentRoute boundary.
 *   - Five pure async generators in parallel via Promise.allSettled.
 *   - Generators exported for direct test / scheduler reuse.
 */
import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";
import { savePacket } from "@/lib/packet-store";
import { z } from "zod";

const log = createLogger("realestate-pulse");

// ─── Input schema ──────────────────────────────────────────────────────────

export const listingPulseSchema = z
  .object({
    /** Address or property identifier — used as the listing anchor. */
    propertyAddress: z.string().min(5).max(200),
    /** Suburb / neighborhood — drives the local-market section. */
    suburb: z.string().min(2).max(80),
    /** Price label as it should appear ("R3 950 000", "$895,000"). */
    priceLabel: z.string().min(2).max(40),
    /** Currency for the comp analysis + offer-card style numbers. */
    currency: z.enum(["ZAR", "USD", "GBP", "EUR", "AUD"]).default("ZAR"),
    /** Property type — drives the description voice. */
    propertyType: z
      .enum([
        "house",
        "apartment",
        "townhouse",
        "estate",
        "smallholding",
        "commercial",
      ])
      .default("house"),
    bedrooms: z.number().int().min(0).max(20).default(3),
    bathrooms: z.number().int().min(0).max(20).default(2),
    /** Floor area in square meters (or square feet — agent's choice). */
    areaLabel: z.string().max(40).optional(),
    /** Bullet list of highlights (1–8). The agent's "why this is special". */
    keyFeatures: z.array(z.string().min(2).max(120)).min(1).max(8),
    /** Optional ICP for the listing — e.g. "young families", "downsizers". */
    targetBuyer: z.string().max(200).optional(),
    /** Agent's name — appears in CTAs. */
    agentName: z.string().min(2).max(80),
    /** Brand voice for the listing description. */
    brandVoice: z
      .enum(["luxury", "warm", "professional", "casual", "punchy"])
      .default("warm"),
  })
  .strict();

export type ListingPulseInput = z.infer<typeof listingPulseSchema>;

// ─── Output types ──────────────────────────────────────────────────────────

export interface ListingDescription {
  headline: string;
  body: string;
  wordCount: number;
  metaSnippet: string;
}

export interface OpenHouseSocial {
  instagram: { caption: string; hashtags: string[] };
  facebook: { caption: string; hashtags: string[] };
  whatsapp: { message: string; segmentationCue: string };
}

export interface BuyerEmail {
  subject: string;
  body: string;
  segment: string;
}

export interface CompAnalysis {
  comps: Array<{
    descriptor: string;
    soldOrListed: string;
    differentiator: string;
  }>;
  positioningNote: string;
}

export interface MarketUpdate {
  headline: string;
  bullets: string[];
  voiceNoteOpener: string;
}

export interface ListingPulse {
  property: { address: string; suburb: string; priceLabel: string };
  generatedAt: string;
  durationMs: number;
  brandVoice: ListingPulseInput["brandVoice"];
  listing: ListingDescription | null;
  social: OpenHouseSocial | null;
  buyerEmail: BuyerEmail | null;
  comps: CompAnalysis | null;
  marketUpdate: MarketUpdate | null;
  errors: Array<{ asset: string; message: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const VOICE_GUIDE: Record<ListingPulseInput["brandVoice"], string> = {
  luxury:
    "Restrained, considered, evocative. Concrete details (oak parquet, north-facing) over adjectives. Never use 'luxurious'.",
  warm: "Inviting, human, lifestyle-led. Picture the family who lives here. Avoid hard-sell.",
  professional:
    "Crisp, factual, agent-of-record voice. Lead with specs, close with a clear CTA.",
  casual:
    "Conversational, contractions welcome. The neighbour-recommending-a-friend tone.",
  punchy: "Short sentences. Strong claims. One opinion per paragraph.",
};

function commonContextBlock(input: ListingPulseInput): string {
  return `PROPERTY: ${input.propertyAddress}, ${input.suburb}
TYPE: ${input.bedrooms}-bed ${input.bathrooms}-bath ${input.propertyType}${input.areaLabel ? ` · ${input.areaLabel}` : ""}
PRICE: ${input.priceLabel} (${input.currency})
KEY FEATURES: ${input.keyFeatures.join(", ")}
${input.targetBuyer ? `TARGET BUYER: ${input.targetBuyer}` : ""}
AGENT: ${input.agentName}
VOICE: ${VOICE_GUIDE[input.brandVoice]}`;
}

function parseJsonOrThrow<T>(raw: string, asset: string): T {
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/u, "")
    .replace(/\s*```\s*$/u, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return stripUnderscoreKeys(parsed) as T;
  } catch (err) {
    log.warn("listing-pulse asset returned non-JSON", {
      asset,
      raw: cleaned.slice(0, 300),
    });
    throw new Error(
      `${asset}: model returned non-JSON (${(err as Error).message})`,
    );
  }
}

/**
 * Defense vs LLM-injected envelope keys (security-review-2026-05).
 * The LLM emits the JSON we asked for, but a prompt-injection attack
 * could try to set `_meta` / `_proto` / `_criticFeedback` / etc. We
 * strip every top-level underscore-prefixed key on the parsed output
 * before it flows into the orchestrator and gets persisted.
 */
function stripUnderscoreKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUnderscoreKeys(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith("_")) continue;
      out[k] = v;
    }
    return out as T;
  }
  return value;
}

// ─── Asset generators ──────────────────────────────────────────────────────

export async function generateListingDescription(
  input: ListingPulseInput,
): Promise<ListingDescription> {
  const system = `You write residential property listing copy for a real-estate agent.

${commonContextBlock(input)}

Output ONLY valid JSON:
{
  "headline": "string — single line, ≤80 chars, evocative not generic",
  "body": "string — 250-400 word listing description in clean Markdown. Structure: opening hook, key features (paragraph form, not bullets), neighbourhood / lifestyle paragraph, closing CTA paragraph mentioning the agent.",
  "metaSnippet": "string — ≤155 char summary for portal search results"
}

Hard rules:
- No "luxurious", "stunning", "must-see", "won't last".
- Use the actual feature words from KEY FEATURES.
- Mention ${input.suburb} once in the lifestyle paragraph.
- Close with a sentence that mentions ${input.agentName}.

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai("Produce the listing description.", {
    system,
    maxTokens: 1500,
    taskType: "creative",
  });
  const parsed = parseJsonOrThrow<Omit<ListingDescription, "wordCount">>(
    raw,
    "listing",
  );
  return {
    ...parsed,
    wordCount: parsed.body.split(/\s+/).filter(Boolean).length,
  };
}

export async function generateOpenHouseSocial(
  input: ListingPulseInput,
): Promise<OpenHouseSocial> {
  const system = `You write open-house social-media posts for a residential real-estate agent.

${commonContextBlock(input)}

Output ONLY valid JSON:
{
  "instagram": {
    "caption": "string — 150-280 chars, lifestyle-led, end with a soft CTA",
    "hashtags": ["string", ...] /* 4-6 hashtags */
  },
  "facebook": {
    "caption": "string — 100-220 chars, slightly more direct than Instagram",
    "hashtags": ["string", ...] /* 3-5 hashtags */
  },
  "whatsapp": {
    "message": "string — under 400 chars, written for an agent's WhatsApp Status / broadcast list",
    "segmentationCue": "string — one sentence on which buyers in their CRM should see this first"
  }
}

Each post must:
- Reference at least one specific feature from KEY FEATURES.
- Mention the suburb ${input.suburb}.
- The Instagram caption ends with the agent's contact ask ("DM ${input.agentName} for the open-house slot").

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai("Produce the open-house social pack.", {
    system,
    maxTokens: 1100,
    taskType: "creative",
  });
  return parseJsonOrThrow<OpenHouseSocial>(raw, "social");
}

export async function generateBuyerEmail(
  input: ListingPulseInput,
): Promise<BuyerEmail> {
  const system = `You write a new-listing email blast for a residential agent's existing buyer list.

${commonContextBlock(input)}

The email targets buyers who registered interest in ${input.suburb} or in this price band. The agent will send via their CRM.

Output ONLY valid JSON:
{
  "subject": "string — 5-9 words, no spam triggers, no ALL CAPS",
  "body": "string — 110-190 words in plain prose (no headers). Lead with a specific feature, not a price drop. Include an explicit invite to the open house. Sign off as ${input.agentName}.",
  "segment": "string — one sentence describing exactly which CRM segment should receive this"
}

No "We're excited to announce". No "I hope this email finds you well". Lead with the property.

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai("Produce the buyer email.", {
    system,
    maxTokens: 800,
    taskType: "creative",
  });
  return parseJsonOrThrow<BuyerEmail>(raw, "buyerEmail");
}

export async function generateCompAnalysis(
  input: ListingPulseInput,
): Promise<CompAnalysis> {
  const system = `You produce a comparable-property analysis for a real-estate agent's pricing conversation.

${commonContextBlock(input)}

Output ONLY valid JSON:
{
  "comps": [
    {
      "descriptor": "string — generic descriptor like '4-bed Victorian on the same street, sold last month'",
      "soldOrListed": "string — e.g. 'Sold for ${input.priceLabel} (${input.currency})' — be plausible relative to the subject's price",
      "differentiator": "string — one specific reason the subject is more or less than this comp"
    }
    /* exactly 3 comps */
  ],
  "positioningNote": "string — 2-3 sentences explaining how to talk about this listing's price relative to comps"
}

Be honest about positioning — sometimes the subject is priced ABOVE comps; explain why with concrete features.
Don't invent specific addresses or sale dates. Use generic descriptors.

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai("Produce the comp analysis.", {
    system,
    maxTokens: 900,
    taskType: "analysis",
  });
  const parsed = parseJsonOrThrow<CompAnalysis>(raw, "comps");
  if (!Array.isArray(parsed.comps) || parsed.comps.length < 3) {
    throw new Error("Comp analysis returned fewer than 3 comps.");
  }
  return parsed;
}

export async function generateMarketUpdate(
  input: ListingPulseInput,
): Promise<MarketUpdate> {
  const system = `You write a one-page market update for ${input.suburb} that the agent can drop into Stories or a buyer phone call.

${commonContextBlock(input)}

Output ONLY valid JSON:
{
  "headline": "string — ≤70 chars, suburb-specific, one number front-and-centre",
  "bullets": ["string", ...] /* exactly 5 bullets, each ≤30 words, each citing a specific market signal (days-on-market, list-to-sale ratio, inventory tightness, school-district pull, infrastructure changes) */
  "voiceNoteOpener": "string — first 15 seconds of a casual voice note the agent can record from this update, around 50 words"
}

Bullets should mix factual market signals with one lifestyle / behavioural signal (e.g. 'first-time-buyer enquiries up since the new BRT line opened').
No filler.

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai("Produce the market update.", {
    system,
    maxTokens: 900,
    taskType: "analysis",
  });
  const parsed = parseJsonOrThrow<MarketUpdate>(raw, "marketUpdate");
  if (!Array.isArray(parsed.bullets) || parsed.bullets.length < 4) {
    throw new Error("Market update returned fewer than 4 bullets.");
  }
  return parsed;
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

export async function buildListingPulse(
  input: ListingPulseInput,
): Promise<ListingPulse> {
  const start = Date.now();

  const [listingR, socialR, emailR, compsR, marketR] = await Promise.allSettled(
    [
      generateListingDescription(input),
      generateOpenHouseSocial(input),
      generateBuyerEmail(input),
      generateCompAnalysis(input),
      generateMarketUpdate(input),
    ],
  );

  const errors: ListingPulse["errors"] = [];
  const recordError = (asset: string, r: PromiseSettledResult<unknown>) => {
    if (r.status === "rejected") {
      errors.push({
        asset,
        message:
          r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  };
  recordError("listing", listingR);
  recordError("social", socialR);
  recordError("buyerEmail", emailR);
  recordError("comps", compsR);
  recordError("marketUpdate", marketR);

  return {
    property: {
      address: input.propertyAddress,
      suburb: input.suburb,
      priceLabel: input.priceLabel,
    },
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    brandVoice: input.brandVoice,
    listing: listingR.status === "fulfilled" ? listingR.value : null,
    social: socialR.status === "fulfilled" ? socialR.value : null,
    buyerEmail: emailR.status === "fulfilled" ? emailR.value : null,
    comps: compsR.status === "fulfilled" ? compsR.value : null,
    marketUpdate: marketR.status === "fulfilled" ? marketR.value : null,
    errors,
  };
}

// ─── Route export ──────────────────────────────────────────────────────────

export const POST = createAgentRoute({
  name: "listing-pulse",
  schema: listingPulseSchema,
  useCritic: false,
  handler: async ({ input, userId }) => {
    const parsed = listingPulseSchema.parse(input);
    const pulse = await buildListingPulse(parsed);

    const packetId = await savePacket({
      userId,
      kind: "listing-pulse",
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
