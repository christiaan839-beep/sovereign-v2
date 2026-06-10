/**
 * Pins the fail-closed contract of the INTERNAL_WEBHOOK_SECRET accessor
 * (BACKLOG H3). The load-bearing property: there is NO configuration in
 * which verifyInternalSecret returns true for an empty or absent header —
 * including the env-unset case that the old `|| ""` fallback left
 * one refactor away from an empty-vs-empty match.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getInternalWebhookSecret,
  verifyInternalSecret,
  __resetInternalSecretWarning,
} from "@/lib/internal-secret";

beforeEach(() => {
  __resetInternalSecretWarning();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getInternalWebhookSecret", () => {
  it("returns null when env is unset", () => {
    vi.stubEnv("INTERNAL_WEBHOOK_SECRET", "");
    expect(getInternalWebhookSecret()).toBeNull();
  });

  it("returns null when env is whitespace-only", () => {
    vi.stubEnv("INTERNAL_WEBHOOK_SECRET", "   ");
    expect(getInternalWebhookSecret()).toBeNull();
  });

  it("returns the trimmed secret when set", () => {
    vi.stubEnv("INTERNAL_WEBHOOK_SECRET", "  s3cret-value  ");
    expect(getInternalWebhookSecret()).toBe("s3cret-value");
  });

  it("never returns an empty string", () => {
    for (const v of ["", " ", "\t", "\n"]) {
      vi.stubEnv("INTERNAL_WEBHOOK_SECRET", v);
      expect(getInternalWebhookSecret()).not.toBe("");
    }
  });
});

describe("verifyInternalSecret — fail-closed contract", () => {
  it("rejects everything when env is unset (including empty presented)", () => {
    vi.stubEnv("INTERNAL_WEBHOOK_SECRET", "");
    expect(verifyInternalSecret("")).toBe(false);
    expect(verifyInternalSecret(null)).toBe(false);
    expect(verifyInternalSecret(undefined)).toBe(false);
    expect(verifyInternalSecret("anything")).toBe(false);
  });

  it("accepts only the exact secret when env is set", () => {
    vi.stubEnv("INTERNAL_WEBHOOK_SECRET", "s3cret-value");
    expect(verifyInternalSecret("s3cret-value")).toBe(true);
    expect(verifyInternalSecret("s3cret-valuX")).toBe(false);
    expect(verifyInternalSecret("s3cret-valu")).toBe(false);
    expect(verifyInternalSecret("")).toBe(false);
    expect(verifyInternalSecret(null)).toBe(false);
  });

  it("rejects an empty presented value even if env were empty-ish", () => {
    // The exact footgun H3 flagged: empty-vs-empty must NOT match.
    vi.stubEnv("INTERNAL_WEBHOOK_SECRET", "   ");
    expect(verifyInternalSecret("")).toBe(false);
    expect(verifyInternalSecret("   ")).toBe(false);
  });
});
