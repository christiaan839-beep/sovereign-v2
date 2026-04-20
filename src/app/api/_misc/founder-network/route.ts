import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { subscriptions, affiliates } from "@/db/schema";
import { eq, count, isNotNull, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import {
  FOUNDER_NETWORK_MAX,
  FOUNDER_NETWORK_COMMISSION_PCT,
  FOUNDER_NETWORK_DISCOUNT_PCT,
} from "@/lib/plans";
import { randomBytes } from "node:crypto";

const log = createLogger("founder-network");

/**
 * FOUNDER NETWORK — Proposal L.
 *
 * GET:  Returns member count, remaining spots, and the caller's status.
 *       Public info only — no PII or member list.
 * POST: Caller claims a slot. Requires:
 *         - Authenticated Clerk session
 *         - A non-free subscription (either existing paid plan or
 *           the free Founders slot from /api/_misc/founders)
 *       Side effects on success:
 *         - subscriptions.founder_network_joined_at = now()
 *         - subscriptions.founder_network_slot = <N of 100>
 *         - affiliates row created (or upgraded) with:
 *             commissionRate = 30 (vs 20% default)
 *             referralCode   = randomly generated 8-char code
 *
 * This does NOT apply the 50% Stripe discount automatically — that's
 * a manual coupon apply step once Stripe billing is wired, to avoid
 * silently refunding the caller's first invoice. The coupon ID is
 * documented in plans.ts (FOUNDER_NETWORK_COUPON_ID).
 *
 * Safety
 * ------
 *   - Slot count is computed via COUNT(*) inside the same request —
 *     race with concurrent POSTs can theoretically over-allocate by 1-2.
 *     Acceptable at the cohort-of-100 scale; if we grow the cohort or
 *     see contention, swap to a DB-level counter row with SELECT FOR UPDATE.
 *   - Idempotent: re-POST with an already-joined account returns the
 *     existing slot + a 200, never errors.
 *   - Does NOT let a free-tier user claim a spot (that would leak the
 *     50% discount to anyone who can sign up).
 */

function generateReferralCode(email: string): string {
  const slug = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 16).toLowerCase();
  const suffix = randomBytes(3).toString("hex"); // 6 hex chars
  return `${slug || "member"}-${suffix}`;
}

