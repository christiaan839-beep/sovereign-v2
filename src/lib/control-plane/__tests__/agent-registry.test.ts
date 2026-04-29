/**
 * R101 — Agent Registry & Crew Composer unit tests.
 *
 * Coverage:
 *   - deriveCapabilities reads tier-1 base + signals
 *   - listRegisteredAgents filters work in all dimensions
 *   - listRegisteredAgents returns sorted-by-slug
 *   - isRegistered guards unknown slugs
 *   - findAgentsByCapability ranks correctly
 *   - composeCrew respects maxTier, minGrade, availability
 *   - composeCrew rankingScore = capability × trust × availability
 *   - composeCrew unmetCapabilities escalation set is correct
 *   - registryStats sums match underlying manifests
 *   - All functions take an optional manifests param for fixtures
 */

import { describe, it, expect } from "vitest";
import {
  deriveCapabilities,
  listRegisteredAgents,
  isRegistered,
  findAgentsByCapability,
  composeCrew,
  registryStats,
  type AgentCapability,
} from "@/lib/control-plane/agent-registry";
import type { AgentManifest } from "@/lib/agent-manifest";

// Test fixtures — small, deterministic, exercise every code path.
const fixtures: Record<string, AgentManifest> = {
  "read-only-summarizer": {
    slug: "read-only-summarizer",
    tier: 1,
    tierReason: "Tier 1: read-only / inference-only",
    models: [],
    tools: [],
    pii: { guardMode: "mask", handlesByDesign: false },
    outputClass: "tenant-private",
    signals: [{ kind: "model_call", detail: "1 occurrence" }],
    classifierConfidence: 0.95,
  },
  "browser-screenshot": {
    slug: "browser-screenshot",
    tier: 3,
    tierReason: "Tier 3: browser_control",
    models: [],
    tools: [{ name: "playwright", origin: "playwright.dev" }],
    pii: { guardMode: "default-mask", handlesByDesign: false },
    outputClass: "confidential",
    signals: [
      { kind: "browser_control", detail: "1 occurrence" },
      { kind: "external_fetch", detail: "playwright" },
    ],
    classifierConfidence: 0.99,
  },
  "stripe-refund": {
    slug: "stripe-refund",
    tier: 3,
    tierReason: "Tier 3: payment_op",
    models: [],
    tools: [{ name: "stripe", origin: "stripe.com" }],
    pii: { guardMode: "mask", handlesByDesign: false },
    outputClass: "confidential",
    signals: [
      { kind: "payment_op", detail: "stripe.refund" },
      { kind: "model_call", detail: "1 occurrence" },
    ],
    classifierConfidence: 0.98,
  },
  "email-sender": {
    slug: "email-sender",
    tier: 3,
    tierReason: "Tier 3: email_send",
    models: [],
    tools: [{ name: "resend", origin: "resend.com" }],
    pii: { guardMode: "flag", handlesByDesign: true },
    outputClass: "tenant-private",
    signals: [
      { kind: "email_send", detail: "resend.send" },
      { kind: "external_fetch", detail: "resend api" },
    ],
    classifierConfidence: 0.97,
  },
  "image-gen": {
    slug: "image-gen",
    tier: 1,
    tierReason: "Tier 1: inference",
    models: [],
    tools: [{ name: "flux", origin: "blackforestlabs.ai" }],
    pii: { guardMode: "skip", handlesByDesign: false },
    outputClass: "public",
    signals: [{ kind: "model_call", detail: "flux call" }],
    classifierConfidence: 0.93,
  },
  "db-writer": {
    slug: "db-writer",
    tier: 2,
    tierReason: "Tier 2: db_write",
    models: [],
    tools: [],
    pii: { guardMode: "default-mask", handlesByDesign: false },
    outputClass: "tenant-private",
    signals: [{ kind: "db_write", detail: "drizzle insert" }],
    classifierConfidence: 0.96,
  },
};

describe("deriveCapabilities", () => {
  it("tier-1 agent gets [read, model_call] base", () => {
    const caps = deriveCapabilities(fixtures["read-only-summarizer"]);
    expect(caps).toEqual(["model_call", "read"]);
  });

  it("browser agent gets browser_control + external_fetch", () => {
    const caps = deriveCapabilities(fixtures["browser-screenshot"]);
    expect(caps).toContain("browser_control");
    expect(caps).toContain("external_fetch");
    expect(caps).toContain("read");
    expect(caps).toContain("model_call");
  });

  it("payment agent gets payment_op", () => {
    const caps = deriveCapabilities(fixtures["stripe-refund"]);
    expect(caps).toContain("payment_op");
  });

  it("image-gen tool inflates capability set", () => {
    const caps = deriveCapabilities(fixtures["image-gen"]);
    expect(caps).toContain("image_gen");
  });

  it("db-writer gets db_write capability", () => {
    const caps = deriveCapabilities(fixtures["db-writer"]);
    expect(caps).toContain("db_write");
  });
});

