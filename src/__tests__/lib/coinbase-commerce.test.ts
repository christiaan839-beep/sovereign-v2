/**
 * Tests for src/lib/coinbase-commerce.
 *
 * Properties pinned:
 *   - verifyCommerceWebhookSignature
 *       * rejects when secret is unset
 *       * rejects when header is null/empty
 *       * rejects when header is not 64-char hex (DoS guard)
 *       * rejects when header is correct length but non-hex
 *       * rejects when HMAC doesn't match (constant-time compare)
 *       * accepts when HMAC matches
 *   - createCommerceCharge
 *       * returns null when COINBASE_COMMERCE_API_KEY isn't set
 *       * POSTs to /charges with X-CC-Api-Key and X-CC-Version headers
 *       * throws on non-2xx from Coinbase
 *   - fetchCommerceCharge
 *       * returns null when API key isn't set
 *       * returns null on 404 (forged-webhook signal)
 *       * returns the charge on 200
 *
 * Pure-function lib — no network mocking needed beyond a global fetch
 * stub.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";

const SECRET = "test-secret-do-not-use-in-prod";
const RAW_BODY = '{"event":{"id":"e_1","type":"charge:confirmed"}}';

function validSig(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("coinbase-commerce", () => {
  beforeEach(() => {
    process.env.COINBASE_COMMERCE_WEBHOOK_SECRET = SECRET;
    process.env.COINBASE_COMMERCE_API_KEY = "ck_test";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
    delete process.env.COINBASE_COMMERCE_API_KEY;
    vi.restoreAllMocks();
  });

  describe("verifyCommerceWebhookSignature", () => {
    it("returns false when secret is unset", async () => {
      delete process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
      const { verifyCommerceWebhookSignature } =
        await import("@/lib/coinbase-commerce");
      const sig = validSig(SECRET, RAW_BODY);
      expect(verifyCommerceWebhookSignature(RAW_BODY, sig)).toBe(false);
    });

    it("returns false on null/empty signature header", async () => {
      const { verifyCommerceWebhookSignature } =
        await import("@/lib/coinbase-commerce");
      expect(verifyCommerceWebhookSignature(RAW_BODY, null)).toBe(false);
      expect(verifyCommerceWebhookSignature(RAW_BODY, "")).toBe(false);
    });

    it("rejects non-64-char hex (pre-auth DoS guard)", async () => {
      const { verifyCommerceWebhookSignature } =
        await import("@/lib/coinbase-commerce");
      // Too short
      expect(verifyCommerceWebhookSignature(RAW_BODY, "deadbeef")).toBe(false);
      // Too long — 128 chars (would have allocated 64 bytes without guard)
      const long = "a".repeat(128);
      expect(verifyCommerceWebhookSignature(RAW_BODY, long)).toBe(false);
      // Massive payload simulating a DoS attempt
      const huge = "a".repeat(1_000_000);
      expect(verifyCommerceWebhookSignature(RAW_BODY, huge)).toBe(false);
    });

    it("rejects 64-char non-hex strings", async () => {
      const { verifyCommerceWebhookSignature } =
        await import("@/lib/coinbase-commerce");
      // 64 chars but contains 'z'
      const nonHex = "z".repeat(64);
      expect(verifyCommerceWebhookSignature(RAW_BODY, nonHex)).toBe(false);
    });

    it("rejects when HMAC doesn't match the body", async () => {
      const { verifyCommerceWebhookSignature } =
        await import("@/lib/coinbase-commerce");
      const wrong = validSig("different-secret", RAW_BODY);
      expect(verifyCommerceWebhookSignature(RAW_BODY, wrong)).toBe(false);
    });

    it("rejects when body has been tampered with", async () => {
      const { verifyCommerceWebhookSignature } =
        await import("@/lib/coinbase-commerce");
      const sig = validSig(SECRET, RAW_BODY);
      expect(verifyCommerceWebhookSignature(RAW_BODY + " ", sig)).toBe(false);
    });

    it("accepts a correctly-computed signature", async () => {
      const { verifyCommerceWebhookSignature } =
        await import("@/lib/coinbase-commerce");
      const sig = validSig(SECRET, RAW_BODY);
      expect(verifyCommerceWebhookSignature(RAW_BODY, sig)).toBe(true);
    });

    it("is case-insensitive on hex (uppercase signature still verifies)", async () => {
      const { verifyCommerceWebhookSignature } =
        await import("@/lib/coinbase-commerce");
      const sig = validSig(SECRET, RAW_BODY).toUpperCase();
      // 64-char hex regex is /i, but the constant-time compare normalizes
      // via Buffer.from(hex). Should match either way.
      expect(verifyCommerceWebhookSignature(RAW_BODY, sig)).toBe(true);
    });
  });

  describe("createCommerceCharge", () => {
    it("returns null when API key isn't set", async () => {
      delete process.env.COINBASE_COMMERCE_API_KEY;
      const { createCommerceCharge } = await import("@/lib/coinbase-commerce");
      const charge = await createCommerceCharge({
        name: "Pro",
        description: "Pro plan",
        amount: "49.00",
        currency: "USD",
        metadata: { userId: "u1", plan: "array" },
      });
      expect(charge).toBeNull();
    });

    it("POSTs to /charges with X-CC-Api-Key + X-CC-Version", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                id: "ch_1",
                code: "ABC123",
                hosted_url: "https://commerce.coinbase.com/charges/ABC123",
                status: "NEW",
                pricing_type: "fixed_price",
                metadata: { userId: "u1", plan: "array" },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);
      const { createCommerceCharge } = await import("@/lib/coinbase-commerce");
      const charge = await createCommerceCharge({
        name: "Pro",
        description: "Pro plan",
        amount: "49.00",
        currency: "USD",
        metadata: { userId: "u1", plan: "array" },
        redirectUrl: "https://x/ok",
        cancelUrl: "https://x/cancel",
      });
      expect(charge?.id).toBe("ch_1");
      expect(charge?.hosted_url).toContain("commerce.coinbase.com");

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://api.commerce.coinbase.com/charges");
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers["X-CC-Api-Key"]).toBe("ck_test");
      expect(headers["X-CC-Version"]).toBeDefined();
      expect(headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.local_price).toEqual({ amount: "49.00", currency: "USD" });
      expect(body.pricing_type).toBe("fixed_price");
      expect(body.metadata).toEqual({ userId: "u1", plan: "array" });
      expect(body.redirect_url).toBe("https://x/ok");
      expect(body.cancel_url).toBe("https://x/cancel");
    });

    it("throws on non-2xx from Coinbase", async () => {
      const fetchMock = vi.fn(
        async () => new Response("internal server error", { status: 503 }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const { createCommerceCharge } = await import("@/lib/coinbase-commerce");
      await expect(
        createCommerceCharge({
          name: "Pro",
          description: "x",
          amount: "49.00",
          currency: "USD",
          metadata: { userId: "u1", plan: "array" },
        }),
      ).rejects.toThrow(/503/);
    });
  });

  describe("fetchCommerceCharge", () => {
    it("returns null when API key isn't set", async () => {
      delete process.env.COINBASE_COMMERCE_API_KEY;
      const { fetchCommerceCharge } = await import("@/lib/coinbase-commerce");
      expect(await fetchCommerceCharge("ch_1")).toBeNull();
    });

    it("returns null on 404 (forged-webhook signal)", async () => {
      const fetchMock = vi.fn(
        async () => new Response("not found", { status: 404 }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const { fetchCommerceCharge } = await import("@/lib/coinbase-commerce");
      expect(await fetchCommerceCharge("ch_forged")).toBeNull();
    });

    it("returns the charge on 200", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                id: "ch_1",
                code: "ABC",
                hosted_url: "https://x/c",
                status: "COMPLETED",
                pricing_type: "fixed_price",
                metadata: { userId: "u1", plan: "array" },
              },
            }),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);
      const { fetchCommerceCharge } = await import("@/lib/coinbase-commerce");
      const charge = await fetchCommerceCharge("ch_1");
      expect(charge?.id).toBe("ch_1");
      expect(charge?.metadata.userId).toBe("u1");
    });

    it("returns null on empty chargeId (defensive)", async () => {
      const { fetchCommerceCharge } = await import("@/lib/coinbase-commerce");
      expect(await fetchCommerceCharge("")).toBeNull();
    });
  });
});
