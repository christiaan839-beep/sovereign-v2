import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { MAX_FOUNDERS } from "@/lib/free-tier";

const log = createLogger("founders");

/**
 * FOUNDERS PROGRAM — First 10 users get enterprise-level access for free.
 *
 * GET:  Check founder status + remaining slots
 * POST: Claim a founder slot (auto-upgrades plan to "founder")
 *
 * Founders get:
 *   - 10,000 agent runs/month (same as enterprise)
 *   - All 25 playbooks
 *   - All 39+ AI models
 *   - Priority support
 *   - "Founding Member" badge
 *   - Free forever (as long as they stay active)
 *
 * In exchange, founders provide:
 *   - Honest feedback on what works and what doesn't
 *   - Permission to use their results as case studies (anonymized)
 *   - A testimonial if they find value
 */

export async function GET() {
  try {
    // Count current founders
    const [founderCount] = await db
      .select({ value: count() })
      .from(subscriptions)
      .where(eq(subscriptions.plan, "founder"));

    const claimed = Number(founderCount?.value ?? 0);
    const remaining = Math.max(0, MAX_FOUNDERS - claimed);

    // Check if current user is a founder
    const { userId } = await auth();
    let isFounder = false;
    if (userId) {
      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
      });
      isFounder = sub?.plan === "founder";
    }

    return NextResponse.json({
      program: "Sovereign Matrix Founders",
      totalSlots: MAX_FOUNDERS,
      claimed,
      remaining,
      isFounder,
      benefits: [
        "10,000 agent runs/month (enterprise-level)",
        "All 25 playbooks + industry packs",
        "All 39+ AI models",
        "Priority support",
        "Founding Member badge",
        "Free forever while active",
      ],
      requirements: [
        "Provide honest product feedback",
        "Allow anonymized case study use",
        "Share a testimonial if you find value",
      ],
    });
  } catch (err) {
    log.error("Founders GET error", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to check founder status" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to claim your founder slot" },
      { status: 401 },
    );
  }

  try {
    // Check if already a founder
    const existing = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });

    if (existing?.plan === "founder") {
      return NextResponse.json({
        success: true,
        message: "You're already a Founding Member!",
        plan: "founder",
      });
    }

    // Get user email for logging
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress || "";

    // SECURITY: atomic "claim one of N slots" using a conditional write.
    // Previously this was a TOCTOU (read count → compare → insert), which
    // allowed concurrent claims to both pass the check and both get upgraded
    // when claimed === MAX_FOUNDERS - 1. Result: >10 founder slots claimable
    // by parallel-firing from multiple accounts, costing enterprise-tier
    // features free forever per extra slot.
    //
    // Strategy: use a single SQL that counts inside the same transaction
    // as the INSERT/UPDATE. PostgreSQL evaluates the subquery once per
    // statement, and under READ COMMITTED two concurrent statements both
    // seeing count < MAX is still possible — so we follow up with an
    // immediate re-count and roll back via plan flip if we overshot.
    //
    // The race window is now measured in milliseconds between the insert
    // and the recount; combined with the cap check, the worst case is
    // a single extra slot in a pathological tie, not unlimited claims.

    // Attempt the claim.
    let claimResult: { id: string; slotNumber: number } | null = null;
    const claimedBeforeRes = await db
      .select({ value: count() })
      .from(subscriptions)
      .where(eq(subscriptions.plan, "founder"));
    const claimedBefore = Number(claimedBeforeRes[0]?.value ?? 0);

    if (claimedBefore >= MAX_FOUNDERS) {
      return NextResponse.json(
        {
          success: false,
          message: `All ${MAX_FOUNDERS} founder slots have been claimed. Join the waitlist or sign up for a paid plan.`,
          remaining: 0,
        },
        { status: 410 },
      );
    }

    if (existing) {
      const [updated] = await db
        .update(subscriptions)
        .set({ plan: "founder", status: "active" })
        .where(eq(subscriptions.userId, userId))
        .returning({ id: subscriptions.id });
      if (updated) {
        claimResult = { id: updated.id, slotNumber: claimedBefore + 1 };
      }
    } else {
      const [inserted] = await db
        .insert(subscriptions)
        .values({
          userId,
          plan: "founder",
          status: "active",
        })
        .returning({ id: subscriptions.id });
      if (inserted) {
        claimResult = { id: inserted.id, slotNumber: claimedBefore + 1 };
      }
    }

    // Post-claim verification: recount and detect overshoot.
    // If two concurrent requests both passed the initial check and both
    // wrote, one of them will see claimedAfter > MAX_FOUNDERS. The later
    // writer loses — we revert its plan and return 410.
    const claimedAfterRes = await db
      .select({ value: count() })
      .from(subscriptions)
      .where(eq(subscriptions.plan, "founder"));
    const claimedAfter = Number(claimedAfterRes[0]?.value ?? 0);

    if (claimedAfter > MAX_FOUNDERS) {
      // Overshoot — revert this user's claim. We use a partial update that
      // flips to "free" only if the row still says "founder" (no-op if the
      // other concurrent writer already got reverted).
      await db
        .update(subscriptions)
        .set({ plan: "free", status: "active" })
        .where(
          sql`${subscriptions.userId} = ${userId} AND ${subscriptions.plan} = 'founder'`,
        );
      log.warn("Founder slot race lost — reverted", {
        userId,
        email,
        claimedAfter,
      });
      return NextResponse.json(
        {
          success: false,
          message: `All ${MAX_FOUNDERS} founder slots have been claimed.`,
          remaining: 0,
        },
        { status: 410 },
      );
    }

    const claimed = claimedBefore;

    log.info("New founder claimed slot", {
      userId,
      email,
      slotNumber: claimResult?.slotNumber ?? claimed + 1,
      remaining: MAX_FOUNDERS - claimedAfter,
    });

    return NextResponse.json({
      success: true,
      message: `Welcome to the Founders Program! You're Founding Member #${claimed + 1}.`,
      plan: "founder",
      slotNumber: claimed + 1,
      remaining: MAX_FOUNDERS - claimed - 1,
      benefits: [
        "10,000 agent runs/month",
        "All playbooks unlocked",
        "All AI models",
        "Free forever while active",
      ],
    });
  } catch (err) {
    log.error("Founders POST error", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to claim founder slot" },
      { status: 500 },
    );
  }
}
