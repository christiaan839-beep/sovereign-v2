/**
 * cost-runaway — tests.
 *
 * Verifies:
 *   - Plan-aware cap defaults: free / starter / array / node / enterprise.
 *   - Unknown plan IDs fall back to the conservative default.
 *   - Pure-function evaluator (`getDailyCapCents`) has no side effects.
 *   - No-DB fallbacks: every async function is fail-OPEN when
 *     DATABASE_URL is unset (Constitution Principle 4 — fail-open
 *     for hot-path code).
 *   - Cost-cap-alert helpers: nextUtcMidnight() is timezone-stable.
 *
 * The full DB-roundtrip path (atomic upsert with ON CONFLICT) is
 * NOT unit-tested here — it requires a live Postgres. The
 * integration test suite covers that path.
 *
 * The fail-OPEN posture is the most critical invariant: a Postgres
 * blip must NEVER block a user request. The platform's circuit
 * breaker is the per-provider fail-closed gate; this module is
 * defense-in-depth.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (ORIGINAL_DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  }
  vi.resetModules();
});

async function importCostRunaway() {
  return await import("../cost-runaway");
}

async function importCostCapAlert() {
  return await import("../cost-cap-alert");
}

describe("cost-runaway — getDailyCapCents (pure)", () => {
  it("returns plan-specific caps for known plans", async () => {
    const { getDailyCapCents } = await importCostRunaway();
    expect(getDailyCapCents("free")).toBe(5_000);
    expect(getDailyCapCents("starter")).toBe(10_000);
    expect(getDailyCapCents("array")).toBe(25_000);
    expect(getDailyCapCents("node")).toBe(50_000);
    expect(getDailyCapCents("enterprise")).toBe(200_000);
    expect(getDailyCapCents("founder")).toBe(50_000);
    expect(getDailyCapCents("pay_per_run")).toBe(50_000);
  });

  it("falls back to the conservative default for unknown plans", async () => {
    const { getDailyCapCents } = await importCostRunaway();
    expect(getDailyCapCents("not-a-plan")).toBe(5_000);
    expect(getDailyCapCents(null)).toBe(5_000);
    expect(getDailyCapCents(undefined)).toBe(5_000);
    expect(getDailyCapCents("")).toBe(5_000);
  });

  it("free-tier cap is the lowest (defense against abuse)", async () => {
    const { getDailyCapCents } = await importCostRunaway();
    const free = getDailyCapCents("free");
    const starter = getDailyCapCents("starter");
    const enterprise = getDailyCapCents("enterprise");
    expect(free).toBeLessThan(starter);
    expect(starter).toBeLessThan(enterprise);
  });
});

describe("cost-runaway — checkTenantCostCap fail-open", () => {
  it("allows the run when DATABASE_URL is unset", async () => {
    const { checkTenantCostCap } = await importCostRunaway();
    const r = await checkTenantCostCap({ userId: "user_x", planId: "free" });
    expect(r.allowed).toBe(true);
    expect(r.spentCents).toBe(0);
    expect(r.capCents).toBe(5_000);
  });

  it("returns the plan-correct cap even when DB is unavailable", async () => {
    const { checkTenantCostCap } = await importCostRunaway();
    const r = await checkTenantCostCap({
      userId: "user_x",
      planId: "enterprise",
    });
    expect(r.capCents).toBe(200_000);
    expect(r.allowed).toBe(true);
  });

  it("never throws — even with hostile inputs", async () => {
    const { checkTenantCostCap } = await importCostRunaway();
    await expect(
      checkTenantCostCap({ userId: "", planId: null }),
    ).resolves.not.toThrow();
    await expect(
      checkTenantCostCap({ userId: "a".repeat(10000), planId: "free" }),
    ).resolves.not.toThrow();
  });
});

describe("cost-runaway — recordCost fail-open", () => {
  it("returns recorded:false when DB is unavailable but does NOT throw", async () => {
    const { recordCost } = await importCostRunaway();
    const r = await recordCost({ userId: "u", costCents: 10, capCents: 5_000 });
    expect(r.recorded).toBe(false);
    expect(r.cumulativeCents).toBe(0);
    expect(r.paused).toBe(false);
  });

  it("zero or negative cost is a successful no-op (avoid wasted DB write)", async () => {
    const { recordCost } = await importCostRunaway();
    const zero = await recordCost({ userId: "u", costCents: 0, capCents: 5_000 });
    expect(zero.recorded).toBe(true);
    expect(zero.paused).toBe(false);
    const neg = await recordCost({ userId: "u", costCents: -5, capCents: 5_000 });
    expect(neg.recorded).toBe(true);
    expect(neg.paused).toBe(false);
  });
});

describe("cost-runaway — getTenantCostState fail-open", () => {
  it("returns null when DB unavailable, never throws", async () => {
    const { getTenantCostState } = await importCostRunaway();
    const r = await getTenantCostState("any-user");
    expect(r).toBeNull();
  });
});

describe("cost-runaway — unpauseTenant fail-open", () => {
  it("returns unpaused:false when DB unavailable, never throws", async () => {
    const { unpauseTenant } = await importCostRunaway();
    const r = await unpauseTenant({ userId: "u", reason: "whitelisted" });
    expect(r.unpaused).toBe(false);
  });
});

describe("cost-cap-alert — nextUtcMidnight", () => {
  it("rolls forward to the next UTC midnight", async () => {
    const { nextUtcMidnight } = await importCostCapAlert();
    const now = new Date("2026-04-28T10:30:00.000Z");
    const next = nextUtcMidnight(now);
    expect(next.toISOString()).toBe("2026-04-29T00:00:00.000Z");
  });

  it("at exactly UTC midnight, rolls to the FOLLOWING midnight (not same instant)", async () => {
    const { nextUtcMidnight } = await importCostCapAlert();
    const midnight = new Date("2026-04-28T00:00:00.000Z");
    const next = nextUtcMidnight(midnight);
    // setUTCHours(24) rolls to the next day; this is the desired behaviour
    // since "the cap resets at the next midnight" means the FUTURE one.
    expect(next.toISOString()).toBe("2026-04-29T00:00:00.000Z");
  });

  it("near end-of-day, still produces next-day midnight", async () => {
    const { nextUtcMidnight } = await importCostCapAlert();
    const lateNight = new Date("2026-04-28T23:59:59.999Z");
    const next = nextUtcMidnight(lateNight);
    expect(next.toISOString()).toBe("2026-04-29T00:00:00.000Z");
  });

  it("end-of-month rolls into next month correctly", async () => {
    const { nextUtcMidnight } = await importCostCapAlert();
    const eom = new Date("2026-04-30T15:00:00.000Z");
    const next = nextUtcMidnight(eom);
    expect(next.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });
});

describe("cost-cap-alert — onCostCapHit", () => {
  it("never throws when audit log is unavailable (fail-open)", async () => {
    const { onCostCapHit } = await importCostCapAlert();
    await expect(
      onCostCapHit({
        userId: "u",
        planId: "free",
        cumulativeCents: 5500,
        capCents: 5000,
        triggerAgentId: "lead-blitz",
      }),
    ).resolves.not.toThrow();
  });
});
