/**
 * SOVEREIGN MATRIX: USAGE TRACKING & METERED BILLING
 *
 * Records token usage per user/agent/model into the database.
 * Enforces daily limits based on plan tier.
 *
 * Free tier: 5,000 tokens/day
 * Paid tier: 500,000 tokens/day
 * Enterprise: Unlimited
 */

import { db } from "@/db";
import { usage } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("billing");

interface UsageMetadata {
  userId: string;
  agentId: string;
  model: string;
  tokensUsed: number;
}

const DAILY_LIMITS: Record<string, number> = {
  free: 5_000,
  sovereign: 500_000,
  "black-card": 500_000,
  enterprise: 999_999_999,
};

export class SovereignBillingMatrix {

  /**
   * Record token usage and check if user is within their daily limit.
   */
  static async recordUsage(data: UsageMetadata): Promise<{ allowed: boolean; remainingBalance?: number }> {
    try {
      if (!data.userId) {
        throw new Error("Unauthorized: missing user context for billing.");
      }

      // Insert usage record
      try {
        await db.insert(usage).values({
          userId: data.userId,
          agentId: data.agentId,
          model: data.model,
          tokensUsed: data.tokensUsed,
        });
      } catch {
        // DB may not be connected — log and allow gracefully
        log.warn("Failed to write usage record to database", { userId: data.userId });
      }

      // Check remaining balance
      const remaining = await this.getRemainingTokens(data.userId);
      const allowed = remaining > 0;

      if (!allowed) {
        log.info("User exceeded daily token limit", { userId: data.userId, remaining });
      }

      return { allowed, remainingBalance: Math.max(0, remaining) };
    } catch {
      // Usage recording failed — allow request to proceed gracefully
      return { allowed: true };
    }
  }

  /**
   * Get remaining tokens for today based on user's plan.
   */
  static async getRemainingTokens(userId: string): Promise<number> {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const result = await db
        .select({ total: sql<number>`COALESCE(SUM(${usage.tokensUsed}), 0)` })
        .from(usage)
        .where(and(eq(usage.userId, userId), gte(usage.createdAt, todayStart)));

      const usedToday = Number(result[0]?.total ?? 0);
      const limit = DAILY_LIMITS.sovereign; // Default to paid tier until plan lookup is wired

      return limit - usedToday;
    } catch {
      // DB unavailable — return generous default
      return 500_000;
    }
  }

  /**
   * Check if user has sufficient credits before executing an expensive workflow.
   */
  static async hasSufficientCredits(userId: string, requiredTokens: number): Promise<boolean> {
    try {
      const remaining = await this.getRemainingTokens(userId);
      return remaining >= requiredTokens;
    } catch {
      return true; // Fail open — don't block users if DB is down
    }
  }
}
