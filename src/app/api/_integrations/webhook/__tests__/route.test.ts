/**
 * Regression tests for /api/_integrations/webhook (wave 122.4).
 *
 * The route lets an authenticated user fire a webhook to an arbitrary URL.
 * The prior hand-rolled hostname blocklist missed 169.254.169.254 (cloud
 * metadata IMDS), did no DNS resolution (DNS-rebinding bypass), and missed
 * IPv6 loopback — an authenticated SSRF hole. The fix routes the request
 * through outboundFetch (open mode: any public host, but the DNS-resolved
 * SSRF guard always runs). These cases pin that wiring.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextResponse } from "next/server";

// Authenticated caller + lightweight working guard helpers.
vi.mock("@/lib/api-guard", () => ({
  guardRoute: vi.fn(async () => ({
    authorized: true,
    userId: "user_1",
    email: "u@example.com",
  })),
  errorResponse: (message: string, status = 500, code = "INTERNAL_ERROR") =>
    NextResponse.json({ error: message, code }, { status }),
  sanitizeString: (input: unknown, maxLength = 2000) =>
    String(input ?? "").slice(0, maxLength),
  validateRequired: (fields: Record<string, unknown>, required: string[]) => {
    for (const f of required) if (!fields[f]) return `${f} is required`;
    return null;
  },
}));

// Stand-in for the real EgressBlockedError so `instanceof` works in the route.
class FakeEgressBlockedError extends Error {
  violation: { reason: string; message: string };
  url: string;
  constructor(url: string, violation: { reason: string; message: string }) {
    super(violation.message);
    this.name = "EgressBlockedError";
    this.url = url;
    this.violation = violation;
  }
}
const mockOutboundFetch = vi.fn();
vi.mock("@/lib/outbound-fetch", () => ({
  outboundFetch: mockOutboundFetch,
  EgressBlockedError: FakeEgressBlockedError,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/integrations/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("integrations webhook SSRF", () => {
  it("blocks a cloud-metadata address via the SSRF guard (400 SSRF_BLOCKED)", async () => {
    mockOutboundFetch.mockRejectedValueOnce(
      new FakeEgressBlockedError(
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
        { reason: "ssrf-blocked", message: "blocked: link-local" },
      ),
    );
    const { POST } = await import("../route");
    const res = await POST(
      makeReq({
        url: "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("SSRF_BLOCKED");
  });

  it("routes a public-host webhook through outboundFetch in open mode and returns its response", async () => {
    mockOutboundFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      contentType: "application/json",
      body: JSON.stringify({ received: true }),
    });
    const { POST } = await import("../route");
    const res = await POST(
      makeReq({ url: "https://hooks.example.com/abc", body: { a: 1 } }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      success: true,
      status: 200,
      response: { received: true },
    });
    // The SSRF-guarded helper is used, with the arbitrary-public-host mode.
    expect(mockOutboundFetch).toHaveBeenCalledWith(
      "https://hooks.example.com/abc",
      expect.objectContaining({ method: "POST" }),
      expect.objectContaining({
        modeOverride: "open",
        ruleId: "integration.user-webhook",
      }),
    );
  });

  it("rejects a malformed URL with 400 before any egress", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeReq({ url: "not a url" }));
    expect(res.status).toBe(400);
    expect(mockOutboundFetch).not.toHaveBeenCalled();
  });
});
