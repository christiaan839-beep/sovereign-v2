/**
 * Tests for agent-tiers — the marketplace classification gate.
 */
import { describe, it, expect } from "vitest";
import {
  getAgentTier,
  isCoreAgent,
  isDeprecatedAgent,
  filterByTier,
  partitionAgents,
  tierComparator,
} from "@/lib/agent-tiers";

describe("agent-tiers", () => {
  it("classifies the documented core flagships as core", () => {
    for (const slug of [
      "god-brain",
      "war-room",
      "computer-use",
      "agency-packet",
      "sourcing-sprint",
      "growth-pulse",
      "listing-pulse",
      "blog-gen",
    ]) {
      expect(getAgentTier(slug)).toBe("core");
      expect(isCoreAgent(slug)).toBe(true);
    }
  });

  it("falls back to experimental for unknown slugs (default tier)", () => {
    expect(getAgentTier("not-a-real-agent")).toBe("experimental");
    expect(isCoreAgent("not-a-real-agent")).toBe(false);
    expect(isDeprecatedAgent("not-a-real-agent")).toBe(false);
  });

  it("filters by tier", () => {
    const slugs = ["god-brain", "war-room", "random-agent", "another-random"];
    expect(filterByTier(slugs, "core")).toEqual(["god-brain", "war-room"]);
    expect(filterByTier(slugs, "experimental")).toEqual([
      "random-agent",
      "another-random",
    ]);
  });

  it("partitions a slug list into the three buckets", () => {
    const slugs = ["god-brain", "long-tail-1", "long-tail-2"];
    const out = partitionAgents(slugs);
    expect(out.core).toEqual(["god-brain"]);
    expect(out.experimental.length).toBe(2);
    expect(out.deprecated).toEqual([]);
  });

  it("sorts core before experimental before deprecated", () => {
    const slugs = ["random-x", "god-brain", "random-y"];
    const sorted = [...slugs].sort(tierComparator);
    expect(sorted[0]).toBe("god-brain");
  });
});
