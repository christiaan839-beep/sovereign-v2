/**
 * Tests for src/lib/mcp-tools-export.ts — Cook 116.
 */

import { describe, it, expect } from "vitest";
import {
  buildMcpDescriptors,
  findDescriptor,
  groupByCategory,
} from "../mcp-tools-export";

describe("buildMcpDescriptors", () => {
  it("returns a non-empty list of tool descriptors", () => {
    const ds = buildMcpDescriptors();
    expect(ds.length).toBeGreaterThan(0);
  });

  it("every descriptor has name + description + category + inputSchema", () => {
    for (const d of buildMcpDescriptors()) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
      expect(d.category).toBeDefined();
      expect(d.inputSchema).toBeDefined();
    }
  });

  it("every name is sovereign-namespaced", () => {
    for (const d of buildMcpDescriptors()) {
      expect(d.name.startsWith("sovereign/")).toBe(true);
    }
  });

  it("names are unique", () => {
    const ds = buildMcpDescriptors();
    const names = ds.map((d) => d.name);
    expect(names.length).toBe(new Set(names).size);
  });

  it("includes the core trust + compliance + verify tools", () => {
    const names = buildMcpDescriptors().map((d) => d.name);
    expect(names).toContain("sovereign/verify-claim");
    expect(names).toContain("sovereign/audit-bias");
    expect(names).toContain("sovereign/compliance-scorecard");
    expect(names).toContain("sovereign/soc2-posture");
    expect(names).toContain("sovereign/render-attestation");
  });
});

describe("findDescriptor", () => {
  it("returns the descriptor by name", () => {
    expect(findDescriptor("sovereign/verify-claim")?.category).toBe("verify");
  });

  it("returns undefined for missing names", () => {
    expect(findDescriptor("ghost")).toBeUndefined();
  });
});

describe("groupByCategory", () => {
  it("buckets descriptors per category", () => {
    const groups = groupByCategory(buildMcpDescriptors());
    expect(
      groups.trust.length + groups.verify.length + groups.compliance.length,
    ).toBeGreaterThan(0);
    expect(Array.isArray(groups.workflow)).toBe(true);
  });

  it("every category present even when empty", () => {
    const groups = groupByCategory([]);
    expect(groups.trust).toEqual([]);
    expect(groups.workflow).toEqual([]);
    expect(groups.billing).toEqual([]);
  });
});

describe("descriptors are JSON-serializable", () => {
  it("round-trips through JSON.stringify", () => {
    expect(() =>
      JSON.parse(JSON.stringify(buildMcpDescriptors())),
    ).not.toThrow();
  });
});
