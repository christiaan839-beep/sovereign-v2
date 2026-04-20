import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
import { setBudget, checkBudget, recordSpend, getSpend } from "@/lib/budget-controls";

describe("budget-controls.ts — Cost Governance", () => {
  it("allows when no budget set", () => { expect(checkBudget("no-budget-user").allowed).toBe(true); });

  it("allows when under budget", () => {
    setBudget({ userId: "budget-user-1", dailyLimitCents: 1000, monthlyLimitCents: 10000 });
    expect(checkBudget("budget-user-1").allowed).toBe(true);
  });

  it("tracks spend correctly", () => {
    recordSpend("budget-user-2", "claude-sonnet-4-6", 10000); // ~3 cents
    const spend = getSpend("budget-user-2");
    expect(spend.dailyCents).toBeGreaterThan(0);
  });

  it("blocks when daily budget exceeded", () => {
    setBudget({ userId: "budget-user-3", dailyLimitCents: 1, monthlyLimitCents: 100000 });
    recordSpend("budget-user-3", "gpt-4o", 100000); // Exceeds $0.01 daily
    const result = checkBudget("budget-user-3");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Daily budget");
  });

  it("NIM models cost $0 (no budget impact)", () => {
    const before = getSpend("nim-user").dailyCents;
    recordSpend("nim-user", "nvidia/llama-3.1-nemotron-ultra-253b-v1", 50000);
    expect(getSpend("nim-user").dailyCents).toBe(before); // No change
  });

  it("returns daily/monthly percent", () => {
    setBudget({ userId: "pct-user", dailyLimitCents: 100, monthlyLimitCents: 1000 });
    const result = checkBudget("pct-user");
    expect(typeof result.dailyPercent).toBe("number");
    expect(typeof result.monthlyPercent).toBe("number");
  });
});
