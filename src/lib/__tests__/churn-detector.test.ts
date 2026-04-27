/**
 * Tests for src/lib/churn-detector.ts — Usage-decline detection.
 *
 * The detector compares the current 30-day window vs the prior 30-day window
 * for each paid subscriber and flags accounts whose run volume dropped by
 * the threshold percentage. Wrong math here = silent revenue loss.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// db.select(...).from(...).where(...) — chains end at .where for the count
// queries, but the subscription query is just .select().from().where().

// Track calls so we can return the right mocked result based on call order.
let callIndex = 0;
const callPlan: Array<unknown> = [];

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => {
          const result = callPlan[callIndex];
          callIndex++;
          return result;
        },
      }),
    })),
  },
}));

beforeEach(() => {
  callIndex = 0;
  callPlan.length = 0;
});

describe("detectUsageDecline", () => {
  it("returns empty when there are no paid subscribers", async () => {
    callPlan.push([]); // subscriptions query → no results
    const { detectUsageDecline } = await import("@/lib/churn-detector");
    const out = await detectUsageDecline();
    expect(out).toEqual([]);
  });

  it("flags a paid user whose runs dropped 50% (above the 30% threshold)", async () => {
    // 1. paid-subs query
    callPlan.push([{ userId: "user_decay", plan: "node" }]);
    // 2. current-window count for user_decay
    callPlan.push([{ count: 10 }]);
    // 3. prior-window count for user_decay
    callPlan.push([{ count: 20 }]);

    const { detectUsageDecline } = await import("@/lib/churn-detector");
    const out = await detectUsageDecline({ thresholdPct: 30 });

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      userId: "user_decay",
      plan: "node",
      currentRuns: 10,
      priorRuns: 20,
      dropPct: 50,
    });
  });

  it("does NOT flag users whose drop is under the threshold", async () => {
    callPlan.push([{ userId: "user_steady", plan: "node" }]);
    callPlan.push([{ count: 17 }]); // 15% drop
    callPlan.push([{ count: 20 }]);

    const { detectUsageDecline } = await import("@/lib/churn-detector");
    const out = await detectUsageDecline({ thresholdPct: 30 });
    expect(out).toEqual([]);
  });

  it("filters out brand-new accounts (priorRuns < minPriorRuns)", async () => {
    callPlan.push([{ userId: "user_new", plan: "starter" }]);
    callPlan.push([{ count: 0 }]); // current
    callPlan.push([{ count: 2 }]); // prior — below default minPriorRuns=5

    const { detectUsageDecline } = await import("@/lib/churn-detector");
    const out = await detectUsageDecline();
    expect(out).toEqual([]);
  });

  it("sorts highest-risk first so callers can rate-limit outreach", async () => {
    // Promise.all inside the detector interleaves the count queries:
    // user_a-current, user_b-current, user_a-prior, user_b-prior.
    callPlan.push([
      { userId: "user_a", plan: "node" }, // 50% drop
      { userId: "user_b", plan: "node" }, // 80% drop (higher risk)
    ]);
    callPlan.push([{ count: 10 }]); // user_a current
    callPlan.push([{ count: 4 }]); // user_b current
    callPlan.push([{ count: 20 }]); // user_a prior
    callPlan.push([{ count: 20 }]); // user_b prior

    const { detectUsageDecline } = await import("@/lib/churn-detector");
    const out = await detectUsageDecline({ thresholdPct: 30 });
    expect(out.map((r) => r.userId)).toEqual(["user_b", "user_a"]);
  });

  it("only includes paid subscribers (free is filtered server-side)", async () => {
    // The mock subs query already returns only the paid ones — but assert
    // that whatever comes back is what we process.
    callPlan.push([{ userId: "user_paid", plan: "founder" }]);
    callPlan.push([{ count: 0 }]);
    callPlan.push([{ count: 50 }]);

    const { detectUsageDecline } = await import("@/lib/churn-detector");
    const out = await detectUsageDecline();
    expect(out[0]?.plan).toBe("founder");
  });
});
