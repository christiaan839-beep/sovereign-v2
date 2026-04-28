/**
 * POST /api/credits — admin-gated credit grants.
 *
 * The route was previously a free-money exploit: any authenticated user
 * could call `{ type: "bonus", amountCents: 100000 }` and receive $1000
 * in credits. The fix put `requireAdmin()` in front of bonus + referral
 * grants and made `purchase` return 501 until Stripe verification is
 * wired. These tests prove each branch of the new gate.
 *
 * Also verifies that every successful grant emits an audit_log row so
 * the SHA-256 hash chain captures who-granted-what-to-whom.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRequireAuth,
  mockRequireAdmin,
  mockAddCredits,
  mockAuditLog,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireAdmin: vi.fn(),
  mockAddCredits: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: mockRequireAuth,
  // Round 25 — credits POST gained a CSRF gate via requireSameOrigin.
  // The test's Request objects don't carry an Origin header so the
  // gate would 403 every test. Mock as a no-op (tests assert auth +
  // role logic, not CSRF — that has dedicated tests in
  // auth-guard-csrf.test.ts).
  requireSameOrigin: () => null,
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/a2e", () => ({
  addCredits: mockAddCredits,
  getCreditBalance: vi.fn(),
  getCreditHistory: vi.fn(),
}));
vi.mock("@/lib/audit-log", () => ({ auditLog: mockAuditLog }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { POST } from "@/app/api/credits/route";

function makeReq(body: unknown): Request {
  return new Request("https://example.test/api/credits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockRequireAdmin.mockReset();
  mockAddCredits.mockReset();
  mockAuditLog.mockReset();
  // Default: caller is signed in as a normal user
  mockRequireAuth.mockResolvedValue({ userId: "user_normal", email: "u@example.com" });
});

describe("POST /api/credits — auth + scope", () => {
  it("blocks unauthenticated callers (requireAuth returns 401)", async () => {
    const errResp = new Response(JSON.stringify({ error: "auth required" }), {
      status: 401,
    });
    mockRequireAuth.mockResolvedValueOnce({ error: errResp });

    const res = await POST(makeReq({ amountCents: 1000, type: "bonus" }));
    expect(res.status).toBe(401);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("rejects type='purchase' with 501 (Stripe verification not yet wired)", async () => {
    // Even an admin can't bypass — purchase requires a real PaymentIntent.
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1", admin: true });

    const res = await POST(makeReq({ amountCents: 5000, type: "purchase" }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.code).toBe("purchase_not_implemented");
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("rejects type='bonus' from a non-admin (requireAdmin returns 404 Response)", async () => {
    // requireAdmin's design: it returns a Response (401 / 404) for non-admins
    // so the endpoint stays opaque to enumeration. The route must propagate
    // that Response, NOT call addCredits.
    const denied = new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
    mockRequireAdmin.mockResolvedValueOnce(denied);

    const res = await POST(makeReq({ amountCents: 100000, type: "bonus" }));
    expect(res.status).toBe(404);
    expect(mockAddCredits).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("rejects type='referral' from a non-admin", async () => {
    const denied = new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
    mockRequireAdmin.mockResolvedValueOnce(denied);

    const res = await POST(makeReq({ amountCents: 500, type: "referral" }));
    expect(res.status).toBe(404);
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("admin grants type='bonus' to themselves by default", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1", admin: true });
    mockAddCredits.mockResolvedValue({ balanceCents: 5000 });

    const res = await POST(makeReq({ amountCents: 5000, type: "bonus" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.added).toBe(5000);
    expect(body.recipient).toBe("user_normal"); // caller userId, not admin since requireAuth happens first
    expect(mockAddCredits).toHaveBeenCalledTimes(1);
  });

  it("admin grants type='bonus' to a specific targetUserId", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1", admin: true });
    mockAddCredits.mockResolvedValue({ balanceCents: 12000 });

    const res = await POST(
      makeReq({
        amountCents: 12000,
        type: "bonus",
        targetUserId: "customer_42",
        description: "December welcome credit",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipient).toBe("customer_42");
    expect(mockAddCredits).toHaveBeenCalledWith(
      "customer_42",
      12000,
      "bonus",
      "December welcome credit",
    );
  });

  it("emits an audit_log row for every successful grant (SOC-2 hash chain)", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1", admin: true });
    mockAddCredits.mockResolvedValue({ balanceCents: 999 });

    await POST(
      makeReq({
        amountCents: 999,
        type: "referral",
        targetUserId: "ref_recipient",
      }),
    );
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    const auditCall = mockAuditLog.mock.calls[0][0];
    expect(auditCall.userId).toBe("user_normal"); // actor
    expect(auditCall.action).toBe("subscription.change");
    expect(auditCall.resource).toBe("credits");
    expect(auditCall.details).toMatchObject({
      kind: "admin_grant",
      type: "referral",
      amountCents: 999,
      recipientUserId: "ref_recipient",
    });
  });

  it("rejects malformed JSON body with 400", async () => {
    const req = new Request("https://example.test/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("rejects amounts above the $1000 cap (Zod schema)", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1", admin: true });

    const res = await POST(makeReq({ amountCents: 999_999, type: "bonus" }));
    expect(res.status).toBe(400);
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("rejects unknown type values", async () => {
    const res = await POST(
      makeReq({ amountCents: 100, type: "free_money_pls" }),
    );
    expect(res.status).toBe(400);
    expect(mockAddCredits).not.toHaveBeenCalled();
  });
});
