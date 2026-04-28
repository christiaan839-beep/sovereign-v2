/**
 * SOVEREIGN MATRIX — Environment Schema (Zod-validated)
 *
 * Single source of truth for all env vars. Validates at boot via
 * `assertEnv()` (called from instrumentation.ts) so a misconfigured
 * deploy fails fast with a descriptive error, not mid-request with
 * a mysterious undefined.
 *
 *   required  — platform cannot start without these
 *   strongly  — at least ONE of these must be set (the OR group)
 *   recommended — feature flags; missing = capability disabled
 *   optional  — purely informational integrations
 *
 * The `env.validated.ts` module re-exports `env` and `capabilities`
 * from this file for backwards compatibility. New code should import
 * from here directly.
 */

import { z } from "zod";

const NonEmpty = z.string().min(1);
const OptionalString = z.string().optional();
const OptionalUrl = z.string().url().optional();

/**
 * Full schema. Every field the app reads from process.env lives here.
 * The shape is flat (not nested) so Next.js build-time env inlining
 * works as expected.
 */
const EnvSchema = z.object({
  // ─── REQUIRED (platform cannot function) ─────────────────────
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: NonEmpty.describe(
    "Clerk frontend publishable key — get from https://dashboard.clerk.com",
  ),
  CLERK_SECRET_KEY: NonEmpty.describe(
    "Clerk server secret — paired with the publishable key above",
  ),
  DATABASE_URL: NonEmpty.describe(
    "Neon Postgres connection string (pooler URL in production)",
  ),

  // ─── STRONGLY RECOMMENDED (at least one AI provider) ─────────
  NVIDIA_NIM_API_KEY: OptionalString,
  GEMINI_API_KEY: OptionalString,
  GOOGLE_GENERATIVE_AI_API_KEY: OptionalString,
  ANTHROPIC_API_KEY: OptionalString,
  GROQ_API_KEY: OptionalString,
  CEREBRAS_API_KEY: OptionalString,
  TAVILY_API_KEY: OptionalString,

  // ─── OBSERVABILITY ───────────────────────────────────────────
  SENTRY_DSN: OptionalUrl,
  NEXT_PUBLIC_SENTRY_DSN: OptionalUrl,
  SENTRY_AUTH_TOKEN: OptionalString,
  SENTRY_ORG: OptionalString,
  SENTRY_PROJECT: OptionalString,
  NEXT_PUBLIC_POSTHOG_KEY: OptionalString,
  NEXT_PUBLIC_POSTHOG_HOST: OptionalUrl,

  // ─── CACHE / RATE LIMITS ─────────────────────────────────────
  UPSTASH_REDIS_REST_URL: OptionalUrl,
  UPSTASH_REDIS_REST_TOKEN: OptionalString,

  // ─── VECTOR MEMORY ───────────────────────────────────────────
  PINECONE_API_KEY: OptionalString,
  PINECONE_INDEX: OptionalString,
  QDRANT_URL: OptionalUrl,
  QDRANT_API_KEY: OptionalString,

  // ─── LLM ROUTING (optional proxy + observability) ────────────
  LITELLM_URL: OptionalUrl,
  LITELLM_API_KEY: OptionalString,
  LANGFUSE_HOST: OptionalUrl,
  LANGFUSE_PUBLIC_KEY: OptionalString,
  LANGFUSE_SECRET_KEY: OptionalString,

  // ─── BILLING ─────────────────────────────────────────────────
  STRIPE_SECRET_KEY: OptionalString,
  STRIPE_WEBHOOK_SECRET: OptionalString,
  STRIPE_PRICE_STARTER: OptionalString,
  STRIPE_PRICE_GROWTH: OptionalString,
  STRIPE_PRICE_NODE: OptionalString,
  STRIPE_PRICE_ARRAY: OptionalString,
  STRIPE_PRICE_ENTERPRISE: OptionalString,
  STRIPE_PRICE_SOVEREIGN: OptionalString,
  PAYFAST_MERCHANT_ID: OptionalString,
  PAYFAST_MERCHANT_KEY: OptionalString,
  PAYFAST_PASSPHRASE: OptionalString,
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: OptionalString,

  // ─── COMMUNICATIONS ──────────────────────────────────────────
  RESEND_API_KEY: OptionalString,
  TWILIO_ACCOUNT_SID: OptionalString,
  TWILIO_AUTH_TOKEN: OptionalString,
  TWILIO_WHATSAPP_NUMBER: OptionalString,
  TELEGRAM_BOT_TOKEN: OptionalString,
  TELEGRAM_ADMIN_CHAT_ID: OptionalString,
  SLACK_WEBHOOK_URL: OptionalUrl,

  // ─── CRM / INTEGRATIONS ──────────────────────────────────────
  HUBSPOT_ACCESS_TOKEN: OptionalString,
  SALESFORCE_CLIENT_ID: OptionalString,
  SALESFORCE_CLIENT_SECRET: OptionalString,

  // ─── APP ─────────────────────────────────────────────────────
  NEXT_PUBLIC_URL: OptionalUrl,
  NEXT_PUBLIC_APP_URL: OptionalUrl,
  CRON_SECRET: OptionalString,
  PUSHER_APP_ID: OptionalString,
  PUSHER_KEY: OptionalString,
  PUSHER_SECRET: OptionalString,

  // ─── SECRETS (encryption-at-rest, webhook auth) ──────────────
  // Round 25 — production-required. assertProductionRequiredEnv
  // boot-fails on missing ENCRYPTION_KEY. Round 26 added the
  // PREVIOUS variant for key rotation reads.
  ENCRYPTION_KEY: OptionalString,
  ENCRYPTION_KEY_PREVIOUS: OptionalString,
  WEBHOOK_API_KEY: OptionalString,

  // ─── MODES ───────────────────────────────────────────────────
  DATA_SOVEREIGNTY_MODE: OptionalString,
  DEGRADATION_MODE: z.enum(["normal", "reduced", "minimal"]).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

// ── Parse once, memoize. Lazy so tests can stub process.env. ────
let _parsed: Env | null = null;
let _warnedAboutMissing = false;

function parse(): Env {
  if (_parsed) return _parsed;
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new EnvValidationError(
      `Environment validation failed:\n${missing}\n\nSee .env.example for the full list of supported variables.`,
      result.error.issues,
    );
  }
  _parsed = result.data;
  return _parsed;
}

/**
 * Thrown when required env vars are missing. Carries the Zod issue list
 * for programmatic consumers (e.g., a /api/health/deep response).
 */
export class EnvValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.core.$ZodIssue[],
  ) {
    super(message);
    this.name = "EnvValidationError";
  }
}

