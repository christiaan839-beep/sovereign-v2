import { describe, it, expect } from "vitest";
import {
  agentMetadata,
  agentInstalls,
  agentReviews,
  agentStatsDaily,
} from "@/db/schema";

describe("Sovereign World Drizzle tables (migration 0020)", () => {
  it("agent_metadata is keyed on slug (text PK — couples to registry)", () => {
    expect(agentMetadata).toBeDefined();
    const cols = Object.keys(agentMetadata as unknown as Record<string, unknown>);
    expect(cols).toContain("slug");
    expect(cols).toContain("displayName");
    expect(cols).toContain("category");
    expect(cols).toContain("pricingCents");
    expect(cols).toContain("featured");
    expect(cols).toContain("visibility");
  });

  it("agent_installs has user+slug uniqueness columns", () => {
    expect(agentInstalls).toBeDefined();
    const cols = Object.keys(agentInstalls as unknown as Record<string, unknown>);
    expect(cols).toContain("userId");
    expect(cols).toContain("agentSlug");
    expect(cols).toContain("installedAt");
  });

  it("agent_reviews has rating + comment columns", () => {
    expect(agentReviews).toBeDefined();
    const cols = Object.keys(agentReviews as unknown as Record<string, unknown>);
    expect(cols).toContain("rating");
    expect(cols).toContain("comment");
    expect(cols).toContain("userId");
    expect(cols).toContain("agentSlug");
  });

  it("agent_stats_daily is a rollup with composite PK", () => {
    expect(agentStatsDaily).toBeDefined();
    const cols = Object.keys(agentStatsDaily as unknown as Record<string, unknown>);
    expect(cols).toContain("agentSlug");
    expect(cols).toContain("day");
    expect(cols).toContain("runs");
    expect(cols).toContain("successes");
    expect(cols).toContain("totalCostCents");
  });
});
