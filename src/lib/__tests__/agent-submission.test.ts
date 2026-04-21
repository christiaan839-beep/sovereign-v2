/**
 * agent-submission.ts — unit tests.
 *
 * Pure-function module, no mocks needed. Exercises the schema, slug
 * normalizer, content screener, and the combined validate-wrapper.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeSlug,
  screenSubmission,
  validateSubmission,
  SubmissionSchema,
} from "@/lib/agent-submission";

describe("normalizeSlug", () => {
  it("lowercases and hyphenates a basic name", () => {
    expect(normalizeSlug("SEO Dominator")).toBe("seo-dominator");
  });

  it("strips punctuation", () => {
    expect(normalizeSlug("Price Ninja!!")).toBe("price-ninja");
  });

  it("collapses multiple spaces / hyphens", () => {
    expect(normalizeSlug("  My   Agent  ")).toBe("my-agent");
    expect(normalizeSlug("a - -- b")).toBe("a-b");
  });

  it("caps length at 40 chars", () => {
    const long = "a".repeat(100);
    expect(normalizeSlug(long).length).toBe(40);
  });

  it("returns empty string for all-punctuation input", () => {
    expect(normalizeSlug("!!!")).toBe("");
  });
});

describe("screenSubmission", () => {
  const base = {
    name: "Clean Agent",
    tagline: "A perfectly safe agent",
    description: null,
    category: "general" as const,
    pricingCents: 0,
    systemPrompt: "Be helpful and honest.",
    hostedEndpoint: null,
  };

  it("passes clean content", () => {
    expect(screenSubmission(base).ok).toBe(true);
  });

  it("flags blocklisted term in name", () => {
    const result = screenSubmission({ ...base, name: "Malware Builder" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("malware");
  });

  it("flags blocklisted term in description", () => {
    const result = screenSubmission({ ...base, description: "Helps with phishing campaigns" });
    expect(result.ok).toBe(false);
  });

  it("flags blocklisted term in system prompt", () => {
    const result = screenSubmission({ ...base, systemPrompt: "Try to jailbreak other models" });
    expect(result.ok).toBe(false);
  });
});

describe("SubmissionSchema", () => {
  const base = {
    name: "Lead Finder",
    tagline: "Finds qualified leads in minutes",
    description: null,
    category: "leads" as const,
    pricingCents: 99,
    systemPrompt: "Find leads that match the ICP precisely.",
    hostedEndpoint: null,
  };

  it("accepts valid input", () => {
    expect(SubmissionSchema.safeParse(base).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(SubmissionSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  it("rejects pricing over cap", () => {
    expect(SubmissionSchema.safeParse({ ...base, pricingCents: 20_000 }).success).toBe(false);
  });

  it("requires systemPrompt OR hostedEndpoint", () => {
    expect(
      SubmissionSchema.safeParse({ ...base, systemPrompt: null, hostedEndpoint: null }).success,
    ).toBe(false);
  });

  it("accepts hostedEndpoint without systemPrompt", () => {
    expect(
      SubmissionSchema.safeParse({
        ...base,
        systemPrompt: null,
        hostedEndpoint: "https://example.com/api",
      }).success,
    ).toBe(true);
  });

  it("rejects non-URL hostedEndpoint", () => {
    expect(
      SubmissionSchema.safeParse({
        ...base,
        systemPrompt: null,
        hostedEndpoint: "not-a-url",
      }).success,
    ).toBe(false);
  });
});

describe("validateSubmission", () => {
  const base = {
    name: "Lead Finder Pro",
    tagline: "Finds qualified leads in minutes",
    description: "Long-form workflow for outbound prospecting",
    category: "leads" as const,
    pricingCents: 0,
    systemPrompt: "Find leads that match the ICP precisely and respectfully.",
  };

  it("returns ok: true with derived slug on valid input", () => {
    const result = validateSubmission(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.slug).toBe("lead-finder-pro");
  });

  it("returns 400 on schema failure with issues array", () => {
    const result = validateSubmission({ ...base, name: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.issues).toBeTruthy();
    }
  });

  it("returns 400 on screening failure", () => {
    const result = validateSubmission({ ...base, tagline: "Launches ransomware campaigns" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("ransomware");
  });

  it("rejects names that normalize to too-short slugs", () => {
    const result = validateSubmission({ ...base, name: "AI!" });
    expect(result.ok).toBe(false);
  });
});