export async function GET() {
  try {
    const [memberCount] = await db
      .select({ value: count() })
      .from(subscriptions)
      .where(isNotNull(subscriptions.founderNetworkJoinedAt));

    const claimed = Number(memberCount?.value ?? 0);
    const remaining = Math.max(0, FOUNDER_NETWORK_MAX - claimed);

    const { userId } = await auth();
    let membership: { slot: number; joinedAt: string; referralCode?: string } | null = null;
    if (userId) {
      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
      });
      if (sub?.founderNetworkJoinedAt) {
        // Fetch their affiliate row for the referral code display
        const affiliate = await db.query.affiliates.findFirst({
          where: eq(affiliates.userId, userId),
        });
        membership = {
          slot: sub.founderNetworkSlot ?? 0,
          joinedAt: sub.founderNetworkJoinedAt.toISOString(),
          referralCode: affiliate?.referralCode,
        };
      }
    }

    return NextResponse.json({
      program: "Sovereign Matrix Founder Network",
      totalSlots: FOUNDER_NETWORK_MAX,
      claimed,
      remaining,
      membership,
      benefits: [
        `${FOUNDER_NETWORK_DISCOUNT_PCT}% lifetime discount on Growth / Node / Enterprise plans`,
        `${FOUNDER_NETWORK_COMMISSION_PCT}% referral commission (vs 20% default) — forever`,
        "Direct Slack access to the founder",
        "Monthly 30-minute 1:1 call",
        "Vote on roadmap — top-voted feature ships every month",
        "Optional 'Founder Network Member' badge for LinkedIn / Twitter",
      ],
      requirements: [
        "Active paid subscription (Growth / Node / Enterprise) OR free Founder slot",
        "Honest product feedback — you help steer the roadmap",
        "Permission to name you as a Founder Network member on the website",
      ],
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42703") {
      // Column not migrated yet — report gracefully so the UI can tell
      // the user to apply the pending migration.
      log.warn("founder_network_joined_at column missing; run migration 0009");
      return NextResponse.json(
        { error: "Founder Network not provisioned in this environment", migration: "0009" },
        { status: 503 },
      );
    }
    log.error("Founder Network GET error", { error: String(err) });
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to join the Founder Network" }, { status: 401 });
  }

  try {
    const existing = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "You need a subscription before joining the Founder Network. Start a Growth / Node / Enterprise plan, or claim a free Founder slot at /api/_misc/founders.",
        },
        { status: 403 },
      );
    }

    // If already a member, return idempotently
    if (existing.founderNetworkJoinedAt) {
      return NextResponse.json({
        success: true,
        alreadyMember: true,
        slot: existing.founderNetworkSlot,
        joinedAt: existing.founderNetworkJoinedAt.toISOString(),
      });
    }

    // Reject free-tier callers (not the free Founders slot — that's "founder" plan)
    if (existing.plan === "free") {
      return NextResponse.json(
        {
          error:
            "The Founder Network is for paying customers and free Founder Members only. Upgrade to Growth / Node / Enterprise first.",
          upgradeUrl: "/pricing",
        },
        { status: 402 },
      );
    }

    // Check slot availability
    const [memberCount] = await db
      .select({ value: count() })
      .from(subscriptions)
      .where(isNotNull(subscriptions.founderNetworkJoinedAt));
    const claimed = Number(memberCount?.value ?? 0);
    if (claimed >= FOUNDER_NETWORK_MAX) {
      return NextResponse.json(
        {
          error: `All ${FOUNDER_NETWORK_MAX} Founder Network slots are taken. Join the waitlist at /contact.`,
          remaining: 0,
        },
        { status: 410 },
      );
    }

    const now = new Date();
    const nextSlot = claimed + 1;

    await db
      .update(subscriptions)
      .set({
        founderNetworkJoinedAt: now,
        founderNetworkSlot: nextSlot,
        updatedAt: now,
      })
      .where(eq(subscriptions.userId, userId));

    // Upgrade (or create) the affiliate row with the Founder Network commission rate.
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? "";
    const existingAffiliate = await db.query.affiliates.findFirst({
      where: eq(affiliates.userId, userId),
    });
    let referralCode: string;
    if (existingAffiliate) {
      referralCode = existingAffiliate.referralCode;
      await db
        .update(affiliates)
        .set({ commissionRate: FOUNDER_NETWORK_COMMISSION_PCT })
        .where(and(eq(affiliates.userId, userId)));
    } else {
      referralCode = generateReferralCode(email || userId);
      await db.insert(affiliates).values({
        userId,
        email: email || `${userId}@unknown`,
        referralCode,
        commissionRate: FOUNDER_NETWORK_COMMISSION_PCT,
      });
    }

    log.info("Founder Network member joined", {
      userId,
      email,
      slot: nextSlot,
      remaining: FOUNDER_NETWORK_MAX - nextSlot,
    });

    return NextResponse.json({
      success: true,
      slot: nextSlot,
      remaining: FOUNDER_NETWORK_MAX - nextSlot,
      joinedAt: now.toISOString(),
      referralCode,
      nextSteps: [
        `Your referral code: ${referralCode}`,
        `Share https://sovereignmatrix.agency?ref=${referralCode} — you earn ${FOUNDER_NETWORK_COMMISSION_PCT}% of every plan they buy, forever.`,
        "Expect a welcome email with Slack + 1:1 scheduling link.",
      ],
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42703" || code === "42P01") {
      log.warn("Founder Network schema missing; run migration 0009");
      return NextResponse.json(
        { error: "Founder Network not provisioned in this environment", migration: "0009" },
        { status: 503 },
      );
    }
    log.error("Founder Network POST error", { error: String(err) });
    return NextResponse.json({ error: "Failed to join Founder Network" }, { status: 500 });
  }
}
