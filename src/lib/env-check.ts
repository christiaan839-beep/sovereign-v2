/**
 * SOVEREIGN MATRIX — Startup Environment Validation
 *
 * Validates all environment variables at server startup. Reports:
 *   - CRITICAL: Platform won't function without these
 *   - DEGRADED: Core feature is disabled
 *   - OPTIONAL: Specific integration missing (logged as info)
 *
 * Called automatically by root layout on first server render.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("env-check");

interface EnvVar {
  key: string;
  label: string;
  level: "critical" | "important" | "optional";
}

const ENV_VARS: EnvVar[] = [
  // ── CRITICAL: Platform won't start properly ──
  { key: "DATABASE_URL", label: "Neon PostgreSQL database", level: "critical" },
  { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", label: "Clerk auth (public)", level: "critical" },
  { key: "CLERK_SECRET_KEY", label: "Clerk auth (secret)", level: "critical" },

  // ── IMPORTANT: Core features degraded ──
  { key: "NVIDIA_NIM_API_KEY", label: "NVIDIA NIM (65+ AI models)", level: "important" },
  { key: "GOOGLE_GENERATIVE_AI_API_KEY", label: "Google Gemini AI", level: "important" },
  { key: "UPSTASH_REDIS_REST_URL", label: "Distributed rate limiting (Upstash Redis)", level: "important" },
  { key: "UPSTASH_REDIS_REST_TOKEN", label: "Distributed rate limiting (Upstash token)", level: "important" },
  { key: "YOCO_SECRET_KEY", label: "Yoco payments", level: "important" },
  { key: "RESEND_API_KEY", label: "Transactional email (Resend)", level: "important" },
  { key: "TAVILY_API_KEY", label: "Live web research (Tavily)", level: "important" },
  { key: "NEXT_PUBLIC_APP_URL", label: "Production URL", level: "important" },
  { key: "CRON_SECRET", label: "Cron endpoint authentication", level: "important" },
  { key: "ENCRYPTION_KEY", label: "Data encryption key", level: "important" },

  // ── OPTIONAL: Specific integrations ──
  { key: "ANTHROPIC_API_KEY", label: "Anthropic Claude", level: "optional" },
  { key: "GROQ_API_KEY", label: "Groq (fast inference)", level: "optional" },
  { key: "FIRECRAWL_API_KEY", label: "Firecrawl (web scraping)", level: "optional" },
  { key: "PINECONE_API_KEY", label: "Pinecone (vector memory)", level: "optional" },
  { key: "PINECONE_INDEX", label: "Pinecone index name", level: "optional" },
  { key: "PINECONE_HOST", label: "Pinecone host URL", level: "optional" },
  { key: "ELEVENLABS_API_KEY", label: "ElevenLabs (voice synthesis)", level: "optional" },
  { key: "HUBSPOT_ACCESS_TOKEN", label: "HubSpot CRM", level: "optional" },
  { key: "TWILIO_ACCOUNT_SID", label: "Twilio (WhatsApp/SMS)", level: "optional" },
  { key: "TELEGRAM_BOT_TOKEN", label: "Telegram bot", level: "optional" },
  { key: "TELEGRAM_ADMIN_CHAT_ID", label: "Telegram admin alerts", level: "optional" },
  { key: "NOTION_API_KEY", label: "Notion integration", level: "optional" },
  { key: "SLACK_WEBHOOK_URL", label: "Slack notifications", level: "optional" },
  { key: "META_ACCESS_TOKEN", label: "Meta/Facebook Ads", level: "optional" },
  { key: "X_API_KEY", label: "X/Twitter API", level: "optional" },
  { key: "N8N_WEBHOOK_URL", label: "n8n workflows", level: "optional" },
  { key: "CALCOM_BOOKING_URL", label: "Cal.com bookings", level: "optional" },
  { key: "KOKORO_API_KEY", label: "Kokoro TTS", level: "optional" },
];

export interface EnvCheckResult {
  critical: string[];
  important: string[];
  optional: string[];
  healthy: boolean;
}

let _cachedResult: EnvCheckResult | null = null;

/**
 * Run a full environment validation.
 * Results are cached — safe to call multiple times.
 */
export function validateEnvironment(): EnvCheckResult {
  if (typeof window !== "undefined") {
    return { critical: [], important: [], optional: [], healthy: true };
  }

  if (_cachedResult) return _cachedResult;

  const critical: string[] = [];
  const important: string[] = [];
  const optional: string[] = [];

  for (const { key, label, level } of ENV_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      const msg = `${key} — ${label}`;
      if (level === "critical") critical.push(msg);
      else if (level === "important") important.push(msg);
      else optional.push(msg);
    }
  }

  // Log results
  if (critical.length > 0) {
    log.error(`🔴 ${critical.length} CRITICAL env vars missing (platform will malfunction):`);
    critical.forEach((m) => log.error(`   ✗ ${m}`));
  }

  if (important.length > 0) {
    log.warn(`🟡 ${important.length} IMPORTANT env vars missing (features degraded):`);
    important.forEach((m) => log.warn(`   ○ ${m}`));
  }

  if (optional.length > 0 && optional.length <= 10) {
    log.info(`🔵 ${optional.length} optional integrations not configured`);
  }

  const total = ENV_VARS.length;
  const configured = total - critical.length - important.length - optional.length;

  if (critical.length === 0) {
    log.info(`✓ Environment check passed — ${configured}/${total} vars configured`);
  }

  _cachedResult = {
    critical,
    important,
    optional,
    healthy: critical.length === 0,
  };

  return _cachedResult;
}

/**
 * Quick check if a specific feature is available.
 * Use in route handlers to decide whether to enable/disable features.
 *
 * Usage:
 *   if (isFeatureAvailable("stripe")) { ... }
 */
export function isFeatureAvailable(feature: string): boolean {
  const checks: Record<string, string[]> = {
    stripe: ["STRIPE_SECRET_KEY"],
    payfast: ["PAYFAST_MERCHANT_ID", "PAYFAST_MERCHANT_KEY"],
    paystack: ["PAYSTACK_SECRET_KEY"],
    yoco: ["YOCO_SECRET_KEY"],
    email: ["RESEND_API_KEY"],
    twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    telegram: ["TELEGRAM_BOT_TOKEN"],
    pinecone: ["PINECONE_API_KEY", "PINECONE_INDEX"],
    hubspot: ["HUBSPOT_ACCESS_TOKEN"],
    firecrawl: ["FIRECRAWL_API_KEY"],
    elevenlabs: ["ELEVENLABS_API_KEY"],
    upstash: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    nvidia: ["NVIDIA_NIM_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY"],
    groq: ["GROQ_API_KEY"],
    tavily: ["TAVILY_API_KEY"],
    slack: ["SLACK_WEBHOOK_URL"],
    meta: ["META_ACCESS_TOKEN"],
    notion: ["NOTION_API_KEY"],
  };

  const required = checks[feature];
  if (!required) return false;
  return required.every((key) => !!process.env[key]);
}
