/**
 * Tests for the agency-content-packet orchestrator.
 *
 * Covers:
 *   - Schema validation rejects malformed input
 *   - All four sub-assets succeed → packet populated, errors empty
 *   - One sub-asset throws → that asset is null, errors records the message
 *   - competitorUrl absent → competitor is null, NOT an error
 *   - Blog word-count is computed from the model's body
 *   - Email-sequence parser rejects responses with fewer than 3 emails
 *   - Ads parser rejects responses with fewer than 3 ads
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────
// Mock @/lib/ai before importing the route so generateBlog/Sequence/Ads
// pick up the stubs instead of hitting real LLMs.

const mockAi = vi.fn();
const mockResearchAi = vi.fn();

vi.mock("@/lib/ai", () => ({
  ai: (...args: unknown[]) => mockAi(...args),
  research_ai: (...args: unknown[]) => mockResearchAi(...args),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

// agent-factory wraps the route export — we don't exercise it here, only
// the pure helpers. Stub it to be a no-op so importing the module is cheap.
vi.mock("@/lib/agent-factory", () => ({
  createAgentRoute: () => () => new Response("noop"),
}));

import {
  agencyPacketSchema,
  buildAgencyPacket,
  generateBlog,
  generateEmailSequence,
  generateAds,
  generateCompetitor,
} from "@/app/api/_agents/agency-packet/route";

// ── Helpers ──────────────────────────────────────────────────────────────

function validInput(overrides: Record<string, unknown> = {}) {
  return agencyPacketSchema.parse({
    clientName: "Acme Corp",
    clientDomain: "acmecorp.com",
    clientDescription:
      "Acme builds applicant-tracking software for mid-market SaaS HR teams. Differentiator: 1-day setup.",
    audience: "HR leaders at 100–500 person SaaS companies",
    brandVoice: "professional",
    primaryKeywords: ["applicant tracking", "hiring funnel"],
    ...overrides,
  });
}

const FAKE_BLOG_BODY =
  "# How modern hiring funnels lose 60% of qualified candidates\n\n" +
  "Hiring funnels leak. Most teams don't measure where. " +
  Array.from({ length: 200 }, () => "lorem ipsum dolor sit amet").join(" ") +
  "\n\n## Section two\n\n" +
  Array.from({ length: 200 }, () => "consectetur adipiscing elit").join(" ");

const FAKE_BLOG_RESPONSE = `${FAKE_BLOG_BODY}

---META---
META_DESCRIPTION: Hiring funnels leak. Here's where 60% of candidates drop and how to fix it.
PRIMARY_KEYWORD: applicant tracking`;

const FAKE_EMAIL_RESPONSE = JSON.stringify({
  sequenceName: "Welcome",
  emails: [
    {
      stepNumber: 1,
      delayDays: 0,
      subject: "Why most hiring funnels leak",
      body: "Body 1",
    },
    {
      stepNumber: 2,
      delayDays: 2,
      subject: "The 3 metrics that actually matter",
      body: "Body 2",
    },
    {
      stepNumber: 3,
      delayDays: 5,
      subject: "One tweak that recovered 38% of drop-offs",
      body: "Body 3",
    },
  ],
});

const FAKE_ADS_RESPONSE = JSON.stringify([
  {
    platform: "LinkedIn",
    hook: "60% of candidates ghost",
    headline: "Recover 38% of drop-offs",
    primaryText: "B2B-credible body",
    callToAction: "Book Demo",
  },
  {
    platform: "Meta",
    hook: "Stop hiring leaks",
    headline: "Fix your funnel today",
    primaryText: "Casual scroll-stopper body",
    callToAction: "Learn More",
  },
  {
    platform: "Google",
    hook: "Hiring funnel ATS",
    headline: "ATS that ships in 1 day",
    primaryText: "Direct outcome body",
    callToAction: "Try Free",
  },
]);

const FAKE_COMPETITOR_RESPONSE = JSON.stringify({
  competitor: "competitor.com",
  topWeakness: {
    issue: "Their pricing page hides team-tier costs behind a sales call.",
    exploit: "Acme publishes a transparent pricing matrix.",
    severity: "HIGH",
  },
  topGap: {
    gap: "No mobile app for hiring managers reviewing candidates on-the-go.",
    opportunity: "Acme can ship a read-only mobile review surface.",
  },
});

// ── Schema tests ──────────────────────────────────────────────────────────

describe("agencyPacketSchema", () => {
  it("accepts a complete, valid input", () => {
    expect(() => validInput()).not.toThrow();
  });

  it("rejects domains without a TLD", () => {
    expect(() => validInput({ clientDomain: "acme" })).toThrow();
  });

  it("rejects clientDescription shorter than 20 chars", () => {
    expect(() => validInput({ clientDescription: "too short" })).toThrow();
  });

  it("rejects more than 5 primary keywords", () => {
    expect(() =>
      validInput({ primaryKeywords: ["a", "b", "c", "d", "e", "f"] }),
    ).toThrow();
  });

  it("treats empty competitorUrl string as undefined", () => {
    const parsed = validInput({ competitorUrl: "" });
    expect(parsed.competitorUrl).toBeUndefined();
  });

  it("defaults brandVoice to professional", () => {
    const parsed = agencyPacketSchema.parse({
      clientName: "Acme Corp",
      clientDomain: "acmecorp.com",
      clientDescription:
        "Acme builds applicant-tracking software for HR teams.",
      audience: "HR leaders",
    });
    expect(parsed.brandVoice).toBe("professional");
  });
});

// ── Asset generator tests ─────────────────────────────────────────────────

describe("generateBlog", () => {
  beforeEach(() => {
    mockAi.mockReset();
    mockResearchAi.mockReset();
  });

  it("parses title, body, meta, and counts words", async () => {
    mockResearchAi.mockResolvedValue("recent-research");
    mockAi.mockResolvedValue(FAKE_BLOG_RESPONSE);

    const blog = await generateBlog(validInput());

    expect(blog.title).toMatch(/hiring funnels/i);
    expect(blog.body).toContain("Section two");
    expect(blog.metaDescription.length).toBeLessThanOrEqual(160);
    expect(blog.primaryKeyword).toBe("applicant tracking");
    expect(blog.wordCount).toBeGreaterThan(400);
  });

  it("falls back gracefully when research_ai throws", async () => {
    mockResearchAi.mockRejectedValue(new Error("tavily down"));
    mockAi.mockResolvedValue(FAKE_BLOG_RESPONSE);

    const blog = await generateBlog(validInput());
    expect(blog.title).toBeTruthy();
    expect(blog.wordCount).toBeGreaterThan(0);
  });

  it("synthesizes a meta description when the model omits one", async () => {
    mockResearchAi.mockResolvedValue("");
    mockAi.mockResolvedValue("# Just a title\n\nBody with no META block.");
    const blog = await generateBlog(validInput());
    expect(blog.metaDescription).toBeTruthy();
    expect(blog.metaDescription.length).toBeLessThanOrEqual(160);
  });
});

describe("generateEmailSequence", () => {
  beforeEach(() => {
    mockAi.mockReset();
  });

  it("returns 3 emails on a well-formed model response", async () => {
    mockAi.mockResolvedValue(FAKE_EMAIL_RESPONSE);
    const seq = await generateEmailSequence(validInput());
    expect(seq.emails).toHaveLength(3);
    expect(seq.emails[0]?.subject).toBeTruthy();
  });

  it("strips a leading code fence before parsing", async () => {
    mockAi.mockResolvedValue("```json\n" + FAKE_EMAIL_RESPONSE + "\n```");
    const seq = await generateEmailSequence(validInput());
    expect(seq.emails).toHaveLength(3);
  });

  it("throws when the model returns fewer than 3 emails", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        sequenceName: "Short",
        emails: [
          { stepNumber: 1, delayDays: 0, subject: "Only one", body: "x" },
        ],
      }),
    );
    await expect(generateEmailSequence(validInput())).rejects.toThrow(
      /fewer than 3/i,
    );
  });
});

describe("generateAds", () => {
  beforeEach(() => {
    mockAi.mockReset();
  });

  it("returns exactly 3 ads on a well-formed response", async () => {
    mockAi.mockResolvedValue(FAKE_ADS_RESPONSE);
    const ads = await generateAds(validInput());
    expect(ads).toHaveLength(3);
    expect(ads.map((a) => a.platform).sort()).toEqual([
      "Google",
      "LinkedIn",
      "Meta",
    ]);
  });

  it("throws when the array has fewer than 3 ads", async () => {
    mockAi.mockResolvedValue(JSON.stringify([{ platform: "LinkedIn" }]));
    await expect(generateAds(validInput())).rejects.toThrow(/fewer than 3/i);
  });
});

describe("generateCompetitor", () => {
  beforeEach(() => {
    mockAi.mockReset();
    mockResearchAi.mockReset();
  });

  it("returns null when competitorUrl is undefined", async () => {
    const out = await generateCompetitor(validInput({ competitorUrl: "" }));
    expect(out).toBeNull();
    expect(mockAi).not.toHaveBeenCalled();
  });

  it("parses topWeakness + topGap on a well-formed response", async () => {
    mockResearchAi.mockResolvedValue("intel");
    mockAi.mockResolvedValue(FAKE_COMPETITOR_RESPONSE);
    const out = await generateCompetitor(
      validInput({ competitorUrl: "https://competitor.com" }),
    );
    expect(out?.competitor).toBe("competitor.com");
    expect(out?.topWeakness.severity).toBe("HIGH");
    expect(out?.topGap.gap).toMatch(/mobile app/i);
  });
});

// ── Orchestrator tests ────────────────────────────────────────────────────

describe("buildAgencyPacket", () => {
  beforeEach(() => {
    mockAi.mockReset();
    mockResearchAi.mockReset();
    mockResearchAi.mockResolvedValue("");
  });

  it("populates all four assets when every sub-call succeeds", async () => {
    mockAi.mockImplementation(async (prompt: unknown, opts: unknown) => {
      const sysText = String(
        (opts as { system?: string } | undefined)?.system ?? "",
      );
      if (sysText.includes("senior agency copywriter"))
        return FAKE_BLOG_RESPONSE;
      if (sysText.includes("email drip sequences")) return FAKE_EMAIL_RESPONSE;
      if (sysText.includes("ad copy for three platforms"))
        return FAKE_ADS_RESPONSE;
      if (sysText.includes("competitive intel"))
        return FAKE_COMPETITOR_RESPONSE;
      throw new Error("unexpected ai() call");
    });

    const packet = await buildAgencyPacket(
      validInput({ competitorUrl: "https://competitor.com" }),
    );

    expect(packet.blog?.wordCount).toBeGreaterThan(0);
    expect(packet.emailSequence?.emails).toHaveLength(3);
    expect(packet.ads?.length).toBe(3);
    expect(packet.competitor?.competitor).toBe("competitor.com");
    expect(packet.errors).toEqual([]);
  });

  it("records sub-asset errors without failing the whole packet", async () => {
    mockAi.mockImplementation(async (prompt: unknown, opts: unknown) => {
      const sysText = String(
        (opts as { system?: string } | undefined)?.system ?? "",
      );
      if (sysText.includes("senior agency copywriter"))
        return FAKE_BLOG_RESPONSE;
      if (sysText.includes("email drip sequences"))
        throw new Error("rate limited");
      if (sysText.includes("ad copy for three platforms"))
        return FAKE_ADS_RESPONSE;
      throw new Error("unexpected ai() call");
    });

    const packet = await buildAgencyPacket(
      validInput({ competitorUrl: undefined }),
    );

    expect(packet.blog).not.toBeNull();
    expect(packet.emailSequence).toBeNull();
    expect(packet.ads).not.toBeNull();
    expect(packet.competitor).toBeNull(); // skipped, not failed
    expect(
      packet.errors.find((e) => e.asset === "emailSequence")?.message,
    ).toMatch(/rate limited/);
    // competitor was skipped, not failed → no error entry
    expect(packet.errors.find((e) => e.asset === "competitor")).toBeUndefined();
  });

  it("reports durationMs and ISO generatedAt", async () => {
    mockAi.mockResolvedValue(FAKE_BLOG_RESPONSE);
    const packet = await buildAgencyPacket(
      validInput({ competitorUrl: undefined }),
    );
    expect(packet.durationMs).toBeGreaterThanOrEqual(0);
    expect(packet.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
