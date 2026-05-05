import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-guard";
import { createLogger } from "@/lib/logger";
import { safeEncrypt, safeDecrypt } from "@/lib/crypto";

const log = createLogger("settings-byok");

/**
 * BYOK Key Storage — POST /api/settings/byok
 *
 * Saves an encrypted third-party API key (Hunter.io, Apollo.io, etc.)
 * into the user's settings.apiKeys JSON blob.
 *
 * The key is stored server-side only; it's never exposed to the client
 * in plaintext. Masked values (first 4 + last 4 chars) are returned on
 * the load action in settings-base.ts.
 *
 * Body: { key: "HUNTER_API_KEY", value: "hunter_abc123..." }
 */

// Keys allowed via BYOK — explicit allowlist to prevent arbitrary storage
const BYOK_ALLOWED_KEYS = new Set([
  // Enrichment
  "HUNTER_API_KEY",
  "APOLLO_API_KEY",
  "CLEARBIT_API_KEY",
  "LUSHA_API_KEY",
  "SNOV_CLIENT_ID",
  "SNOV_CLIENT_SECRET",
  // AI models
  "OPENAI_API_KEY",
  "MISTRAL_API_KEY",
  "PERPLEXITY_API_KEY",
  // CRM
  "HUBSPOT_ACCESS_TOKEN",
  "PIPEDRIVE_API_TOKEN",
  "CLOSE_API_KEY",
  "GHL_API_KEY",
  "LEMLIST_API_KEY",
  "INSTANTLY_API_KEY",
  "SALESFORCE_ACCESS_TOKEN",
  // Communication
  "DISCORD_BOT_TOKEN",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "SENDGRID_API_KEY",
  // Productivity
  "NOTION_TOKEN",
  "AIRTABLE_TOKEN",
  "GITHUB_TOKEN",
  "GITLAB_TOKEN",
  "LINEAR_API_KEY",
  "JIRA_TOKEN",
  "PINECONE_API_KEY",
  "SUPABASE_SERVICE_KEY",
  "GOOGLE_SERVICE_ACCOUNT",
  // Voice/Media
  "ELEVENLABS_API_KEY",
  "DEEPGRAM_API_KEY",
  "ASSEMBLYAI_API_KEY",
  "FAL_KEY",
  // Payments
  "YOCO_SECRET_KEY",
  "PAYSTACK_SECRET_KEY",
]);

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as { key?: string; value?: string };
    const { key, value } = body;

    if (!key || typeof key !== "string" || !BYOK_ALLOWED_KEYS.has(key)) {
      return NextResponse.json({ error: "Unknown key name" }, { status: 400 });
    }
    if (!value || typeof value !== "string" || value.length < 4) {
      return NextResponse.json({ error: "Value too short" }, { status: 400 });
    }
    // Sanity check: value shouldn't look like a template or placeholder
    if (value.includes("YOUR_") || value === "undefined" || value === "null") {
      return NextResponse.json(
        { error: "Value looks like a placeholder" },
        { status: 400 },
      );
    }

    const userEmail = auth.email || "";
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    // Load existing settings
    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.userEmail, userEmail));
    const oldApiKeys: Record<string, string> =
      existing.length > 0 && existing[0].apiKeys
        ? JSON.parse(existing[0].apiKeys)
        : {};

    // FIX (audit P0): encrypt BYOK values at rest. Previously stored plaintext
    // in settings.apiKeys — first DB breach would leak every customer's
    // Stripe/Twilio/Hunter/Apollo/etc keys. safeEncrypt is a no-op when
    // ENCRYPTION_KEY is unset (dev), AES-256-GCM when set (prod).
    const merged = { ...oldApiKeys, [key]: safeEncrypt(value) };

    if (existing.length > 0) {
      await db
        .update(settings)
        .set({ apiKeys: JSON.stringify(merged) })
        .where(eq(settings.userEmail, userEmail));
    } else {
      await db.insert(settings).values({
        userEmail,
        apiKeys: JSON.stringify(merged),
        config: "{}",
      });
    }

    log.info("BYOK key saved", { email: userEmail, key });

    return NextResponse.json({ success: true, key, stored: true });
  } catch (err) {
    log.error("BYOK save failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to save key" }, { status: 500 });
  }
}

/** Load masked BYOK status — which third-party keys are configured */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const userEmail = auth.email || "";
    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.userEmail, userEmail));
    const savedKeys: Record<string, string> =
      existing.length > 0 && existing[0].apiKeys
        ? JSON.parse(existing[0].apiKeys)
        : {};

    // Return configured status — never the raw values
    const status: Record<string, boolean> = {};
    for (const key of BYOK_ALLOWED_KEYS) {
      status[key] = Boolean(savedKeys[key]);
    }

    return NextResponse.json({ success: true, configured: status });
  } catch (err) {
    log.error("BYOK load failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
