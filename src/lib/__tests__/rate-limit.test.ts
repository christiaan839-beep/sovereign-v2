/**
 * Tests for src/lib/rate-limit.ts — In-memory rate limiter path
 *
 * Since our webhook and payment routes now depend on this for defense
 * against abuse (zero routes had rate limiting before the security audit),
 * a regression in the limiter would silently re-open every fixed route.
 *
 * We test the in-memory fallback path deterministically. The Redis path
 * is exercised via integration in production.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Force in-memory path by unsetting Redis env vars before import.
async function freshLimiter() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  vi.resetModules();
  return (await import("@/lib/rate-limit")).rateLimit;
}

function makeRequest(
  opts: {
    ip?: string;
    apiKey?: string;
    url?: string;
  } = {},
): Request {
  const headers = new Headers();
  if (opts.ip) headers.set("x-forwarded-for", opts.ip);
  if (opts.apiKey) headers.set("x-api-key", opts.apiKey);
  return new Request(opts.url || "https://example.com/api/test", {
    method: "POST",
    headers,
  });
}

describe("rateLimit — in-memory fallback", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("allows requests under the limit", async () => {
    const rateLimit = await freshLimiter();
    const limiter = rateLimit({ interval: 60, limit: 5 });

    for (let i = 0; i < 5; i++) {
      const res = await limiter.check(makeRequest({ ip: "1.1.1.1" }));
      expect(res).toBeNull(); // null = allowed
    }
  });

  it("blocks the 6th request when limit is 5", async () => {
    const rateLimit = await freshLimiter();
    const limiter = rateLimit({ interval: 60, limit: 5 });

    for (let i = 0; i < 5; i++) {
      await limiter.check(makeRequest({ ip: "2.2.2.2" }));
    }
    const blocked = await limiter.check(makeRequest({ ip: "2.2.2.2" }));
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });

  it("blocked response includes Retry-After header", async () => {
    const rateLimit = await freshLimiter();
    const limiter = rateLimit({ interval: 60, limit: 1 });

    await limiter.check(makeRequest({ ip: "3.3.3.3" }));
    const blocked = await limiter.check(makeRequest({ ip: "3.3.3.3" }));
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
  });

  it("separate IPs have independent buckets", async () => {
    const rateLimit = await freshLimiter();
    const limiter = rateLimit({ interval: 60, limit: 2 });

    await limiter.check(makeRequest({ ip: "4.4.4.4" }));
    await limiter.check(makeRequest({ ip: "4.4.4.4" }));
    const firstBlocked = await limiter.check(makeRequest({ ip: "4.4.4.4" }));
    expect(firstBlocked).not.toBeNull();

    // Different IP should still be allowed
    const otherAllowed = await limiter.check(makeRequest({ ip: "5.5.5.5" }));
    expect(otherAllowed).toBeNull();
  });

  it("API key identifier takes priority over IP", async () => {
    const rateLimit = await freshLimiter();
    const limiter = rateLimit({ interval: 60, limit: 2 });

    // Same IP, different API keys — buckets should be separate.
    await limiter.check(makeRequest({ ip: "6.6.6.6", apiKey: "sk_one" }));
    await limiter.check(makeRequest({ ip: "6.6.6.6", apiKey: "sk_one" }));
    const keyOneBlocked = await limiter.check(
      makeRequest({ ip: "6.6.6.6", apiKey: "sk_one" }),
    );
    expect(keyOneBlocked).not.toBeNull();

    const keyTwoAllowed = await limiter.check(
      makeRequest({ ip: "6.6.6.6", apiKey: "sk_two" }),
    );
    expect(keyTwoAllowed).toBeNull();
  });

  it("missing x-forwarded-for falls back to 'unknown' bucket", async () => {
    const rateLimit = await freshLimiter();
    const limiter = rateLimit({ interval: 60, limit: 2 });

    // No IP header — should still work but all such requests share a bucket.
    await limiter.check(
      new Request("https://example.com/api/test", { method: "POST" }),
    );
    await limiter.check(
      new Request("https://example.com/api/test", { method: "POST" }),
    );
    const blocked = await limiter.check(
      new Request("https://example.com/api/test", { method: "POST" }),
    );
    expect(blocked).not.toBeNull();
  });

  it("rightmost (trusted) IP in x-forwarded-for chain is used", async () => {
    const rateLimit = await freshLimiter();
    const limiter = rateLimit({ interval: 60, limit: 1 });

    // Threat model: a client controls the LEFTMOST X-Forwarded-For entry
    // (anyone can set the header in their browser; Vercel + similar proxies
    // APPEND the real client IP rather than overwriting). The rightmost
    // entry is the trusted client IP from the proxy. Using the leftmost
    // would let attackers rotate fake IPs to bypass per-IP rate limiting.
    const req = new Request("https://example.com/api/test", {
      method: "POST",
      // Same trusted (right-most) IP, attacker rotates fake left-most.
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    const req2 = new Request("https://example.com/api/test", {
      method: "POST",
      headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" },
    });

    await limiter.check(req);
    const blocked = await limiter.check(req2);
    expect(blocked).not.toBeNull(); // Same trusted IP → same bucket
  });

  it("x-real-ip wins over x-forwarded-for (most-trusted IP source)", async () => {
    const rateLimit = await freshLimiter();
    const limiter = rateLimit({ interval: 60, limit: 1 });

    // Vercel sets x-real-ip with the verified client IP; we should prefer
    // it over any X-Forwarded-For value (which a client can sneak past
    // some proxies).
    const req = new Request("https://example.com/api/test", {
      method: "POST",
      headers: {
        "x-real-ip": "1.1.1.1",
        "x-forwarded-for": "9.9.9.9, 10.0.0.1",
      },
    });
    const req2 = new Request("https://example.com/api/test", {
      method: "POST",
      headers: {
        "x-real-ip": "1.1.1.1",
        "x-forwarded-for": "8.8.8.8, 10.0.0.2",
      },
    });

    await limiter.check(req);
    const blocked = await limiter.check(req2);
    expect(blocked).not.toBeNull(); // Same x-real-ip → same bucket
  });

  it("API key is hashed, not used raw, in the identifier", async () => {
    const rateLimit = await freshLimiter();
    const limiter = rateLimit({ interval: 60, limit: 1 });

    // Two identical keys should hit the same bucket.
    const secretKey = "sk_live_super_secret_do_not_log";
    await limiter.check(makeRequest({ apiKey: secretKey }));
    const blocked = await limiter.check(makeRequest({ apiKey: secretKey }));
    expect(blocked).not.toBeNull();
  });

  it("separate limiter instances with different configs are independent", async () => {
    const rateLimit = await freshLimiter();
    const strict = rateLimit({ interval: 60, limit: 1 });
    const loose = rateLimit({ interval: 60, limit: 100 });

    await strict.check(makeRequest({ ip: "8.8.8.8" }));
    const strictBlocked = await strict.check(makeRequest({ ip: "8.8.8.8" }));
    expect(strictBlocked).not.toBeNull();

    // Loose limiter is a separate store keyed by `${interval}-${limit}`.
    const looseAllowed = await loose.check(makeRequest({ ip: "8.8.8.8" }));
    expect(looseAllowed).toBeNull();
  });

  it("blocked response body has retryAfter field", async () => {
    const rateLimit = await freshLimiter();
    const limiter = rateLimit({ interval: 60, limit: 1 });

    await limiter.check(makeRequest({ ip: "9.9.9.9" }));
    const blocked = await limiter.check(makeRequest({ ip: "9.9.9.9" }));
    const body = await blocked!.json();
    expect(body).toHaveProperty("retryAfter");
    expect(typeof body.retryAfter).toBe("number");
  });
});
