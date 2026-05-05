import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-guard";
import { createLogger } from "@/lib/logger";
import { safeEncrypt, safeDecrypt } from "@/lib/crypto";
const log = createLogger("settings-base");

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  try {
    const { action, settings: newSettings } = await req.json();
    const userEmail = auth.email || "admin@umbra.ai";

    // Keys that should go to the apiKeys column (used by ai.ts)
    const API_KEY_NAMES = [
      "gemini",
      "anthropic",
      "tavily",
      "pinecone_key",
      "pinecone_index",
      "ollama",
      "groq",
      "grok",
    ];

    if (action === "save") {
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.userEmail, userEmail));

      // Separate API keys from other config. API keys are encrypted at rest;
      // config is non-secret display preferences.
      const apiKeyData: Record<string, string> = {};
      const configData: Record<string, string> = {};
      for (const [key, val] of Object.entries(newSettings)) {
        if (API_KEY_NAMES.includes(key)) {
          apiKeyData[key] = safeEncrypt(val as string);
        } else {
          configData[key] = val as string;
        }
      }

      if (existing.length > 0) {
        // Merge with existing
        const oldApiKeys = existing[0].apiKeys
          ? JSON.parse(existing[0].apiKeys)
          : {};
        const oldConfig = existing[0].config
          ? JSON.parse(existing[0].config)
          : {};
        const mergedApiKeys = { ...oldApiKeys, ...apiKeyData };
        const mergedConfig = { ...oldConfig, ...configData };

        await db
          .update(settings)
          .set({
            apiKeys: JSON.stringify(mergedApiKeys),
            config: JSON.stringify(mergedConfig),
          })
          .where(eq(settings.userEmail, userEmail));
      } else {
        await db.insert(settings).values({
          userEmail,
          apiKeys: JSON.stringify(apiKeyData),
          config: JSON.stringify(configData),
        });
      }

      return NextResponse.json({
        success: true,
        message: "API keys saved securely.",
      });
    }

    if (action === "load") {
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.userEmail, userEmail));
      const savedApiKeys =
        existing.length > 0 && existing[0].apiKeys
          ? JSON.parse(existing[0].apiKeys)
          : {};

      // Mask sensitive values (show first 4 + last 4 chars). We must decrypt
      // first; otherwise the mask would show base64 ciphertext bytes instead
      // of the real key prefix/suffix.
      const masked: Record<string, string> = {};
      for (const [key, val] of Object.entries(savedApiKeys)) {
        let valStr: string;
        try {
          valStr = safeDecrypt(val as string);
        } catch {
          // A decrypt failure here means the row has a key encrypted under
          // an old ENCRYPTION_KEY. Show "rotation required" rather than
          // leaking ciphertext or showing a meaningless mask.
          masked[key] = "•••• rotate ••••";
          continue;
        }
        masked[key] =
          valStr.length > 8
            ? valStr.slice(0, 4) + "••••" + valStr.slice(-4)
            : "••••••••";
      }

      const status = {
        gemini:
          !!savedApiKeys.gemini ||
          !!process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
          !!process.env.GEMINI_API_KEY,
        anthropic: !!savedApiKeys.anthropic || !!process.env.ANTHROPIC_API_KEY,
        tavily: !!savedApiKeys.tavily || !!process.env.TAVILY_API_KEY,
        pinecone_key:
          !!savedApiKeys.pinecone_key || !!process.env.PINECONE_API_KEY,
        groq: !!savedApiKeys.groq || !!process.env.GROQ_API_KEY,
      };

      return NextResponse.json({ success: true, masked, status });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    log.error("Settings Postgres API error", error as Record<string, unknown>);
    return NextResponse.json(
      { error: "Failed to process settings." },
      { status: 500 },
    );
  }
}
