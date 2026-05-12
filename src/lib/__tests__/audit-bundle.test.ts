/**
 * Tests for src/lib/audit-bundle.ts — Cook 56 subscription deliveries.
 *
 *   - generateAuditBundle:
 *       - validates active subscription + period + deliverTo
 *       - bundleId is deterministic per (tenant, period)
 *       - filters receipts strictly to [periodStart, periodEnd)
 *       - embeds signed attestation + daily timeline
 *       - JSON-serializable
 *   - nextBundleAt:
 *       - monthly fires on the 1st 07:00 UTC
 *       - quarterly fires on Jan/Apr/Jul/Oct 1st 07:00 UTC
 */

import { describe, it, expect } from "vitest";
import {
  generateAuditBundle,
  nextBundleAt,
  type AuditSubscription,
} from "../audit-bundle";
import type { ReceiptSummary } from "../receipt-analytics";
import type { PeriodStats } from "../attestation-letter";

const SUB: AuditSubscription = {
  id: "sub-1",
  tenantId: "t-acme",
  tenantDisplayName: "Acme Corp",
  deliverTo: ["compliance@acme.example"],
  cadence: "monthly",
  frameworks: ["eu-ai-act-annex-iv"],
  active: true,
};

const STATS: PeriodStats = {
  totalRuns: 1000,
  passedRuns: 990,
  redTeamCampaigns: 1,
  redTeamFailuresByseverity: { critical: 0, high: 0, medium: 1, low: 2 },
  driftEvents: 1,
  replays: 4,
};

const P_START = Date.parse("2026-04-01T00:00:00Z");
const P_END = Date.parse("2026-05-01T00:00:00Z");
const SIGNING_KEY = "test-signing-key-not-secret-32ch";

function rcpt(
  id: string,
  ms: number,
  status: ReceiptSummary["status"] = "committed",
): ReceiptSummary {
  return { id, agentSlug: "x", committedAt: ms, status };
}

describe("generateAuditBundle — validation", () => {
  it("rejects paused subscriptions", () => {
    expect(() =>
      generateAuditBundle({
        subscription: { ...SUB, active: false },
        periodStart: P_START,
        periodEnd: P_END,
        receipts: [],
        stats: STATS,
        signingKey: SIGNING_KEY,
      }),
    ).toThrow(/paused/);
  });

  it("rejects empty deliverTo", () => {
    expect(() =>
      generateAuditBundle({
        subscription: { ...SUB, deliverTo: [] },
        periodStart: P_START,
        periodEnd: P_END,
        receipts: [],
        stats: STATS,
        signingKey: SIGNING_KEY,
      }),
    ).toThrow(/deliverTo/);
  });

  it("rejects period where end <= start", () => {
    expect(() =>
      generateAuditBundle({
        subscription: SUB,
        periodStart: P_END,
        periodEnd: P_START,
        receipts: [],
        stats: STATS,
        signingKey: SIGNING_KEY,
      }),
    ).toThrow(/periodEnd/);
  });
});

describe("generateAuditBundle — happy path", () => {
  it("emits a bundle with signed letter + timeline + summary", () => {
    const receipts = [
      rcpt("a", Date.parse("2026-04-05T10:00:00Z"), "committed"),
      rcpt("b", Date.parse("2026-04-15T10:00:00Z"), "drifted"),
      rcpt("c", Date.parse("2026-04-25T10:00:00Z"), "committed"),
    ];
    const bundle = generateAuditBundle({
      subscription: SUB,
      periodStart: P_START,
      periodEnd: P_END,
      receipts,
      stats: STATS,
      signingKey: SIGNING_KEY,
    });
    expect(bundle.bundleId).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.subscriptionId).toBe(SUB.id);
    expect(bundle.timeline.length).toBeGreaterThan(0);
    expect(bundle.summary.totalReceipts).toBe(3);
    expect(bundle.summary.driftedReceipts).toBe(1);
    expect(bundle.summary.passRate).toBeCloseTo(2 / 3, 4);
    expect(bundle.letter.body).toContain("Acme Corp");
    expect(bundle.letter.signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("filters receipts outside the period window", () => {
    const receipts = [
      rcpt("before", Date.parse("2026-03-30T10:00:00Z")),
      rcpt("in", Date.parse("2026-04-15T10:00:00Z")),
      rcpt("after", Date.parse("2026-05-05T10:00:00Z")),
    ];
    const bundle = generateAuditBundle({
      subscription: SUB,
      periodStart: P_START,
      periodEnd: P_END,
      receipts,
      stats: STATS,
      signingKey: SIGNING_KEY,
    });
    expect(bundle.summary.totalReceipts).toBe(1);
  });

  it("bundleId is deterministic for (tenant, period)", () => {
    const a = generateAuditBundle({
      subscription: SUB,
      periodStart: P_START,
      periodEnd: P_END,
      receipts: [],
      stats: STATS,
      signingKey: SIGNING_KEY,
    });
    const b = generateAuditBundle({
      subscription: SUB,
      periodStart: P_START,
      periodEnd: P_END,
      receipts: [],
      stats: STATS,
      signingKey: SIGNING_KEY,
    });
    expect(a.bundleId).toBe(b.bundleId);
  });

  it("emits a JSON-serializable bundle", () => {
    const bundle = generateAuditBundle({
      subscription: SUB,
      periodStart: P_START,
      periodEnd: P_END,
      receipts: [],
      stats: STATS,
      signingKey: SIGNING_KEY,
    });
    expect(() => JSON.parse(JSON.stringify(bundle))).not.toThrow();
  });
});

describe("nextBundleAt", () => {
  it("monthly cadence fires on the 1st at 07:00 UTC", () => {
    const next = nextBundleAt("monthly", new Date("2026-04-15T00:00:00Z"))!;
    expect(next.toISOString()).toBe("2026-05-01T07:00:00.000Z");
  });

  it("quarterly cadence fires on Jan/Apr/Jul/Oct 1st 07:00 UTC", () => {
    const next = nextBundleAt("quarterly", new Date("2026-02-15T00:00:00Z"))!;
    expect(next.toISOString()).toBe("2026-04-01T07:00:00.000Z");
  });

  it("quarterly skips over off-quarter months", () => {
    const next = nextBundleAt("quarterly", new Date("2026-08-15T00:00:00Z"))!;
    expect(next.toISOString()).toBe("2026-10-01T07:00:00.000Z");
  });
});
