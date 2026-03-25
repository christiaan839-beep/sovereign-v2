import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-guard";

/**
 * Returns the current user's plan tier.
 * Used by useUsage hook to determine generation limits.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const email = auth.email || "admin@umbra.ai";

    const [tenant] = await db
      .select({ plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.clerkUserId, email))
      .limit(1);

    const plan = tenant?.plan || "starter";
    const isPaid = plan === "pro" || plan === "agency";

    return NextResponse.json({
      plan,
      isPaid,
      limit: isPaid ? 999999 : 20,
    });
  } catch {
    return NextResponse.json({ plan: "starter", isPaid: false, limit: 20 });
  }
}
