/**
 * Tests for src/lib/receipt-analytics.ts — Cook 55.
 *
 *   - buildTimeline: bucket by day + week, status counts, top agents,
 *     window filtering.
 *   - diffReceipts: added / removed / changed / same; identical flag;
 *     stable alphabetical ordering; fallback when fields absent.
 */

import { describe, it, expect } from "vitest";
import {
  buildTimeline,
  diffReceipts,
  type ReceiptSummary,
} from "../receipt-analytics";

const DAY = 24 * 60 * 60 * 1000;

function rcpt(
  id: string,
  agent: string,
  ms: number,
  status: ReceiptSummary["status"] = "committed",
  fields?: Record<string, unknown>,
): ReceiptSummary {
  return {
    id,
    agentSlug: agent,
    committedAt: ms,
    status,
    ...(fields ? { fields } : {}),
  };
}

const D = Date.parse;

describe("buildTimeline — empty", () => {
  it("returns [] for empty receipts", () => {
    expect(buildTimeline({ receipts: [] })).toEqual([]);
  });
});

describe("buildTimeline — daily bucketing", () => {
  it("groups receipts into UTC days, descending status counts", () => {
    const receipts = [
      rcpt("a", "lead-blitz", D("2026-05-12T05:00:00Z"), "committed"),
      rcpt("b", "lead-blitz", D("2026-05-12T22:00:00Z"), "drifted"),
      rcpt("c", "content", D("2026-05-13T05:00:00Z"), "committed"),
    ];
    const buckets = buildTimeline({ receipts });
    expect(buckets).toHaveLength(2);
    expect(buckets[0].label).toBe("2026-05-12");
    expect(buckets[0].total).toBe(2);
    expect(buckets[0].byStatus.committed).toBe(1);
    expect(buckets[0].byStatus.drifted).toBe(1);
    expect(buckets[1].label).toBe("2026-05-13");
    expect(buckets[1].total).toBe(1);
  });

  it("returns top agents by count per bucket", () => {
    const day = D("2026-05-12T00:00:00Z");
    const receipts = [
      rcpt("a", "lead-blitz", day + 1),
      rcpt("b", "lead-blitz", day + 2),
      rcpt("c", "content", day + 3),
    ];
    const buckets = buildTimeline({ receipts });
    expect(buckets[0].topAgents[0]).toEqual({
      agentSlug: "lead-blitz",
      count: 2,
    });
    expect(buckets[0].topAgents[1]).toEqual({
      agentSlug: "content",
      count: 1,
    });
  });

  it("respects windowStart / windowEnd", () => {
    const receipts = [
      rcpt("a", "x", D("2026-05-10T00:00:00Z")),
      rcpt("b", "x", D("2026-05-12T00:00:00Z")),
      rcpt("c", "x", D("2026-05-14T00:00:00Z")),
    ];
    const buckets = buildTimeline({
      receipts,
      windowStart: D("2026-05-12T00:00:00Z"),
      windowEnd: D("2026-05-14T00:00:00Z"),
    });
    expect(buckets).toHaveLength(1);
    expect(buckets[0].label).toBe("2026-05-12");
  });
});

describe("buildTimeline — weekly bucketing", () => {
  it("groups by UTC weeks (Sun-start)", () => {
    const receipts = [
      rcpt("a", "x", D("2026-05-11T00:00:00Z")), // Mon
      rcpt("b", "x", D("2026-05-13T00:00:00Z")), // Wed
      rcpt("c", "x", D("2026-05-18T00:00:00Z")), // next Mon
    ];
    const buckets = buildTimeline({ receipts, granularity: "week" });
    expect(buckets).toHaveLength(2);
    expect(buckets[0].total).toBe(2);
    expect(buckets[0].end - buckets[0].start).toBe(7 * DAY);
  });
});

describe("diffReceipts", () => {
  const A = rcpt("a", "x", 0, "committed", {
    safetyVerdict: "pass",
    qualityScore: 0.9,
    model: "nim",
  });

  it("identical receipts → all fields op=same + identical=true", () => {
    const B = rcpt("b", "x", 0, "committed", { ...A.fields! });
    const d = diffReceipts(A, B);
    expect(d.identical).toBe(true);
    expect(d.changedFieldCount).toBe(0);
    expect(d.diffs.every((x) => x.op === "same")).toBe(true);
  });

  it("flags changed fields with before/after", () => {
    const B = rcpt("b", "x", 0, "committed", {
      ...A.fields!,
      qualityScore: 0.8,
    });
    const d = diffReceipts(A, B);
    expect(d.identical).toBe(false);
    const changed = d.diffs.find((x) => x.field === "qualityScore")!;
    expect(changed.op).toBe("changed");
    expect(changed.before).toBe(0.9);
    expect(changed.after).toBe(0.8);
  });

  it("flags added + removed fields", () => {
    const B = rcpt("b", "x", 0, "committed", {
      safetyVerdict: "pass",
      newField: "yes",
    });
    const d = diffReceipts(A, B);
    expect(d.diffs.find((x) => x.field === "model")!.op).toBe("removed");
    expect(d.diffs.find((x) => x.field === "newField")!.op).toBe("added");
    expect(d.diffs.find((x) => x.field === "qualityScore")!.op).toBe("removed");
  });

  it("returns diffs in stable alphabetical order", () => {
    const B = rcpt("b", "x", 0, "committed", { ...A.fields! });
    const d = diffReceipts(A, B);
    const fields = d.diffs.map((x) => x.field);
    expect(fields).toEqual([...fields].sort());
  });

  it("falls back to comparing answer when fields are absent", () => {
    const a: ReceiptSummary = {
      id: "a",
      agentSlug: "x",
      committedAt: 0,
      status: "committed",
      answer: "hello",
    };
    const b: ReceiptSummary = {
      id: "b",
      agentSlug: "x",
      committedAt: 0,
      status: "committed",
      answer: "world",
    };
    const d = diffReceipts(a, b);
    expect(d.identical).toBe(false);
    expect(d.diffs[0].field).toBe("answer");
    expect(d.diffs[0].op).toBe("changed");
  });

  it("compares nested objects by structural equality", () => {
    const a = rcpt("a", "x", 0, "committed", {
      meta: { tone: "calm", lang: "en" },
    });
    const b = rcpt("b", "x", 0, "committed", {
      meta: { tone: "calm", lang: "en" },
    });
    expect(diffReceipts(a, b).identical).toBe(true);
  });
});
