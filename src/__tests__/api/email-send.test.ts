/**
 * Tests for /api/_email/send — provider selection.
 *
 * The Gmail branch uses a lazy `require("nodemailer")` for graceful
 * degradation when the package isn't installed; that hooks line is hard
 * to mock cleanly in vitest, so the Gmail send path is verified manually
 * via the route's integration test instead. These tests pin the parts we
 * can test deterministically: provider selection, request validation, and
 * the Resend success path.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAuth = vi.fn();
const mockRateLimitCheck = vi.fn();
const mockIsAdmin = vi.fn();

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: () => mockAuth(),
}));
vi.mock("@/lib/admin-auth", () => ({
  isAdmin: (id: string) => mockIsAdmin(id),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ check: () => mockRateLimitCheck() }),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/_email/send/route");
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/_email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/_email/send — provider selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user_test" });
    mockIsAdmin.mockReturnValue(true);
    mockRateLimitCheck.mockResolvedValue(null);
    delete process.env.RESEND_API_KEY;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
  });

  it("uses Resend when RESEND_API_KEY is set", async () => {
    process.env.RESEND_API_KEY = "re_fake";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "msg_resend_123" }),
    });

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ to: "x@y.com", subject: "Hi", html: "<p>hi</p>" }),
    );
    const json = (await res.json()) as { provider: string; messageId: string };
    expect(res.status).toBe(200);
    expect(json.provider).toBe("resend");
    expect(json.messageId).toBe("msg_resend_123");
  });

  it("falls back to console mode when no providers are configured", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ to: "x@y.com", subject: "Hi", html: "<p>hi</p>" }),
    );
    const json = (await res.json()) as { provider: string };
    expect(res.status).toBe(200);
    expect(json.provider).toBe("console");
  });

  it("rejects requests missing required fields", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ to: "x@y.com" }));
    expect(res.status).toBe(400);
  });

  it("returns a generic error (no SMTP details) when Resend fails", async () => {
    process.env.RESEND_API_KEY = "re_fake";
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: "Invalid sender domain" }),
    });

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ to: "x@y.com", subject: "Hi", html: "<p>hi</p>" }),
    );
    const json = (await res.json()) as { success: boolean; error: string };
    expect(json.success).toBe(false);
    // The verbatim provider error must NOT leak to clients.
    expect(json.error).not.toMatch(/Invalid sender domain/);
    expect(json.error).toMatch(/delivery failed/i);
  });

  it("returns 404 to non-admin callers (gate against authenticated spam)", async () => {
    mockIsAdmin.mockReturnValue(false);
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ to: "x@y.com", subject: "Hi", html: "<p>hi</p>" }),
    );
    expect(res.status).toBe(404);
  });
});
