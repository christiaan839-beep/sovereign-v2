/**
 * Tests for src/lib/knowledge-graph.ts — Wave 145.
 *
 * Pure-function tests over `extractEntities` and `mergeEntities`.
 * DB writes are smoke-tested via the guard paths.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  extractEntities,
  mergeEntities,
  upsertNode,
  upsertEdge,
  recordRunAsGraph,
} from "@/lib/knowledge-graph";

describe("extractEntities", () => {
  it("returns empty on too-short input", () => {
    expect(extractEntities("")).toEqual([]);
    expect(extractEntities("hi")).toEqual([]);
  });

  it("extracts URLs as url + matching domain", () => {
    const r = extractEntities("Check https://acme.com/page for more.");
    expect(r.some((e) => e.nodeType === "url" && /acme/.test(e.label))).toBe(
      true,
    );
    expect(
      r.some((e) => e.nodeType === "domain" && e.label === "acme.com"),
    ).toBe(true);
  });

  it("strips trailing punctuation from URLs", () => {
    const r = extractEntities("Visit https://acme.com/page.");
    const url = r.find((e) => e.nodeType === "url");
    expect(url?.label.endsWith(".")).toBe(false);
  });

  it("extracts bare domains", () => {
    const r = extractEntities("contact us at acme.io and beta.dev");
    const domains = r
      .filter((e) => e.nodeType === "domain")
      .map((e) => e.label);
    expect(domains).toContain("acme.io");
    expect(domains).toContain("beta.dev");
  });

  it("extracts dollar amounts", () => {
    const r = extractEntities(
      "It costs $5,000 monthly, or $24K annually, or $1.5M total.",
    );
    const amounts = r
      .filter((e) => e.nodeType === "amount")
      .map((e) => e.label);
    expect(amounts).toContain("$5,000");
    expect(amounts.some((a) => /\$24K/i.test(a))).toBe(true);
    expect(amounts.some((a) => /\$1\.5M/i.test(a))).toBe(true);
  });

  it("extracts ISO + spelled-out dates", () => {
    const r = extractEntities("Born on 2026-05-22 or May 22, 2026.");
    const dates = r.filter((e) => e.nodeType === "date").map((e) => e.label);
    expect(dates).toContain("2026-05-22");
    expect(dates.some((d) => /May/i.test(d))).toBe(true);
  });

  it("extracts capitalised entities", () => {
    const r = extractEntities(
      "Acme Corp announced its partnership with Beta Industries.",
    );
    const entities = r
      .filter((e) => e.nodeType === "entity")
      .map((e) => e.label);
    expect(entities.some((e) => /Acme/.test(e))).toBe(true);
    expect(entities.some((e) => /Beta/.test(e))).toBe(true);
  });

  it("filters out stop-word starters (The, And, etc.)", () => {
    const r = extractEntities("The Quick And Lazy Fox jumped over things.");
    const entities = r
      .filter((e) => e.nodeType === "entity")
      .map((e) => e.label);
    expect(entities.some((e) => e.startsWith("The"))).toBe(false);
    expect(entities.some((e) => e.startsWith("And"))).toBe(false);
  });

  it("dedupes case-insensitively + bumps confidence", () => {
    const r = extractEntities("acme.io and ACME.IO and acme.io again");
    const acme = r.find(
      (e) => e.nodeType === "domain" && e.label === "acme.io",
    );
    expect(acme).toBeDefined();
    expect(acme!.confidence).toBeGreaterThan(80);
  });

  it("caps output at MAX_ENTITIES_PER_RUN (12)", () => {
    const longText = Array.from(
      { length: 50 },
      (_, i) => `Site${i}.com mentioning Entity${i} at $${i}00.`,
    ).join(" ");
    const r = extractEntities(longText);
    expect(r.length).toBeLessThanOrEqual(12);
  });

  it("truncates labels longer than 120 chars", () => {
    const longUrl = "https://" + "x".repeat(200) + ".com";
    const r = extractEntities(longUrl);
    for (const e of r) {
      expect(e.label.length).toBeLessThanOrEqual(120);
    }
  });
});

describe("mergeEntities", () => {
  it("returns empty when both lists empty", () => {
    expect(mergeEntities([], [])).toEqual([]);
  });

  it("deduplicates across both lists", () => {
    const a = [
      { nodeType: "domain" as const, label: "acme.com", confidence: 80 },
    ];
    const b = [
      { nodeType: "domain" as const, label: "acme.com", confidence: 80 },
    ];
    const r = mergeEntities(a, b);
    expect(r).toHaveLength(1);
    expect(r[0].confidence).toBeGreaterThan(80);
  });

  it("preserves distinct entries", () => {
    const a = [{ nodeType: "domain" as const, label: "a.com", confidence: 80 }];
    const b = [{ nodeType: "domain" as const, label: "b.com", confidence: 70 }];
    expect(mergeEntities(a, b)).toHaveLength(2);
  });

  it("sorts by confidence desc", () => {
    const a = [{ nodeType: "entity" as const, label: "Beta", confidence: 50 }];
    const b = [
      { nodeType: "entity" as const, label: "Alpha", confidence: 80 },
      { nodeType: "entity" as const, label: "Gamma", confidence: 60 },
    ];
    const r = mergeEntities(a, b);
    expect(r[0].label).toBe("Alpha");
    expect(r[1].label).toBe("Gamma");
    expect(r[2].label).toBe("Beta");
  });

  it("clamps merged confidence to 100", () => {
    const a = [{ nodeType: "entity" as const, label: "X", confidence: 98 }];
    const b = [{ nodeType: "entity" as const, label: "X", confidence: 98 }];
    const r = mergeEntities(a, b);
    expect(r[0].confidence).toBeLessThanOrEqual(100);
  });
});

describe("guard paths", () => {
  it("upsertNode returns null for anon userId", async () => {
    expect(await upsertNode("anon", "domain", "x.com")).toBeNull();
  });

  it("upsertNode returns null for empty label", async () => {
    expect(await upsertNode("u", "domain", "")).toBeNull();
  });

  it("upsertEdge returns false for anon userId", async () => {
    expect(await upsertEdge("anon", "a", "b", "EXECUTED")).toBe(false);
  });

  it("upsertEdge returns false when source equals target", async () => {
    expect(await upsertEdge("u", "same", "same", "EXECUTED")).toBe(false);
  });

  it("recordRunAsGraph returns zeros for anon userId", async () => {
    const r = await recordRunAsGraph("anon", "audit", { output: "x" });
    expect(r).toEqual({ nodesWritten: 0, edgesWritten: 0 });
  });
});
