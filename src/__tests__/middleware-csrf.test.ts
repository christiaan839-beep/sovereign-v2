/**
 * Wave-107 — CSRF/origin enforcement tests for src/middleware.ts.
 *
 * Pins the security contract:
 *  - State-changing methods on cookie-authed routes require same-origin
 *  - Webhook + cron routes are excluded (HMAC / CRON_SECRET verify themselves)
 *  - Bearer / x-api-key requests bypass (can't be CSRF'd from a browser)
 *  - Sec-Fetch-Site is the primary signal; Origin is the fallback
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/api-logger", () => ({
  apiLogger: { log: vi.fn() },
}));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return undefined;
    }
  },
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (fn: unknown) => fn,
  createRouteMatcher: () => () => false,
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.NEXT_PUBLIC_APP_URL = "https://app.sovereignmatrix.agency";
  process.env.NODE_ENV = "production";
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function makeReq(opts: {
  method: string;
  pathname: string;
  headers?: Record<string, string>;
}): NextRequest {
  const url = new URL(`https://sovereignmatrix.agency${opts.pathname}`);
  return {
    method: opts.method,
    nextUrl: url,
    headers: {
      get: (k: string) => opts.headers?.[k.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe("enforceCsrfOrigin — wave 107", () => {
  it("allows GET requests (not state-changing)", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({ method: "GET", pathname: "/api/anything" });
    expect(enforceCsrfOrigin(r)).toBeNull();
  });

  it("allows HEAD and OPTIONS (not state-changing)", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    expect(
      enforceCsrfOrigin(makeReq({ method: "HEAD", pathname: "/api/x" })),
    ).toBeNull();
    expect(
      enforceCsrfOrigin(makeReq({ method: "OPTIONS", pathname: "/api/x" })),
    ).toBeNull();
  });

  it("allows EXPLICITLY-ALLOWLISTED webhook routes (HMAC-verified separately)", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const cases = [
      "/api/webhooks/clerk",
      "/api/_webhooks/twilio/voice",
      "/api/_payments/stripe/webhook",
      "/api/_payments/paystack/webhook",
      "/api/_payments/payfast/webhook",
      "/api/payments/stripe/webhook",
    ];
    for (const pathname of cases) {
      const r = makeReq({
        method: "POST",
        pathname,
        headers: { "sec-fetch-site": "cross-site", origin: "https://evil.com" },
      });
      expect(enforceCsrfOrigin(r), `${pathname} should bypass CSRF`).toBeNull();
    }
  });

  it("Wave-107.1 CRITICAL: does NOT bypass cookie-authed routes that merely CONTAIN '/webhook' substring", async () => {
    // The audit caught the substring-match flaw: these routes contain
    // '/webhook' in the path but ARE cookie-authed user-action routes,
    // NOT HMAC-verified inbound webhooks. They MUST still receive
    // CSRF protection or an attacker can CSRF the victim into
    // mutating their webhook config / triggering SSRF via the
    // integrations webhook.
    const { enforceCsrfOrigin } = await import("../middleware");
    const dangerouslyBypassed = [
      "/api/_settings/webhooks",
      "/api/_integrations/webhook",
      "/api/agents/webhook-gateway",
      "/api/some-future/webhook-thing",
    ];
    for (const pathname of dangerouslyBypassed) {
      const r = makeReq({
        method: "POST",
        pathname,
        headers: { "sec-fetch-site": "cross-site" },
      });
      const blocked = enforceCsrfOrigin(r);
      expect(blocked, `${pathname} MUST be CSRF-protected`).not.toBeNull();
      expect(blocked!.status).toBe(403);
    }
  });

  it("allows cron routes (CRON_SECRET-verified separately)", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/cron/audit-retention",
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(enforceCsrfOrigin(r)).toBeNull();
  });

  it("allows Bearer-authed requests with credential-shaped value (≥16 chars)", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/agents/foo",
      headers: {
        authorization: "Bearer sk_live_long_realkey_at_least_16chars",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(enforceCsrfOrigin(r)).toBeNull();
  });

  it("allows x-api-key requests with credential-shaped value", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/agents/foo",
      headers: {
        "x-api-key": "key_abc_at_least_16chars",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(enforceCsrfOrigin(r)).toBeNull();
  });

  it("Wave-107.1 HIGH: does NOT bypass on short/empty bearer values", async () => {
    // Previously `headers.get('x-api-key')` returning any non-empty
    // string disabled the CSRF check. An attacker could set
    // `x-api-key: x` to bypass. Now we require ≥16 chars (real API
    // keys are always longer).
    const { enforceCsrfOrigin } = await import("../middleware");
    const cases = [
      { authorization: "x" },
      { authorization: "Bearer" },
      { authorization: "Bearer x" },
      { "x-api-key": "x" },
      { "x-api-key": "   " },
      { "x-api-key": "shorty" },
    ];
    for (const headers of cases) {
      const r = makeReq({
        method: "POST",
        pathname: "/api/jobs",
        headers: { ...headers, "sec-fetch-site": "cross-site" },
      });
      expect(
        enforceCsrfOrigin(r),
        `${JSON.stringify(headers)} should NOT bypass CSRF`,
      ).not.toBeNull();
    }
  });

  it("allows same-origin POST (Sec-Fetch-Site=same-origin)", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/jobs",
      headers: {
        "sec-fetch-site": "same-origin",
        origin: "https://sovereignmatrix.agency",
      },
    });
    expect(enforceCsrfOrigin(r)).toBeNull();
  });

  it("allows same-site POST", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/jobs",
      headers: { "sec-fetch-site": "same-site" },
    });
    expect(enforceCsrfOrigin(r)).toBeNull();
  });

  it("Wave-107.1: Sec-Fetch-Site=none falls through to Origin allowlist (NOT auto-trusted)", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    // Address-bar / bookmark / extension POST with no Origin → BLOCK.
    // State-changing POSTs from these contexts are rare and suspicious.
    const blocked = enforceCsrfOrigin(
      makeReq({
        method: "POST",
        pathname: "/api/jobs",
        headers: { "sec-fetch-site": "none" },
      }),
    );
    expect(blocked).not.toBeNull();

    // Same scenario but WITH an allowed Origin → ALLOW (legitimate
    // user-initiated POST from a typed URL on our own domain).
    const allowed = enforceCsrfOrigin(
      makeReq({
        method: "POST",
        pathname: "/api/jobs",
        headers: {
          "sec-fetch-site": "none",
          origin: "https://sovereignmatrix.agency",
        },
      }),
    );
    expect(allowed).toBeNull();
  });

  it("BLOCKS cross-site POST (Sec-Fetch-Site=cross-site)", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/jobs",
      headers: {
        "sec-fetch-site": "cross-site",
        origin: "https://evil.com",
      },
    });
    const blocked = enforceCsrfOrigin(r);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(403);
  });

  it("BLOCKS POST with no Sec-Fetch-Site AND no Origin AND no Referer", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({ method: "POST", pathname: "/api/jobs" });
    const blocked = enforceCsrfOrigin(r);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(403);
  });

  it("BLOCKS POST with disallowed Origin (older browser path)", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/jobs",
      headers: { origin: "https://attacker.com" },
    });
    expect(enforceCsrfOrigin(r)).not.toBeNull();
  });

  it("ALLOWS POST with allowed Origin (older browser path)", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/jobs",
      headers: { origin: "https://sovereignmatrix.agency" },
    });
    expect(enforceCsrfOrigin(r)).toBeNull();
  });

  it("ALLOWS POST when only Referer points at allowed origin", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/jobs",
      headers: { referer: "https://sovereignmatrix.agency/dashboard" },
    });
    expect(enforceCsrfOrigin(r)).toBeNull();
  });

  it("BLOCKS POST when Referer points at attacker origin", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/jobs",
      headers: { referer: "https://evil.com/csrf-page" },
    });
    expect(enforceCsrfOrigin(r)).not.toBeNull();
  });

  it("BLOCKS POST with malformed Referer (no positive signal)", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/jobs",
      headers: { referer: "not-a-valid-url" },
    });
    expect(enforceCsrfOrigin(r)).not.toBeNull();
  });

  it("the 403 response carries the X-Sovereign-Reason header for SRE triage", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/jobs",
      headers: { "sec-fetch-site": "cross-site" },
    });
    const blocked = enforceCsrfOrigin(r);
    expect(blocked!.headers.get("x-sovereign-reason")).toBe("csrf-origin");
  });

  it("does NOT leak the specific reason to the response body (only generic 'Forbidden')", async () => {
    const { enforceCsrfOrigin } = await import("../middleware");
    const r = makeReq({
      method: "POST",
      pathname: "/api/jobs",
      headers: { origin: "https://evil-attacker.com" },
    });
    const blocked = await enforceCsrfOrigin(r)!.json();
    expect(blocked.error).toBe("Forbidden");
    expect(JSON.stringify(blocked)).not.toContain("evil-attacker");
  });
});
