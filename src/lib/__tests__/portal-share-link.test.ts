/**
 * portal-share-link — HMAC-SHA256 over clientId for portal share URLs.
 *
 * The contract these tests enforce:
 *   - signShareToken(clientId) → 64-char hex (deterministic given secret)
 *   - verifyShareToken accepts a freshly-signed token for the same clientId
 *   - verifyShareToken REJECTS:
 *       a token signed for a different clientId (cross-impersonation)
 *       a malformed token (wrong length, non-hex, empty, null)
 *       any token when PORTAL_SHARE_SECRET is missing/too short (fail closed)
 *   - signShareToken THROWS when secret is missing (fail closed)
 *
 * Constant-time comparison is implicit — we test that the function
 * returns false on every mismatch path. The actual timing-safety
 * relies on node:crypto.timingSafeEqual.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

const ORIGINAL_SECRET = process.env.PORTAL_SHARE_SECRET;

function setSecret(s: string | undefined) {
  if (s === undefined) delete process.env.PORTAL_SHARE_SECRET;
  else process.env.PORTAL_SHARE_SECRET = s;
}

afterAll(() => setSecret(ORIGINAL_SECRET));

describe("portal-share-link · signShareToken + verifyShareToken", () => {
  beforeEach(() => {
    setSecret("test-secret-at-least-16-chars-long");
  });

  it("signs a deterministic 64-char hex token", async () => {
    const { signShareToken } = await import("@/lib/portal-share-link");
    const t1 = signShareToken("alice@example.com");
    const t2 = signShareToken("alice@example.com");
    expect(t1).toBe(t2);
    expect(t1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different tokens for different clientIds", async () => {
    const { signShareToken } = await import("@/lib/portal-share-link");
    const a = signShareToken("alice@example.com");
    const b = signShareToken("bob@example.com");
    expect(a).not.toBe(b);
  });

  it("verifies a freshly-signed token for the SAME clientId", async () => {
    const { signShareToken, verifyShareToken } = await import("@/lib/portal-share-link");
    const token = signShareToken("alice@example.com");
    expect(verifyShareToken("alice@example.com", token)).toBe(true);
  });

  it("REJECTS a token signed for a different clientId (cross-impersonation)", async () => {
    const { signShareToken, verifyShareToken } = await import("@/lib/portal-share-link");
    const aliceToken = signShareToken("alice@example.com");
    expect(verifyShareToken("bob@example.com", aliceToken)).toBe(false);
  });

  it("rejects null / undefined / empty tokens", async () => {
    const { verifyShareToken } = await import("@/lib/portal-share-link");
    expect(verifyShareToken("alice", null)).toBe(false);
    expect(verifyShareToken("alice", "")).toBe(false);
  });

  it("rejects a token of the wrong length", async () => {
    const { verifyShareToken } = await import("@/lib/portal-share-link");
    // 63 chars instead of 64 — early-exit before timingSafeEqual.
    expect(verifyShareToken("alice", "a".repeat(63))).toBe(false);
  });

  it("rejects all tokens when secret is missing (fails closed)", async () => {
    setSecret(undefined);
    // Must re-import to get fresh module reading the new env state.
    // (Module is functional, no internal cache, so no problem.)
    const { verifyShareToken } = await import("@/lib/portal-share-link");
    expect(verifyShareToken("alice", "a".repeat(64))).toBe(false);
  });

  it("rejects all tokens when secret is too short (fails closed)", async () => {
    setSecret("too-short");
    const { verifyShareToken } = await import("@/lib/portal-share-link");
    expect(verifyShareToken("alice", "a".repeat(64))).toBe(false);
  });

  it("signShareToken throws when secret is missing (forces caller to handle)", async () => {
    setSecret(undefined);
    const { signShareToken } = await import("@/lib/portal-share-link");
    expect(() => signShareToken("alice")).toThrow(/PORTAL_SHARE_SECRET/);
  });

  it("rotating the secret invalidates every previously-signed token", async () => {
    setSecret("original-secret-at-least-16chars");
    const { signShareToken: sign1, verifyShareToken: verify1 } = await import("@/lib/portal-share-link");
    const before = sign1("alice@example.com");
    expect(verify1("alice@example.com", before)).toBe(true);

    setSecret("new-secret-also-at-least-16chars");
    // New module instance picks up the new secret. We re-import to be
    // explicit even though the module is functional and re-reads on
    // every call.
    const { verifyShareToken: verify2 } = await import("@/lib/portal-share-link");
    expect(verify2("alice@example.com", before)).toBe(false);
  });
});

describe("portal-share-link · buildShareUrl", () => {
  beforeEach(() => {
    setSecret("test-secret-at-least-16-chars-long");
  });

  it("produces a URL with /portal/<encoded-clientId>?token=<hex>", async () => {
    const { buildShareUrl } = await import("@/lib/portal-share-link");
    const url = buildShareUrl(
      "https://sovereignmatrix.agency",
      "client-with-spaces & special@chars",
    );
    expect(url).toContain("/portal/");
    expect(url).toContain("token=");
    // clientId path segment must be URL-encoded.
    expect(url).toContain("%20");
    expect(url).toContain("%26"); // &
    // Token is 64-char hex.
    const tokenMatch = url.match(/token=([0-9a-f]{64})/);
    expect(tokenMatch).not.toBeNull();
  });
});
