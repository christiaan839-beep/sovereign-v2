/**
 * requireSameOrigin (CSRF gate) — tests.
 *
 * The gate's job is to refuse any non-GET request whose Origin (or
 * Referer fallback) doesn't match the canonical app origin. SameSite=Lax
 * cookies attach to top-level POSTs from cross-site forms, so without
 * this check the platform's mutating endpoints are CSRF-vulnerable.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { requireSameOrigin } from "../auth-guard";

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.sovereignmatrix.agency";
});

afterEach(() => {
  if (ORIGINAL_APP_URL !== undefined) {
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
  } else {
    delete process.env.NEXT_PUBLIC_APP_URL;
  }
});

function makeReq(method: string, headers: Record<string, string> = {}): Request {
  return new Request("https://app.sovereignmatrix.agency/api/x", { method, headers });
}

describe("requireSameOrigin", () => {
  it("returns null (allows) on GET regardless of origin", () => {
    expect(requireSameOrigin(makeReq("GET", { origin: "https://evil.com" }))).toBeNull();
    expect(requireSameOrigin(makeReq("HEAD"))).toBeNull();
    expect(requireSameOrigin(makeReq("OPTIONS"))).toBeNull();
  });

  it("blocks POST with no Origin and no Referer", async () => {
    const res = requireSameOrigin(makeReq("POST"));
    expect(res?.status).toBe(403);
  });

  it("allows POST when Origin matches NEXT_PUBLIC_APP_URL", () => {
    expect(
      requireSameOrigin(makeReq("POST", { origin: "https://app.sovereignmatrix.agency" })),
    ).toBeNull();
  });

  it("blocks POST when Origin is a different origin", () => {
    const res = requireSameOrigin(makeReq("POST", { origin: "https://evil.com" }));
    expect(res?.status).toBe(403);
  });

  it("falls back to Referer when Origin is missing", () => {
    expect(
      requireSameOrigin(
        makeReq("POST", { referer: "https://app.sovereignmatrix.agency/dashboard" }),
      ),
    ).toBeNull();
  });

  it("blocks POST when Referer is from a different origin", () => {
    const res = requireSameOrigin(
      makeReq("POST", { referer: "https://evil.com/csrf" }),
    );
    expect(res?.status).toBe(403);
  });

  it("allows Vercel preview deployments by suffix", () => {
    expect(
      requireSameOrigin(
        makeReq("POST", { origin: "https://feature-branch-abc123.vercel.app" }),
      ),
    ).toBeNull();
  });

  it("allows localhost on dev", () => {
    expect(
      requireSameOrigin(makeReq("POST", { origin: "http://localhost:3000" })),
    ).toBeNull();
    expect(
      requireSameOrigin(makeReq("POST", { origin: "http://127.0.0.1:3000" })),
    ).toBeNull();
  });

  it("blocks all DELETE/PATCH/PUT cross-origin", () => {
    expect(
      requireSameOrigin(makeReq("DELETE", { origin: "https://evil.com" }))?.status,
    ).toBe(403);
    expect(
      requireSameOrigin(makeReq("PATCH", { origin: "https://evil.com" }))?.status,
    ).toBe(403);
    expect(
      requireSameOrigin(makeReq("PUT", { origin: "https://evil.com" }))?.status,
    ).toBe(403);
  });

  it("blocks malformed Origin headers (defense in depth)", () => {
    expect(
      requireSameOrigin(makeReq("POST", { origin: "not-a-url" }))?.status,
    ).toBe(403);
  });
});
