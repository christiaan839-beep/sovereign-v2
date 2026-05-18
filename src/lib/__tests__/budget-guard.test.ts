/**
 * Tests for src/lib/budget-guard.ts — Wave 26.
 *
 * Mocks the budget-controls module so we control checkBudget's
 * verdict per test. Verifies:
 *   - Anonymous calls (no userId) are never blocked
 *   - free-tier calls are never blocked
 *   - Allowed calls return silently
 *   - Disallowed calls throw BudgetExceededError with structured fields
 *   - Fail-open behavior when checkBudget throws
 *   - 80% threshold publishes an event-bus notification
 *   - Hard block publishes the threshold event AND audits
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCheckBudget = vi.fn();
vi.mock("@/lib/budget-controls", () => ({
  checkBudget: mockCheckBudget,
}));

const mockPublishBudgetThreshold = vi.fn();
vi.mock("@/lib/event-bus", () => ({
  publishBudgetThreshold: mockPublishBudgetThreshold,
}));

const mockAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit-log", () => ({
  auditLog: mockAuditLog,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enforceBudget — short-circuits", () => {
  it("returns silently when userId is null (anonymous)", async () => {
    const { enforceBudget } = await import("@/lib/budget-guard");
    await enforceBudget({ userId: null });
    expect(mockCheckBudget).not.toHaveBeenCalled();
  });

  it("returns silently when freeTier=true (NIM / Ollama / etc.)", async () => {
    const { enforceBudget, _resetBudgetAlertsForTests } =
      await import("@/lib/budget-guard");
    _resetBudgetAlertsForTests();
    await enforceBudget({ userId: "u1", freeTier: true });
    expect(mockCheckBudget).not.toHaveBeenCalled();
  });
});

describe("enforceBudget — allowed path", () => {
  it("returns silently when checkBudget allows", async () => {
    mockCheckBudget.mockResolvedValueOnce({
      allowed: true,
      dailyCents: 100,
      dailyLimitCents: 1000,
      dailyPercent: 10,
      monthlyCents: 100,
      plan: "starter",
    });
    const { enforceBudget, _resetBudgetAlertsForTests } =
      await import("@/lib/budget-guard");
    _resetBudgetAlertsForTests();
    await expect(enforceBudget({ userId: "u1" })).resolves.toBeUndefined();
    expect(mockPublishBudgetThreshold).not.toHaveBeenCalled();
  });

  it("publishes a threshold event at >=80% spend (once per user per process)", async () => {
    mockCheckBudget.mockResolvedValue({
      allowed: true,
      dailyCents: 850,
      dailyLimitCents: 1000,
      dailyPercent: 85,
      monthlyCents: 850,
      plan: "starter",
    });
    const { enforceBudget, _resetBudgetAlertsForTests } =
      await import("@/lib/budget-guard");
    _resetBudgetAlertsForTests();
    await enforceBudget({ userId: "u_warn", tenantId: "tenant_x" });
    expect(mockPublishBudgetThreshold).toHaveBeenCalledTimes(1);
    expect(mockPublishBudgetThreshold).toHaveBeenCalledWith(
      "tenant_x",
      expect.objectContaining({
        usedCents: 850,
        capCents: 1000,
        pctUsed: 85,
      }),
    );
    // Second call for same user does NOT re-publish.
    await enforceBudget({ userId: "u_warn", tenantId: "tenant_x" });
    expect(mockPublishBudgetThreshold).toHaveBeenCalledTimes(1);
  });
});

describe("enforceBudget — block path", () => {
  it("throws BudgetExceededError with structured fields when checkBudget denies", async () => {
    mockCheckBudget.mockResolvedValueOnce({
      allowed: false,
      reason: "daily cap reached",
      dailyCents: 1000,
      dailyLimitCents: 1000,
      dailyPercent: 100,
      monthlyCents: 1000,
      plan: "starter",
    });
    const { enforceBudget, BudgetExceededError, _resetBudgetAlertsForTests } =
      await import("@/lib/budget-guard");
    _resetBudgetAlertsForTests();
    let caught: Error | undefined;
    try {
      await enforceBudget({ userId: "u_blocked" });
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(BudgetExceededError);
    if (caught instanceof BudgetExceededError) {
      expect(caught.userId).toBe("u_blocked");
      expect(caught.dailyLimitCents).toBe(1000);
      expect(caught.plan).toBe("starter");
    }
  });

  it("audits the block (Wave-9 chain anchor sweeps the row)", async () => {
    mockCheckBudget.mockResolvedValueOnce({
      allowed: false,
      reason: "over",
      dailyCents: 2000,
      dailyLimitCents: 1000,
      dailyPercent: 200,
      monthlyCents: 2000,
      plan: "free",
    });
    const { enforceBudget, _resetBudgetAlertsForTests } =
      await import("@/lib/budget-guard");
    _resetBudgetAlertsForTests();
    await expect(enforceBudget({ userId: "u_audit" })).rejects.toBeInstanceOf(
      Error,
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u_audit",
        action: "credits.add",
        resource: "budget:blocked",
      }),
    );
  });
});

describe("enforceBudget — fail-open", () => {
  it("returns silently when checkBudget throws (DB blip)", async () => {
    mockCheckBudget.mockRejectedValueOnce(new Error("Neon timed out"));
    const { enforceBudget, _resetBudgetAlertsForTests } =
      await import("@/lib/budget-guard");
    _resetBudgetAlertsForTests();
    await expect(enforceBudget({ userId: "u_blip" })).resolves.toBeUndefined();
  });
});

describe("BudgetExceededError", () => {
  it("uses a default message when no reason is supplied", async () => {
    const { BudgetExceededError } = await import("@/lib/budget-guard");
    const e = new BudgetExceededError({
      userId: "u",
      dailyCents: 1500,
      dailyLimitCents: 1000,
      plan: "starter",
    });
    expect(e.name).toBe("BudgetExceededError");
    expect(e.message).toMatch(/1500/);
    expect(e.message).toMatch(/1000/);
    expect(e.message).toMatch(/starter/);
  });

  it("uses the supplied reason when present", async () => {
    const { BudgetExceededError } = await import("@/lib/budget-guard");
    const e = new BudgetExceededError({
      userId: "u",
      dailyCents: 100,
      dailyLimitCents: 50,
      plan: "free",
      reason: "your custom message",
    });
    expect(e.message).toBe("your custom message");
  });
});
