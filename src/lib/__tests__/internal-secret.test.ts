/**
 * Wave 111.x — internal-secret helper (BACKLOG H3).
 *
 * Pins the fail-closed contract on the `INTERNAL_WEBHOOK_SECRET`
 * verification path so a future cleanup PR can't accidentally
 * reintroduce the `|| ""` empty-fallback footgun the wave-107.2
 * review flagged.
 *
 * Three properties under test:
 *   1. verifyInternalSecret() rejects when env is unset, empty,
 *      or below MIN_SECRET_LENGTH — even when presented matches.
 *   2. verifyInternalSecret() rejects on length mismatch and
 *      timing-safe-equal mismatch.
 *   3. hasInternalSecretConfigured() agrees with the verify path.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

async function fresh() {
  vi.resetModules();
  return await import("@/lib/internal-secret");
}

const VALID_SECRET = "a".repeat(32); // well above the 16-byte floor

describe("internal-secret — env-missing fail-closed", () => {
  beforeEach(() => {
    delete process.env.INTERNAL_WEBHOOK_SECRET;
  });

  it("rejects ANY presented value when env is unset", async () => {
    const { verifyInternalSecret } = await fresh();
    expect(verifyInternalSecret("")).toBe(false);
    expect(verifyInternalSecret(VALID_SECRET)).toBe(false);
    expect(verifyInternalSecret("anything")).toBe(false);
  });

  it("rejects when env is empty string", async () => {
    process.env.INTERNAL_WEBHOOK_SECRET = "";
    const { verifyInternalSecret } = await fresh();
    expect(verifyInternalSecret("")).toBe(false);
    expect(verifyInternalSecret("anything")).toBe(false);
  });

  it("rejects when env is whitespace-only", async () => {
    process.env.INTERNAL_WEBHOOK_SECRET = "       ";
    const { verifyInternalSecret } = await fresh();
    expect(verifyInternalSecret("       ")).toBe(false);
    expect(verifyInternalSecret("")).toBe(false);
  });

  it("rejects a short (<16 byte) secret even when presented matches exactly", async () => {
    process.env.INTERNAL_WEBHOOK_SECRET = "tooshort";
    const { verifyInternalSecret } = await fresh();
    expect(verifyInternalSecret("tooshort")).toBe(false);
  });

  it("hasInternalSecretConfigured agrees with verify on missing/short envs", async () => {
    const { hasInternalSecretConfigured: a } = await fresh();
    expect(a()).toBe(false);

    process.env.INTERNAL_WEBHOOK_SECRET = "short";
    const { hasInternalSecretConfigured: b } = await fresh();
    expect(b()).toBe(false);

    process.env.INTERNAL_WEBHOOK_SECRET = "";
    const { hasInternalSecretConfigured: c } = await fresh();
    expect(c()).toBe(false);
  });
});

describe("internal-secret — env-set verification", () => {
  beforeEach(() => {
    process.env.INTERNAL_WEBHOOK_SECRET = VALID_SECRET;
  });

  it("accepts the exact configured secret", async () => {
    const { verifyInternalSecret } = await fresh();
    expect(verifyInternalSecret(VALID_SECRET)).toBe(true);
  });

  it("rejects a length-mismatch presented value (timing-safe equal needs same length)", async () => {
    const { verifyInternalSecret } = await fresh();
    expect(verifyInternalSecret(VALID_SECRET + "x")).toBe(false);
    expect(verifyInternalSecret(VALID_SECRET.slice(0, -1))).toBe(false);
  });

  it("rejects a same-length-but-different-value presented secret", async () => {
    const { verifyInternalSecret } = await fresh();
    const wrong = "b".repeat(VALID_SECRET.length);
    expect(verifyInternalSecret(wrong)).toBe(false);
  });

  it("rejects non-string presented values (null, undefined, number, object)", async () => {
    const { verifyInternalSecret } = await fresh();
    expect(verifyInternalSecret(null)).toBe(false);
    expect(verifyInternalSecret(undefined)).toBe(false);
    expect(verifyInternalSecret(42)).toBe(false);
    expect(verifyInternalSecret({})).toBe(false);
  });

  it("hasInternalSecretConfigured returns true when env meets the floor", async () => {
    const { hasInternalSecretConfigured } = await fresh();
    expect(hasInternalSecretConfigured()).toBe(true);
  });

  it("getInternalSecretForOutboundCall returns the trimmed secret when configured", async () => {
    process.env.INTERNAL_WEBHOOK_SECRET = "  " + VALID_SECRET + "  ";
    const { getInternalSecretForOutboundCall } = await fresh();
    expect(getInternalSecretForOutboundCall()).toBe(VALID_SECRET);
  });

  it("getInternalSecretForOutboundCall returns null when unconfigured", async () => {
    delete process.env.INTERNAL_WEBHOOK_SECRET;
    const { getInternalSecretForOutboundCall } = await fresh();
    expect(getInternalSecretForOutboundCall()).toBeNull();
  });
});

describe("internal-secret — footgun-regression contract", () => {
  it("REGRESSION: presented='' MUST NOT equal env='' (the old `|| ''` bypass)", async () => {
    process.env.INTERNAL_WEBHOOK_SECRET = "";
    const { verifyInternalSecret } = await fresh();
    // Pre-helper code path: `presented === ""` and `secret === ""`
    // would timing-safe-equal as true. The helper hard-blocks this.
    expect(verifyInternalSecret("")).toBe(false);
  });

  it("REGRESSION: missing-env state cannot be matched by any presented value", async () => {
    delete process.env.INTERNAL_WEBHOOK_SECRET;
    const { verifyInternalSecret } = await fresh();
    expect(verifyInternalSecret("")).toBe(false);
    expect(verifyInternalSecret(VALID_SECRET)).toBe(false);
  });
});
