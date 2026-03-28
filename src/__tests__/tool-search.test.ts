/**
 * Tool Search Registry Tests
 *
 * Validates the agent tool search system returns correct agents
 * for natural language queries and category/registry metadata.
 */

import { describe, it, expect } from "vitest";
import {
  searchAgentTools,
  getAgentCategories,
  getRegistrySize,
  getAgentTool,
} from "@/lib/tool-search";

describe("searchAgentTools", () => {
  it('should return leads agent for "find leads"', () => {
    const results = searchAgentTools("find leads");
    const names = results.map((r) => r.name);
    expect(names).toContain("leads");
  });

  it('should return competitor + site-assassin for "analyze competitor"', () => {
    const results = searchAgentTools("analyze competitor");
    const names = results.map((r) => r.name);
    expect(names).toContain("competitor");
    expect(names).toContain("site-assassin");
  });

  it('should return blog-gen for "write blog"', () => {
    const results = searchAgentTools("write blog");
    const names = results.map((r) => r.name);
    expect(names).toContain("blog-gen");
  });

  it('should return empty array for "nonsense xyz"', () => {
    const results = searchAgentTools("nonsense xyz");
    expect(results).toHaveLength(0);
  });

  it("should respect the limit parameter", () => {
    const results = searchAgentTools("search", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

describe("getAgentTool", () => {
  it("should return a tool by exact name", () => {
    const tool = getAgentTool("blog-gen");
    expect(tool).toBeDefined();
    expect(tool?.category).toBe("content");
  });

  it("should return undefined for unknown name", () => {
    expect(getAgentTool("does-not-exist")).toBeUndefined();
  });
});

describe("getAgentCategories", () => {
  it("should return all categories as record of arrays", () => {
    const categories = getAgentCategories();
    expect(Object.keys(categories).length).toBeGreaterThan(5);
    expect(categories["content"]).toContain("blog-gen");
    expect(categories["sales"]).toContain("leads");
    expect(categories["intelligence"]).toContain("competitor");
  });
});

describe("getRegistrySize", () => {
  it("should return more than 20 agents", () => {
    expect(getRegistrySize()).toBeGreaterThan(20);
  });
});
