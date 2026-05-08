/**
 * Tests for the recruiting-sourcing-sprint orchestrator.
 *
 * Same contract pattern as agency-packet:
 *   - Schema validation rejects malformed input
 *   - Each generator parses well-formed responses
 *   - Each generator throws on under-count responses (channels < 5,
 *     objections < 4)
 *   - JSON parser strips code fences
 *   - Orchestrator records sub-asset errors without sinking the whole
 *     sprint (Promise.allSettled semantics)
 *   - Voicemail seconds estimator + email word count are sane
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
  sourcingSprintSchema,
  buildSourcingSprint,
  generateIcp,
  generateBooleans,
  generateOutreach,
  generateChannels,
  generateObjections,
} from "@/app/api/_agents/sourcing-sprint/route";

// ── Helpers ──────────────────────────────────────────────────────────────

function validInput(overrides: Record<string, unknown> = {}) {
  return sourcingSprintSchema.parse({
    roleTitle: "Senior Backend Engineer",
    companyName: "Acme Corp",
    companyDescription:
      "Acme builds applicant-tracking software for mid-market SaaS HR teams. Differentiator: 1-day setup.",
    mustHaveSkills: ["Go", "distributed systems", "Postgres"],
    seniorityLevel: "senior",
    urgency: "perfect-fit",
    ...overrides,
  });
}

const FAKE_ICP = JSON.stringify({
  archetype: "Series B platform engineer",
  yearsExperienceMin: 6,
  yearsExperienceMax: 12,
  mustHaveSignals: [
    "Worked at a Series A-C startup",
    "Built distributed systems in Go",
    "Owned a Postgres schema at scale",
    "Speaker at a Go conference",
  ],
  niceToHaveSignals: ["OSS maintainer", "Rust experience"],
  motivators: ["Equity upside", "Technical autonomy", "Founding team energy"],
  redFlags: [
    "Bootcamp grad < 2 yrs",
    "Only big-tech experience",
    "No public artifacts",
  ],
});

const FAKE_BOOLEANS = JSON.stringify({
  linkedin:
    '("Senior Backend Engineer" OR "Staff Engineer") AND ("Go" OR "Golang") AND "Postgres" NOT recruiter',
  googleXRay:
    'site:linkedin.com/in/ ("backend engineer") ("Go" OR "Golang") ("Postgres") -student',
  github: "language:go followers:>50 location:remote",
});

const FAKE_OUTREACH = JSON.stringify({
  linkedinDm: {
    body: "Saw your Go talk at GopherCon — the section on Postgres connection pooling was the clearest take I've seen. Acme's hitting that exact problem at scale. 15-min chat?",
  },
  coldEmail: {
    subject: "Your GopherCon take on connection pooling",
    body: "Saw your GopherCon talk on Postgres connection pooling.\n\nAcme is shipping ATS software with the exact pain you described — every backend engineer interview spends 20 minutes on it.\n\nWorth a 15-minute conversation?",
  },
  voicemail: {
    script:
      "Hi this is John from Acme. I caught your GopherCon talk last month and the connection-pooling slide solved a problem we've been chewing on. Would love 15 minutes to explain why I'm calling — try me at 555-1234.",
  },
});

const FAKE_CHANNELS = JSON.stringify([
  {
    channel: "GopherCon attendee list",
    why: "Series B Go shops cluster at this conference more than any other in the language.",
    firstAction: "Pull the 2025 speaker + workshop attendee directory.",
  },
  {
    channel: "r/golang weekly hiring thread",
    why: "Mid-senior Go devs read this thread; less recruiter-saturated than LinkedIn.",
    firstAction: "Post a 3-line role brief Friday and DM upvoters.",
  },
  {
    channel: "Postgres Slack — #performance channel",
    why: "Engineers actively debugging connection pooling are exactly the ICP.",
    firstAction:
      "Lurk for 1 week; DM 5 active contributors with one specific question about their post.",
  },
  {
    channel: "GitHub trending Go this month",
    why: "OSS maintainers signal the technical depth and motivation our ICP needs.",
    firstAction:
      "Star + open thoughtful issue on top 10 trending repos; DM authors after.",
  },
  {
    channel: "Substack: Brandur's archive subscribers",
    why: "The audience for this newsletter is a near-perfect ICP overlap.",
    firstAction: "Sponsor one issue with a 60-word job-snippet ad.",
  },
]);

const FAKE_OBJECTIONS = JSON.stringify([
  {
    objection: "I'm not looking right now.",
    response:
      "Totally understand — I'm not asking you to look. I'm asking if you'd take 15 minutes for the conversation, then decide.",
    escalation:
      "If still cold, send a 1-line text 6 weeks later: 'No pitch, just keeping you on my radar — same role still open.'",
  },
  {
    objection: "Compensation isn't competitive enough.",
    response:
      "I appreciate you saying so directly. The base is $X; equity adds a possible $Y at our last 409A. Is that range workable, or are we below floor?",
    escalation:
      "If below floor: 'Got it, won't waste your time. Mind sharing what would move the needle, in case our offer ladder evolves?'",
  },
  {
    objection: "I haven't heard of Acme.",
    response:
      "Fair. We're Series B, 30 engineers, $50M ARR. Here's a 90-second TL;DR + the latest investor memo.",
    escalation:
      "If still skeptical: introduce them to a current eng team-lead for a no-recruiter conversation.",
  },
  {
    objection: "Too risky — I'd be giving up vest / equity / promotion.",
    response:
      "Real concern. Most of our recent hires came from senior IC roles; I can show you what their first 6-month equity vest looked like.",
    escalation:
      "If still cold: walk through the math privately on a 30-min call and let them decide on data.",
  },
]);

// ── Schema tests ──────────────────────────────────────────────────────────

describe("sourcingSprintSchema", () => {
  it("accepts a complete, valid input", () => {
    expect(() => validInput()).not.toThrow();
  });

  it("rejects empty mustHaveSkills", () => {
    expect(() => validInput({ mustHaveSkills: [] })).toThrow();
  });

  it("rejects more than 10 mustHaveSkills", () => {
    expect(() =>
      validInput({
        mustHaveSkills: Array.from({ length: 11 }, (_, i) => `skill${i}`),
      }),
    ).toThrow();
  });

  it("rejects clientDescription shorter than 20 chars", () => {
    expect(() => validInput({ companyDescription: "too short" })).toThrow();
  });

  it("defaults seniorityLevel and urgency", () => {
    const parsed = sourcingSprintSchema.parse({
      roleTitle: "SWE",
      companyName: "Acme",
      companyDescription: "Acme does applicant tracking for SaaS HR teams.",
      mustHaveSkills: ["Go"],
    });
    expect(parsed.seniorityLevel).toBe("senior");
    expect(parsed.urgency).toBe("perfect-fit");
  });
});

// ── Asset generator tests ─────────────────────────────────────────────────

describe("generateIcp", () => {
  beforeEach(() => mockAi.mockReset());

  it("parses a well-formed ICP", async () => {
    mockAi.mockResolvedValue(FAKE_ICP);
    const icp = await generateIcp(validInput());
    expect(icp.archetype).toBeTruthy();
    expect(icp.mustHaveSignals.length).toBeGreaterThanOrEqual(4);
    expect(icp.yearsExperienceMin).toBeLessThan(icp.yearsExperienceMax);
  });

  it("strips a leading code fence before parsing", async () => {
    mockAi.mockResolvedValue("```json\n" + FAKE_ICP + "\n```");
    const icp = await generateIcp(validInput());
    expect(icp.archetype).toBeTruthy();
  });

  it("throws when the model returns non-JSON", async () => {
    mockAi.mockResolvedValue("definitely not json");
    await expect(generateIcp(validInput())).rejects.toThrow(/non-JSON/i);
  });
});

describe("generateBooleans", () => {
  beforeEach(() => mockAi.mockReset());

  it("returns all three platform strings", async () => {
    mockAi.mockResolvedValue(FAKE_BOOLEANS);
    const b = await generateBooleans(validInput());
    expect(b.linkedin).toContain("Senior Backend");
    expect(b.googleXRay).toContain("site:linkedin.com");
    expect(b.github).toContain("language:go");
  });
});

describe("generateOutreach", () => {
  beforeEach(() => mockAi.mockReset());

  it("computes char count, word count, and voicemail seconds", async () => {
    mockAi.mockResolvedValue(FAKE_OUTREACH);
    const o = await generateOutreach(validInput());
    expect(o.linkedinDm.charCount).toBe(o.linkedinDm.body.length);
    expect(o.coldEmail.wordCount).toBeGreaterThan(10);
    expect(o.coldEmail.subject).toBeTruthy();
    expect(o.voicemail.estimatedSeconds).toBeGreaterThan(0);
  });
});

describe("generateChannels", () => {
  beforeEach(() => mockAi.mockReset());

  it("returns exactly 5 channels", async () => {
    mockAi.mockResolvedValue(FAKE_CHANNELS);
    const ch = await generateChannels(validInput());
    expect(ch).toHaveLength(5);
    expect(ch[0]?.firstAction).toBeTruthy();
  });

  it("throws when fewer than 5 channels are returned", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify([
        { channel: "X", why: "y", firstAction: "z" },
        { channel: "X2", why: "y2", firstAction: "z2" },
      ]),
    );
    await expect(generateChannels(validInput())).rejects.toThrow(
      /fewer than 5/i,
    );
  });
});

describe("generateObjections", () => {
  beforeEach(() => mockAi.mockReset());

  it("returns exactly 4 plays", async () => {
    mockAi.mockResolvedValue(FAKE_OBJECTIONS);
    const o = await generateObjections(validInput());
    expect(o).toHaveLength(4);
    expect(o[0]?.escalation).toBeTruthy();
  });

  it("throws when fewer than 4 plays are returned", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify([{ objection: "a", response: "b", escalation: "c" }]),
    );
    await expect(generateObjections(validInput())).rejects.toThrow(
      /fewer than 4/i,
    );
  });
});

// ── Orchestrator tests ────────────────────────────────────────────────────

describe("buildSourcingSprint", () => {
  beforeEach(() => mockAi.mockReset());

  it("populates all five assets when every sub-call succeeds", async () => {
    // vitest's spy serializer can re-invoke the mock with no args during
    // post-hoc reporting — fall back to FAKE_ICP rather than throwing,
    // which would pollute Promise rejection traces.
    mockAi.mockImplementation(async (_p: unknown, opts: unknown) => {
      const sys = String(
        (opts as { system?: string } | undefined)?.system ?? "",
      );
      if (sys.includes("structured ICP")) return FAKE_ICP;
      if (sys.includes("boolean strings")) return FAKE_BOOLEANS;
      if (sys.includes("outreach that converts")) return FAKE_OUTREACH;
      if (sys.includes("non-LinkedIn places")) return FAKE_CHANNELS;
      if (sys.includes("four most common candidate objections"))
        return FAKE_OBJECTIONS;
      return FAKE_ICP;
    });

    const sprint = await buildSourcingSprint(validInput());
    expect(sprint.icp?.archetype).toBeTruthy();
    expect(sprint.booleans?.linkedin).toBeTruthy();
    expect(sprint.outreach?.coldEmail.wordCount).toBeGreaterThan(0);
    expect(sprint.channels?.length).toBe(5);
    expect(sprint.objections?.length).toBe(4);
    expect(sprint.errors).toEqual([]);
  });

  it("records sub-asset errors without sinking the whole sprint", async () => {
    mockAi.mockImplementation(async (_p: unknown, opts: unknown) => {
      const sys = String(
        (opts as { system?: string } | undefined)?.system ?? "",
      );
      if (sys.includes("structured ICP")) return FAKE_ICP;
      if (sys.includes("boolean strings")) throw new Error("nim quota");
      if (sys.includes("outreach that converts")) return FAKE_OUTREACH;
      if (sys.includes("non-LinkedIn places")) return FAKE_CHANNELS;
      if (sys.includes("four most common candidate objections"))
        return FAKE_OBJECTIONS;
      return FAKE_ICP;
    });

    const sprint = await buildSourcingSprint(validInput());
    expect(sprint.icp).not.toBeNull();
    expect(sprint.booleans).toBeNull();
    expect(sprint.outreach).not.toBeNull();
    expect(sprint.errors.find((e) => e.asset === "booleans")?.message).toMatch(
      /nim quota/,
    );
  });

  it("reports durationMs and ISO generatedAt", async () => {
    mockAi.mockResolvedValue(FAKE_ICP);
    const sprint = await buildSourcingSprint(validInput());
    expect(sprint.durationMs).toBeGreaterThanOrEqual(0);
    expect(sprint.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
