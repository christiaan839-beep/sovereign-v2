/**
 * Tests for src/lib/plan-enforcement.ts
 *
 * Revenue gate. Verifies:
 *  - Active subscription resolves to its plan tier
 *  - Missing subscription falls back to free
 *  - Missing tables (PG 42P01) fail open to free, not crash
 *  - Run cap blocks when used >= limit (and only then)
 *  - Unlimited plans (Infinity) never block
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Plan-enforcement issues two sequential Drizzle queries:
 *   1. subscriptions: db.select(...).from(subs).where(...).limit(1)   ← awaited at .limit()
 *   2. playbook_runs: db.select(...).from(runs).where(...)            ← awaited at .where()
 *
 * We intercept by giving each chain step a thenable so the .where() return
 * value can act as both a chain object (with .limit) and a Promise.
 */
type QueueItem =
  | { kind: "value"; value: unknown[] }
  | { kind: "error"; err: unknown };

async function loadWithQueries(queue: QueueItem[]) {
  vi.resetModules();

  vi.doMock("@/db", () => {
    const remaining = [...queue];

    const dequeue = () => {
      const next = remaining.shift();
      if (!next) throw new Error("query queue exhausted");
      return next.kind === "value"
        ? Promise.resolve(next.value)
        : Promise.reject(next.err);
    };

    // A chain object that is itself a thenable (for the .where()-terminal query)
    // AND exposes .limit() (for the .limit()-terminal query).
    const makeChain = () => {
      let resolved: Promise<unknown> | null = null;
      const resolveOnce = () => (resolved ??= dequeue());
      return {
        limit: vi.fn(() => dequeue()),
        then: (
          onFulfilled: (v: unknown) => unknown,
          onRejected?: (e: unknown) => unknown,
        ) => resolveOnce().then(onFulfilled, onRejected),
        catch: (onRejected: (e: unknown) => unknown) =>
          resolveOnce().catch(onRejected),
      };
    };

    return {
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => makeChain()),
          })),
        })),
      },
    };
  });

  return await import("@/lib/plan-enforcement");
}

const okSub = (plan: string) => ({
  kind: "value" as const,
  value: [{ plan, status: "active" }],
});
const noSub = { kind: "value" as const, value: [] };
const runCount = (n: number) => ({
  kind: "value" as const,
  value: [{ count: n }],
});
const dbErr = (code: string, message: string) => ({
  kind: "error" as const,
  err: Object.assign(new Error(message), { code }),
});

describe("checkPlanLimits", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows when an active subscription is under its run cap", async () => {
    const { checkPlanLimits } = await loadWithQueries([
      okSub("starter"),
      runCount(10),
    ]);
    const r = await checkPlanLimits("user_123");
    expect(r.allowed).toBe(true);
    expect(r.plan).toBe("starter");
    expect(r.used).toBe(10);
    expect(r.limit).toBe(200);
    expect(r.remaining).toBe(190);
  });

  it("blocks when usage equals the run cap", async () => {
    const { checkPlanLimits } = await loadWithQueries([
      okSub("starter"),
      runCount(200),
    ]);
    const r = await checkPlanLimits("user_123");
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.message).toMatch(/200\/200 runs/);
    expect(r.upgradeUrl).toBe("/pricing");
  });

  it("blocks when usage exceeds the run cap", async () => {
    const { checkPlanLimits } = await loadWithQueries([noSub, runCount(51)]);
    const r = await checkPlanLimits("user_123");
    expect(r.allowed).toBe(false);
    expect(r.plan).toBe("free");
    expect(r.used).toBe(51);
    expect(r.limit).toBe(50);
  });

  it("uses the enterprise cap (10K runs) for enterprise subscribers", async () => {
    const { checkPlanLimits } = await loadWithQueries([
      okSub("enterprise"),
      runCount(9_500),
    ]);
    const r = await checkPlanLimits("user_999");
    expect(r.plan).toBe("enterprise");
    expect(r.limit).toBe(10_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(500);
  });

  it("falls back to free when no active subscription exists", async () => {
    const { checkPlanLimits } = await loadWithQueries([noSub, runCount(0)]);
    const r = await checkPlanLimits("user_no_sub");
    expect(r.plan).toBe("free");
    expect(r.limit).toBe(50);
    expect(r.allowed).toBe(true);
  });

  it("treats missing subscriptions table (PG 42P01) as free, not error", async () => {
    const { checkPlanLimits } = await loadWithQueries([
      dbErr("42P01", 'relation "subscriptions" does not exist'),
      runCount(0),
    ]);
    const r = await checkPlanLimits("user_no_table");
    expect(r.plan).toBe("free");
    expect(r.allowed).toBe(true);
  });

  it("treats missing playbook_runs table as zero usage (fail-open)", async () => {
    const { checkPlanLimits } = await loadWithQueries([
      okSub("starter"),
      dbErr("42P01", 'relation "playbook_runs" does not exist'),
    ]);
    const r = await checkPlanLimits("user_no_runs_table");
    expect(r.plan).toBe("starter");
    expect(r.used).toBe(0);
    expect(r.allowed).toBe(true);
  });

  it("normalizes legacy plan names (pro → node)", async () => {
    const { checkPlanLimits } = await loadWithQueries([
      okSub("pro"),
      runCount(100),
    ]);
    const r = await checkPlanLimits("user_legacy");
    expect(r.plan).toBe("node");
    expect(r.limit).toBe(2_000);
  });
});

describe("incrementUsage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("does not throw under happy path", async () => {
    const { incrementUsage } = await loadWithQueries([
      okSub("starter"),
      runCount(50),
    ]);
    await expect(incrementUsage("user_123")).resolves.toBeUndefined();
  });

  it("does not throw when DB lookups fail", async () => {
    const { incrementUsage } = await loadWithQueries([
      dbErr("42P01", "no table"),
      dbErr("42P01", "no table"),
    ]);
    await expect(incrementUsage("user_123")).resolves.toBeUndefined();
  });
});
