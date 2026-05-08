/**
 * Tests for the realestate listing-pulse orchestrator (Vertical 4).
 *
 * Same shape as the other vertical packet tests:
 *   - Schema validation
 *   - Each generator parses well-formed responses + computes derived fields
 *   - Generators throw on under-count responses (comps < 3, market bullets < 4)
 *   - JSON parser strips code fences
 *   - Orchestrator's allSettled behavior: every-asset-succeeds + one-fails
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAi = vi.fn();

vi.mock("@/lib/ai", () => ({
  ai: (...args: unknown[]) => mockAi(...args),
  research_ai: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));

vi.mock("@/lib/agent-factory", () => ({
  createAgentRoute: () => () => new Response("noop"),
}));

import {
  listingPulseSchema,
  buildListingPulse,
  generateListingDescription,
  generateOpenHouseSocial,
  generateBuyerEmail,
  generateCompAnalysis,
  generateMarketUpdate,
} from "@/app/api/_agents/listing-pulse/route";

function validInput(overrides: Record<string, unknown> = {}) {
  return listingPulseSchema.parse({
    propertyAddress: "12 Beach Road, Sea Point",
    suburb: "Sea Point",
    priceLabel: "R3 950 000",
    currency: "ZAR",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 2,
    keyFeatures: ["north-facing", "sea-view balcony", "oak parquet", "gas hob"],
    agentName: "Lerato Khumalo",
    brandVoice: "warm",
    ...overrides,
  });
}

const FAKE_LISTING = JSON.stringify({
  headline: "North-facing apartment with sea views in Sea Point",
  body: "Step inside an apartment built around two ideas: morning sun and the Atlantic. The main living room runs north along original oak parquet, opening to a balcony that takes in the entire bay from Mouille Point to Bantry Bay.\n\nThe kitchen sits to the east — gas hob, full pantry, generous prep counter. Three bedrooms, two bathrooms, all with built-in storage. The primary bedroom shares the balcony.\n\nSea Point itself needs no introduction: 200m to the promenade, three coffee shops on the same block, and the Saturday Mojo Market five minutes' walk away.\n\nFor a viewing arrangement, message Lerato Khumalo directly.",
  metaSnippet:
    "North-facing 3-bed apartment in Sea Point with sea views, oak parquet, and a kitchen built for hosting.",
});

const FAKE_SOCIAL = JSON.stringify({
  instagram: {
    caption:
      "Sea-view balcony, oak parquet, gas hob — and a sunset slot at the open house this Saturday. DM Lerato Khumalo for the slot.",
    hashtags: ["#SeaPoint", "#CapeTownProperty", "#SeaViews", "#OpenHouse"],
  },
  facebook: {
    caption:
      "Open house Saturday in Sea Point — 3-bed, north-facing, sea views, original oak parquet. R3 950 000.",
    hashtags: ["#SeaPoint", "#CapeTownProperty", "#PropertyForSale"],
  },
  whatsapp: {
    message:
      "👋 Open-house this Saturday in Sea Point — 3-bed, sea views, R3 950 000. Drop me a 👀 and I'll send you the slot. — Lerato",
    segmentationCue: "Buyers tagged 'Sea Point' or 'R3-4M' in the CRM",
  },
});

const FAKE_BUYER_EMAIL = JSON.stringify({
  subject: "Sea Point listing matching your brief",
  body: "Quick note — 12 Beach Road came on the market today. North-facing 3-bed, sea views, original oak parquet, R3 950 000.\n\nIt matches the brief you gave me three months ago: Sea Point, north-facing, under R4M. The open house is Saturday at 11.\n\nReply or message me and I'll lock in your slot. — Lerato Khumalo",
  segment: "Buyers tagged 'Sea Point' with budget R3M–R4.5M",
});

const FAKE_COMPS = JSON.stringify({
  comps: [
    {
      descriptor: "Similar 3-bed apartment, same building, sold last quarter",
      soldOrListed: "Sold for R3.7M (ZAR)",
      differentiator:
        "That apartment was south-facing without sea views; this one is north-facing with full bay views.",
    },
    {
      descriptor: "3-bed apartment two blocks back from the beach",
      soldOrListed: "Listed at R3.4M (ZAR)",
      differentiator: "No oak parquet; the subject also has a larger balcony.",
    },
    {
      descriptor: "Older 3-bed in a less-renovated complex",
      soldOrListed: "Sold for R3.2M (ZAR)",
      differentiator:
        "Pre-renovation; subject has refurbished kitchen and original parquet preserved.",
    },
  ],
  positioningNote:
    "Subject is at the upper end of the comp set, justified by the north orientation and the unobstructed bay view. Talk to buyers about the sea-view delta as the price-to-comp explanation.",
});

const FAKE_MARKET = JSON.stringify({
  headline: "Sea Point: 12-day average days-on-market for 3-beds",
  bullets: [
    "Days-on-market for 3-beds dropped from 28 in Q4 to 12 in Q1 — fastest in 5 years.",
    "List-to-sale ratio is 96.3%, up from 91% same period last year.",
    "Inventory tightness: 8 active 3-bed listings in the suburb vs 14 last quarter.",
    "BRT line extension to Sea Point added 23% to first-time-buyer enquiries.",
    "Sunset Beach School zone moved into the catchment, boosting family demand.",
  ],
  voiceNoteOpener:
    "Hi, Lerato here — quick market note for Sea Point. Three-bed apartments are moving in 12 days right now, list-to-sale ratio is sitting at 96 percent. If you've been waiting for prices to soften, the data says the opposite is happening. Reply if you want me to send you the full pulse.",
});

// ── Schema tests ──────────────────────────────────────────────────────────

describe("listingPulseSchema", () => {
  it("accepts a complete valid input", () => {
    expect(() => validInput()).not.toThrow();
  });

  it("rejects empty keyFeatures", () => {
    expect(() => validInput({ keyFeatures: [] })).toThrow();
  });

  it("rejects more than 8 keyFeatures", () => {
    expect(() =>
      validInput({
        keyFeatures: Array.from({ length: 9 }, (_, i) => `feature${i}`),
      }),
    ).toThrow();
  });

  it("defaults bedrooms / bathrooms / propertyType / brandVoice", () => {
    const parsed = listingPulseSchema.parse({
      propertyAddress: "12 Beach Road",
      suburb: "Sea Point",
      priceLabel: "R3 950 000",
      keyFeatures: ["north-facing"],
      agentName: "Lerato",
    });
    expect(parsed.bedrooms).toBe(3);
    expect(parsed.bathrooms).toBe(2);
    expect(parsed.propertyType).toBe("house");
    expect(parsed.brandVoice).toBe("warm");
    expect(parsed.currency).toBe("ZAR");
  });
});

// ── Asset generator tests ─────────────────────────────────────────────────

describe("generateListingDescription", () => {
  beforeEach(() => mockAi.mockReset());

  it("parses headline + body + meta and computes word count", async () => {
    mockAi.mockResolvedValue(FAKE_LISTING);
    const desc = await generateListingDescription(validInput());
    expect(desc.headline).toMatch(/Sea Point/i);
    expect(desc.wordCount).toBeGreaterThan(50);
    expect(desc.metaSnippet.length).toBeLessThanOrEqual(200);
  });

  it("strips a code fence before parsing", async () => {
    mockAi.mockResolvedValue("```json\n" + FAKE_LISTING + "\n```");
    const desc = await generateListingDescription(validInput());
    expect(desc.headline).toBeTruthy();
  });
});

describe("generateOpenHouseSocial", () => {
  beforeEach(() => mockAi.mockReset());

  it("returns three platform-specific blocks", async () => {
    mockAi.mockResolvedValue(FAKE_SOCIAL);
    const s = await generateOpenHouseSocial(validInput());
    expect(s.instagram.hashtags.length).toBeGreaterThan(0);
    expect(s.whatsapp.segmentationCue).toBeTruthy();
  });
});

describe("generateBuyerEmail", () => {
  beforeEach(() => mockAi.mockReset());

  it("parses a well-formed email", async () => {
    mockAi.mockResolvedValue(FAKE_BUYER_EMAIL);
    const e = await generateBuyerEmail(validInput());
    expect(e.subject).toBeTruthy();
    expect(e.body.length).toBeGreaterThan(60);
    expect(e.segment).toBeTruthy();
  });
});

describe("generateCompAnalysis", () => {
  beforeEach(() => mockAi.mockReset());

  it("returns 3 comps + a positioning note", async () => {
    mockAi.mockResolvedValue(FAKE_COMPS);
    const c = await generateCompAnalysis(validInput());
    expect(c.comps).toHaveLength(3);
    expect(c.positioningNote.length).toBeGreaterThan(20);
  });

  it("throws when fewer than 3 comps are returned", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        comps: [{ descriptor: "x", soldOrListed: "y", differentiator: "z" }],
        positioningNote: "n",
      }),
    );
    await expect(generateCompAnalysis(validInput())).rejects.toThrow(
      /fewer than 3/i,
    );
  });
});

describe("generateMarketUpdate", () => {
  beforeEach(() => mockAi.mockReset());

  it("returns headline + bullets + voice opener", async () => {
    mockAi.mockResolvedValue(FAKE_MARKET);
    const m = await generateMarketUpdate(validInput());
    expect(m.bullets.length).toBeGreaterThanOrEqual(4);
    expect(m.voiceNoteOpener.length).toBeGreaterThan(20);
  });

  it("throws when fewer than 4 bullets are returned", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        headline: "x",
        bullets: ["a", "b"],
        voiceNoteOpener: "c",
      }),
    );
    await expect(generateMarketUpdate(validInput())).rejects.toThrow(
      /fewer than 4/i,
    );
  });
});

// ── Orchestrator tests ────────────────────────────────────────────────────

describe("buildListingPulse", () => {
  beforeEach(() => mockAi.mockReset());

  it("populates all five assets when every sub-call succeeds", async () => {
    mockAi.mockImplementation(async (_p: unknown, opts: unknown) => {
      const sys = String(
        (opts as { system?: string } | undefined)?.system ?? "",
      );
      if (sys.includes("residential property listing copy"))
        return FAKE_LISTING;
      if (sys.includes("open-house social-media posts")) return FAKE_SOCIAL;
      if (sys.includes("new-listing email blast")) return FAKE_BUYER_EMAIL;
      if (sys.includes("comparable-property analysis")) return FAKE_COMPS;
      if (sys.includes("one-page market update")) return FAKE_MARKET;
      return FAKE_LISTING; // fallback for the spy serializer
    });

    const pulse = await buildListingPulse(validInput());
    expect(pulse.listing?.wordCount).toBeGreaterThan(0);
    expect(pulse.social?.instagram.hashtags.length).toBeGreaterThan(0);
    expect(pulse.buyerEmail?.subject).toBeTruthy();
    expect(pulse.comps?.comps.length).toBe(3);
    expect(pulse.marketUpdate?.bullets.length).toBeGreaterThanOrEqual(4);
    expect(pulse.errors).toEqual([]);
  });

  it("records sub-asset errors without sinking the whole pulse", async () => {
    mockAi.mockImplementation(async (_p: unknown, opts: unknown) => {
      const sys = String(
        (opts as { system?: string } | undefined)?.system ?? "",
      );
      if (sys.includes("residential property listing copy"))
        return FAKE_LISTING;
      if (sys.includes("open-house social-media posts"))
        throw new Error("provider down");
      if (sys.includes("new-listing email blast")) return FAKE_BUYER_EMAIL;
      if (sys.includes("comparable-property analysis")) return FAKE_COMPS;
      if (sys.includes("one-page market update")) return FAKE_MARKET;
      return FAKE_LISTING;
    });

    const pulse = await buildListingPulse(validInput());
    expect(pulse.listing).not.toBeNull();
    expect(pulse.social).toBeNull();
    expect(pulse.errors.find((e) => e.asset === "social")?.message).toMatch(
      /provider down/,
    );
  });

  it("reports property fields + ISO timestamp + duration", async () => {
    mockAi.mockResolvedValue(FAKE_LISTING);
    const pulse = await buildListingPulse(validInput());
    expect(pulse.property.address).toContain("Beach Road");
    expect(pulse.property.suburb).toBe("Sea Point");
    expect(pulse.durationMs).toBeGreaterThanOrEqual(0);
    expect(pulse.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
