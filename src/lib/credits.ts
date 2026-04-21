/**
 * CREDIT SERVICE — balance, holds, and ledger management.
 *
 * Four operations:
 *   getBalance(userId)           — current balance in cents
 *   placeHold(userId, cents)     — reserve credits for an in-flight run
 *   captureHold(holdId)          — convert hold → real deduction
 *   releaseHold(holdId)          — cancel hold, balance restored
 *   topUp(userId, cents, meta)   — add credits (Stripe/promo/adjustment)
 *
 * Atomicity: each operation is a single SQL statement or a transaction.
 * Concurrent runs can't oversubscribe because the hold check uses a
 * CHECK constraint on user_credits.balance_cents >= 0 — any transaction
 * that would push balance negative fails at the DB level.
 *
 * All amounts are INTEGER CENTS. Never pass floats.
 */

import { db } from "@/db";
import {
  userCredits,
  creditTransactions,
  creditHolds,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("credits");

const DEFAULT_HOLD_TTL_MS = 5 * 60_000; // 5 minutes — long enough for any single agent run

export type TransactionReason =
  | "topup"
  | "agent_run"
  | "refund"
  | "adjustment"
  | "promo"
  | "hold_capture"
  | "hold_release";

export type HoldStatus = "active" | "captured" | "released" | "expired";

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly userId: string,
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Insufficient credits for user ${userId}: need ${required}¢, have ${available}¢`);
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Return current balance in cents. Returns 0 if the user has no row
 * yet — new users are implicitly at zero until their first top-up.
 */
export async function getBalance(userId: string): Promise<number> {
  const rows = await db
    .select({ balance: userCredits.balanceCents })
    .from(userCredits)
    .where(eq(userCredits.userId, userId))
    .limit(1);
  return rows[0]?.balance ?? 0;
}

/**
 * Place a hold. Deducts from balance immediately (so concurrent requests
 * see the reduced balance), creates a credit_holds row, and inserts a
 * bookkeeping transaction. Returns the hold ID for later capture/release.
 *
 * Atomicity: a single UPDATE with a WHERE clause that enforces the
 * balance would go non-negative. If no row is affected, we throw
 * InsufficientCreditsError — no partial state left behind.
 */
export async function placeHold(
  userId: string,
  amountCents: number,
  agentRunId?: string,
  ttlMs: number = DEFAULT_HOLD_TTL_MS,
): Promise<string> {
  if (amountCents <= 0) throw new Error("amountCents must be positive");

  return db.transaction(async (tx) => {
    // ensure a row exists for the user — defensive upsert at cost of
    // one round-trip; keeps the UPDATE below simple
    await tx
      .insert(userCredits)
      .values({ userId, balanceCents: 0 })
      .onConflictDoNothing();

    // Atomic debit with guard: returns 0 rows if balance would go below 0
    const debited = await tx
      .update(userCredits)
      .set({
        balanceCents: sql`${userCredits.balanceCents} - ${amountCents}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userCredits.userId, userId),
          sql`${userCredits.balanceCents} >= ${amountCents}`,
        ),
      )
      .returning({ balance: userCredits.balanceCents });

    if (debited.length === 0) {
      const current = await getBalance(userId);
      throw new InsufficientCreditsError(userId, amountCents, current);
    }

    // Create the hold row
    const [hold] = await tx
      .insert(creditHolds)
      .values({
        userId,
        amountCents,
        agentRunId,
        expiresAt: new Date(Date.now() + ttlMs),
        status: "active",
      })
      .returning({ id: creditHolds.id });

    // Ledger entry: negative delta, reason tags this as a hold (captured or
    // released later will create matching hold_capture / hold_release rows).
    await tx.insert(creditTransactions).values({
      userId,
      deltaCents: -amountCents,
      reason: "agent_run",
      holdId: hold.id,
      runId: agentRunId,
      metadata: { stage: "hold_placed", ttlMs },
    });

    log.info("hold placed", { userId, amountCents, holdId: hold.id });
    return hold.id;
  });
}

/**
 * Capture a hold — marks it as permanently consumed. Balance stays
 * where it is (already debited on placeHold). Bookkeeping entry only.
 *
 * Idempotent: capturing an already-captured hold is a no-op.
 */
