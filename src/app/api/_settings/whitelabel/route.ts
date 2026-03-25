import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { whitelabelConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

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
  } catch (err) {
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
    const { agencyName, logoUrl, primaryColor, supportEmail } = body;

    const existing = await db.query.whitelabelConfig.findFirst({
      where: eq(whitelabelConfig.userEmail, userEmail)
    });

    if (existing) {
      await db.update(whitelabelConfig)
        .set({ agencyName, logoUrl, primaryColor, supportEmail, updatedAt: new Date() })
        .where(eq(whitelabelConfig.userEmail, userEmail));
    } else {
      await db.insert(whitelabelConfig).values({
        userEmail,
        agencyName: agencyName || "SOVEREIGN",
        logoUrl,
        primaryColor: primaryColor || "#00B7FF",
        supportEmail,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
