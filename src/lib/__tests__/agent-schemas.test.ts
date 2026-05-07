/**
 * Tests for src/lib/agent-schemas.ts — Reusable Agent Input Validation
 */
import { describe, it, expect } from "vitest";
import {
  leadGenSchema,
  siteAnalysisSchema,
  contentGenSchema,
  competitorSchema,
  promptOnlySchema,
  visionSchema,
  urlSchema,
  emailSchema,
  nicheSchema,
} from "@/lib/agent-schemas";

describe("agent-schemas.ts", () => {
  // ── Primitive Schemas ──

  it("urlSchema validates URLs", () => {
    expect(urlSchema.safeParse("https://example.com").success).toBe(true);
    expect(urlSchema.safeParse("not-a-url").success).toBe(false);
    expect(urlSchema.safeParse("").success).toBe(false);
  });

  it("emailSchema validates emails", () => {
    expect(emailSchema.safeParse("test@example.com").success).toBe(true);
    expect(emailSchema.safeParse("not-email").success).toBe(false);
  });

  it("nicheSchema enforces length", () => {
    expect(nicheSchema.safeParse("AI").success).toBe(true);
    expect(nicheSchema.safeParse("x").success).toBe(false); // too short
    expect(nicheSchema.safeParse("a".repeat(201)).success).toBe(false); // too long
  });

  // ── Lead Gen Schema ──

  it("leadGenSchema requires niche", () => {
    expect(leadGenSchema.safeParse({ niche: "SaaS" }).success).toBe(true);
    expect(leadGenSchema.safeParse({}).success).toBe(false);
  });

  it("leadGenSchema accepts optional fields", () => {
    const result = leadGenSchema.safeParse({
      niche: "Real Estate",
      location: "London",
      count: 10,
    });
    expect(result.success).toBe(true);
  });

  it("leadGenSchema rejects invalid count", () => {
    expect(leadGenSchema.safeParse({ niche: "Tech", count: 100 }).success).toBe(
      false,
    );
    expect(leadGenSchema.safeParse({ niche: "Tech", count: 0 }).success).toBe(
      false,
    );
  });

  // ── Site Analysis Schema ──

  it("siteAnalysisSchema requires valid URL", () => {
    expect(
      siteAnalysisSchema.safeParse({ url: "https://example.com" }).success,
    ).toBe(true);
    expect(siteAnalysisSchema.safeParse({ url: "not-a-url" }).success).toBe(
      false,
    );
    expect(siteAnalysisSchema.safeParse({}).success).toBe(false);
  });

  // ── Content Gen Schema ──

  it("contentGenSchema requires prompt", () => {
    expect(
      contentGenSchema.safeParse({ prompt: "Write about AI" }).success,
    ).toBe(true);
    expect(contentGenSchema.safeParse({}).success).toBe(false);
  });

  it("contentGenSchema validates length enum", () => {
    expect(
      contentGenSchema.safeParse({ prompt: "test", length: "short" }).success,
    ).toBe(true);
    expect(
      contentGenSchema.safeParse({ prompt: "test", length: "huge" }).success,
    ).toBe(false);
  });

  // ── Competitor Schema ──

  it("competitorSchema requires at least one field", () => {
    expect(competitorSchema.safeParse({}).success).toBe(false);
    expect(competitorSchema.safeParse({ company: "Acme" }).success).toBe(true);
    expect(
      competitorSchema.safeParse({ url: "https://acme.com" }).success,
    ).toBe(true);
    expect(competitorSchema.safeParse({ prompt: "Analyze Acme" }).success).toBe(
      true,
    );
  });

  // ── Prompt Only Schema ──

  it("promptOnlySchema validates prompt length", () => {
    expect(promptOnlySchema.safeParse({ prompt: "Hi" }).success).toBe(false); // too short
    expect(
      promptOnlySchema.safeParse({ prompt: "Hello world, do something" })
        .success,
    ).toBe(true);
  });

  // ── Vision Schema ──

  it("visionSchema requires at least one input", () => {
    expect(visionSchema.safeParse({}).success).toBe(false);
    expect(
      visionSchema.safeParse({ url: "https://img.com/photo.jpg" }).success,
    ).toBe(true);
    expect(visionSchema.safeParse({ image: "base64data" }).success).toBe(true);
    expect(
      visionSchema.safeParse({ prompt: "Describe this image" }).success,
    ).toBe(true);
  });
});
