/**
 * Tests for src/lib/internal-webhook.ts (BACKLOG H3).
 *
 * The load-bearing invariant: an unconfigured `INTERNAL_WEBHOOK_SECRET`
 * must NEVER authorize a caller. The old `process.env.X || ""` pattern,
 * paired with a future refactor that dropped the `length > 0` guard, would
 * let an empty presented header equal an empty secret and trust anyone.
 * These tests pin the fail-closed contract in one place.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  getInternalWebhookSecret,
  verifyInternalWebhookSecret,
} from "../internal-webhook";

const ORIGINAL = process.env.INTERNAL_WEBHOOK_SECRET;

beforeEach(() => {
  delete process.env.INTERNAL_WEBHOOK_SECRET;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.INTERNAL_WEBHOOK_SECRET;
  else process.env.INTERNAL_WEBHOOK_SECRET = ORIGINAL;
});

describe("getInternalWebhookSecret", () => {
  it("returns null when the env var is unset", () => {
    expect(getInternalWebhookSecret()).toBeNull();
  });

  it("returns null when the env var is the empty string", () => {
    process.env.INTERNAL_WEBHOOK_SECRET = "";
    expect(getInternalWebhookSecret()).toBeNull();
  });

  it("returns the secret when configured", () => {
    process.env.INTERNAL_WEBHOOK_SECRET = "s3cr3t-value";
    expect(getInternalWebhookSecret()).toBe("s3cr3t-value");
  });
});

describe("verifyInternalWebhookSecret — fail-closed contract", () => {
  it("rejects when the secret is unconfigured, even with a matching-looking empty header", () => {
    // The core H3 invariant: no env var → no trust, regardless of input.
    expect(verifyInternalWebhookSecret("")).toBe(false);
    expect(verifyInternalWebhookSecret(null)).toBe(false);
    expect(verifyInternalWebhookSecret(undefined)).toBe(false);
    expect(verifyInternalWebhookSecret("anything")).toBe(false);
  });

  it("rejects an empty presented header when a secret IS configured", () => {
    process.env.INTERNAL_WEBHOOK_SECRET = "real-secret";
    expect(verifyInternalWebhookSecret("")).toBe(false);
    expect(verifyInternalWebhookSecret(null)).toBe(false);
    expect(verifyInternalWebhookSecret(undefined)).toBe(false);
  });

  it("rejects a non-matching header", () => {
    process.env.INTERNAL_WEBHOOK_SECRET = "real-secret";
    expect(verifyInternalWebhookSecret("wrong-secret")).toBe(false);
  });

  it("rejects a header of a different length (constant-time guard short-circuits)", () => {
    process.env.INTERNAL_WEBHOOK_SECRET = "real-secret";
    expect(verifyInternalWebhookSecret("real")).toBe(false);
    expect(verifyInternalWebhookSecret("real-secret-plus")).toBe(false);
  });

  it("accepts an exact match", () => {
    process.env.INTERNAL_WEBHOOK_SECRET = "real-secret";
    expect(verifyInternalWebhookSecret("real-secret")).toBe(true);
  });
});
