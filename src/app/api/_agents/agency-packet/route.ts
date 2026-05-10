/**
 * AGENCY CONTENT PACKET — Vertical 1 cornerstone deliverable.
 *
 * One call → four production-ready assets, branded for one of the agency's
 * SMB clients:
 *
 *   1. Long-form SEO blog post (≥ 1,500 words, structured headings)
 *   2. Three-email welcome / nurture sequence
 *   3. Three platform-specific ad creatives (LinkedIn / Meta / Google)
 *   4. Competitor weakness + market gap teaser (one of each)
 *
 * Why this exists:
 *   B2B agencies (SEO / content / ad) pay $200/mo each for SEMrush,
 *   Copy.ai, Apollo, Calendly Premium, and a growing pile of single-
 *   purpose tools. Sovereign's value prop to them is not "agents" — it
 *   is "one weekly packet per client, whitelabel-ready." This route is
 *   that packet.
 *
 * Architecture:
 *   - Single safety pipeline at the createAgentRoute boundary. Inner
 *     ai() calls are pure logic (no per-call factory wrap) so we get
 *     four independent generations in parallel rather than four serial
 *     HTTP round-trips through internal /api/agents/* endpoints.
 *   - Promise.allSettled — one failed sub-asset never sinks the packet.
 *     The caller sees which assets succeeded and which need a re-run.
 *   - Strict zod input. Strict typed output. No "any" leaking.
 *
 * Reuse:
 *   - generateBlog/Sequence/Ads/Competitor are exported so the test
 *     suite (and any future scheduler / cron / playbook) can call them
 *     directly without going through HTTP.
 */
