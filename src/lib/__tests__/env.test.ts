/**
 * env.ts — test coverage for the existing Zod schema + capability
 * predicates. Since `env` + `capabilities` are memoized Proxy-backed
 * module singletons, we test the *behavior* by stubbing `process.env`
 * before each test and clearing the memoization via dynamic re-import.
 *
 * We test three things:
 *   1. REQUIRED env vars are enforced — assertEnv() throws when any
 *      are missing in production, warns in development.
 *   2. Capability predicates reflect presence/absence of their
 *      upstream env vars.
 *   3. EnvValidationError carries the Zod issue list for programmatic
 *      consumption.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* ─── Test harness ─────────────────────────────────────────────── */

const SNAPSHOT = { ...process.env };

function setEnv(map: Record<string, string | undefined>): void {
  // Reset to snapshot, then apply overrides.
  for (const key of Object.keys(process.env)) delete process.env[key];
  for (const [k, v] of Object.entries(SNAPSHOT)) {
    if (v !== undefined) process.env[k] = v;
  }
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

async function freshEnv() {
  // Re-import env.ts so its memoized `_parsed` is reset.
  vi.resetModules();
  return import("@/lib/env");
}

/** Minimum required env to pass schema validation.
 *  Round 25 — added ENCRYPTION_KEY and CRON_SECRET to clear the new
 *  assertProductionRequiredEnv gate. The existing schema-required set
 *  is unchanged; the new prod-only set is additional. */
const VALID_REQUIRED = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_" + "x".repeat(30),
  CLERK_SECRET_KEY: "sk_test_" + "x".repeat(30),
  DATABASE_URL: "postgres://u:p@host:5432/db",
  NVIDIA_NIM_API_KEY: "nvapi-test",
  ENCRYPTION_KEY: "a".repeat(64),
  CRON_SECRET: "x".repeat(32),
};

beforeEach(() => {
  setEnv({});
});

afterEach(() => {
  // Restore the real process.env between tests.
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, SNAPSHOT);
});

/* ─── REQUIRED env enforcement ─────────────────────────────────── */

describe("env — required validation", () => {
  it("assertEnv throws (in production) when DATABASE_URL is missing", async () => {
    setEnv({ ...VALID_REQUIRED, DATABASE_URL: undefined, NODE_ENV: "production" });
    const { assertEnv, EnvValidationError } = await freshEnv();
    expect(() => assertEnv()).toThrow(EnvValidationError);
  });

  it("assertEnv does NOT throw in development when REQUIRED is missing (dev-friendly)", async () => {
    setEnv({ ...VALID_REQUIRED, DATABASE_URL: undefined, NODE_ENV: "development" });
    const { assertEnv } = await freshEnv();
    // Should log an error but not throw — matches the dev ergonomics
    // documented in the env.ts banner.
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => assertEnv()).not.toThrow();
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });

  it("assertEnv throws when CLERK_SECRET_KEY is missing (prod)", async () => {
    setEnv({ ...VALID_REQUIRED, CLERK_SECRET_KEY: undefined, NODE_ENV: "production" });
    const { assertEnv, EnvValidationError } = await freshEnv();
    expect(() => assertEnv()).toThrow(EnvValidationError);
  });

  it("assertEnv throws when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing (prod)", async () => {
    setEnv({
      ...VALID_REQUIRED,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined,
      NODE_ENV: "production",
    });
    const { assertEnv, EnvValidationError } = await freshEnv();
    expect(() => assertEnv()).toThrow(EnvValidationError);
  });

  it("assertEnv succeeds when all REQUIRED vars are set (prod)", async () => {
    setEnv({ ...VALID_REQUIRED, NODE_ENV: "production" });
    const { assertEnv } = await freshEnv();
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(() => assertEnv()).not.toThrow();
    consoleLog.mockRestore();
  });
});

/* ─── Capability predicates ────────────────────────────────────── */

