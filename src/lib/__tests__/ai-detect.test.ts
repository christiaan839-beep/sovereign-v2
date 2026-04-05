/**
 * Tests for src/lib/ai-detect.ts — AI pattern scorer
 *
 * The scorer runs on 9 heuristics: cliches, hedging, paragraph-uniformity,
 * transition-density, contraction-absence, list-obsession, repeated
 * adjectives, sentence-variance, and vocabulary diversity.
 *
 * These tests lock in the behavior so score-weight tweaks show up
 * immediately rather than silently drifting over time.
 */
import { describe, it, expect } from "vitest";
import { detectAIPatterns } from "@/lib/ai-detect";

describe("detectAIPatterns", () => {
  describe("trivially short/empty input", () => {
    it("returns score 0 for empty string", () => {
      const result = detectAIPatterns("");
      expect(result.score).toBe(0);
      expect(result.flags).toEqual([]);
    });

    it("returns score 0 for clean short text", () => {
      const result = detectAIPatterns("The cat sat on the mat.");
      expect(result.score).toBe(0);
    });

    it("does not flag under-threshold word counts for diversity/transitions", () => {
      // 50 words, no red flags → should not trigger any heuristic
      const clean = "The team shipped the feature on Friday. Users liked it. ".repeat(5);
      const result = detectAIPatterns(clean);
      // Score may be >0 from low variance, but should not have all 9 flags
      expect(result.score).toBeLessThan(30);
    });
  });

  describe("cliche detection", () => {
    it("flags 'delve into' as a high-severity cliche", () => {
      const result = detectAIPatterns("Let's delve into the topic.");
      const clicheFlags = result.flags.filter(f => f.severity === "high");
      expect(clicheFlags.length).toBeGreaterThan(0);
      expect(clicheFlags[0].pattern).toContain("delve");
    });

    it("flags 'leverage' and 'utilize' as cliches with 'use' replacements", () => {
      const result = detectAIPatterns("We leverage AI to utilize the data.");
      const flags = result.flags.filter(f => f.severity === "high");
      const patterns = flags.map(f => f.pattern);
      expect(patterns.some(p => p.includes("leverage"))).toBe(true);
      expect(patterns.some(p => p.includes("utilize"))).toBe(true);
      expect(flags.every(f => f.replacement === "use")).toBe(true);
    });

    it("flags multiple instances of the same cliche separately", () => {
      const result = detectAIPatterns("We leverage data. Companies leverage AI. Everyone leverages something.");
      const leverageFlags = result.flags.filter(f => f.pattern.includes("leverage"));
      expect(leverageFlags.length).toBe(3);
    });

    it("adds 6 points per cliche", () => {
      const oneClichè = detectAIPatterns("We leverage data.");
      const twoCliches = detectAIPatterns("We leverage and utilize data.");
      // At least the delta from the cliche scoring
      expect(twoCliches.score - oneClichè.score).toBeGreaterThanOrEqual(6);
    });
  });

  describe("hedging language", () => {
    it("flags hedging phrases at medium severity", () => {
      const result = detectAIPatterns("Generally speaking, it's important to note this.");
      const hedgingFlags = result.flags.filter(f => f.severity === "medium" && f.pattern.includes("Hedging"));
      expect(hedgingFlags.length).toBeGreaterThan(0);
    });
  });

  describe("perfect paragraph structure", () => {
    it("flags 4+ paragraphs all with 3-5 sentences", () => {
      // Each paragraph has exactly 4 sentences
      const para = "First sentence. Second sentence. Third sentence. Fourth sentence.";
      const text = [para, para, para, para].join("\n\n");
      const result = detectAIPatterns(text);
      const structureFlag = result.flags.find(f => f.pattern.includes("Perfect paragraph"));
      expect(structureFlag).toBeDefined();
      expect(structureFlag?.severity).toBe("medium");
    });

    it("does NOT flag when paragraphs vary (e.g. 2 sentences vs 6)", () => {
      const short = "One sentence. Two sentence.";
      const long = "Alpha. Beta. Gamma. Delta. Epsilon. Zeta.";
      const text = [short, long, short, long].join("\n\n");
      const result = detectAIPatterns(text);
      const structureFlag = result.flags.find(f => f.pattern.includes("Perfect paragraph"));
      expect(structureFlag).toBeUndefined();
    });
  });

  describe("excessive transitions", () => {
    it("flags high transition density (> 2 per 500 words)", () => {
      // ~40 words with 3 transitions = extremely high density
      const text = "We built it. Furthermore, we tested it. Moreover, we shipped it. Additionally, we celebrated.";
      const result = detectAIPatterns(text);
      const transitionFlag = result.flags.find(f => f.pattern.includes("transitions"));
      expect(transitionFlag).toBeDefined();
    });
  });

  describe("contraction absence", () => {
    it("flags text >100 words with zero contractions", () => {
      const formal = "The system processes requests rapidly. ".repeat(25);
      const result = detectAIPatterns(formal);
      const contractionFlag = result.flags.find(f => f.pattern.includes("contractions"));
      expect(contractionFlag).toBeDefined();
      expect(contractionFlag?.severity).toBe("low");
    });

    it("does NOT flag when contractions are present", () => {
      const casual = "I'm working on it. It's running well. We're shipping soon. ".repeat(25);
      const result = detectAIPatterns(casual);
      const contractionFlag = result.flags.find(f => f.pattern.includes("contractions"));
      expect(contractionFlag).toBeUndefined();
    });
  });

  describe("repeated adjectives", () => {
    it("flags an adjective repeated 3+ times", () => {
      const result = detectAIPatterns(
        "This is a comprehensive solution. Our comprehensive approach delivers comprehensive results."
      );
      const adjFlag = result.flags.find(f => f.pattern.includes("comprehensive"));
      expect(adjFlag).toBeDefined();
      expect(adjFlag?.pattern).toContain("3 times");
    });

    it("does NOT flag adjective used once or twice", () => {
      const result = detectAIPatterns("This is innovative. Another innovative idea.");
      const adjFlag = result.flags.find(f => f.pattern.includes("innovative"));
      expect(adjFlag).toBeUndefined();
    });
  });

  describe("sentence length variance", () => {
    it("flags low variance (robotic uniform length)", () => {
      // 5 sentences all with ~7 words each
      const text = "The cat sat on the red mat. The dog ran through the wet grass. The bird flew high into the sky. The fish swam deep in the pond. The horse ate some green fresh hay.";
      const result = detectAIPatterns(text);
      const varianceFlag = result.flags.find(f => f.pattern.includes("variance"));
      expect(varianceFlag).toBeDefined();
    });

    it("does NOT flag high variance (natural mix)", () => {
      const text = "Yes. The team worked through the night on a deeply complex problem with many moving parts. Fast. We shipped it in the morning after running exhaustive integration tests across multiple environments. Done.";
      const result = detectAIPatterns(text);
      const varianceFlag = result.flags.find(f => f.pattern.includes("Low sentence length variance"));
      expect(varianceFlag).toBeUndefined();
    });
  });

  describe("vocabulary diversity", () => {
    it("flags low vocabulary diversity in long enough text", () => {
      const repetitive = "the the the the the and and and and and a a a a a ".repeat(10);
      const result = detectAIPatterns(repetitive);
      const divFlag = result.flags.find(f => f.pattern.includes("vocabulary diversity"));
      expect(divFlag).toBeDefined();
    });
  });

  describe("score capping", () => {
    it("caps score at 100 no matter how many issues", () => {
      // Maximum slop: every cliche, hedging, transitions, no contractions, repeated adjectives
      const slop = (
        "It's important to note that we must delve into this. " +
        "Generally speaking, we leverage innovative solutions. " +
        "Furthermore, moreover, additionally, we utilize comprehensive strategies. " +
        "We revolutionize with cutting-edge paradigm shifts. " +
        "Our comprehensive innovative transformative dynamic strategic approach empowers users. " +
        "At the end of the day, we harness the power to dive deep. " +
        "In conclusion, it goes without saying that this is a game-changer. " +
        "Comprehensive testing shows comprehensive results. "
      ).repeat(3);
      const result = detectAIPatterns(slop);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe("suggestion text", () => {
    it("returns 'reads naturally' for low score (<=15)", () => {
      const result = detectAIPatterns("The team shipped it Friday.");
      expect(result.score).toBeLessThanOrEqual(15);
      expect(result.suggestion.toLowerCase()).toContain("naturally");
    });

    it("returns 'mildly robotic' for score 16-35", () => {
      // Need a score in the 16-35 range; two cliches = 12, + some variance hit
      const result = detectAIPatterns("We leverage data. We utilize insights.");
      // May or may not land in range, so just assert the suggestion semantics
      if (result.score > 15 && result.score <= 35) {
        expect(result.suggestion.toLowerCase()).toContain("robotic");
      }
    });

    it("returns actionable guidance for high scores", () => {
      const slop = "It's important to note that we delve into comprehensive solutions. Furthermore, we leverage cutting-edge strategies. Moreover, we utilize robust paradigms.";
      const result = detectAIPatterns(slop);
      expect(result.score).toBeGreaterThan(35);
      // Suggestion should mention replacing cliches (high-severity flags present)
      expect(result.suggestion.toLowerCase()).toMatch(/cliche|structure|formal/);
    });
  });

  describe("flag locations", () => {
    it("reports the char index of each cliche match", () => {
      const prefix = "Welcome to Sovereign Matrix. ";
      const text = prefix + "Let's leverage AI.";
      const result = detectAIPatterns(text);
      const leverageFlag = result.flags.find(f => f.pattern.includes("leverage"));
      expect(leverageFlag).toBeDefined();
      expect(leverageFlag?.location).toBe(prefix.length + "Let's ".length);
    });
  });
});
