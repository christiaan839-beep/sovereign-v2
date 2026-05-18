/**
 * Tests for /api/security/login-event — Wave 27 anomalous-login wire-up.
 *
 * Verifies the Clerk-webhook-callable contract: auth gate, scorer
 * invocation, audit emission, and event-bus publish only on
 * medium/high/critical risk bands.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit-log", () => ({ auditLog: mockAuditLog }));

const mockPublishAnomalyFlagged = vi.fn();
vi.mock("@/lib/event-bus", () => ({
  publishAnomalyFlagged: mockPublishAnomalyFlagged,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ check: vi.fn().mockResolvedValue(null) }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
});

function req(body: Record<string, unknown>, withSecret = true) {
  const headers = new Headers({ "content-type": "application/json" });
  if (withSecret) headers.set("x-cron-secret", "test-cron-secret");
  return new Request("http://localhost/api/security/login-event", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("/api/security/login-event", () => {
  it("rejects requests without the cron secret header", async () => {
    const { POST } = await import("@/app/api/security/login-event/route");
    const r = await POST(req({ userId: "u_anon" }, false));
    expect(r.status).toBe(401);
  });

  it("rejects malformed body", async () => {
    const { POST } = await import("@/app/api/security/login-event/route");
    const r = await POST(req({} as Record<string, unknown>));
    expect(r.status).toBe(400);
  });

  it("returns an 'ok' verdict + audits on a clean first login", async () => {
    const { POST } = await import("@/app/api/security/login-event/route");
    const r = await POST(
      req({
        userId: "u_first_login_test",
        country: "ZA",
        ip: "41.207.1.2",
        userAgent: "Mozilla/5.0",
        deviceFingerprint: "abcd-1234",
      }),
    );
    expect(r.status).toBe(200);
    const v = (await r.json()) as { riskBand: string };
    // first-login is a 20-point signal (low band); medium kicks in at 41.
    expect(["ok", "low", "medium"]).toContain(v.riskBand);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u_first_login_test",
        action: "user.login",
      }),
    );
  });

  it("does NOT publish anomaly event for 'ok' or 'low' risk bands", async () => {
    const { POST } = await import("@/app/api/security/login-event/route");
    // Seed history with a normal login so subsequent same-device login
    // produces an "ok" band.
    const seed = {
      userId: "u_low_band",
      country: "ZA",
      ip: "1.2.3.4",
      userAgent: "ua1",
      deviceFingerprint: "fp1",
    };
    await POST(req(seed));
    mockPublishAnomalyFlagged.mockClear();
    // Repeat the same login — should be "ok".
    const r = await POST(req(seed));
    expect(r.status).toBe(200);
    const v = (await r.json()) as { riskBand: string };
    expect(["ok", "low"]).toContain(v.riskBand);
    expect(mockPublishAnomalyFlagged).not.toHaveBeenCalled();
  });

  it("publishes anomaly event on a high-risk band (new country + new device)", async () => {
    const { POST } = await import("@/app/api/security/login-event/route");
    // Seed: ZA login.
    await POST(
      req({
        userId: "u_high_band",
        country: "ZA",
        ip: "1.2.3.4",
        userAgent: "ua1",
        deviceFingerprint: "fp1",
      }),
    );
    mockPublishAnomalyFlagged.mockClear();
    // Suspicious: different country AND different device.
    const r = await POST(
      req({
        userId: "u_high_band",
        country: "RU",
        ip: "9.9.9.9",
        userAgent: "ua2",
        deviceFingerprint: "fp2",
      }),
    );
    expect(r.status).toBe(200);
    const v = (await r.json()) as {
      riskBand: string;
      recommendation: string;
    };
    expect(["medium", "high", "critical"]).toContain(v.riskBand);
    // event-bus publish fires for medium+.
    expect(mockPublishAnomalyFlagged).toHaveBeenCalledWith(
      "*",
      expect.objectContaining({
        userId: "u_high_band",
        riskBand: v.riskBand,
        recommendation: v.recommendation,
      }),
    );
  });

  it("hashes the user-agent string (never echoes raw UA in storage)", async () => {
    const { POST } = await import("@/app/api/security/login-event/route");
    await POST(
      req({
        userId: "u_hash_test",
        country: "ZA",
        userAgent: "very-specific-user-agent-string",
        deviceFingerprint: "fp-x",
      }),
    );
    // Asserted indirectly: audit-log details payload must NOT include
    // the raw userAgent string (only the verdict).
    const call = mockAuditLog.mock.calls.find(
      ([arg]) => arg.userId === "u_hash_test",
    );
    expect(call).toBeDefined();
    const details = call![0].details as Record<string, unknown>;
    expect(JSON.stringify(details)).not.toContain(
      "very-specific-user-agent-string",
    );
  });
});
