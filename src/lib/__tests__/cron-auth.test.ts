/**
 * Tests for src/lib/cron-auth.ts — Cron route authentication
 *
 * Critical defense: all 10 cron routes now use this helper. A regression
 * here would re-open the "Bearer undefined" bypass and fail-open patterns
 * that were the subject of the second security audit.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { requireCronAuth } from "@/lib/cron-auth";

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set("authorization", authHeader);
  return new Request("https://example.com/api/cron/test", {
    method: "GET",
    headers,
  });
}

describe("requireCronAuth", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("accepts a valid Bearer token matching CRON_SECRET", () => {
    process.env.CRON_SECRET = "test_secret_12345";
    const res = requireCronAuth(makeRequest("Bearer test_secret_12345"));
    expect(res).toBeNull();
  });

  it("rejects a wrong Bearer token with 401", async () => {
    process.env.CRON_SECRET = "correct_secret";
    const res = requireCronAuth(makeRequest("Bearer wrong_secret"));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("rejects missing auth header with 401", () => {
    process.env.CRON_SECRET = "secret";
    const res = requireCronAuth(makeRequest());
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  // REGRESSION: the "Bearer undefined" bypass — when CRON_SECRET was unset,
  // naive `auth !== \`Bearer ${secret}\`` became `auth !== "Bearer undefined"`,
  // so an attacker sending literally "Bearer undefined" passed.
  it("REGRESSION: rejects with 503 when CRON_SECRET is unset (not 401 bypass)", () => {
    delete process.env.CRON_SECRET;
    const res = requireCronAuth(makeRequest("Bearer undefined"));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(503);
  });

  it("REGRESSION: rejects with 503 when CRON_SECRET is empty string", () => {
    process.env.CRON_SECRET = "";
    const res = requireCronAuth(makeRequest("Bearer something"));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(503);
  });

  it("REGRESSION: rejects even a matching header when CRON_SECRET is unset", () => {
    // The bypass was triggered specifically by attackers mimicking what
    // string interpolation produces. This asserts that's closed.
    delete process.env.CRON_SECRET;
    const res = requireCronAuth(makeRequest("Bearer "));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(503);
  });

  it("case-sensitive header name — 'Authorization' and 'authorization' both work", () => {
    process.env.CRON_SECRET = "secret_xyz";

    const req1 = new Request("https://example.com/api/cron/test", {
      method: "GET",
      headers: { Authorization: "Bearer secret_xyz" },
    });
    expect(requireCronAuth(req1)).toBeNull();

    const req2 = new Request("https://example.com/api/cron/test", {
      method: "GET",
      headers: { authorization: "Bearer secret_xyz" },
    });
    expect(requireCronAuth(req2)).toBeNull();
  });

  it("rejects Bearer prefix mismatch — 'bearer' lowercase", () => {
    process.env.CRON_SECRET = "secret";
    const res = requireCronAuth(makeRequest("bearer secret"));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("rejects token without Bearer prefix", () => {
    process.env.CRON_SECRET = "secret";
    const res = requireCronAuth(makeRequest("secret"));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });
});
