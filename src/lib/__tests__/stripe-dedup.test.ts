/**
 * Stripe webhook deduplication — integration-shaped unit tests.
 *
 * Verifies the two-state idempotency invariants of the Stripe webhook
 * dedup pattern implemented in /api/_payments/stripe/webhook/route.ts.
 *
 * We test the INVARIANTS (what must be true about the dedup table state
 * transitions), not the route itself — routes bring in Clerk/DB mocks that
 * make the tests brittle.
 */

import { describe, it, expect } from "vitest";

/**
 * State machine for stripe_events:
 *
 *                 insert
 *   null ──────────────────► received ──────process ok────► completed
 *     ▲                        │
 *     │                        ├──process error──► failed ─┐
 *     │                        │                            │
 *     └───stale-window (5 min) or failed-status retry──────┘
 *
 * Rules:
 *   - null → received (INSERT on first delivery)
 *   - received → completed (UPDATE on success)
 *   - received → failed (UPDATE on handler error)
 *   - failed → reprocessed → completed (allowed)
 *   - stale received → reprocessed (allowed, original attempt crashed)
 *   - completed → no action (duplicate, short-circuit 200)
 */

type EventStatus = "received" | "completed" | "failed";
interface EventRow {
  status: EventStatus;
  receivedAt: Date;
}

function decideDedupAction(
  existing: EventRow | null,
  now: Date,
  staleWindowMs: number = 5 * 60 * 1000,
): "process" | "duplicate-short-circuit" | "defer-inflight" | "reprocess-stale" | "reprocess-failed" {
  if (!existing) return "process";
  if (existing.status === "completed") return "duplicate-short-circuit";
  if (existing.status === "failed") return "reprocess-failed";
  // status === "received"
  const elapsed = now.getTime() - existing.receivedAt.getTime();
  if (elapsed < staleWindowMs) return "defer-inflight";
  return "reprocess-stale";
}

describe("Stripe webhook dedup state machine", () => {
  const now = new Date("2026-04-21T12:00:00Z");

  it("processes a new event on first arrival", () => {
    expect(decideDedupAction(null, now)).toBe("process");
  });

  it("short-circuits on a completed duplicate", () => {
    const existing: EventRow = {
      status: "completed",
      receivedAt: new Date(now.getTime() - 10_000),
    };
    expect(decideDedupAction(existing, now)).toBe("duplicate-short-circuit");
  });

  it("re-processes a failed event immediately (no wait)", () => {
    const existing: EventRow = {
      status: "failed",
      receivedAt: new Date(now.getTime() - 10_000),
    };
    expect(decideDedupAction(existing, now)).toBe("reprocess-failed");
  });

  it("defers when a fresh 'received' row exists (concurrent processing)", () => {
    const existing: EventRow = {
      status: "received",
      receivedAt: new Date(now.getTime() - 30_000), // 30s old — fresh
    };
    expect(decideDedupAction(existing, now)).toBe("defer-inflight");
  });

  it("re-processes a stale 'received' row (crashed before catch-to-failed)", () => {
    const existing: EventRow = {
      status: "received",
      receivedAt: new Date(now.getTime() - 6 * 60_000), // 6min old — stale
    };
    expect(decideDedupAction(existing, now)).toBe("reprocess-stale");
  });

  it("treats exactly-at-threshold as stale (>= stale window)", () => {
    // Default window is 5 minutes; exactly 5 min ago should be stale
    const existing: EventRow = {
      status: "received",
      receivedAt: new Date(now.getTime() - 5 * 60_000),
    };
    // Current impl uses `<` so 5-min exactly is "stale" (not in-flight)
    expect(decideDedupAction(existing, now)).toBe("reprocess-stale");
  });

  it("treats just-under-threshold as in-flight", () => {
    const existing: EventRow = {
      status: "received",
      receivedAt: new Date(now.getTime() - 4 * 60_000 - 59_000), // 4:59
    };
    expect(decideDedupAction(existing, now)).toBe("defer-inflight");
  });
});

describe("No-duplicate-charge invariant", () => {
  it("once completed, the same event never triggers processing again", () => {
    const events: EventRow[] = [
      { status: "completed", receivedAt: new Date("2026-04-21T12:00:00Z") },
    ];
    // Stripe retries 10 times — every retry should short-circuit
    for (let i = 0; i < 10; i++) {
      const retryAt = new Date(`2026-04-21T12:${String(i + 1).padStart(2, "0")}:00Z`);
      expect(decideDedupAction(events[0], retryAt)).toBe("duplicate-short-circuit");
    }
  });
});
