/**
 * Tests for src/lib/plan-enforcement.ts — Plan limit gating.
 *
 * checkPlanLimits() decides whether a user can run another agent.
 * If this lies, free users either get blocked unfairly or run unlimited
 * for free. Both are revenue bugs.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// db.select({plan, status}).from(subscriptions).where().limit() → mockSubSelect
// db.select({count}).from(playbookRuns).where()              → mockUsageSelect
// We branch on the shape of the projection passed to select() so the two
// queries don't collide.
const mockSubSelect = vi.fn();
const mockUsageSelect = vi.fn();

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn((projection?: Record<string, unknown>) => {
        const isUsageQuery = !!projection && "count" in projection;
        // Build a chain whose terminal is awaitable AND can chain `.limit()`.
        const terminal: any = {
          then: (
            resolve: (v: unknown) => void,
            reject?: (e: unknown) => void,
          ) => {
            const fn = isUsageQuery ? mockUsageSelect : mockSubSelect;
            return Promise.resolve().then(fn).then(resolve, reject);
          },
          limit: async () =>
            isUsageQuery ? mockUsageSelect() : mockSubSelect(),
        };
        return {
          from: () => ({
            where: () => terminal,
          }),
        };
      }),
    },
  };
});

// Don't try to import the founders set — keep it deterministic.
vi.mock("@/app/api/_misc/founders/route", () => ({
  founders: { has: () => false },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

async function loadModule() {
  vi.resetModules();
  return await import("@/lib/plan-enforcement");
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("checkPlanLimits — under quota", () => {
  it("allows when free user is under 50/month", async () => {
    mockSubSelect.mockResolvedValue([]); // no active subscription → free tier
    mockUsageSelect.mockResolvedValue([{ count: 10 }]);

    const { checkPlanLimits } = await loadModule();
    const check = await checkPlanLimits("user_free");

    expect(check.allowed).toBe(true);
    expect(check.plan).toBe("free");
    expect(check.used).toBe(10);
    expect(check.limit).toBe(50);
    expect(check.remaining).toBe(40);
  });

  it("uses paid plan when subscriptions row exists and is active", async () => {
    mockSubSelect.mockResolvedValue([{ plan: "node", status: "active" }]);
    mockUsageSelect.mockResolvedValue([{ count: 100 }]);

    const { checkPlanLimits } = await loadModule();
    const check = await checkPlanLimits("user_paid");

    expect(check.plan).toBe("node");
    expect(check.allowed).toBe(true);
    expect(check.limit).toBeGreaterThan(50); // node tier limit
  });
});

describe("checkPlanLimits — at/over quota (revenue gate)", () => {
  it("blocks when free user hits exactly the 50/month cap", async () => {
    mockSubSelect.mockResolvedValue([]);
    mockUsageSelect.mockResolvedValue([{ count: 50 }]);

    const { checkPlanLimits } = await loadModule();
    const check = await checkPlanLimits("user_capped");

    expect(check.allowed).toBe(false);
    expect(check.remaining).toBe(0);
    expect(check.upgradeUrl).toBe("/pricing");
    expect(check.message).toContain("/50");
  });

  it("blocks when free user exceeds the cap", async () => {
    mockSubSelect.mockResolvedValue([]);
    mockUsageSelect.mockResolvedValue([{ count: 73 }]);

    const { checkPlanLimits } = await loadModule();
    const check = await checkPlanLimits("user_over");

    expect(check.allowed).toBe(false);
    expect(check.used).toBe(73);
  });
});

describe("checkPlanLimits — graceful degradation", () => {
  it("falls through to free tier when subscriptions table is missing (PG 42P01)", async () => {
    mockSubSelect.mockRejectedValue(
      Object.assign(new Error("relation does not exist"), { code: "42P01" }),
    );
    mockUsageSelect.mockResolvedValue([{ count: 5 }]);

    const { checkPlanLimits } = await loadModule();
    const check = await checkPlanLimits("user_no_sub_table");

    // Should not crash, should default to free
    expect(check.plan).toBe("free");
    expect(check.allowed).toBe(true);
  });

  it("returns 0 usage when playbook_runs table is missing", async () => {
    mockSubSelect.mockResolvedValue([]);
    mockUsageSelect.mockRejectedValue(
      Object.assign(new Error("relation does not exist"), { code: "42P01" }),
    );

    const { checkPlanLimits } = await loadModule();
    const check = await checkPlanLimits("user_no_runs_table");

    // Free user with 0 usage → still allowed
    expect(check.allowed).toBe(true);
    expect(check.used).toBe(0);
  });

  it("fails open (returns 0 usage) on generic DB error — never lock everyone out", async () => {
    mockSubSelect.mockResolvedValue([]);
    mockUsageSelect.mockRejectedValue(new Error("connection refused"));

    const { checkPlanLimits } = await loadModule();
    const check = await checkPlanLimits("user_db_down");

    expect(check.allowed).toBe(true);
    expect(check.used).toBe(0);
  });
});

describe("incrementUsage — log + non-fatal", () => {
  it("never throws even when DB queries fail", async () => {
    mockSubSelect.mockRejectedValue(new Error("pool exhausted"));
    mockUsageSelect.mockRejectedValue(new Error("pool exhausted"));

    const { incrementUsage } = await loadModule();
    await expect(incrementUsage("user_anything")).resolves.toBeUndefined();
  });
});
