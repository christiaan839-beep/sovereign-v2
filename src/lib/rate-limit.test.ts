import { describe, it, expect } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("creates a limiter with check method", () => {
    const limiter = rateLimit({ interval: 60, limit: 10 });
    expect(limiter.check).toBeDefined();
    expect(typeof limiter.check).toBe("function");
  });

  it("allows requests under the limit", async () => {
    const limiter = rateLimit({ interval: 60, limit: 10 });
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": `rate-test-allow-${Date.now()}` },
    });
    const result = await limiter.check(req);
    expect(result).toBeNull();
  });

  it("blocks requests over the limit", async () => {
    const ip = `rate-test-block-${Date.now()}`;
    const limiter = rateLimit({ interval: 60, limit: 3 });
    const makeReq = () =>
      new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": ip },
      });

    // Exhaust limit
    for (let i = 0; i < 3; i++) {
      await limiter.check(makeReq());
    }

    // Next should be blocked
    const result = await limiter.check(makeReq());
    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
  });

  it("returns proper 429 response body", async () => {
    const ip = `rate-test-body-${Date.now()}`;
    const limiter = rateLimit({ interval: 60, limit: 1 });
    const makeReq = () =>
      new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": ip },
      });

    await limiter.check(makeReq()); // Use up the limit
    const result = await limiter.check(makeReq());
    expect(result).not.toBeNull();

    const body = await result!.json();
    expect(body.error).toContain("Rate limit");
    expect(body.retryAfter).toBeDefined();
  });

  it("identifies clients by API key when present", async () => {
    const limiter = rateLimit({ interval: 60, limit: 2 });
    const makeReq = (key: string) =>
      new Request("http://localhost/api/test", {
        headers: { "x-api-key": key, "x-forwarded-for": "same-ip" },
      });

    // Different API keys should have separate limits
    await limiter.check(makeReq("key-aaa-111"));
    await limiter.check(makeReq("key-aaa-111"));
    const blocked = await limiter.check(makeReq("key-aaa-111"));
    const allowed = await limiter.check(makeReq("key-bbb-222"));

    expect(blocked).not.toBeNull();
    expect(allowed).toBeNull();
  });
});
