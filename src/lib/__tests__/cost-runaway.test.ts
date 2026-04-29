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

describe("R43 — resolveEffectiveCap (Trust-as-Collateral live wire)", () => {
  it("falls back to base cap when no agentId is provided", async () => {
    const { resolveEffectiveCap } = await importCostRunaway();
    const r = resolveEffectiveCap({ baseCapCents: 5000 });
    expect(r.capCents).toBe(5000);
    expect(r.creditLineApplied).toBeUndefined();
    expect(r.fellBackReason).toBe("no_agent_id");
  });

  it("falls back to base cap when no credit line row exists", async () => {
    const { resolveEffectiveCap } = await importCostRunaway();
    const r = resolveEffectiveCap({
      baseCapCents: 5000,
      agentId: "unscored-agent",
      creditLineRow: null,
    });
    expect(r.capCents).toBe(5000);
    expect(r.fellBackReason).toBe("no_credit_line");
  });

  it("applies an A+ credit line — widens cap from $50 to $250 (5x)", async () => {
    const { resolveEffectiveCap } = await importCostRunaway();
    const now = new Date("2026-04-29T12:00:00.000Z");
    const r = resolveEffectiveCap({
      baseCapCents: 5000, // $50 base (free tier)
      agentId: "trusted-agent",
      creditLineRow: {
        letterGrade: "A+",
        multiplier: "5.00",
        baseDailyLimitCents: 5000,
        effectiveDailyLimitCents: 25000, // $250
        computedAt: new Date("2026-04-29T05:30:00.000Z"), // ~6.5h old
      },
      now,
    });
    expect(r.capCents).toBe(25000);
    expect(r.fellBackReason).toBeUndefined();
    expect(r.creditLineApplied?.letterGrade).toBe("A+");
    expect(r.creditLineApplied?.multiplier).toBe(5.0);
    expect(r.creditLineApplied?.effectiveCapCents).toBe(25000);
  });

  it("applies an F credit line — narrows cap from $50 to $12.50 (0.25x)", async () => {
    const { resolveEffectiveCap } = await importCostRunaway();
    const now = new Date("2026-04-29T12:00:00.000Z");
    const r = resolveEffectiveCap({
      baseCapCents: 5000,
      agentId: "untrusted-agent",
      creditLineRow: {
        letterGrade: "F",
        multiplier: "0.25",
        baseDailyLimitCents: 5000,
        effectiveDailyLimitCents: 1250, // $12.50
        computedAt: new Date("2026-04-29T05:30:00.000Z"),
      },
      now,
    });
    expect(r.capCents).toBe(1250);
    expect(r.creditLineApplied?.letterGrade).toBe("F");
    expect(r.creditLineApplied?.multiplier).toBe(0.25);
  });

  it("falls back to base cap when credit line is stale (>36h old)", async () => {
    const { resolveEffectiveCap } = await importCostRunaway();
    const now = new Date("2026-04-29T12:00:00.000Z");
    // Last computed 40 hours ago — past staleness threshold.
    const stale = new Date("2026-04-27T20:00:00.000Z");
    const r = resolveEffectiveCap({
      baseCapCents: 5000,
      agentId: "stale-agent",
      creditLineRow: {
        letterGrade: "A+",
        multiplier: "5.00",
        baseDailyLimitCents: 5000,
        effectiveDailyLimitCents: 25000, // would have been $250
        computedAt: stale,
      },
      now,
    });
    // Even though the credit line says 5x, we fall back to base.
    expect(r.capCents).toBe(5000);
    expect(r.creditLineApplied).toBeUndefined();
    expect(r.fellBackReason).toBe("stale_credit_line");
  });

  it("accepts credit line at the exact 36h boundary as fresh", async () => {
    const { resolveEffectiveCap, CREDIT_LINE_STALENESS_THRESHOLD_HOURS } =
      await importCostRunaway();
    expect(CREDIT_LINE_STALENESS_THRESHOLD_HOURS).toBe(36);

    const now = new Date("2026-04-29T12:00:00.000Z");
    // Exactly 36h old — boundary case, should still apply.
    const exact36h = new Date(now.getTime() - 36 * 60 * 60 * 1000);
    const r = resolveEffectiveCap({
      baseCapCents: 5000,
      agentId: "boundary-agent",
      creditLineRow: {
        letterGrade: "A",
        multiplier: "3.00",
        baseDailyLimitCents: 5000,
        effectiveDailyLimitCents: 15000,
        computedAt: exact36h,
      },
      now,
    });
    expect(r.capCents).toBe(15000);
  });

  it("coerces multiplier from string (Drizzle numeric) to number", async () => {
    const { resolveEffectiveCap } = await importCostRunaway();
    const now = new Date("2026-04-29T12:00:00.000Z");
    const r = resolveEffectiveCap({
      baseCapCents: 5000,
      agentId: "any",
      creditLineRow: {
        letterGrade: "B+",
        multiplier: "1.50", // string from drizzle numeric
        baseDailyLimitCents: 5000,
        effectiveDailyLimitCents: 7500,
        computedAt: new Date("2026-04-29T05:30:00.000Z"),
      },
      now,
    });
    expect(typeof r.creditLineApplied?.multiplier).toBe("number");
    expect(r.creditLineApplied?.multiplier).toBe(1.5);
  });

  it("checkTenantCostCap accepts the optional agentId param without breaking back-compat", async () => {
    const { checkTenantCostCap } = await importCostRunaway();
    // No DB → fail-open, but the new param shape must be accepted.
    const r = await checkTenantCostCap({
      userId: "user_x",
      planId: "free",
      agentId: "some-agent",
    });
    expect(r.allowed).toBe(true);
    expect(r.capCents).toBe(5000);
    expect(r.creditLineApplied).toBeUndefined();
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
