/**
 * Tests for src/lib/budget-controls.ts — DB-backed plan budget enforcement.
 *
 * Critical invariant: the daily hard cap MUST fire even after a serverless
 * cold start. The previous in-memory implementation silently bypassed
 * enforcement on every Vercel restart. These tests pin the new behaviour:
 *
 *   - Daily spend is read from the usage table (Postgres, not memory)
 *   - When today's sum >= plan.dailyBudgetCents, allowed=false
 *   - Free models contribute 0 to the budget tally (verified at the
 *     model-prices boundary, not budget-controls itself)
 *   - DB read failure fails open (never lock everyone out on a transient blip)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Module-level DB mock ─────────────────────────────────────────────────

const usageTable = { __name: "usage" };

let usageDailyCents = 0;
let usageMonthlyCents = 0;
let dbThrows = false;
let dbThrowsCode: string | undefined;
const insertedRows: Array<Record<string, unknown>> = [];

function makeAggregateRow(value: number) {
  return [{ cents: value }];
}

const dbMock = {
  select: () => ({
    from: () => ({
      where: () => {
        // checkBudget makes two queries: dayStartUtc (daily) and monthStartUtc
        // (monthly). We can't tell them apart from this stub — but in tests
        // we always set them via beforeEach, and the order is daily first
        // due to Promise.all.
        const responses = [
          makeAggregateRow(usageDailyCents),
          makeAggregateRow(usageMonthlyCents),
        ];
        let i = 0;
        return {
          // For non-aggregate queries (getSpend, getTopSpenders) we don't
          // exercise them in the budget-cap tests below.
          groupBy: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
          limit: () => Promise.resolve([]),
          // The aggregate await chain: drizzle awaits the where() chain.
          then: (resolve: (rows: Array<{ cents: number }>) => void) => {
            if (dbThrows) {
              const err: Error & { code?: string } = new Error("db blip");
              if (dbThrowsCode) err.code = dbThrowsCode;
              throw err;
            }
            resolve(responses[i] ?? [{ cents: 0 }]);
            i++;
            return { catch: () => Promise.resolve() };
          },
        };
      },
    }),
  }),
  insert: (_table: unknown) => ({
    values: (row: Record<string, unknown>) => {
      insertedRows.push(row);
      return Promise.resolve();
    },
  }),
};

vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("@/db/schema", () => ({ usage: usageTable }));
vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  and: () => ({}),
  gte: () => ({}),
  sql: (strings: TemplateStringsArray) => ({ raw: strings.join("") }),
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
  return await import("@/lib/budget-controls");
}

beforeEach(() => {
  usageDailyCents = 0;
  usageMonthlyCents = 0;
  dbThrows = false;
  dbThrowsCode = undefined;
  insertedRows.length = 0;
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("budget-controls — DB-backed daily cap", () => {
  it("allows when no spend yet (free plan, day 1)", async () => {
    usageDailyCents = 0;
    const { checkBudget, _resetBudgetCacheForTests } = await load();
    _resetBudgetCacheForTests();
    const result = await checkBudget("user_a", "free");
    expect(result.allowed).toBe(true);
    expect(result.dailyCents).toBe(0);
    expect(result.dailyLimitCents).toBe(50); // free plan = $0.50/day
  });

  it("allows when under the daily cap", async () => {
    usageDailyCents = 30; // 60% of $0.50
    const { checkBudget, _resetBudgetCacheForTests } = await load();
    _resetBudgetCacheForTests();
    const result = await checkBudget("user_b", "free");
    expect(result.allowed).toBe(true);
    expect(result.dailyPercent).toBe(60);
  });

  it("BLOCKS when daily spend equals the cap", async () => {
    usageDailyCents = 50; // exactly at $0.50 free-plan cap
    const { checkBudget, _resetBudgetCacheForTests } = await load();
    _resetBudgetCacheForTests();
    const result = await checkBudget("user_c", "free");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Daily budget exceeded/);
    expect(result.reason).toMatch(/00:00 UTC/);
  });

  it("BLOCKS when daily spend exceeds the cap", async () => {
    usageDailyCents = 250;
    const { checkBudget, _resetBudgetCacheForTests } = await load();
    _resetBudgetCacheForTests();
    const result = await checkBudget("user_d", "starter");
    expect(result.allowed).toBe(false);
    expect(result.dailyLimitCents).toBe(200); // starter plan
    expect(result.dailyPercent).toBe(125);
  });

  it("higher tier plans honour their own (larger) caps", async () => {
    usageDailyCents = 1500; // $15 today
    const { checkBudget, _resetBudgetCacheForTests } = await load();
    _resetBudgetCacheForTests();

    // Starter cap is $2 — blocked
    const starter = await checkBudget("user_e", "starter");
    expect(starter.allowed).toBe(false);

    // Node cap is $50 — allowed
    _resetBudgetCacheForTests();
    const node = await checkBudget("user_e", "node");
    expect(node.allowed).toBe(true);
    expect(node.dailyLimitCents).toBe(5000); // $50/day
  });

  it("falls back to free plan when planId is null/undefined", async () => {
    usageDailyCents = 49;
    const { checkBudget, _resetBudgetCacheForTests } = await load();
    _resetBudgetCacheForTests();
    const result = await checkBudget("user_f", null);
    expect(result.plan).toBe("free");
    expect(result.dailyLimitCents).toBe(50);
    expect(result.allowed).toBe(true);
  });

  it("fails open when DB query fails (does not lock everyone out)", async () => {
    dbThrows = true;
    const { checkBudget, _resetBudgetCacheForTests } = await load();
    _resetBudgetCacheForTests();
    const result = await checkBudget("user_g", "free");
    expect(result.allowed).toBe(true);
    expect(result.dailyCents).toBe(0);
  });

  it("treats missing usage table (42P01) as zero spend (dev mode)", async () => {
    dbThrows = true;
    dbThrowsCode = "42P01";
    const { checkBudget, _resetBudgetCacheForTests } = await load();
    _resetBudgetCacheForTests();
    const result = await checkBudget("user_h", "starter");
    expect(result.allowed).toBe(true);
    expect(result.dailyCents).toBe(0);
  });
});

describe("budget-controls — recordSpend writes to usage", () => {
  it("inserts a row with computed costCents for paid models", async () => {
    const { recordSpend } = await load();
    await recordSpend("user_x", "claude-sonnet-4-6", 1000, 500, "code-agent");

    expect(insertedRows.length).toBe(1);
    const row = insertedRows[0];
    expect(row.userId).toBe("user_x");
    expect(row.model).toBe("claude-sonnet-4-6");
    expect(row.inputTokens).toBe(1000);
    expect(row.outputTokens).toBe(500);
    // 1000 in @ 300c/M + 500 out @ 1500c/M = 0.3 + 0.75 = 1.05 → ceil = 2 cents
    expect(Number(row.costCents)).toBeGreaterThan(0);
    expect(row.provider).toBe("anthropic");
  });

  it("free models record cost=0 (still inserts row for analytics)", async () => {
    const { recordSpend } = await load();
    await recordSpend(
      "user_y",
      "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      10000,
      5000,
      "agent",
    );
    expect(insertedRows.length).toBe(1);
    expect(insertedRows[0].costCents).toBe(0);
    expect(insertedRows[0].provider).toBe("nvidia-nim");
  });
});
