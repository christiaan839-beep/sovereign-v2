/**
 * Tests for log → ReceiptRecord projection.
 *
 * The behaviour that matters most here is the failure path: a
 * compliance pipeline that silently drops rows produces a document
 * that understates what happened. Every test that asserts on `skipped`
 * is pinning that contract.
 */

import { describe, it, expect } from "vitest";
import {
  projectRecords,
  normaliseVerdict,
  toIso,
  isAttested,
} from "../src/project.js";

describe("normaliseVerdict", () => {
  it("maps the vocabularies real logs actually use", () => {
    for (const v of ["pass", "OK", "success", "allowed", "clean", "200", true])
      expect(normaliseVerdict(v)).toBe("pass");
    for (const v of ["warn", "Warning", "flagged", "review", "degraded"])
      expect(normaliseVerdict(v)).toBe("warn");
    for (const v of ["block", "denied", "FAIL", "error", "rejected", false])
      expect(normaliseVerdict(v)).toBe("block");
  });

  it("treats an absent outcome as pass", () => {
    expect(normaliseVerdict(undefined)).toBe("pass");
    expect(normaliseVerdict(null)).toBe("pass");
    expect(normaliseVerdict("")).toBe("pass");
  });

  it("treats an unreadable outcome as warn, not pass", () => {
    // An outcome we could not parse is not evidence that nothing went
    // wrong. Defaulting to pass here would launder unknown states into
    // a clean compliance report.
    expect(normaliseVerdict("quux")).toBe("warn");
    expect(normaliseVerdict({ nested: true })).toBe("warn");
  });
});

describe("toIso", () => {
  it("accepts ISO strings and Dates", () => {
    expect(toIso("2026-03-01T12:00:00.000Z")).toBe("2026-03-01T12:00:00.000Z");
    expect(toIso(new Date(0))).toBe("1970-01-01T00:00:00.000Z");
  });

  it("infers epoch units from magnitude", () => {
    const expected = "2026-03-01T12:00:00.000Z";
    const ms = Date.parse(expected);
    expect(toIso(ms / 1000)).toBe(expected); // seconds
    expect(toIso(ms)).toBe(expected); // milliseconds
    expect(toIso(ms * 1000)).toBe(expected); // microseconds
  });

  it("rejects non-times rather than coercing them", () => {
    expect(toIso("not a date")).toBeNull();
    expect(toIso(undefined)).toBeNull();
    expect(toIso(NaN)).toBeNull();
    expect(toIso(new Date("nope"))).toBeNull();
    expect(toIso("")).toBeNull();
  });
});

describe("projectRecords", () => {
  it("auto-detects the common id / time / outcome field names", () => {
    const { records, skipped, scanned } = projectRecords([
      { request_id: "r1", created_at: "2026-03-01T00:00:00Z", status: "ok" },
      { id: "r2", timestamp: 1772323200, outcome: "denied", model: "claude" },
    ]);
    expect(skipped).toEqual([]);
    expect(scanned).toBe(2);
    expect(records[0]).toMatchObject({ verdictId: "r1", overall: "pass" });
    expect(records[1]).toMatchObject({
      verdictId: "r2",
      overall: "block",
      agentSlug: "claude",
    });
  });

  it("honours an explicit mapping over auto-detection", () => {
    const { records } = projectRecords(
      [{ id: "wrong", ticket: "right", when: "2026-01-01T00:00:00Z" }],
      { id: "ticket", issuedAt: "when" },
    );
    expect(records[0]?.verdictId).toBe("right");
  });

  it("accepts a function and a dotted path as field sources", () => {
    const { records } = projectRecords(
      [{ meta: { key: "k1" }, at: "2026-01-01T00:00:00Z", blocked: true }],
      {
        id: "meta.key",
        issuedAt: "at",
        verdict: (row) => ((row as { blocked: boolean }).blocked ? "block" : "pass"),
      },
    );
    expect(records[0]).toMatchObject({ verdictId: "k1", overall: "block" });
  });

  it("reports every unprojectable row with its index and reason", () => {
    const { records, skipped, scanned } = projectRecords([
      { id: "good", ts: "2026-01-01T00:00:00Z" },
      { ts: "2026-01-01T00:00:00Z" }, // no id
      { id: "no-time" }, // no timestamp
      { id: "bad-time", ts: "banana" }, // unparseable
      null,
      "a string",
      ["an array"],
    ]);
    expect(records).toHaveLength(1);
    expect(scanned).toBe(7);
    expect(skipped.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(skipped[0]?.reason).toMatch(/no id/);
    expect(skipped[1]?.reason).toMatch(/no timestamp/);
    expect(skipped[2]?.reason).toMatch(/not a date/);
    expect(skipped[3]?.reason).toBe("not an object");
    expect(skipped[5]?.reason).toBe("not an object");
  });

  it("can be told to abort instead of skipping", () => {
    expect(() =>
      projectRecords([{ nope: 1 }], { onInvalid: "throw" }),
    ).toThrow(/row 0/);
  });

  it("carries requested extra fields and marks provenance", () => {
    const { records } = projectRecords(
      [{ id: "r", ts: "2026-01-01T00:00:00Z", cost: 0.04, tenant: "acme" }],
      { carry: ["cost", "tenant", "absent"] },
    );
    expect(records[0]).toMatchObject({ cost: 0.04, tenant: "acme" });
    expect(records[0]).not.toHaveProperty("absent");
    // Provenance marker — a projected row is not an attested one.
    expect(records[0]?.source).toBe("projected");
  });

  it("never marks a projected record as attested", () => {
    const { records } = projectRecords([
      { id: "r", ts: "2026-01-01T00:00:00Z", signature: "v2=fake" },
    ]);
    // A `signature` field carried in from a log is not a contentHash
    // pair this package produced, so it must not read as attested.
    expect(isAttested(records[0]!)).toBe(false);
  });

  it("rejects a non-array input loudly", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => projectRecords({ not: "an array" })).toThrow(TypeError);
  });

  it("handles an empty input without inventing records", () => {
    expect(projectRecords([])).toEqual({
      records: [],
      skipped: [],
      scanned: 0,
    });
  });
});

describe("isAttested", () => {
  it("requires both a signature and a content hash", () => {
    const base = { verdictId: "v", overall: "pass" as const, issuedAt: "t" };
    expect(isAttested({ ...base, signature: "v2=x", contentHash: "abc" })).toBe(
      true,
    );
    expect(isAttested({ ...base, signature: "v2=x" })).toBe(false);
    expect(isAttested({ ...base, contentHash: "abc" })).toBe(false);
    expect(isAttested({ ...base, signature: "", contentHash: "abc" })).toBe(
      false,
    );
    expect(isAttested(base)).toBe(false);
  });
});
