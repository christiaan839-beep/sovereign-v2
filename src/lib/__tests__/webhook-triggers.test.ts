/**
 * Tests for webhook-triggers — secret generation + verify path
 * (no-DB graceful + edge cases). HMAC round-trip is tested via
 * integration against a live DB subscription.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateWebhookSecret,
  listActiveSubscriptionsForAgent,
  verifyTriggerRequest,
} from "../webhook-triggers";

describe("generateWebhookSecret()", () => {
  it("produces a 64-char hex string (32 random bytes)", () => {
    const s = generateWebhookSecret();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is unique across many calls (collision check)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateWebhookSecret());
    expect(set.size).toBe(100);
  });

  it("has high entropy — no obvious repeated bytes", () => {
    const s = generateWebhookSecret();
    // A 64-hex string should have >32 distinct chars in any healthy random draw.
    const distinct = new Set(s.split("")).size;
    expect(distinct).toBeGreaterThan(8); // very loose — just catches catastrophically bad RNG
  });
});

describe("verifyTriggerRequest() — graceful no-DB path", () => {
  const ORIG = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIG;
  });

  it("returns no_db when DATABASE_URL is unset", async () => {
    const r = await verifyTriggerRequest({
      subscriptionId: "00000000-0000-0000-0000-000000000000",
      agentSlugFromUrl: "invoice-ocr",
      rawBody: "{}",
      signatureHeader: "sha256=abc",
      timestampHeader: String(Math.floor(Date.now() / 1000)),
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("no_db");
  });

  it("never throws even on pathological inputs", async () => {
    await expect(
      verifyTriggerRequest({
        subscriptionId: "",
        agentSlugFromUrl: "",
        rawBody: "",
        signatureHeader: null,
        timestampHeader: null,
      }),
    ).resolves.toBeDefined();
  });
});

describe("listActiveSubscriptionsForAgent() — graceful no-DB", () => {
  const ORIG = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIG;
  });

  it("returns [] without a DB", async () => {
    expect(await listActiveSubscriptionsForAgent("any-slug")).toEqual([]);
  });

  it("returns [] for empty slug regardless of DB", async () => {
    process.env.DATABASE_URL = "postgres://unused";
    expect(await listActiveSubscriptionsForAgent("")).toEqual([]);
  });
});