/**
 * The typed env object. Preferred over process.env for:
 *   1. Type safety (TS knows which keys are strings vs undefined)
 *   2. Boot-time validation (missing REQUIRED vars throw immediately)
 *   3. Clear documentation of every env var in one place
 */
export const env: Env = new Proxy({} as Env, {
  get(_, prop: string) {
    return parse()[prop as keyof Env];
  },
});

/**
 * Called from instrumentation.ts at startup. Validates the schema and
 * logs a banner showing which capabilities are active. In dev mode
 * missing recommendations are warnings; in prod they're informational.
 *
 * Throws EnvValidationError if REQUIRED vars are missing — in that case
 * the server should not start.
 */
export function assertEnv(): void {
  try {
    const parsed = parse();
    logCapabilityBanner(parsed);
    // Round 25 — additional production-only hard requirements
    // (ENCRYPTION_KEY, CRON_SECRET, etc). See assertProductionRequiredEnv.
    if (process.env.NODE_ENV === "production") {
      assertProductionRequiredEnv();
    }
  } catch (err) {
    if (err instanceof EnvValidationError) {
      // In dev, log the error but don't crash — let the dev fix it
      // iteratively. In prod, re-throw so the deploy fails loud.
      console.error(`\n\u001b[31m✗ ${err.message}\u001b[0m\n`);
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    } else {
      throw err;
    }
  }
}

/**
 * Round 25 — production-only hard requirements.
 *
 * These envs are fail-OPEN if absent today: missing ENCRYPTION_KEY
 * makes safeEncrypt return plaintext (silently broken security);
 * missing CRON_SECRET means verifyCron rejects every cron tick.
 * Hard-requiring them in prod turns silent failure into a boot-fail.
 *
 * NOT called in dev / test / preview — those environments tolerate
 * missing values for iteration speed. Production is where this
 * matters.
 */
export function assertProductionRequiredEnv(): void {
  const required: Array<{ name: string; reason: string }> = [
    {
      name: "ENCRYPTION_KEY",
      reason:
        "AES-256-GCM key for OAuth tokens + BYOK secrets at rest. " +
        "Without it, safeEncrypt returns plaintext silently — the " +
        "data lands in the DB unencrypted and nobody knows.",
    },
    {
      name: "CRON_SECRET",
      reason:
        "Bearer secret for cron-only routes (job-runner, schedulers, " +
        "audit-chain verifier, eval runner). Without it, every cron " +
        "tick 401s and the platform's automation goes silent.",
    },
    {
      name: "DATABASE_URL",
      reason: "Neon Postgres connection string — platform cannot run.",
    },
    {
      name: "CLERK_SECRET_KEY",
      reason: "Clerk server secret — auth path is broken without it.",
    },
    {
      name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      reason: "Clerk frontend key — auth path is broken without it.",
    },
  ];

  const missing = required.filter((r) => !process.env[r.name]);
  if (missing.length === 0) return;

  const lines = missing.map((r) => `  - ${r.name}: ${r.reason}`).join("\n");
  throw new EnvValidationError(
    `Production env validation failed — missing required envs:\n${lines}\n\n` +
      `Set these in your hosting platform's environment settings.`,
    [],
  );
}

