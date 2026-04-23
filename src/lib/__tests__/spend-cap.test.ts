/**
 * Tests for spend-cap — plan-resolution + no-DB fail-open path.
 *
 * The SQL aggregate is exercised by integration tests against a real
 * Neon branch (out of scope for unit tests). Here we test:
 *   - plan → cap mapping (pure)
 *   - behaviour without a DB (fail-open)
 *   - behaviour without a userId (system call)
 *   - behaviour for enterprise (unlimited)
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { capForPlan, checkSpendCap, SPEND_CAPS_CENTS } from "../spend-cap";

describe("capForPlan()", () => {
  it("returns the right cap for each known plan", () => {
    expect(capForPlan("free")).toBe(50);
    expect(capForPlan("starter")).toBe(500);
    expect(capForPlan("growth")).toBe(2_500);
    expect(capForPlan("node")).toBe(10_000);
    expect(capForPlan("founder")).toBe(10_000);
    expect(capForPlan("enterprise")).toBe("unlimited");
  });

  it("is case-insensitive", () => {
    expect(capForPlan("FREE")).toBe(50);
    expect(capForPlan("Enterprise")).toBe("unlimited");
  });

  it("falls back to the FREE cap for null / undefined / unknown plans", () => {
    expect(capForPlan(null)).toBe(50);
    expect(capForPlan(undefined)).toBe(50);
    expect(capForPlan("mystery-plan")).toBe(50);
  });

  it("exposes the raw mapping for display (pricing page etc.)", () => {
    expect(SPEND_CAPS_CENTS.free).toBe(50);
    expect(SPEND_CAPS_CENTS.enterprise).toBe("unlimited");
  });
});

describe("checkSpendCap() — graceful paths", () => {
  const ORIGINAL = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL;
  });

  it("returns allowed + empty_user_fail_open for a null userId", async () => {
    const r = await checkSpendCap({ userId: null, plan: "free" });
    expect(r.allowed).toBe(true);
    expect(r.mode).toBe("empty_user_fail_open");
  });

  it("returns allowed + unlimited for enterprise plan", async () => {
    const r = await checkSpendCap({ userId: "user_abc", plan: "enterprise" });
    expect(r.allowed).toBe(true);
    expect(r.mode).toBe("unlimited");
    expect(r.limitCents).toBe(Number.POSITIVE_INFINITY);
    expect(r.remainingCents).toBe(-1);
  });

  it("returns allowed + no_db_fail_open when DATABASE_URL is unset", async () => {
    const r = await checkSpendCap({ userId: "user_abc", plan: "free" });
    expect(r.allowed).toBe(true);
    expect(r.mode).toBe("no_db_fail_open");
    expect(r.limitCents).toBe(50);
  });

  it("remainingCents equals the full cap when DB is unavailable", async () => {
    const r = await checkSpendCap({ userId: "user_abc", plan: "growth" });
    expect(r.remainingCents).toBe(2_500);
  });

  it("treats empty string plan as free tier", async () => {
    const r = await checkSpendCap({ userId: "user_abc", plan: "" });
    expect(r.limitCents).toBe(50);
  });
});