export async function captureHold(holdId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [hold] = await tx
      .select()
      .from(creditHolds)
      .where(eq(creditHolds.id, holdId))
      .limit(1);

    if (!hold) throw new Error(`Hold ${holdId} not found`);
    if (hold.status === "captured") return; // idempotent
    if (hold.status !== "active") {
      throw new Error(`Cannot capture hold ${holdId}: status is ${hold.status}`);
    }

    await tx
      .update(creditHolds)
      .set({ status: "captured", capturedAt: new Date() })
      .where(eq(creditHolds.id, holdId));

    await tx.insert(creditTransactions).values({
      userId: hold.userId,
      deltaCents: 0, // already debited on placeHold
      reason: "hold_capture",
      holdId: hold.id,
      runId: hold.agentRunId,
      metadata: { capturedCents: hold.amountCents },
    });

    log.info("hold captured", { holdId, userId: hold.userId });
  });
}

/**
 * Release a hold — refunds the held amount to the user's balance.
 * Use when the run fails, is cancelled, or times out.
 *
 * Idempotent: releasing an already-released hold is a no-op.
 */
export async function releaseHold(holdId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [hold] = await tx
      .select()
      .from(creditHolds)
      .where(eq(creditHolds.id, holdId))
      .limit(1);

    if (!hold) throw new Error(`Hold ${holdId} not found`);
    if (hold.status === "released" || hold.status === "expired") return;
    if (hold.status !== "active") {
      throw new Error(`Cannot release hold ${holdId}: status is ${hold.status}`);
    }

    // Refund the balance
    await tx
      .update(userCredits)
      .set({
        balanceCents: sql`${userCredits.balanceCents} + ${hold.amountCents}`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, hold.userId));

    await tx
      .update(creditHolds)
      .set({ status: "released", releasedAt: new Date() })
      .where(eq(creditHolds.id, holdId));

    await tx.insert(creditTransactions).values({
      userId: hold.userId,
      deltaCents: hold.amountCents,
      reason: "hold_release",
      holdId: hold.id,
      runId: hold.agentRunId,
      metadata: { refundedCents: hold.amountCents },
    });

    log.info("hold released", { holdId, userId: hold.userId });
  });
}

/**
 * Top up a user's balance (Stripe webhook, promo, admin adjustment).
 * Upserts the user_credits row if it doesn't exist yet.
 */
export async function topUp(
  userId: string,
  amountCents: number,
  reason: "topup" | "promo" | "refund" | "adjustment" = "topup",
  metadata: Record<string, unknown> = {},
): Promise<number> {
  if (amountCents <= 0) throw new Error("amountCents must be positive for topUp");

  return db.transaction(async (tx) => {
    await tx
      .insert(userCredits)
      .values({ userId, balanceCents: amountCents, lastToppedUpAt: new Date() })
      .onConflictDoUpdate({
        target: userCredits.userId,
        set: {
          balanceCents: sql`${userCredits.balanceCents} + ${amountCents}`,
          lastToppedUpAt: new Date(),
          updatedAt: new Date(),
        },
      });

    await tx.insert(creditTransactions).values({
      userId,
      deltaCents: amountCents,
      reason,
      metadata,
    });

    const newBalance = await getBalance(userId);
    log.info("credits topped up", { userId, amountCents, reason, newBalance });
    return newBalance;
  });
}

/**
 * Sweep expired holds back to active balance. Meant to run as a cron
 * job every minute — defensive against crashes during a run that leave
 * a hold stuck in "active" forever.
 *
 * Returns the number of holds swept.
 */
export async function sweepExpiredHolds(): Promise<number> {
  const now = new Date();
  const expired = await db
    .select({ id: creditHolds.id })
    .from(creditHolds)
    .where(
      and(
        eq(creditHolds.status, "active"),
        sql`${creditHolds.expiresAt} < ${now}`,
      ),
    );

  let count = 0;
  for (const { id } of expired) {
    try {
      await releaseHold(id);
      // Mark as expired (not just released) for auditability
      await db
        .update(creditHolds)
        .set({ status: "expired" })
        .where(eq(creditHolds.id, id));
      count++;
    } catch (err) {
      log.warn("failed to sweep expired hold", {
        holdId: id,
        error: (err as Error).message,
      });
    }
  }
  if (count > 0) log.info("swept expired holds", { count });
  return count;
}
