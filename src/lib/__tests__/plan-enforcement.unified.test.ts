/**
 * Tests for src/lib/plan-enforcement.ts — unified plan quota.
 *
 * Critical invariant: getMonthlyUsage rolls up BOTH `usage` (agent runs) and
 * `playbook_runs` (playbook executions) so a single plan quota covers both
 * entry points. Without this, a Free user (50/mo) could fire 50 agents AND
 * 50 playbooks for an effective 100/mo cap.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Module-level mocks of drizzle pieces ─────────────────────────────────

let usageCount = 0;
let playbookCount = 0;
let subscriptionRow: { plan: string; status: string } | null = null;
let usageThrows = false;
let playbookThrows = false;

const usageTable = { __name: "usage" };
const playbookRunsTable = { __name: "playbook_runs" };
const subscriptionsTable = { __name: "subscriptions" };

function makeSelectChain(table: unknown) {
  return {
    from: (_t: unknown) => ({
      where: (_w: unknown) => ({
        limit: () => {
          if (table === subscriptionsTable) {
            return Promise.resolve(subscriptionRow ? [subscriptionRow] : []);
          }
          return Promise.resolve([]);
        },
        // For aggregation queries — count(*) — drizzle awaits the where chain
        // directly. Both forms resolve to the same shape.
        then: (resolve: (rows: Array<{ count: number }>) => void) => {
          if (table === usageTable) {
            if (usageThrows) throw new Error("usage table missing");
            resolve([{ count: usageCount }]);
          } else if (table === playbookRunsTable) {
            if (playbookThrows) throw new Error("playbookRuns table missing");
            resolve([{ count: playbookCount }]);
          } else {
            resolve([]);
          }
          return { catch: () => Promise.resolve() };
        },
      }),
    }),
  };
}

const dbMock = {
  select: (_cols: unknown) => {
    let pinned: unknown = null;
    return {
      from: (table: unknown) => {
        pinned = table;
        return makeSelectChain(pinned).from(table);
      },
    };
  },
};

vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("@/db/schema", () => ({
  usage: usageTable,
  playbookRuns: playbookRunsTable,
  subscriptions: subscriptionsTable,
}));
vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  and: (..._args: unknown[]) => ({}),
  gte: () => ({}),
  sql: (strings: TemplateStringsArray, ..._values: unknown[]) =>
    strings.join(""),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

async function load() {
  vi.resetModules();
  return await import("@/lib/plan-enforcement");
}

beforeEach(() => {
  usageCount = 0;
  playbookCount = 0;
  subscriptionRow = null;
  usageThrows = false;
  playbookThrows = false;
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("plan-enforcement — unified counter", () => {
  it("free user under combined limit is allowed", async () => {
    usageCount = 20;
    playbookCount = 20;
    const { checkPlanLimits } = await load();
    const result = await checkPlanLimits("user_free");
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe("free");
    expect(result.used).toBe(40);
  });

  it("free user blocked once agent + playbook combined hit the cap", async () => {
    // Free plan = 50 runs/mo. 30 agents + 25 playbooks = 55 — over.
    // Without the rollup this would have been 30 vs 50 (allowed) and
    // the user would have effectively gotten ~75 runs.
    usageCount = 30;
    playbookCount = 25;
    const { checkPlanLimits } = await load();
    const result = await checkPlanLimits("user_free");
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(55);
    expect(result.message).toMatch(/Upgrade/);
    expect(result.upgradeUrl).toBe("/pricing");
  });

  it("starter plan honours its 200 quota across both counters", async () => {
    subscriptionRow = { plan: "starter", status: "active" };
    usageCount = 150;
    playbookCount = 49;
    const { checkPlanLimits } = await load();
    const ok = await checkPlanLimits("user_starter");
    expect(ok.allowed).toBe(true);
    expect(ok.plan).toBe("starter");

    playbookCount = 51; // 150 + 51 = 201 > 200
    const blocked = await checkPlanLimits("user_starter");
    expect(blocked.allowed).toBe(false);
  });

  it("missing usage table degrades to playbook count alone (no crash)", async () => {
    usageThrows = true;
    playbookCount = 5;
    const { checkPlanLimits } = await load();
    const result = await checkPlanLimits("user_dev");
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(5);
  });

  it("missing playbook_runs table degrades to usage count alone", async () => {
    playbookThrows = true;
    usageCount = 7;
    const { checkPlanLimits } = await load();
    const result = await checkPlanLimits("user_dev");
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(7);
  });

  it("returns remaining = limit - used for active subscriptions", async () => {
    subscriptionRow = { plan: "starter", status: "active" };
    usageCount = 80;
    playbookCount = 20;
    const { checkPlanLimits } = await load();
    const result = await checkPlanLimits("user_starter");
    expect(result.remaining).toBe(100); // 200 - 100
  });
});
