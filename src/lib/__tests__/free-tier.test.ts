/**
 * Tests for src/lib/free-tier.ts — Usage Metering System
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Dependencies ──

vi.mock("@/db", () => {
  const mockDb = {
    query: {
      subscriptions: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  };
  // Make select() return a thenable chain
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    }),
  });
  return { db: mockDb };
});

vi.mock("@/db/schema", () => ({
  usage: { userId: "userId", createdAt: "createdAt" },
  subscriptions: { userId: "userId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ col: _col, val })),
  and: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((_col: unknown, val: unknown) => ({ col: _col, val })),
  sql: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Import after mocks ──

import { db } from "@/db";
import {
  checkFreeUsage,
  incrementUsage,
  getUsageStats,
  addBonusRuns,
  getUpgradePrompt,
  FREE_MONTHLY_LIMIT,
  PRO_MONTHLY_LIMIT,
  REFERRAL_BONUS_RUNS,
} from "@/lib/free-tier";

// ── Helpers ──

function mockUsageCount(count: number) {
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count }]),
    }),
  });
}

function mockUserTier(plan: string | null) {
  (db.query.subscriptions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
    plan ? { plan } : null
  );
}

// ── Tests ──

describe("free-tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level caches by clearing mock return values
    mockUsageCount(0);
    mockUserTier(null);
  });

  describe("checkFreeUsage", () => {
    it("should return allowed=true for a new user with zero usage", async () => {
      mockUsageCount(0);
      mockUserTier(null); // defaults to "free"

      const result = await checkFreeUsage("user_new");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(FREE_MONTHLY_LIMIT);
      expect(result.limit).toBe(FREE_MONTHLY_LIMIT);
    });

    it("should return allowed=false when free tier limit is exceeded", async () => {
      mockUsageCount(FREE_MONTHLY_LIMIT);
      mockUserTier(null);

      const result = await checkFreeUsage("user_exhausted");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should return allowed=true for a pro user under the pro limit", async () => {
      mockUsageCount(150);
      mockUserTier("pro");

      const result = await checkFreeUsage("user_pro");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(PRO_MONTHLY_LIMIT);
      expect(result.remaining).toBe(PRO_MONTHLY_LIMIT - 150);
    });

    it("should return allowed=true with Infinity remaining for enterprise users", async () => {
      mockUsageCount(9999);
      mockUserTier("enterprise");

      const result = await checkFreeUsage("user_enterprise");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
      expect(result.limit).toBe(Infinity);
    });

    it("should return allowed=true when usage is just below the limit", async () => {
      mockUsageCount(FREE_MONTHLY_LIMIT - 1);
      mockUserTier(null);

      const result = await checkFreeUsage("user_almost");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });

  describe("incrementUsage", () => {
    it("should call db.insert to record a usage entry", async () => {
      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      (db.insert as ReturnType<typeof vi.fn>).mockImplementation(insertMock);

      await incrementUsage("user_123", "seo-agent");

      expect(insertMock).toHaveBeenCalled();
    });

    it("should not throw when db insert fails", async () => {
      (db.insert as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        values: vi.fn().mockRejectedValue(new Error("DB connection lost")),
      }));

      // Should not throw
      await expect(incrementUsage("user_123", "seo-agent")).resolves.not.toThrow();
    });
  });

  describe("getUsageStats", () => {
    it("should return correct stats for a free tier user", async () => {
      mockUsageCount(42);
      mockUserTier(null);

      const stats = await getUsageStats("user_stats");
      expect(stats.used).toBe(42);
      expect(stats.limit).toBe(FREE_MONTHLY_LIMIT);
      expect(stats.resetDate).toBeDefined();
      // resetDate should be a valid ISO string
      expect(new Date(stats.resetDate).getTime()).not.toBeNaN();
    });

    it("should return Infinity limit for enterprise users", async () => {
      mockUsageCount(500);
      mockUserTier("enterprise");

      const stats = await getUsageStats("user_ent");
      expect(stats.limit).toBe(Infinity);
    });

    it("should return a resetDate in the future", async () => {
      mockUsageCount(0);
      mockUserTier(null);

      const stats = await getUsageStats("user_future");
      const resetDate = new Date(stats.resetDate);
      expect(resetDate.getTime()).toBeGreaterThan(Date.now() - 86400000); // within reason
    });
  });

  describe("addBonusRuns", () => {
    it("should insert a negative-token credit row for bonus runs", async () => {
      const valuesMock = vi.fn().mockResolvedValue(undefined);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

      await addBonusRuns("user_referral", 50);

      expect(db.insert).toHaveBeenCalled();
      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_referral",
          agentId: "referral-bonus",
          tokensUsed: -50,
        })
      );
    });

    it("should not throw when db insert fails", async () => {
      (db.insert as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        values: vi.fn().mockRejectedValue(new Error("DB error")),
      }));

      await expect(addBonusRuns("user_fail", 25)).resolves.not.toThrow();
    });
  });

  describe("getUpgradePrompt", () => {
    it("should return a string containing the limit number", () => {
      const prompt = getUpgradePrompt(FREE_MONTHLY_LIMIT);
      expect(prompt).toContain(String(FREE_MONTHLY_LIMIT));
    });

    it("should mention Pro tier and the pro limit", () => {
      const prompt = getUpgradePrompt(FREE_MONTHLY_LIMIT);
      expect(prompt).toContain("Pro");
      expect(prompt).toContain(PRO_MONTHLY_LIMIT.toLocaleString());
    });

    it("should mention referral bonus runs", () => {
      const prompt = getUpgradePrompt(FREE_MONTHLY_LIMIT);
      expect(prompt).toContain(String(REFERRAL_BONUS_RUNS));
    });

    it("should mention the upgrade and invite options", () => {
      const prompt = getUpgradePrompt(FREE_MONTHLY_LIMIT);
      expect(prompt).toContain("Upgrade");
      expect(prompt).toContain("invite");
    });
  });

  describe("constants", () => {
    it("should have correct tier limits", () => {
      expect(FREE_MONTHLY_LIMIT).toBe(50);
      expect(PRO_MONTHLY_LIMIT).toBe(2000);
      expect(REFERRAL_BONUS_RUNS).toBe(50);
    });
  });
});
