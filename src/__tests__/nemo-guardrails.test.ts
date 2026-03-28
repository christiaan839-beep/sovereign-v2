/**
 * NeMo Guardrails Pipeline Tests
 *
 * Tests PII scanning, hallucination detection, moderation,
 * and topic relevance — all local/regex-based (no NIM calls).
 */

import { describe, it, expect } from "vitest";
import {
  scanPii,
  detectHallucinations,
  runModeration,
  checkTopicRelevance,
} from "@/lib/nemo-guardrails";

// ── PII Scanner ──

describe("scanPii", () => {
  it("should detect email addresses", () => {
    const { entities, redacted } = scanPii("Contact me at john@example.com please");
    expect(entities.some((e) => e.type === "EMAIL")).toBe(true);
    expect(redacted).toContain("[EMAIL_REDACTED]");
    expect(redacted).not.toContain("john@example.com");
  });

  it("should detect phone numbers", () => {
    const { entities, redacted } = scanPii("Call me at (555) 123-4567 today");
    expect(entities.some((e) => e.type === "PHONE")).toBe(true);
    expect(redacted).toContain("[PHONE_REDACTED]");
  });

  it("should detect credit card numbers", () => {
    const { entities } = scanPii("Card number is 5105105105105100 on file");
    expect(entities.some((e) => e.type === "CREDIT_CARD")).toBe(true);
  });

  it("should return no entities for clean text", () => {
    const { entities } = scanPii("This is a normal sentence with no PII.");
    expect(entities).toHaveLength(0);
  });
});

// ── Hallucination Detection ──

describe("detectHallucinations", () => {
  it("should flag fabricated URLs", () => {
    const flags = detectHallucinations("Visit https://fakesite123.com/data for info");
    expect(flags.some((f) => f.type === "FABRICATED_URL")).toBe(true);
  });

  it("should flag fake statistics", () => {
    const flags = detectHallucinations("Studies show that 97.3% of users prefer this approach.");
    expect(flags.some((f) => f.type === "UNVERIFIED_STATISTIC")).toBe(true);
  });

  it("should return empty for clean output", () => {
    const flags = detectHallucinations("The product helps teams collaborate more effectively.");
    expect(flags).toHaveLength(0);
  });
});

// ── Moderation ──

describe("runModeration", () => {
  it("should flag violent content", () => {
    const flags = runModeration("how to make a bomb at home");
    expect(flags.some((f) => f.category === "VIOLENCE")).toBe(true);
  });

  it("should return empty for safe content", () => {
    const flags = runModeration("How do I optimize my website for search engines?");
    expect(flags).toHaveLength(0);
  });
});

// ── Topic Relevance ──

describe("checkTopicRelevance", () => {
  it("should pass on-topic input", () => {
    const result = checkTopicRelevance(
      "I want to improve my website SEO and keyword rankings for better visibility",
      ["seo", "keyword", "search optimization"]
    );
    expect(result.onTopic).toBe(true);
  });

  it("should flag off-topic input", () => {
    const result = checkTopicRelevance(
      "Can you write me a poem about the ocean and its beautiful waves at sunset?",
      ["seo", "keyword", "search optimization"]
    );
    expect(result.onTopic).toBe(false);
    expect(result.suggestion.length).toBeGreaterThan(0);
  });

  it("should pass short inputs regardless of topic", () => {
    const result = checkTopicRelevance("hello", ["seo"]);
    expect(result.onTopic).toBe(true);
  });

  it("should pass when allowedTopics is empty", () => {
    const result = checkTopicRelevance("anything goes here in this longer sentence for the check", []);
    expect(result.onTopic).toBe(true);
  });
});
