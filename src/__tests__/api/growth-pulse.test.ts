/**
 * Tests for the growth-pulse orchestrator (Vertical 3 — African SMBs).
 *
 * Covers:
 *   - Schema validation rejects malformed input
 *   - Locale → currency resolution
 *   - Each generator parses well-formed responses + computes derived
 *     fields (charCount, currency)
 *   - Generators throw on under-count responses (seo items < 5,
 *     social posts < 4)
 *   - JSON parser strips code fences
 *   - Orchestrator's allSettled behaviour: every-asset-succeeds,
 *     one-asset-fails, durationMs + ISO timestamp
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAi = vi.fn();

vi.mock("@/lib/ai", () => ({
  ai: (...args: unknown[]) => mockAi(...args),
  research_ai: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

vi.mock("@/lib/agent-factory", () => ({
  createAgentRoute: () => () => new Response("noop"),
}));

import {
  growthPulseSchema,
  resolveCurrency,
  buildGrowthPulse,
  generateSeo,
  generateSocialPosts,
  generateReEngagementEmail,
  generateWhatsapp,
  generateOfferCard,
} from "@/app/api/_agents/growth-pulse/route";

// ── Helpers ──────────────────────────────────────────────────────────────

function validInput(overrides: Record<string, unknown> = {}) {
  return growthPulseSchema.parse({
    businessName: "Ndlovu Hair & Beauty",
    businessDescription:
      "Ndlovu is a 6-chair salon in Sea Point, Cape Town serving working professionals. We specialise in protective styling and chemical-free colour.",
    industry: "salon",
    locale: "ZA",
    topServices: ["braids", "manicure", "hair colour"],
    brandVoice: "warm",
    ...overrides,
  });
}

const FAKE_SEO = JSON.stringify({
  priorityFix:
    "Add NAP (name / address / phone) to footer in consistent format with Google Business Profile.",
  items: [
    {
      task: "Claim Google Business Profile and verify ownership",
      why: "Required before any other local-SEO work compounds.",
      estimatedMinutes: 15,
    },
    {
      task: "Upload 10 photos (interior, exterior, before/after, staff)",
      why: "Profiles with 10+ photos rank higher and get 35% more clicks.",
      estimatedMinutes: 20,
    },
    {
      task: "Add NAP to website footer in identical format",
      why: "Citation consistency is the single biggest local-SEO signal.",
      estimatedMinutes: 5,
    },
    {
      task: "Request 3 reviews from happy customers this week",
      why: "Recency of reviews matters more than total count.",
      estimatedMinutes: 10,
    },
    {
      task: "List on Yellow Pages South Africa + Snupit",
      why: "Local directory citations boost map-pack rankings.",
      estimatedMinutes: 25,
    },
    {
      task: "Embed Google Map on contact page",
      why: "Signals to Google that the address on-page matches the GBP.",
      estimatedMinutes: 10,
    },
  ],
  localKeywords: [
    "salon Sea Point",
    "braids Cape Town",
    "hair colour Sea Point",
    "protective styling Cape Town",
    "chemical-free colour CBD",
  ],
});

const FAKE_SOCIAL = JSON.stringify([
  {
    platform: "Instagram",
    caption:
      "Sea Point folks — meet Lerato, our braider with the hands of a sculptor. Walk in tired, walk out queen. Slots open Saturday.",
    hashtags: [
      "#NdlovuHair",
      "#SeaPointSalon",
      "#BraidsCapeTown",
      "#ProtectiveStyling",
    ],
  },
  {
    platform: "Facebook",
    caption:
      "Looking for a salon that doesn't smell like ammonia? We use chemical-free colour exclusively. Book by Friday and get a free conditioning treatment.",
    hashtags: ["#NdlovuHair", "#CapeTownSalons", "#HealthyHair"],
  },
  {
    platform: "LinkedIn",
    caption:
      "After 8 years running Ndlovu, here's what I've learned about retaining staff in hospitality: pay them like professionals. We're hiring our 7th full-time stylist this month.",
    hashtags: ["#SmallBusiness", "#CapeTown", "#WomenInBusiness", "#Hiring"],
  },
  {
    platform: "X",
    caption:
      "Tip: if your salon doesn't ask about your hair history before the first appointment, find a new salon. We do, every time.",
    hashtags: ["#HairCare", "#SalonTip", "#CapeTownLiving"],
  },
]);

const FAKE_EMAIL = JSON.stringify({
  subject: "Lerato moved chairs — a quick note",
  body: "It's been a few months — wanted to share two things.\n\nLerato moved to our Sea Point flagship and now takes appointments Mon–Sat. Our chemical-free colour line is fully back in stock after the supplier hiccup in Q1.\n\nIf it's been a minute, book on WhatsApp 060-555-1234 and I'll personally make sure you get a slot this week.",
  segment: "Customers who haven't booked in 90+ days",
});

const FAKE_WHATSAPP = JSON.stringify({
  template:
    "Hi {{first_name}} 👋 — quick note from Ndlovu. Lerato is back this week and we have Saturday slots. R450 braids special until end of month. Book here: 060-555-1234. Reply STOP to unsubscribe.",
  segmentationCue: "Customers tagged 'braids' who last booked 60+ days ago",
  optInDisclaimer: "Reply STOP to unsubscribe.",
});

const FAKE_OFFER = JSON.stringify({
  headline: "Saturday Braids Special",
  description:
    "Full-head braids with Lerato, including conditioning treatment. Walk-in friendly until end of month.",
  priceLabel: "R450",
  validUntilSuggestion: "End of next month (last Saturday)",
  redemptionMechanic:
    "Mention 'Saturday Special' on WhatsApp 060-555-1234 to lock in the rate.",
});

// ── Schema tests ──────────────────────────────────────────────────────────

describe("growthPulseSchema", () => {
  it("accepts a complete valid input", () => {
    expect(() => validInput()).not.toThrow();
  });

  it("rejects empty topServices", () => {
    expect(() => validInput({ topServices: [] })).toThrow();
  });

  it("rejects more than 3 topServices", () => {
    expect(() => validInput({ topServices: ["a", "b", "c", "d"] })).toThrow();
  });

  it("rejects businessDescription < 20 chars", () => {
    expect(() => validInput({ businessDescription: "too short" })).toThrow();
  });

  it("defaults locale to ZA and brandVoice to warm", () => {
    const parsed = growthPulseSchema.parse({
      businessName: "Acme",
      businessDescription:
        "Acme bakery serves Pretoria suburb commuters with morning pastries.",
      industry: "bakery",
      topServices: ["pastries"],
    });
    expect(parsed.locale).toBe("ZA");
    expect(parsed.brandVoice).toBe("warm");
  });

  it("treats empty websiteUrl as undefined", () => {
    const parsed = validInput({ websiteUrl: "" });
    expect(parsed.websiteUrl).toBeUndefined();
  });
});

describe("resolveCurrency", () => {
  it("derives ZAR from ZA when currency is unset", () => {
    expect(resolveCurrency(validInput())).toBe("ZAR");
  });

  it("derives NGN from NG", () => {
    expect(resolveCurrency(validInput({ locale: "NG" }))).toBe("NGN");
  });

  it("derives KES from KE", () => {
    expect(resolveCurrency(validInput({ locale: "KE" }))).toBe("KES");
  });

  it("derives USD from countries without local currency mapping (ZW)", () => {
    expect(resolveCurrency(validInput({ locale: "ZW" }))).toBe("USD");
  });

  it("respects an explicit currency override", () => {
    const input = validInput({ locale: "ZA", currency: "USD" });
    expect(resolveCurrency(input)).toBe("USD");
  });
});

// ── Asset generator tests ─────────────────────────────────────────────────

describe("generateSeo", () => {
  beforeEach(() => mockAi.mockReset());

  it("parses a well-formed checklist", async () => {
    mockAi.mockResolvedValue(FAKE_SEO);
    const seo = await generateSeo(validInput());
    expect(seo.priorityFix).toBeTruthy();
    expect(seo.items.length).toBeGreaterThanOrEqual(5);
    expect(seo.localKeywords.length).toBeGreaterThan(0);
  });

  it("strips a code fence before parsing", async () => {
    mockAi.mockResolvedValue("```json\n" + FAKE_SEO + "\n```");
    const seo = await generateSeo(validInput());
    expect(seo.items.length).toBeGreaterThanOrEqual(5);
  });

  it("throws when the model returns fewer than 5 checklist items", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        priorityFix: "x",
        items: [
          { task: "a", why: "b", estimatedMinutes: 5 },
          { task: "a2", why: "b2", estimatedMinutes: 5 },
        ],
        localKeywords: ["a", "b"],
      }),
    );
    await expect(generateSeo(validInput())).rejects.toThrow(/fewer than 5/i);
  });
});

describe("generateSocialPosts", () => {
  beforeEach(() => mockAi.mockReset());

  it("returns 4 platform-specific posts and computes charCount", async () => {
    mockAi.mockResolvedValue(FAKE_SOCIAL);
    const posts = await generateSocialPosts(validInput());
    expect(posts).toHaveLength(4);
    expect(posts[0]?.charCount).toBe(posts[0]?.caption.length);
    const platforms = posts.map((p) => p.platform).sort();
    expect(platforms).toEqual(["Facebook", "Instagram", "LinkedIn", "X"]);
  });

  it("throws when fewer than 4 posts are returned", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify([
        { platform: "Instagram", caption: "x", hashtags: ["#a"] },
      ]),
    );
    await expect(generateSocialPosts(validInput())).rejects.toThrow(
      /fewer than 4/i,
    );
  });
});

describe("generateReEngagementEmail", () => {
  beforeEach(() => mockAi.mockReset());

  it("parses a well-formed email", async () => {
    mockAi.mockResolvedValue(FAKE_EMAIL);
    const email = await generateReEngagementEmail(validInput());
    expect(email.subject).toBeTruthy();
    expect(email.body.length).toBeGreaterThan(50);
    expect(email.segment).toBeTruthy();
  });
});

describe("generateWhatsapp", () => {
  beforeEach(() => mockAi.mockReset());

  it("parses the broadcast and computes char count", async () => {
    mockAi.mockResolvedValue(FAKE_WHATSAPP);
    const wa = await generateWhatsapp(validInput());
    expect(wa.template).toContain("{{first_name}}");
    expect(wa.charCount).toBe(wa.template.length);
    expect(wa.optInDisclaimer.toLowerCase()).toContain("stop");
  });
});

describe("generateOfferCard", () => {
  beforeEach(() => mockAi.mockReset());

  it("parses a ZA offer card and stamps ZAR currency", async () => {
    mockAi.mockResolvedValue(FAKE_OFFER);
    const offer = await generateOfferCard(validInput());
    expect(offer.headline).toBeTruthy();
    expect(offer.priceLabel).toMatch(/R\d/);
    expect(offer.currency).toBe("ZAR");
  });

  it("derives currency from locale when input.currency is unset", async () => {
    mockAi.mockResolvedValue(FAKE_OFFER);
    const offer = await generateOfferCard(validInput({ locale: "KE" }));
    expect(offer.currency).toBe("KES");
  });
});

// ── Orchestrator tests ────────────────────────────────────────────────────

describe("buildGrowthPulse", () => {
  beforeEach(() => mockAi.mockReset());

  it("populates all five assets when every sub-call succeeds", async () => {
    mockAi.mockImplementation(async (_p: unknown, opts: unknown) => {
      const sys = String(
        (opts as { system?: string } | undefined)?.system ?? "",
      );
      if (sys.includes("local-SEO specialist")) return FAKE_SEO;
      if (sys.includes("organic social posts")) return FAKE_SOCIAL;
      if (sys.includes("re-engagement emails")) return FAKE_EMAIL;
      if (sys.includes("WhatsApp Business broadcast")) return FAKE_WHATSAPP;
      if (sys.includes("limited-time offer cards")) return FAKE_OFFER;
      return FAKE_SEO; // fallback so the spy serializer never throws
    });

    const pulse = await buildGrowthPulse(validInput());
    expect(pulse.seo?.items.length).toBeGreaterThan(0);
    expect(pulse.socialPosts?.length).toBe(4);
    expect(pulse.reEngagementEmail?.subject).toBeTruthy();
    expect(pulse.whatsapp?.template).toContain("{{first_name}}");
    expect(pulse.offer?.priceLabel).toMatch(/R\d/);
    expect(pulse.business.currency).toBe("ZAR");
    expect(pulse.errors).toEqual([]);
  });

  it("records sub-asset errors without sinking the whole pulse", async () => {
    mockAi.mockImplementation(async (_p: unknown, opts: unknown) => {
      const sys = String(
        (opts as { system?: string } | undefined)?.system ?? "",
      );
      if (sys.includes("local-SEO specialist")) return FAKE_SEO;
      if (sys.includes("organic social posts"))
        throw new Error("provider down");
      if (sys.includes("re-engagement emails")) return FAKE_EMAIL;
      if (sys.includes("WhatsApp Business broadcast")) return FAKE_WHATSAPP;
      if (sys.includes("limited-time offer cards")) return FAKE_OFFER;
      return FAKE_SEO;
    });

    const pulse = await buildGrowthPulse(validInput());
    expect(pulse.seo).not.toBeNull();
    expect(pulse.socialPosts).toBeNull();
    expect(pulse.reEngagementEmail).not.toBeNull();
    expect(
      pulse.errors.find((e) => e.asset === "socialPosts")?.message,
    ).toMatch(/provider down/);
  });

  it("reports business locale + currency + ISO timestamp", async () => {
    mockAi.mockResolvedValue(FAKE_SEO);
    const pulse = await buildGrowthPulse(validInput({ locale: "NG" }));
    expect(pulse.business.locale).toBe("NG");
    expect(pulse.business.currency).toBe("NGN");
    expect(pulse.durationMs).toBeGreaterThanOrEqual(0);
    expect(pulse.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
