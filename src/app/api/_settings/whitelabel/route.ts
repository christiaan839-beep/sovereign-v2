import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { whitelabelConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { bustWhitelabelCache } from "@/lib/whitelabel-resolver";

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

    // Invalidate the whitelabel-resolver cache for BOTH the old and
    // new domain (if the domain changed). Otherwise page views serve
    // stale branding for up to 5 min until TTL expires naturally.
    if (existing?.domain) bustWhitelabelCache(existing.domain);
    if (typeof domain === "string" && domain) bustWhitelabelCache(domain);

    return NextResponse.json({ success: true });
  } catch (_err) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