function logCapabilityBanner(e: Env): void {
  if (_warnedAboutMissing) return;
  _warnedAboutMissing = true;

  const status = (ok: boolean) => (ok ? "\u001b[32m✓\u001b[0m" : "\u001b[90m–\u001b[0m");
  const lines: string[] = [
    "",
    "\u001b[1mSovereign Matrix — capability status\u001b[0m",
    `  ${status(!!e.NVIDIA_NIM_API_KEY)} NVIDIA NIM             (primary inference)`,
    `  ${status(!!e.CEREBRAS_API_KEY)} Cerebras               (fast inference)`,
    `  ${status(!!(e.GEMINI_API_KEY || e.GOOGLE_GENERATIVE_AI_API_KEY))} Gemini                 (fallback)`,
    `  ${status(!!e.ANTHROPIC_API_KEY)} Claude                 (BYOK recommended)`,
    `  ${status(!!e.GROQ_API_KEY)} Groq                   (fast failover)`,
    `  ${status(!!e.TAVILY_API_KEY)} Tavily                 (research grounding)`,
    `  ${status(!!(e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN))} Upstash Redis          (rate limits + cache)`,
    `  ${status(!!(e.SENTRY_DSN || e.NEXT_PUBLIC_SENTRY_DSN))} Sentry                 (error tracking)`,
    `  ${status(!!(e.PINECONE_API_KEY && e.PINECONE_INDEX))} Pinecone               (vector memory)`,
    `  ${status(!!e.QDRANT_URL)} Qdrant                 (self-hosted vectors)`,
    `  ${status(!!e.LITELLM_URL)} LiteLLM                (unified proxy)`,
    `  ${status(!!(e.LANGFUSE_HOST && e.LANGFUSE_PUBLIC_KEY && e.LANGFUSE_SECRET_KEY))} Langfuse               (LLM tracing)`,
    `  ${status(!!e.STRIPE_SECRET_KEY)} Stripe                 (billing)`,
    `  ${status(!!e.RESEND_API_KEY)} Resend                 (email)`,
    "",
  ];
  console.log(lines.join("\n"));

  // Warn if NO AI providers are configured — platform is nearly useless.
  const hasAnyAI =
    e.NVIDIA_NIM_API_KEY ||
    e.GEMINI_API_KEY ||
    e.GOOGLE_GENERATIVE_AI_API_KEY ||
    e.ANTHROPIC_API_KEY ||
    e.GROQ_API_KEY ||
    e.CEREBRAS_API_KEY;
  if (!hasAnyAI) {
    console.warn(
      "\u001b[33m⚠ No AI provider configured. Set at least one of: " +
        "NVIDIA_NIM_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY.\u001b[0m",
    );
  }
}

/**
 * Capability predicates — use instead of manual env checks in feature
 * branches. When a capability is false, the feature should degrade
 * gracefully (return cached data, skip the step, etc.).
 */
export const capabilities = {
  get ai(): boolean {
    const e = env;
    return !!(
      e.NVIDIA_NIM_API_KEY ||
      e.GEMINI_API_KEY ||
      e.GOOGLE_GENERATIVE_AI_API_KEY ||
      e.ANTHROPIC_API_KEY ||
      e.GROQ_API_KEY ||
      e.CEREBRAS_API_KEY
    );
  },
  get nvidia(): boolean { return !!env.NVIDIA_NIM_API_KEY; },
  get cerebras(): boolean { return !!env.CEREBRAS_API_KEY; },
  get gemini(): boolean { return !!(env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY); },
  get claude(): boolean { return !!env.ANTHROPIC_API_KEY; },
  get groq(): boolean { return !!env.GROQ_API_KEY; },
  get webSearch(): boolean { return !!env.TAVILY_API_KEY; },

  get sentry(): boolean { return !!(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN); },
  get posthog(): boolean { return !!env.NEXT_PUBLIC_POSTHOG_KEY; },
  get cache(): boolean { return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN); },
  get rateLimits(): boolean { return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN); },

  get pinecone(): boolean { return !!(env.PINECONE_API_KEY && env.PINECONE_INDEX); },
  get qdrant(): boolean { return !!env.QDRANT_URL; },
  get vectorMemory(): boolean { return this.pinecone || this.qdrant; },

  get liteLLM(): boolean { return !!env.LITELLM_URL; },
  get langfuse(): boolean {
    return !!(env.LANGFUSE_HOST && env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
  },

  get stripe(): boolean { return !!env.STRIPE_SECRET_KEY; },
  get email(): boolean { return !!env.RESEND_API_KEY; },
  get sms(): boolean { return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN); },
  get whatsapp(): boolean {
    return !!(env.TWILIO_WHATSAPP_NUMBER && env.TWILIO_ACCOUNT_SID);
  },
  get telegram(): boolean { return !!env.TELEGRAM_BOT_TOKEN; },
  get payfast(): boolean { return !!env.PAYFAST_MERCHANT_ID; },
  get paystack(): boolean { return !!env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY; },
  get hubspot(): boolean { return !!env.HUBSPOT_ACCESS_TOKEN; },
  get salesforce(): boolean { return !!(env.SALESFORCE_CLIENT_ID && env.SALESFORCE_CLIENT_SECRET); },
  get realtime(): boolean {
    return !!(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET);
  },
} as const;
