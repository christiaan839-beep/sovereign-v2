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

    // Mask API keys — never return full keys in GET responses
    const rawKeys = JSON.parse(userSettings?.apiKeys || "{}");
    const maskedKeys: Record<string, { configured: boolean; masked: string }> = {};
    for (const [provider, key] of Object.entries(rawKeys)) {
      const k = String(key);
      if (k && k.length > 8) {
        maskedKeys[provider] = {
          configured: true,
          masked: `${k.slice(0, 4)}..${k.slice(-4)}`,
        };
      } else if (k) {
        maskedKeys[provider] = { configured: true, masked: "****" };
      } else {
        maskedKeys[provider] = { configured: false, masked: "" };
      }
    }

    return NextResponse.json({ apiKeys: maskedKeys });
  } catch (err) {
    console.error("GET /api/settings/api-keys error:", err);
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
    const apiKeysString = JSON.stringify(body);

    const existing = await db.query.settings.findFirst({
      where: eq(settings.userEmail, userEmail)
    });

    if (existing) {
      await db.update(settings)
        .set({ apiKeys: apiKeysString })
        .where(eq(settings.userEmail, userEmail));
    } else {
      await db.insert(settings).values({
        userEmail,
        apiKeys: apiKeysString,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/settings/api-keys error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
