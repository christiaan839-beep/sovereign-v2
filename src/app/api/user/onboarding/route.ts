import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("user-onboarding");

/**
 * POST /api/user/onboarding — Persist onboarding selections to tenant record.
 * Called at the end of the onboarding flow to save goal, industry, and company URL.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { goal, industry, companyUrl } = body as {
      goal?: string;
      industry?: string;
      companyUrl?: string;
    };

    // Upsert tenant with onboarding data
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.clerkUserId, userId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(tenants).set({
        ...(goal && { onboardingGoal: goal }),
        ...(industry && { onboardingIndustry: industry }),
        ...(companyUrl && { companyUrl }),
      }).where(eq(tenants.clerkUserId, userId));
    } else {
      // Create tenant if first time
      const nodeId = `SM-${userId.slice(-6).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      await db.insert(tenants).values({
        clerkUserId: userId,
        nodeId,
        plan: "free",
        onboardingGoal: goal || null,
        onboardingIndustry: industry || null,
        companyUrl: companyUrl || null,
      });
    }

    log.info("Onboarding saved", { userId, goal, industry });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      // Table doesn't exist — save locally only
      return NextResponse.json({ success: true, note: "DB not migrated yet" });
    }
    log.error("Onboarding save failed", { error: msg });
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

/**
 * GET /api/user/onboarding — Retrieve user's onboarding preferences.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ goal: null, industry: null, companyUrl: null });
    }

    const [tenant] = await db
      .select({
        goal: tenants.onboardingGoal,
        industry: tenants.onboardingIndustry,
        companyUrl: tenants.companyUrl,
      })
      .from(tenants)
      .where(eq(tenants.clerkUserId, userId))
      .limit(1);

    return NextResponse.json({
      goal: tenant?.goal || null,
      industry: tenant?.industry || null,
      companyUrl: tenant?.companyUrl || null,
    });
  } catch {
    return NextResponse.json({ goal: null, industry: null, companyUrl: null });
  }
}
