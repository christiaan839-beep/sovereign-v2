import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { whitelabelConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireEntitlement } from "@/lib/plan-enforcement";

export async function GET() {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = user.primaryEmailAddress.emailAddress;

  try {
    const config = await db.query.whitelabelConfig.findFirst({
      where: eq(whitelabelConfig.userEmail, userEmail)
    });

    return NextResponse.json({ config: config || null });
  } catch (_err) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Writing agency name / logo / colour / custom domain is the
  // white-label entitlement. GET stays open so an owner can always read
  // back (and a downgraded tenant can see) their own config; only the
  // write is gated. Fails closed — an unresolvable plan is "free".
  const gate = await requireEntitlement(user.id, "whiteLabel");
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: gate.message,
        requiredPlan: gate.requiredPlan,
        upgradeUrl: gate.upgradeUrl,
      },
      { status: 402 }
    );
  }

  const userEmail = user.primaryEmailAddress.emailAddress;

  try {
    const body = await req.json();
    const { agencyName, logoUrl, primaryColor, supportEmail, domain } = body;

    const existing = await db.query.whitelabelConfig.findFirst({
      where: eq(whitelabelConfig.userEmail, userEmail)
    });

    // Build partial update — only set fields that were provided
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (agencyName !== undefined) updates.agencyName = agencyName;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (primaryColor !== undefined) updates.primaryColor = primaryColor;
    if (supportEmail !== undefined) updates.supportEmail = supportEmail;
    if (domain !== undefined) updates.domain = domain;

    if (existing) {
      await db.update(whitelabelConfig)
        .set(updates)
        .where(eq(whitelabelConfig.userEmail, userEmail));
    } else {
      await db.insert(whitelabelConfig).values({
        userEmail,
        agencyName: agencyName || "SOVEREIGN",
        logoUrl,
        primaryColor: primaryColor || "#00B7FF",
        supportEmail,
        domain: domain || "",
      });
    }

    return NextResponse.json({ success: true });
  } catch (_err) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
