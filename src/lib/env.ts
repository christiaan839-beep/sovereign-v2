/**
 * SOVEREIGN — Centralized Environment Variable Validator
 *
 * Validates all required environment variables at startup.
 * Import this module in any API route that needs env validation.
 * Throws descriptive errors if critical keys are missing.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("env");

type EnvKey = {
  name: string;
  required: boolean;
  description: string;
};

const ENV_SCHEMA: EnvKey[] = [
  { name: "GOOGLE_GENERATIVE_AI_API_KEY", required: true, description: "Google AI Ultra API key for Gemini 2.5 Pro, Imagen, Veo" },
  { name: "DATABASE_URL", required: true, description: "Neon Serverless Postgres connection string" },
  { name: "PINECONE_API_KEY", required: true, description: "Pinecone vector database API key" },
  { name: "PINECONE_INDEX", required: false, description: "Pinecone index name (defaults to 'umbra-memory')" },
  { name: "CLERK_SECRET_KEY", required: true, description: "Clerk authentication secret key" },
  { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", required: true, description: "Clerk publishable key" },
  { name: "STRIPE_SECRET_KEY", required: false, description: "Stripe payment processing secret key" },
  { name: "STRIPE_WEBHOOK_SECRET", required: false, description: "Stripe webhook signature verification secret" },
  { name: "APOLLO_API_KEY", required: false, description: "Apollo.io lead enrichment API key" },
  { name: "TWILIO_ACCOUNT_SID", required: false, description: "Twilio SMS/WhatsApp account SID" },
  { name: "TWILIO_AUTH_TOKEN", required: false, description: "Twilio authentication token" },
  { name: "TELEGRAM_BOT_TOKEN", required: false, description: "Telegram Command Center bot token" },
  { name: "TELEGRAM_OWNER_CHAT_ID", required: false, description: "Telegram authorized owner chat ID" },
];

export function validateEnv(): { valid: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of ENV_SCHEMA) {
    const value = process.env[key.name];
    
    if (!value || value === "PLACEHOLDER_BOT_TOKEN" || value === "PLACEHOLDER_CHAT_ID") {
      if (key.required) {
        missing.push(`MISSING: ${key.name} — ${key.description}`);
      } else {
        warnings.push(`OPTIONAL: ${key.name} — ${key.description}`);
      }
    }
  }

  if (missing.length > 0) {
    log.error("SOVEREIGN ENVIRONMENT VALIDATION FAILED");
    log.error("═══════════════════════════════════════");
    missing.forEach((m) => log.error(m));
    if (warnings.length > 0) {
      log.warn("Optional keys not configured:");
      warnings.forEach((w) => log.warn(w));
    }
    log.error("═══════════════════════════════════════");
  }

  return { valid: missing.length === 0, missing, warnings };
}

/**
 * Utility: Get a required environment variable or throw a descriptive error.
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[SOVEREIGN ENV] Missing required environment variable: ${key}. Check .env.local`);
  }
  return value;
}

/**
 * Utility: Get an optional environment variable with a default fallback.
 */
export function getOptionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}
