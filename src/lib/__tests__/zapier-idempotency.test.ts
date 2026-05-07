/**
 * Zapier idempotency-key derivation tests.
 *
 * Pins the contract that powers webhook coverage row 11/11:
 *
 *   - Header path wins over body-hash when both are present
 *   - Header path is trimmed + length-capped (no 4 KB key blowup)
 *   - Body-hash is stable for the same (userId, body) pair
 *   - Body-hash is namespaced by userId (no cross-tenant collision)
 *   - Anonymous request with no header returns null (caller skips dedup)
 */

import { describe, it, expect } from "vitest";
import { computeZapierIdemKey } from "../zapier-idempotency";

function headerBag(record: Record<string, string>) {
  return (name: string) => {
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(record)) {
      if (k.toLowerCase() === lower) return v;
    }
    return null;
  };
}

describe("zapier-idempotency: header path", () => {
  it("returns the trimmed header when set", () => {
    const key = computeZapierIdemKey({
      getHeader: headerBag({ "Idempotency-Key": "  zap_step_42  " }),
      rawBody: '{"agent":"leads"}',
      userId: "user_A",
    });
    expect(key).toBe("zap_step_42");
  });

  it("header wins over body-hash when both possible", () => {
    const headerKey = computeZapierIdemKey({
      getHeader: headerBag({ "Idempotency-Key": "explicit-key" }),
      rawBody: '{"agent":"leads"}',
      userId: "user_A",
    });
    const bodyKey = computeZapierIdemKey({
      getHeader: headerBag({}),
      rawBody: '{"agent":"leads"}',
      userId: "user_A",
    });
    expect(headerKey).toBe("explicit-key");
    expect(bodyKey).not.toBe("explicit-key");
  });

  it("caps header keys at 200 chars", () => {
    const longKey = "x".repeat(400);
    const key = computeZapierIdemKey({
      getHeader: headerBag({ "Idempotency-Key": longKey }),
      rawBody: "",
      userId: "user_A",
    });
    expect(key).not.toBeNull();
    expect(key!.length).toBe(200);
  });

  it("ignores empty / whitespace headers and falls through", () => {
    const empty = computeZapierIdemKey({
      getHeader: headerBag({ "Idempotency-Key": "   " }),
      rawBody: "body",
      userId: "user_A",
    });
    expect(empty).not.toBe("");
    expect(empty!.length).toBe(64); // SHA-256 hex
  });
});

describe("zapier-idempotency: body-hash fallback", () => {
  it("is stable for the same (userId, body) input", () => {
    const a = computeZapierIdemKey({
      getHeader: headerBag({}),
      rawBody: '{"agent":"leads","params":{"x":1}}',
      userId: "user_A",
    });
    const b = computeZapierIdemKey({
      getHeader: headerBag({}),
      rawBody: '{"agent":"leads","params":{"x":1}}',
      userId: "user_A",
    });
    expect(a).toBe(b);
  });

  it("is scoped by userId — same body, different users do NOT collide", () => {
    const userA = computeZapierIdemKey({
      getHeader: headerBag({}),
      rawBody: '{"agent":"leads"}',
      userId: "user_A",
    });
    const userB = computeZapierIdemKey({
      getHeader: headerBag({}),
      rawBody: '{"agent":"leads"}',
      userId: "user_B",
    });
    expect(userA).not.toBeNull();
    expect(userB).not.toBeNull();
    expect(userA).not.toBe(userB);
  });

  it("differs when body differs (same user)", () => {
    const a = computeZapierIdemKey({
      getHeader: headerBag({}),
      rawBody: '{"agent":"leads","params":{"x":1}}',
      userId: "user_A",
    });
    const b = computeZapierIdemKey({
      getHeader: headerBag({}),
      rawBody: '{"agent":"leads","params":{"x":2}}',
      userId: "user_A",
    });
    expect(a).not.toBe(b);
  });

  it("returns null when no header AND no userId (anonymous)", () => {
    const k = computeZapierIdemKey({
      getHeader: headerBag({}),
      rawBody: "body",
      userId: undefined,
    });
    expect(k).toBeNull();
  });

  it("returns the SHA-256 hex (64 chars) for the body-hash path", () => {
    const k = computeZapierIdemKey({
      getHeader: headerBag({}),
      rawBody: '{"agent":"leads"}',
      userId: "user_A",
    });
    expect(k).not.toBeNull();
    expect(k!.length).toBe(64);
    expect(k).toMatch(/^[a-f0-9]{64}$/);
  });
});
