/**
 * Tests for src/lib/system-prompts.ts — Anti-Slop Rules & Prompt Quality
 */
import { describe, it, expect } from "vitest";
import { getSystemPrompt, getAntiSlopRules } from "@/lib/system-prompts";

describe("system-prompts.ts — Quality & Anti-Slop", () => {
  const antiSlop = getAntiSlopRules();

  it("anti-slop rules exist and are non-empty", () => {
    expect(antiSlop.length).toBeGreaterThan(100);
  });

  it("anti-slop rules ban common AI phrases", () => {
    const lower = antiSlop.toLowerCase();
    expect(lower).toContain("i'd be happy to");
    expect(lower).toContain("certainly");
  });

  it("anti-slop rules ban buzzwords", () => {
    const lower = antiSlop.toLowerCase();
    // Should mention at least some of these as banned
    const buzzwords = ["delve", "leverage", "utilize", "streamline", "cutting-edge"];
    const found = buzzwords.filter(w => lower.includes(w));
    expect(found.length).toBeGreaterThan(0);
  });

  it("getSystemPrompt returns prompt for known task types", () => {
    const prompt = getSystemPrompt("sales");
    expect(prompt.length).toBeGreaterThan(50);
  });

  it("getSystemPrompt returns default for unknown task types", () => {
    const prompt = getSystemPrompt("nonexistent-type-xyz");
    expect(prompt.length).toBeGreaterThan(0); // Should return a fallback
  });

  it("system prompts mention banned phrases only as rules (not as output)", () => {
    const salesPrompt = getSystemPrompt("sales");
    // The prompt itself may list banned phrases as examples of what NOT to say
    // Verify it doesn't start with banned phrases (which would mean the AI IS using them)
    expect(salesPrompt.startsWith("I'd be happy to")).toBe(false);
    expect(salesPrompt.startsWith("Certainly")).toBe(false);
  });

  it("anti-slop rules include data accuracy rules", () => {
    const lower = antiSlop.toLowerCase();
    // Should mention not inventing data
    expect(lower.includes("invent") || lower.includes("fabricat") || lower.includes("hallucin") || lower.includes("made up")).toBe(true);
  });
});
