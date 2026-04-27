import { describe, it, expect, beforeEach } from "vitest";
import {
  checkTokenBudget,
  recordTokenUsage,
  getDailyLimit,
  __resetTokenBudgetForTesting,
} from "@/lib/token-budget";

beforeEach(() => __resetTokenBudgetForTesting());

describe("token-budget", () => {
  it("getDailyLimit varies by plan", () => {
    expect(getDailyLimit("free")).toBe(100_000);
    expect(getDailyLimit("starter")).toBe(1_000_000);
    expect(getDailyLimit("growth")).toBe(5_000_000);
    expect(getDailyLimit("enterprise")).toBe(Number.POSITIVE_INFINITY);
  });

  it("allows requests under the cap", async () => {
    const r = await checkTokenBudget("u1", "free", "claude", 50_000);
    expect(r.allowed).toBe(true);
    expect(r.softWarning).toBe(false);
  });

  it("flags soft warning at 80%+", async () => {
    await recordTokenUsage("u2", "claude", 75_000); // 75% on free
    const r = await checkTokenBudget("u2", "free", "claude", 10_000); // projects 85%
    expect(r.allowed).toBe(true);
    expect(r.softWarning).toBe(true);
    expect(r.pctUsed).toBeGreaterThanOrEqual(80);
  });

  it("blocks requests that would exceed the cap", async () => {
    await recordTokenUsage("u3", "claude", 95_000); // 95% on free
    const r = await checkTokenBudget("u3", "free", "claude", 10_000); // projects 105%
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/free plan daily token limit/);
  });

  it("scoping is per-model — exhausting Claude doesn't block Gemini", async () => {
    await recordTokenUsage("u4", "claude", 100_000); // exhausts free Claude
    const r = await checkTokenBudget("u4", "free", "gemini", 50_000);
    expect(r.allowed).toBe(true);
  });

  it("scoping is per-user — u5's spend doesn't affect u6", async () => {
    await recordTokenUsage("u5", "claude", 100_000);
    const r = await checkTokenBudget("u6", "free", "claude", 50_000);
    expect(r.allowed).toBe(true);
  });

  it("enterprise plan has no per-model cap", async () => {
    await recordTokenUsage("u7", "claude", 999_999_999);
    const r = await checkTokenBudget("u7", "enterprise", "claude", 1_000_000);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(Number.POSITIVE_INFINITY);
  });

  it("recordTokenUsage with 0 or negative tokens is a no-op", async () => {
    await recordTokenUsage("u8", "claude", 0);
    await recordTokenUsage("u8", "claude", -10);
    const r = await checkTokenBudget("u8", "free", "claude", 10);
    expect(r.usedToday).toBe(0);
  });
});
