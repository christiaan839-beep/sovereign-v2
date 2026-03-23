/**
 * SOVEREIGN MATRIX — Validated Environment Configuration
 *
 * Type-safe environment variable access with runtime validation.
 * Import `env` instead of using `process.env` directly.
 */

type EnvConfig = {
  // ─── Critical (platform won't function without these) ───
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  DATABASE_URL: string;

  // ─── AI Providers (at least one required) ───
  NVIDIA_NIM_API_KEY: string | undefined;
  GOOGLE_GENERATIVE_AI_API_KEY: string | undefined;
  ANTHROPIC_API_KEY: string | undefined;
  GROQ_API_KEY: string | undefined;

  // ─── Communications ───
  RESEND_API_KEY: string | undefined;
  TWILIO_ACCOUNT_SID: string | undefined;
  TWILIO_AUTH_TOKEN: string | undefined;
  TWILIO_WHATSAPP_NUMBER: string | undefined;
  TELEGRAM_BOT_TOKEN: string | undefined;
  TELEGRAM_ADMIN_CHAT_ID: string | undefined;

  // ─── Payments ───
  STRIPE_SECRET_KEY: string | undefined;
  STRIPE_WEBHOOK_SECRET: string | undefined;
  PAYFAST_MERCHANT_ID: string | undefined;
  PAYFAST_MERCHANT_KEY: string | undefined;
  PAYFAST_PASSPHRASE: string | undefined;
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: string | undefined;

  // ─── Vector Memory ───
  PINECONE_API_KEY: string | undefined;
  PINECONE_INDEX: string | undefined;

  // ─── Research ───
  TAVILY_API_KEY: string | undefined;

  // ─── CRM ───
  HUBSPOT_ACCESS_TOKEN: string | undefined;
  SALESFORCE_CLIENT_ID: string | undefined;
  SALESFORCE_CLIENT_SECRET: string | undefined;

  // ─── Cache ───
  UPSTASH_REDIS_REST_URL: string | undefined;
  UPSTASH_REDIS_REST_TOKEN: string | undefined;

  // ─── App ───
  NEXT_PUBLIC_URL: string | undefined;
  CRON_SECRET: string | undefined;
  PUSHER_APP_ID: string | undefined;
  PUSHER_KEY: string | undefined;
  PUSHER_SECRET: string | undefined;
};

function getEnv(): EnvConfig {
  const critical = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? "",
    DATABASE_URL: process.env.DATABASE_URL ?? "",
  };

  return {
    ...critical,

    // AI
    NVIDIA_NIM_API_KEY: process.env.NVIDIA_NIM_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,

    // Comms
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID,

    // Payments
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    PAYFAST_MERCHANT_ID: process.env.PAYFAST_MERCHANT_ID,
    PAYFAST_MERCHANT_KEY: process.env.PAYFAST_MERCHANT_KEY,
    PAYFAST_PASSPHRASE: process.env.PAYFAST_PASSPHRASE,
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,

    // Memory
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_INDEX: process.env.PINECONE_INDEX,

    // Research
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,

    // CRM
    HUBSPOT_ACCESS_TOKEN: process.env.HUBSPOT_ACCESS_TOKEN,
    SALESFORCE_CLIENT_ID: process.env.SALESFORCE_CLIENT_ID,
    SALESFORCE_CLIENT_SECRET: process.env.SALESFORCE_CLIENT_SECRET,

    // Cache
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,

    // App
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    PUSHER_APP_ID: process.env.PUSHER_APP_ID,
    PUSHER_KEY: process.env.PUSHER_KEY,
    PUSHER_SECRET: process.env.PUSHER_SECRET,
  };
}

/** Type-safe environment config — use this instead of process.env */
export const env = getEnv();

/**
 * Check if a specific capability is available based on env configuration.
 * Use this for graceful degradation in agent routes.
 */
export const capabilities = {
  get ai() {
    return !!(env.NVIDIA_NIM_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || env.ANTHROPIC_API_KEY || env.GROQ_API_KEY);
  },
  get nvidia() { return !!env.NVIDIA_NIM_API_KEY; },
  get gemini() { return !!env.GOOGLE_GENERATIVE_AI_API_KEY; },
  get claude() { return !!env.ANTHROPIC_API_KEY; },
  get groq() { return !!env.GROQ_API_KEY; },
  get email() { return !!env.RESEND_API_KEY; },
  get sms() { return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN); },
  get whatsapp() { return !!(env.TWILIO_WHATSAPP_NUMBER && env.TWILIO_ACCOUNT_SID); },
  get telegram() { return !!env.TELEGRAM_BOT_TOKEN; },
  get stripe() { return !!env.STRIPE_SECRET_KEY; },
  get payfast() { return !!env.PAYFAST_MERCHANT_ID; },
  get paystack() { return !!env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY; },
  get vectorMemory() { return !!(env.PINECONE_API_KEY && env.PINECONE_INDEX); },
  get webSearch() { return !!env.TAVILY_API_KEY; },
  get hubspot() { return !!env.HUBSPOT_ACCESS_TOKEN; },
  get salesforce() { return !!(env.SALESFORCE_CLIENT_ID && env.SALESFORCE_CLIENT_SECRET); },
  get cache() { return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN); },
  get realtime() { return !!(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET); },
};