describe("listRegisteredAgents — filters", () => {
  it("returns all agents when no filter", () => {
    const all = listRegisteredAgents(undefined, fixtures);
    expect(all.length).toBe(Object.keys(fixtures).length);
  });

  it("sorted by slug ascending (deterministic)", () => {
    const all = listRegisteredAgents(undefined, fixtures);
    const slugs = all.map((a) => a.slug);
    const sorted = [...slugs].sort();
    expect(slugs).toEqual(sorted);
  });

  it("maxTier filter excludes higher tiers", () => {
    const tier1 = listRegisteredAgents({ maxTier: 1 }, fixtures);
    expect(tier1.every((a) => a.manifest.tier <= 1)).toBe(true);
    expect(tier1.length).toBe(2); // read-only-summarizer + image-gen
  });

  it("requiredCapabilities filter requires ALL match", () => {
    const need: AgentCapability[] = ["payment_op", "model_call"];
    const matches = listRegisteredAgents(
      { requiredCapabilities: need },
      fixtures,
    );
    expect(matches.length).toBe(1);
    expect(matches[0].slug).toBe("stripe-refund");
  });

  it("piiGuardModes filter respects allowlist", () => {
    const flagOnly = listRegisteredAgents(
      { piiGuardModes: ["flag"] },
      fixtures,
    );
    expect(flagOnly.length).toBe(1);
    expect(flagOnly[0].slug).toBe("email-sender");
  });

  it("outputClasses filter respects allowlist", () => {
    const publicOnly = listRegisteredAgents(
      { outputClasses: ["public"] },
      fixtures,
    );
    expect(publicOnly.length).toBe(1);
    expect(publicOnly[0].slug).toBe("image-gen");
  });

  it("slugSubstring filter is case-insensitive", () => {
    const matches = listRegisteredAgents(
      { slugSubstring: "BROWSER" },
      fixtures,
    );
    expect(matches.length).toBe(1);
    expect(matches[0].slug).toBe("browser-screenshot");
  });
});

describe("isRegistered", () => {
  it("returns true for known slug", () => {
    expect(isRegistered("read-only-summarizer", fixtures)).toBe(true);
  });
  it("returns false for unknown slug", () => {
    expect(isRegistered("nonexistent-agent", fixtures)).toBe(false);
  });
  it("works against the real generated manifests by default", () => {
    expect(isRegistered("nonexistent-agent")).toBe(false);
  });
});

describe("findAgentsByCapability", () => {
  it("returns full-coverage agents first", () => {
    const matches = findAgentsByCapability(["payment_op"], fixtures);
    expect(matches[0].slug).toBe("stripe-refund");
    expect(matches[0].capabilityScore).toBe(1);
  });

  it("partial-coverage agents sorted by score then slug", () => {
    const matches = findAgentsByCapability(
      ["model_call", "payment_op"],
      fixtures,
    );
    expect(matches[0].slug).toBe("stripe-refund");
    expect(matches[0].capabilityScore).toBe(1);
    // Other agents have model_call but not payment_op → 0.5
    const partial = matches.filter((m) => m.capabilityScore === 0.5);
    expect(partial.length).toBeGreaterThan(0);
  });

  it("returns empty array when no required caps", () => {
    expect(findAgentsByCapability([], fixtures)).toEqual([]);
  });

  it("excludes agents with zero overlap", () => {
    // payment_op + image_gen — only stripe-refund has payment_op,
    // only image-gen has image_gen → both should appear (>0 overlap)
    const matches = findAgentsByCapability(
      ["payment_op", "image_gen"],
      fixtures,
    );
    const slugs = matches.map((m) => m.slug);
    expect(slugs).toContain("stripe-refund");
    expect(slugs).toContain("image-gen");
  });

  it("missingCapabilities lists what each agent lacks", () => {
    const matches = findAgentsByCapability(
      ["model_call", "payment_op", "image_gen"],
      fixtures,
    );
    const stripe = matches.find((m) => m.slug === "stripe-refund");
    expect(stripe?.missingCapabilities).toEqual(["image_gen"]);
  });
});

