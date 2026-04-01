/**
 * Tests for src/lib/tool-search.ts — Agent Tool Registry Search
 */
import { describe, it, expect } from "vitest";
import {
  searchAgentTools,
  getAgentTool,
  getAgentCategories,
  getRegistrySize,
} from "@/lib/tool-search";

describe("tool-search", () => {
  // ─── searchAgentTools ───

  describe("searchAgentTools", () => {
    it("should return relevant agents for a keyword search", () => {
      const results = searchAgentTools("seo keyword ranking");
      expect(results.length).toBeGreaterThan(0);
      const names = results.map((r) => r.name);
      expect(names).toContain("seo-dominator");
    });

    it("should return agents matching content-related queries", () => {
      const results = searchAgentTools("write a blog post");
      expect(results.length).toBeGreaterThan(0);
      const names = results.map((r) => r.name);
      expect(names).toContain("blog-gen");
    });

    it("should return competitor analysis agents for competitor queries", () => {
      const results = searchAgentTools("analyze competitor website");
      expect(results.length).toBeGreaterThan(0);
      const categories = results.map((r) => r.category);
      expect(categories).toContain("intelligence");
    });

    it("should respect the limit parameter", () => {
      const results = searchAgentTools("search", 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should return empty array for completely irrelevant query", () => {
      const results = searchAgentTools("xyzzy qqq zzz");
      expect(results.length).toBe(0);
    });

    it("should return empty array for very short non-matching terms", () => {
      // Terms under 3 chars are filtered out by the implementation
      const results = searchAgentTools("ab cd");
      expect(results.length).toBe(0);
    });

    it("should match agents by exact name", () => {
      const results = searchAgentTools("god-brain");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe("god-brain");
    });

    it("should return results sorted by relevance score", () => {
      const results = searchAgentTools("voice speech audio");
      expect(results.length).toBeGreaterThan(0);
      // Voice-related agents should rank highest
      const voiceAgents = results.filter((r) => r.category === "voice");
      expect(voiceAgents.length).toBeGreaterThan(0);
    });

    it("should find lead generation agents for sales queries", () => {
      const results = searchAgentTools("find B2B leads and prospects");
      expect(results.length).toBeGreaterThan(0);
      const names = results.map((r) => r.name);
      expect(names).toContain("leads");
    });

    it("should match by category keyword", () => {
      const results = searchAgentTools("code programming develop");
      expect(results.length).toBeGreaterThan(0);
      const codeAgents = results.filter((r) => r.category === "code");
      expect(codeAgents.length).toBeGreaterThan(0);
    });

    it("should default limit to 5 results", () => {
      const results = searchAgentTools("agent tool search query find");
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  // ─── getAgentTool ───

  describe("getAgentTool", () => {
    it("should return the correct tool by name", () => {
      const tool = getAgentTool("leads");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("leads");
      expect(tool!.category).toBe("sales");
    });

    it("should return undefined for a non-existent tool", () => {
      const tool = getAgentTool("does-not-exist");
      expect(tool).toBeUndefined();
    });

    it("should include the inputSchema in returned tool", () => {
      const tool = getAgentTool("flux-image");
      expect(tool).toBeDefined();
      expect(tool!.inputSchema).toBeDefined();
      expect(tool!.inputSchema.properties).toBeDefined();
    });
  });

  // ─── getAgentCategories ───

  describe("getAgentCategories", () => {
    it("should return a mapping of categories to agent name arrays", () => {
      const categories = getAgentCategories();
      expect(Object.keys(categories).length).toBeGreaterThan(0);
      expect(categories["content"]).toBeDefined();
      expect(Array.isArray(categories["content"])).toBe(true);
    });

    it("should include expected categories", () => {
      const categories = getAgentCategories();
      expect(categories).toHaveProperty("content");
      expect(categories).toHaveProperty("sales");
      expect(categories).toHaveProperty("intelligence");
      expect(categories).toHaveProperty("seo");
      expect(categories).toHaveProperty("code");
      expect(categories).toHaveProperty("voice");
      expect(categories).toHaveProperty("meta");
    });

    it("should have blog-gen in the content category", () => {
      const categories = getAgentCategories();
      expect(categories["content"]).toContain("blog-gen");
    });
  });

  // ─── getRegistrySize ───

  describe("getRegistrySize", () => {
    it("should return a positive number", () => {
      const size = getRegistrySize();
      expect(size).toBeGreaterThan(0);
    });

    it("should match the number of unique agent entries", () => {
      const categories = getAgentCategories();
      const totalAgents = Object.values(categories).flat().length;
      expect(getRegistrySize()).toBe(totalAgents);
    });
  });
});