describe("capabilities — AI providers", () => {
  it("ai is false when no provider keys are present", async () => {
    setEnv({
      ...VALID_REQUIRED,
      NVIDIA_NIM_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
      GOOGLE_GENERATIVE_AI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      GROQ_API_KEY: undefined,
      CEREBRAS_API_KEY: undefined,
    });
    const { capabilities } = await freshEnv();
    expect(capabilities.ai).toBe(false);
  });

  it("ai is true when any one provider is configured", async () => {
    setEnv({ ...VALID_REQUIRED, NVIDIA_NIM_API_KEY: "nvapi-x" });
    const { capabilities } = await freshEnv();
    expect(capabilities.ai).toBe(true);
  });

  it("nvidia predicate tracks NVIDIA_NIM_API_KEY", async () => {
    setEnv({ ...VALID_REQUIRED, NVIDIA_NIM_API_KEY: "nvapi-real" });
    const a = await freshEnv();
    expect(a.capabilities.nvidia).toBe(true);

    setEnv({ ...VALID_REQUIRED, NVIDIA_NIM_API_KEY: undefined });
    const b = await freshEnv();
    expect(b.capabilities.nvidia).toBe(false);
  });

  it("gemini predicate is satisfied by EITHER env var", async () => {
    setEnv({ ...VALID_REQUIRED, GEMINI_API_KEY: "gem-x" });
    const a = await freshEnv();
    expect(a.capabilities.gemini).toBe(true);

    setEnv({ ...VALID_REQUIRED, GOOGLE_GENERATIVE_AI_API_KEY: "gai-x" });
    const b = await freshEnv();
    expect(b.capabilities.gemini).toBe(true);
  });
});

describe("capabilities — observability + infra", () => {
  it("sentry reflects SENTRY_DSN OR NEXT_PUBLIC_SENTRY_DSN", async () => {
    setEnv({ ...VALID_REQUIRED, SENTRY_DSN: "https://x@sentry.io/1" });
    const a = await freshEnv();
    expect(a.capabilities.sentry).toBe(true);

    setEnv({ ...VALID_REQUIRED, NEXT_PUBLIC_SENTRY_DSN: "https://y@sentry.io/2" });
    const b = await freshEnv();
    expect(b.capabilities.sentry).toBe(true);

    setEnv({ ...VALID_REQUIRED });
    const c = await freshEnv();
    expect(c.capabilities.sentry).toBe(false);
  });

  it("cache + rateLimits need BOTH upstash vars", async () => {
    setEnv({ ...VALID_REQUIRED, UPSTASH_REDIS_REST_URL: "https://u.upstash.io" });
    const a = await freshEnv();
    expect(a.capabilities.cache).toBe(false);
    expect(a.capabilities.rateLimits).toBe(false);

    setEnv({
      ...VALID_REQUIRED,
      UPSTASH_REDIS_REST_URL: "https://u.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "AAAA",
    });
    const b = await freshEnv();
    expect(b.capabilities.cache).toBe(true);
    expect(b.capabilities.rateLimits).toBe(true);
  });

  it("vectorMemory is true if EITHER Pinecone or Qdrant is set", async () => {
    setEnv({ ...VALID_REQUIRED, QDRANT_URL: "https://q.example" });
    const a = await freshEnv();
    expect(a.capabilities.vectorMemory).toBe(true);

    setEnv({
      ...VALID_REQUIRED,
      PINECONE_API_KEY: "pc-x",
      PINECONE_INDEX: "sov",
    });
    const b = await freshEnv();
    expect(b.capabilities.vectorMemory).toBe(true);
  });
});

describe("capabilities — revenue + comms", () => {
  it("stripe tracks STRIPE_SECRET_KEY", async () => {
    setEnv({ ...VALID_REQUIRED, STRIPE_SECRET_KEY: "sk_test_abc" });
    const a = await freshEnv();
    expect(a.capabilities.stripe).toBe(true);
  });

  it("email requires RESEND_API_KEY", async () => {
    setEnv({ ...VALID_REQUIRED, RESEND_API_KEY: "re_x" });
    const a = await freshEnv();
    expect(a.capabilities.email).toBe(true);
  });

  it("sms requires BOTH Twilio vars", async () => {
    setEnv({ ...VALID_REQUIRED, TWILIO_ACCOUNT_SID: "AC_x" });
    const a = await freshEnv();
    expect(a.capabilities.sms).toBe(false);

    setEnv({
      ...VALID_REQUIRED,
      TWILIO_ACCOUNT_SID: "AC_x",
      TWILIO_AUTH_TOKEN: "tok",
    });
    const b = await freshEnv();
    expect(b.capabilities.sms).toBe(true);
  });
});

/* ─── Error shape ──────────────────────────────────────────────── */

describe("EnvValidationError", () => {
  it("carries the raw Zod issue list for programmatic consumers", async () => {
    setEnv({ ...VALID_REQUIRED, DATABASE_URL: undefined, NODE_ENV: "production" });
    const { assertEnv, EnvValidationError } = await freshEnv();
    try {
      assertEnv();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const ev = err as InstanceType<typeof EnvValidationError>;
      expect(Array.isArray(ev.issues)).toBe(true);
      expect(ev.issues.length).toBeGreaterThan(0);
      expect(ev.message).toContain("Environment validation failed");
    }
  });
});