import { createAgentRoute } from "@/lib/agent-factory";
import { ai, research_ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";
import { savePacket } from "@/lib/packet-store";
import { publicHttpUrlSchema } from "@/lib/safe-url";
import { z } from "zod";

const log = createLogger("agency-packet");

// ─── Input schema ──────────────────────────────────────────────────────────

export const agencyPacketSchema = z
  .object({
    /** Domain of the agency's CLIENT (the SMB end-customer). */
    clientDomain: z
      .string()
      .min(3)
      .max(120)
      .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a domain like acmecorp.com"),
    /** Display name for the client (shown in deliverable headers). */
    clientName: z.string().min(2).max(80),
    /** One paragraph: what the client does + their differentiator. */
    clientDescription: z.string().min(20).max(2000),
    /** Who the client sells to. One sentence. */
    audience: z.string().min(5).max(400),
    /** The brand voice the deliverables should match. */
    brandVoice: z
      .enum(["professional", "casual", "technical", "friendly", "bold"])
      .default("professional"),
    /** 1–5 keywords / topics to anchor the SEO blog post. */
    primaryKeywords: z.array(z.string().min(2).max(80)).max(5).default([]),
    /** Optional competitor URL for the competitive-intel section. */
    competitorUrl: publicHttpUrlSchema
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .strict();

export type AgencyPacketInput = z.infer<typeof agencyPacketSchema>;

// ─── Output types ──────────────────────────────────────────────────────────

export interface BlogAsset {
  title: string;
  body: string;
  wordCount: number;
  metaDescription: string;
  primaryKeyword: string;
}

export interface EmailAsset {
  sequenceName: string;
  emails: Array<{
    stepNumber: number;
    delayDays: number;
    subject: string;
    body: string;
  }>;
}

export interface AdAsset {
  platform: "LinkedIn" | "Meta" | "Google";
  hook: string;
  headline: string;
  primaryText: string;
  callToAction: string;
}

export interface CompetitorAsset {
  competitor: string;
  topWeakness: {
    issue: string;
    exploit: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
  };
  topGap: { gap: string; opportunity: string };
}

export interface AgencyPacket {
  client: { name: string; domain: string };
  generatedAt: string;
  durationMs: number;
  brandVoice: AgencyPacketInput["brandVoice"];
  blog: BlogAsset | null;
  emailSequence: EmailAsset | null;
  ads: AdAsset[] | null;
  competitor: CompetitorAsset | null;
  errors: Array<{ asset: string; message: string }>;
}

// ─── Asset generators (pure functions — testable, reusable) ─────────────────

/** Defense vs LLM-injected envelope keys (security-review-2026-05).
 * Strip every top-level (and nested) underscore-prefixed key from the
 * parsed model output before it flows into the orchestrator. */
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

const VOICE_GUIDE: Record<AgencyPacketInput["brandVoice"], string> = {
  professional:
    "Crisp, confident, expert-but-accessible. Avoid jargon. Use short sentences and concrete numbers.",
  casual:
    "Conversational, warm, light. Use contractions. Speak like a smart friend explaining over coffee.",
  technical:
    "Precise, specific, comfortable with terminology. Cite mechanisms and trade-offs. No marketing fluff.",
  friendly:
    "Warm, encouraging, generous. First-name energy. Genuine without being sappy.",
  bold: "Punchy, direct, opinionated. Strong claims. Short paragraphs. No hedge words.",
};

export async function generateBlog(
  input: AgencyPacketInput,
): Promise<BlogAsset> {
  const primaryKeyword =
    input.primaryKeywords[0] ||
    `${input.clientName} ${input.audience.split(" ").slice(0, 2).join(" ")}`;
  const keywordsList =
    input.primaryKeywords.length > 0
      ? input.primaryKeywords.join(", ")
      : primaryKeyword;

  // Best-effort live research. If it fails, the post is still grounded
  // in the client description but we flag absence in the meta line.
  let research = "";
  try {
    research = await research_ai(
      `${primaryKeyword} 2026 trends statistics`,
      `Find 3-5 recent statistics or data points about "${primaryKeyword}" the post can cite.`,
    );
  } catch (err) {
    log.warn("research_ai unavailable for agency-packet blog", {
      keyword: primaryKeyword,
      error: String(err),
    });
  }

  const system = `You are a senior agency copywriter writing under a brand voice guide.

VOICE: ${VOICE_GUIDE[input.brandVoice]}

CLIENT: ${input.clientName} — ${input.clientDescription}
AUDIENCE: ${input.audience}

Output a long-form SEO blog post in clean Markdown. Hard requirements:
- Title (H1, single line)
- 5–8 H2 sections with 1–3 H3 subsections each where useful
- 1,500–2,200 words total
- Lead with a hook, not a definition
- Use the primary keyword "${primaryKeyword}" 4–8 times naturally
- Include at least 3 specific data points or named examples
- End with a single concrete call-to-action that points at ${input.clientName}
- No filler phrases ("In today's fast-paced world", "leverage", "delve")
- No marketing slop ("revolutionize", "game-changer", "world-class")

After the post, output a separator line: "---META---"
Then output exactly two lines:
META_DESCRIPTION: <155-character meta description, factual>
PRIMARY_KEYWORD: ${primaryKeyword}`;

  const userPrompt = `Topic anchor: ${primaryKeyword}
Other relevant keywords to use sparingly: ${keywordsList}
${research ? `Recent research the post may reference:\n${research.slice(0, 1500)}` : "Live research is unavailable; ground the post in the client description."}

Write the full post now.`;

  const raw = await ai(userPrompt, {
    system,
    maxTokens: 4000,
    taskType: "creative",
  });

  // Split off the META block.
  const metaIdx = raw.indexOf("---META---");
  const body = (metaIdx >= 0 ? raw.slice(0, metaIdx) : raw).trim();
  const metaBlock = metaIdx >= 0 ? raw.slice(metaIdx + 10) : "";

  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() || `${input.clientName} insights`;

  const metaDescMatch = metaBlock.match(/META_DESCRIPTION:\s*(.+)/);
  const metaDescription =
    metaDescMatch?.[1]?.trim() ||
    `${title} — ${input.clientDescription.slice(0, 100)}`;

  const wordCount = body
    .replace(/[#*`_\-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    title,
    body,
    wordCount,
    metaDescription: metaDescription.slice(0, 160),
    primaryKeyword,
  };
}

export async function generateEmailSequence(
  input: AgencyPacketInput,
): Promise<EmailAsset> {
  const system = `You build short, useful email drip sequences for ${input.clientName}.

VOICE: ${VOICE_GUIDE[input.brandVoice]}

CLIENT: ${input.clientName} — ${input.clientDescription}
AUDIENCE: ${input.audience}

Output ONLY valid JSON matching this exact shape:
{
  "sequenceName": "string — short label",
  "emails": [
    { "stepNumber": 1, "delayDays": 0, "subject": "string", "body": "string" },
    { "stepNumber": 2, "delayDays": 2, "subject": "string", "body": "string" },
    { "stepNumber": 3, "delayDays": 5, "subject": "string", "body": "string" }
  ]
}

EMAIL RULES:
- Subject lines: 5–8 words, curiosity-driven, no spam triggers ("free", "!!!", ALL CAPS)
- Body: 120–220 words each
- Each email delivers standalone value — never just teases the next one
- One CTA per email, action-oriented
- No "I hope this email finds you well", no "circling back", no "just checking in"

Return ONLY the JSON. No prose, no code fence.`;

  const userPrompt = `Build the welcome / first-touch sequence for ${input.clientName} aimed at: ${input.audience}.

Email 1 — first contact, deliver one specific insight.
Email 2 — surface one common mistake the audience makes.
Email 3 — soft pitch with one concrete next action.`;

  const raw = await ai(userPrompt, {
    system,
    maxTokens: 1800,
    taskType: "creative",
  });

  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/u, "")
    .replace(/\s*```\s*$/u, "")
    .trim();

  const parsed = stripUnderscoreKeys(JSON.parse(cleaned)) as EmailAsset;
  if (!Array.isArray(parsed.emails) || parsed.emails.length < 3) {
    throw new Error("Email-sequence model returned fewer than 3 emails.");
  }
  return parsed;
}

export async function generateAds(
  input: AgencyPacketInput,
): Promise<AdAsset[]> {
  const system = `You generate ad copy for three platforms: LinkedIn, Meta (Instagram / Facebook), Google.

VOICE: ${VOICE_GUIDE[input.brandVoice]}

CLIENT: ${input.clientName} — ${input.clientDescription}
AUDIENCE: ${input.audience}

Output ONLY a valid JSON array of exactly 3 objects:
[
  { "platform": "LinkedIn", "hook": "string", "headline": "string (≤40 chars)", "primaryText": "string (2–3 short paragraphs)", "callToAction": "string" },
  { "platform": "Meta", "hook": "string", "headline": "string (≤40 chars)", "primaryText": "string (2–3 short paragraphs)", "callToAction": "string" },
  { "platform": "Google", "hook": "string", "headline": "string (≤30 chars)", "primaryText": "string (Google text-ad style — short, benefit-led)", "callToAction": "string" }
]

PLATFORM TONES:
- LinkedIn: professional, B2B-credible, lead with a metric or capability.
- Meta: casual, scroll-stopping, lead with a specific pain.
- Google: direct, transactional, lead with the outcome.

NO marketing slop. Every headline must stop the scroll. CTA must be one of: Learn More, Book Demo, Get Started, See Pricing, Try Free, Contact Sales.

Return ONLY the JSON array. No prose, no fence.`;

  const userPrompt = `Three ads, one per platform, all selling ${input.clientName} to ${input.audience}.`;

  const raw = await ai(userPrompt, {
    system,
    maxTokens: 1400,
    taskType: "creative",
  });

  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/u, "")
    .replace(/\s*```\s*$/u, "")
    .trim();

  const parsed = stripUnderscoreKeys(JSON.parse(cleaned)) as AdAsset[];
  if (!Array.isArray(parsed) || parsed.length < 3) {
    throw new Error("Ads model returned fewer than 3 ads.");
  }
  return parsed.slice(0, 3);
}

export async function generateCompetitor(
  input: AgencyPacketInput,
): Promise<CompetitorAsset | null> {
  if (!input.competitorUrl) return null;

  const competitorHost = input.competitorUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  let intel = "";
  try {
    intel = await research_ai(
      `site:${competitorHost} pricing positioning weaknesses`,
      `Find 3 specific things about ${competitorHost}'s site, pricing, and customer complaints.`,
    );
  } catch (err) {
    log.warn("research_ai unavailable for agency-packet competitor", {
      competitorHost,
      error: String(err),
    });
  }

  const system = `You produce honest, sharp competitive intel.

CLIENT (the agency's customer): ${input.clientName} — ${input.clientDescription}
COMPETITOR: ${competitorHost}
AUDIENCE: ${input.audience}

Output ONLY valid JSON:
{
  "competitor": "${competitorHost}",
  "topWeakness": {
    "issue": "string — one specific weakness, not generic",
    "exploit": "string — one sentence on how ${input.clientName} positions against it",
    "severity": "HIGH" | "MEDIUM" | "LOW"
  },
  "topGap": {
    "gap": "string — one specific market gap the competitor leaves open",
    "opportunity": "string — what ${input.clientName} can do about it"
  }
}

Be specific. "Their pricing page hides team-tier costs" beats "they're expensive."
No slop. No "world-class" or "unparalleled."

Return ONLY the JSON. No prose, no fence.`;

  const userPrompt = intel
    ? `Recent intel on ${competitorHost}:\n${intel.slice(0, 2000)}\n\nProduce the JSON.`
    : `Produce the JSON. Live research is unavailable; reason from general knowledge of ${competitorHost} and label severity conservatively.`;

  const raw = await ai(userPrompt, {
    system,
    maxTokens: 600,
    taskType: "analysis",
  });

  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/u, "")
    .replace(/\s*```\s*$/u, "")
    .trim();

  return stripUnderscoreKeys(JSON.parse(cleaned)) as CompetitorAsset;
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

export async function buildAgencyPacket(
  input: AgencyPacketInput,
): Promise<AgencyPacket> {
  const start = Date.now();

  const [blogR, emailR, adsR, compR] = await Promise.allSettled([
    generateBlog(input),
    generateEmailSequence(input),
    generateAds(input),
    generateCompetitor(input),
  ]);

  const errors: AgencyPacket["errors"] = [];
  const recordError = (asset: string, r: PromiseSettledResult<unknown>) => {
    if (r.status === "rejected") {
      errors.push({
        asset,
        message:
          r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  };
  recordError("blog", blogR);
  recordError("emailSequence", emailR);
  recordError("ads", adsR);
  recordError("competitor", compR);

  return {
    client: { name: input.clientName, domain: input.clientDomain },
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    brandVoice: input.brandVoice,
    blog: blogR.status === "fulfilled" ? blogR.value : null,
    emailSequence: emailR.status === "fulfilled" ? emailR.value : null,
    ads: adsR.status === "fulfilled" ? adsR.value : null,
    competitor: compR.status === "fulfilled" ? compR.value : null,
    errors,
  };
}

// ─── Route export ──────────────────────────────────────────────────────────

export const POST = createAgentRoute({
  name: "agency-packet",
  schema: agencyPacketSchema,
  // The packet IS the deliverable — no critic gate (would mangle JSON
  // sub-assets and double the LLM bill).
  useCritic: false,
  // Run the post-flight verifier (LlamaGuard + PII + content-policy +
  // quality + critic) on the assembled packet. The packet is what the
  // agency hands their client — safety bar must be high. ~+200ms p50
  // worth paying.
  useVerifier: true,
  handler: async ({ input, userId }) => {
    const parsed = agencyPacketSchema.parse(input);
    const packet = await buildAgencyPacket(parsed);

    // Best-effort persistence — never blocks the response.
    const packetId = await savePacket({
      userId,
      kind: "agency-content-packet",
      input: parsed,
      output: packet as unknown as Record<string, unknown>,
      errorCount: packet.errors.length,
      durationMs: packet.durationMs,
    });

    return {
      ...(packet as unknown as Record<string, unknown>),
      packetId,
    };
  },
});
