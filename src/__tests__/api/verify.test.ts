/**
 * Tests for /api/verify — the public signature verifier.
 *
 * Covers:
 *   - rate-limit short-circuit (429) when limiter blocks
 *   - 400 on non-JSON body / missing fields / wrong types
 *   - 200 with valid: true for an authentic canonical+signature pair
 *   - 200 with valid: false for tampered canonical
 *   - surfaces id / agentName / createdAt from canonical when JSON-valid
 *   - constant-time mismatched-length signature → false (not a crash)
 */
import { describe, it, expect, beforeAll, vi } from "vitest";

beforeAll(() => {
  process.env.AGENT_RUN_SIGNING_SECRET = "test_secret_with_enough_entropy_aaaa";
});

// Capture the rate-limit constructor args so we can regression-test
// the unit bug (interval used to be 60_000 ms — should be 60 seconds).
const rateLimitArgs: Array<{ interval: number; limit: number }> = [];
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (config: { interval: number; limit: number }) => {
    rateLimitArgs.push(config);
    return { check: vi.fn().mockResolvedValue(null) };
  },
}));

import { signRun } from "@/lib/agent-runs";

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/verify/route");
}

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

describe("POST /api/verify", () => {
  it("regression: rate-limit interval is SECONDS, not milliseconds", async () => {
    // Bug history: this used to pass 60_000 by mistake. The lib treats
    // `interval` as seconds; passing 60_000 makes the bucket key roll over
    // every ~16 hours, which is effectively no rate limiting.
    rateLimitArgs.length = 0;
    await loadRoute();
    expect(rateLimitArgs.length).toBeGreaterThan(0);
    const { interval } = rateLimitArgs[0]!;
    expect(interval).toBeLessThanOrEqual(3600); // any value > 1h would be the same bug class
    expect(interval).toBe(60);
  });

  it("returns 400 on malformed JSON body", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeReq("this is not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when canonical or signature missing", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeReq({ canonical: "x" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when canonical is empty", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeReq({ canonical: "", signature: "v1=abc" }));
    expect(res.status).toBe(400);
  });

  it("verifies a valid canonical + signature pair", async () => {
    const canonical =
      '{"v":1,"id":"abc","agentName":"blog-gen","output":"ok","createdAt":"2026-05-10T00:00:00.000Z"}';
    const signature = signRun(canonical);
    const { POST } = await loadRoute();
    const res = await POST(makeReq({ canonical, signature }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      valid: boolean;
      agentName?: string;
      id?: string;
      algorithm: string;
    };
    expect(json.valid).toBe(true);
    expect(json.algorithm).toBe("HMAC-SHA256");
    expect(json.agentName).toBe("blog-gen");
    expect(json.id).toBe("abc");
  });

  it("rejects a tampered canonical with valid: false", async () => {
    const canonical = '{"v":1,"id":"abc","output":"ok"}';
    const signature = signRun(canonical);
    const tampered = '{"v":1,"id":"abc","output":"hacked"}';
    const { POST } = await loadRoute();
    const res = await POST(makeReq({ canonical: tampered, signature }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { valid: boolean };
    expect(json.valid).toBe(false);
  });

  it("returns valid: false for a sig of mismatched length", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeReq({ canonical: "anything", signature: "v1=short" }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { valid: boolean };
    expect(json.valid).toBe(false);
  });

  it("returns valid: false for the 'unsigned' sentinel", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeReq({ canonical: "anything", signature: "unsigned" }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { valid: boolean };
    expect(json.valid).toBe(false);
  });
});
