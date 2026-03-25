import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = user.primaryEmailAddress.emailAddress;

  try {
    const userSettings = await db.query.settings.findFirst({
      where: eq(settings.userEmail, userEmail)
    });

    return NextResponse.json({ webhooks: userSettings?.webhooks || "{}" });
  } catch (err) {
    console.error("GET /api/settings/webhooks error:", err);
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
    const webhooksString = JSON.stringify(body);

    const existing = await db.query.settings.findFirst({
      where: eq(settings.userEmail, userEmail)
    });

    if (existing) {
      await db.update(settings)
        .set({ webhooks: webhooksString })
        .where(eq(settings.userEmail, userEmail));
    } else {
      await db.insert(settings).values({
        userEmail,
        webhooks: webhooksString,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/settings/webhooks error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
