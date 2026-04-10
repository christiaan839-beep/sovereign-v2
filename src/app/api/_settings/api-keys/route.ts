import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeEncrypt, safeDecrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";
const log = createLogger("settings-api-keys");

export async function GET() {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = user.primaryEmailAddress.emailAddress;

  try {
    const userSettings = await db.query.settings.findFirst({
      where: eq(settings.userEmail, userEmail),
    });

    // Decrypt then mask API keys — never return full keys in GET responses
    let rawKeys: Record<string, unknown> = {};
    try {
      const decrypted = safeDecrypt(userSettings?.apiKeys || "{}");
      rawKeys = JSON.parse(decrypted);
    } catch {
      // Fallback: try parsing as plain JSON (legacy unencrypted data)
      try {
        rawKeys = JSON.parse(userSettings?.apiKeys || "{}");
      } catch {
        rawKeys = {};
      }
    }
    const maskedKeys: Record<string, { configured: boolean; masked: string }> =
      {};
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
    log.error(
      "GET /api/settings/api-keys error",
      err as Record<string, unknown>,
    );
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

    // SECURITY: cap encrypted payload size + validate shape. Previously
    // accepted arbitrary JSON with no size limit; storage abuse vector.
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Body must be a flat object of provider → key strings" },
        { status: 400 },
      );
    }
    for (const [provider, value] of Object.entries(body)) {
      if (typeof provider !== "string" || provider.length > 50) {
        return NextResponse.json(
          { error: "Provider keys must be strings under 50 chars" },
          { status: 400 },
        );
      }
      if (typeof value !== "string" || value.length > 2_000) {
        return NextResponse.json(
          {
            error: `API key for '${provider}' must be a string under 2,000 chars`,
          },
          { status: 400 },
        );
      }
    }

    const apiKeysString = JSON.stringify(body);
    if (apiKeysString.length > 10_240) {
      return NextResponse.json(
        { error: "Total API keys payload must be under 10 KB" },
        { status: 413 },
      );
    }

    const encryptedKeys = safeEncrypt(apiKeysString);

    const existing = await db.query.settings.findFirst({
      where: eq(settings.userEmail, userEmail),
    });

    if (existing) {
      await db
        .update(settings)
        .set({ apiKeys: encryptedKeys })
        .where(eq(settings.userEmail, userEmail));
    } else {
      await db.insert(settings).values({
        userEmail,
        apiKeys: encryptedKeys,
      });
    }

    await auditLog({
      userId: user.id,
      action: "api_key.create",
      resource: userEmail,
      details: { providers: Object.keys(body) },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error(
      "POST /api/settings/api-keys error",
      err as Record<string, unknown>,
    );
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
