/**
 * Tests for src/lib/admin-memories-helpers.ts — Wave 143.
 */
import { describe, it, expect } from "vitest";
import {
  parseMemoryFilters,
  clampLimit,
  normalizeSort,
  truncateContent,
  projectMetadata,
  sortFragment,
  MEMORY_VALID_SORTS,
} from "@/lib/admin-memories-helpers";

describe("clampLimit", () => {
  it("defaults to 50 on null", () => {
    expect(clampLimit(null)).toBe(50);
  });
  it("defaults on non-numeric", () => {
    expect(clampLimit("abc")).toBe(50);
  });
  it("clamps low to 1", () => {
    expect(clampLimit("-5")).toBe(1);
    expect(clampLimit("0")).toBe(1);
  });
  it("clamps high to 200", () => {
    expect(clampLimit("99999")).toBe(200);
  });
  it("passes through in-range values", () => {
    expect(clampLimit("75")).toBe(75);
  });
});

describe("normalizeSort", () => {
  it("defaults to createdAt-desc on null", () => {
    expect(normalizeSort(null)).toBe("createdAt-desc");
  });
  it("rejects unknown sorts to default", () => {
    expect(normalizeSort("malicious-sql-here")).toBe("createdAt-desc");
  });
  it("accepts every whitelisted value", () => {
    for (const s of MEMORY_VALID_SORTS) {
      expect(normalizeSort(s)).toBe(s);
    }
  });
  it("trims input", () => {
    expect(normalizeSort("  agent  ")).toBe("agent");
  });
});

describe("parseMemoryFilters", () => {
  it("returns all-null when no params", () => {
    const r = parseMemoryFilters(new URLSearchParams());
    expect(r.userId).toBeNull();
    expect(r.agentName).toBeNull();
    expect(r.search).toBeNull();
    expect(r.limit).toBe(50);
    expect(r.sort).toBe("createdAt-desc");
  });

  it("strips empty strings", () => {
    const r = parseMemoryFilters(
      new URLSearchParams({ userId: "  ", agent: "", q: "" }),
    );
    expect(r.userId).toBeNull();
    expect(r.agentName).toBeNull();
    expect(r.search).toBeNull();
  });

  it("passes through populated params", () => {
    const r = parseMemoryFilters(
      new URLSearchParams({
        userId: "u_1",
        agent: "audit",
        q: "stripe",
        limit: "100",
        sort: "agent",
      }),
    );
    expect(r.userId).toBe("u_1");
    expect(r.agentName).toBe("audit");
    expect(r.search).toBe("stripe");
    expect(r.limit).toBe(100);
    expect(r.sort).toBe("agent");
  });
});

describe("truncateContent", () => {
  it("returns dash for empty", () => {
    expect(truncateContent("")).toBe("—");
  });
  it("collapses whitespace + trims", () => {
    expect(truncateContent("  alpha\n\n  beta  ")).toBe("alpha beta");
  });
  it("truncates with ellipsis above max", () => {
    const r = truncateContent("x".repeat(500), 100);
    expect(r.length).toBe(101);
    expect(r.endsWith("…")).toBe(true);
  });
  it("returns full string when under max", () => {
    expect(truncateContent("short", 100)).toBe("short");
  });
});

describe("projectMetadata", () => {
  it("returns undefined on null/falsy", () => {
    expect(projectMetadata(null)).toBeUndefined();
    expect(projectMetadata(undefined)).toBeUndefined();
    expect(projectMetadata("")).toBeUndefined();
  });

  it("parses JSON strings", () => {
    expect(projectMetadata('{"kind":"audit"}')).toEqual({ kind: "audit" });
  });

  it("returns undefined on malformed JSON", () => {
    expect(projectMetadata("not json")).toBeUndefined();
  });

  it("returns undefined when no whitelisted keys present", () => {
    expect(projectMetadata({ random: "value" })).toBeUndefined();
  });

  it("keeps only whitelisted keys", () => {
    const r = projectMetadata({
      kind: "deep-think",
      mode: "reason",
      embedding: [0.1, 0.2, 0.3], // huge — must be dropped
      random: "ignored",
    });
    expect(r).toEqual({ kind: "deep-think", mode: "reason" });
  });

  it("passes through consolidation metadata", () => {
    const r = projectMetadata({
      kind: "consolidated-summary",
      consolidatedFrom: 8,
      oldestAt: "2026-01-01",
      newestAt: "2026-01-08",
    });
    expect(r?.consolidatedFrom).toBe(8);
    expect(r?.oldestAt).toBe("2026-01-01");
  });
});

describe("sortFragment", () => {
  it("returns the SQL fragment for each whitelisted sort", () => {
    expect(sortFragment("createdAt-desc")).toBe("created_at DESC");
    expect(sortFragment("createdAt-asc")).toBe("created_at ASC");
    expect(sortFragment("agent")).toBe("agent_name ASC, created_at DESC");
  });

  it("falls back to default for unknown sort (TS-narrowed, defensive)", () => {
    // @ts-expect-error — intentionally pass an invalid value to confirm runtime guard
    expect(sortFragment("evil-sql")).toBe("created_at DESC");
  });
});
