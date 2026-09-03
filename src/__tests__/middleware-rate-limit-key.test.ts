/**
 * The agent gateway's rate-limit bucket key.
 *
 * `/api/agents/*` fronts every agent in AGENT_REGISTRY, and several of those
 * reach a paid model. The limiter in front of them is therefore the thing
 * standing between an anonymous caller and unmetered spend.
 *
 * It used to bucket on `x-api-key || clientIp`, where the key was
 * `request.headers.get("x-api-key")` with no validation. That makes the
 * limiter opt-out rather than mandatory: send a different random key on each
 * request and every one lands in its own fresh bucket, so the count never
 * reaches the limit. The first test below fails against that implementation.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { rateLimitBucketKey } from "../middleware";

function req(headers: Record<string, string>): NextRequest {
  return new NextRequest("https://example.test/api/agents/smart-router", {
    headers: new Headers(headers),
  });
}

const IP = { "x-forwarded-for": "203.0.113.7" };

describe("the agent gateway's rate-limit bucket", () => {
  it("is the same bucket however the caller varies x-api-key", () => {
    // The bypass, stated directly: rotating an unvalidated header must not
    // move the caller into a new bucket.
    const keys = [
      rateLimitBucketKey(req({ ...IP })),
      rateLimitBucketKey(req({ ...IP, "x-api-key": "sk_aaaaaaaaaaaaaaaaaaaa" })),
      rateLimitBucketKey(req({ ...IP, "x-api-key": "sk_bbbbbbbbbbbbbbbbbbbb" })),
      rateLimitBucketKey(req({ ...IP, "x-api-key": "" })),
      rateLimitBucketKey(req({ ...IP, authorization: "Bearer wharrgarbl" })),
    ];
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("203.0.113.7");
  });

  it("takes the rightmost x-forwarded-for entry, not one the caller prepended", () => {
    // Vercel appends its own value; anything to the left is caller-controlled.
    expect(
      rateLimitBucketKey(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.7" })),
    ).toBe("203.0.113.7");
  });

  it("separates genuinely different clients", () => {
    // Guards the guard: a key that collapsed everything to one constant would
    // pass the first test and rate-limit the whole internet as one caller.
    expect(rateLimitBucketKey(req({ "x-forwarded-for": "203.0.113.7" }))).not.toBe(
      rateLimitBucketKey(req({ "x-forwarded-for": "198.51.100.4" })),
    );
  });

  it("falls back to x-real-ip, then to a single anonymous bucket", () => {
    expect(rateLimitBucketKey(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    // No IP at all is one shared bucket — restrictive, which is the safe
    // direction for an unauthenticated public gateway.
    expect(rateLimitBucketKey(req({}))).toBe("anonymous");
  });
});