describe("composeCrew — ranking and constraints", () => {
  it("respects maxTier", () => {
    const proposal = composeCrew(
      {
        requiredCapabilities: ["model_call"],
        maxTier: 1,
      },
      fixtures,
    );
    expect(proposal.members.every((m) => m.manifest.tier <= 1)).toBe(true);
  });

  it("excludes agents below minReputationGrade", () => {
    const proposal = composeCrew(
      {
        requiredCapabilities: ["model_call"],
        minReputationGrade: "A",
        reputationByAgent: {
          "read-only-summarizer": "A+",
          "image-gen": "B",
        },
      },
      fixtures,
    );
    const slugs = proposal.members.map((m) => m.slug);
    expect(slugs).toContain("read-only-summarizer");
    expect(slugs).not.toContain("image-gen"); // B below A floor
  });

  it("ranking_score = capability × trust × availability", () => {
    const proposal = composeCrew(
      {
        requiredCapabilities: ["model_call"],
        reputationByAgent: { "read-only-summarizer": "A+" },
        availabilityByAgent: { "read-only-summarizer": 0.5 },
      },
      fixtures,
    );
    const summarizer = proposal.members.find(
      (m) => m.slug === "read-only-summarizer",
    );
    expect(summarizer).toBeDefined();
    if (summarizer) {
      // capability=1, trust=11/11=1, availability=0.5 → 0.5
      expect(summarizer.rankingScore).toBeCloseTo(0.5, 5);
    }
  });

  it("default trust = 0.5 when no reputation provided", () => {
    const proposal = composeCrew(
      {
        requiredCapabilities: ["model_call"],
      },
      fixtures,
    );
    const summarizer = proposal.members.find(
      (m) => m.slug === "read-only-summarizer",
    );
    expect(summarizer?.rankingScore).toBeCloseTo(0.5, 5);
  });

  it("identifies fullCoverage members", () => {
    const proposal = composeCrew(
      {
        requiredCapabilities: ["payment_op"],
      },
      fixtures,
    );
    expect(proposal.fullCoverageAvailable).toBe(true);
    expect(proposal.members[0].fullCoverage).toBe(true);
  });

  it("populates unmetCapabilities when no agent covers everything", () => {
    const proposal = composeCrew(
      {
        requiredCapabilities: ["payment_op", "voice_call"],
      },
      fixtures,
    );
    expect(proposal.unmetCapabilities).toContain("voice_call");
  });

  it("rationale includes the required capabilities and crew size", () => {
    const proposal = composeCrew(
      { requiredCapabilities: ["model_call"] },
      fixtures,
    );
    expect(proposal.rationale).toContain("model_call");
    expect(proposal.rationale).toContain(`${proposal.members.length}`);
  });

  it("respects maxCrewSize cap", () => {
    const proposal = composeCrew(
      {
        requiredCapabilities: ["model_call"],
        maxCrewSize: 2,
      },
      fixtures,
    );
    expect(proposal.members.length).toBeLessThanOrEqual(2);
  });

  it("default maxCrewSize is 5", () => {
    const proposal = composeCrew(
      { requiredCapabilities: ["model_call"] },
      fixtures,
    );
    expect(proposal.members.length).toBeLessThanOrEqual(5);
  });
});

describe("registryStats", () => {
  it("totals match the input manifest count", () => {
    const stats = registryStats(fixtures);
    expect(stats.total).toBe(Object.keys(fixtures).length);
  });

  it("byTier sums equal total", () => {
    const stats = registryStats(fixtures);
    const sum = stats.byTier[1] + stats.byTier[2] + stats.byTier[3];
    expect(sum).toBe(stats.total);
  });

  it("byOutputClass sums equal total", () => {
    const stats = registryStats(fixtures);
    const sum =
      stats.byOutputClass.public +
      stats.byOutputClass["tenant-private"] +
      stats.byOutputClass.confidential;
    expect(sum).toBe(stats.total);
  });

  it("byPiiGuard sums equal total", () => {
    const stats = registryStats(fixtures);
    const sum =
      stats.byPiiGuard.mask +
      stats.byPiiGuard.flag +
      stats.byPiiGuard.skip +
      stats.byPiiGuard["default-mask"];
    expect(sum).toBe(stats.total);
  });

  it("counts the real generated manifest registry without errors", () => {
    const stats = registryStats();
    expect(stats.total).toBeGreaterThan(100); // we have 223 agents
    expect(stats.byTier[1]).toBeGreaterThan(0);
  });
});
