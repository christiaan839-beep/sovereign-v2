import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { eq, count } from "drizzle-orm";
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
 *   - All 35+ AI models
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
        "All 35+ AI models",
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
    return NextResponse.json({ error: "Failed to check founder status" }, { status: 500 });
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to claim your founder slot" }, { status: 401 });
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

    // Check remaining slots
    const [founderCount] = await db
      .select({ value: count() })
      .from(subscriptions)
      .where(eq(subscriptions.plan, "founder"));

    const claimed = Number(founderCount?.value ?? 0);
    if (claimed >= MAX_FOUNDERS) {
      return NextResponse.json({
        success: false,
        message: `All ${MAX_FOUNDERS} founder slots have been claimed. Join the waitlist or sign up for a paid plan.`,
        remaining: 0,
      }, { status: 410 }); // 410 Gone
    }

    // Get user email for logging
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress || "";

    // Upgrade to founder
    if (existing) {
      await db
        .update(subscriptions)
        .set({ plan: "founder", status: "active" })
        .where(eq(subscriptions.userId, userId));
    } else {
      await db.insert(subscriptions).values({
        userId,
        plan: "founder",
        status: "active",
      });
    }

    log.info("New founder claimed slot", {
      userId,
      email,
      slotNumber: claimed + 1,
      remaining: MAX_FOUNDERS - claimed - 1,
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
    return NextResponse.json({ error: "Failed to claim founder slot" }, { status: 500 });
  }
}
