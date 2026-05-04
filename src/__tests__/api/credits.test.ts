/**
 * Tests for /api/credits POST — Stripe payment intent verification gate.
 *
 * Covers the security-critical branching:
 *   - purchase requires paymentIntentId
 *   - intent must succeed
 *   - intent.metadata.userId must match caller
 *   - intent.amount must equal requested credit amount
 *   - replays are blocked via idempotency
 *   - bonus / referral are admin-only
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Module mocks ─────────────────────────────────────────────────────────

const mockAuth = vi.fn();
const mockGetStripe = vi.fn();
const mockIsAdmin = vi.fn();
const mockAlreadyProcessed = vi.fn();
const mockAddCredits = vi.fn();
const mockAuditLog = vi.fn();

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: () => mockAuth(),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => mockGetStripe(),
}));
vi.mock("@/lib/admin-auth", () => ({
  isAdmin: (id: string) => mockIsAdmin(id),
}));
vi.mock("@/lib/idempotency", () => ({
  alreadyProcessed: (...args: unknown[]) => mockAlreadyProcessed(...args),
}));
vi.mock("@/lib/a2e", () => ({
  addCredits: (...args: unknown[]) => mockAddCredits(...args),
  getCreditBalance: vi.fn(),
  getCreditHistory: vi.fn(),
}));
vi.mock("@/lib/audit-log", () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/credits/route");
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/credits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("POST /api/credits — purchase verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user_test_123" });
    mockAlreadyProcessed.mockResolvedValue(false);
    mockAddCredits.mockResolvedValue({
      userId: "user_test_123",
      balanceCents: 1000,
      lifetimeEarned: 1000,
      lifetimeSpent: 0,
    });
    mockIsAdmin.mockReturnValue(false);
  });

  it("rejects purchase without paymentIntentId", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ amountCents: 1000, type: "purchase" }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/paymentIntentId/i);
  });

  it("returns 503 when Stripe is not configured", async () => {
    mockGetStripe.mockReturnValue(null);
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        amountCents: 1000,
        type: "purchase",
        paymentIntentId: "pi_abc",
      }),
    );
    expect(res.status).toBe(503);
  });

  it("rejects when payment intent has not succeeded", async () => {
    mockGetStripe.mockReturnValue({
      paymentIntents: {
        retrieve: vi.fn().mockResolvedValue({
          id: "pi_abc",
          status: "requires_payment_method",
          amount: 1000,
          metadata: { userId: "user_test_123" },
        }),
      },
    });
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        amountCents: 1000,
        type: "purchase",
        paymentIntentId: "pi_abc",
      }),
    );
    expect(res.status).toBe(402);
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("rejects when payment intent userId does not match caller", async () => {
    mockGetStripe.mockReturnValue({
      paymentIntents: {
        retrieve: vi.fn().mockResolvedValue({
          id: "pi_abc",
          status: "succeeded",
          amount: 1000,
          metadata: { userId: "user_OTHER" },
        }),
      },
    });
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        amountCents: 1000,
        type: "purchase",
        paymentIntentId: "pi_abc",
      }),
    );
    expect(res.status).toBe(403);
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("rejects when intent amount differs from requested credits", async () => {
    mockGetStripe.mockReturnValue({
      paymentIntents: {
        retrieve: vi.fn().mockResolvedValue({
          id: "pi_abc",
          status: "succeeded",
          amount: 500, // user paid R5 but is asking for R10 of credits
          metadata: { userId: "user_test_123" },
        }),
      },
    });
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        amountCents: 1000,
        type: "purchase",
        paymentIntentId: "pi_abc",
      }),
    );
    expect(res.status).toBe(400);
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("blocks replay when intent has already been redeemed", async () => {
    mockAlreadyProcessed.mockResolvedValue(true);
    mockGetStripe.mockReturnValue({
      paymentIntents: { retrieve: vi.fn() },
    });
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        amountCents: 1000,
        type: "purchase",
        paymentIntentId: "pi_replayed",
      }),
    );
    expect(res.status).toBe(409);
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("credits the user when the intent is valid", async () => {
    mockGetStripe.mockReturnValue({
      paymentIntents: {
        retrieve: vi.fn().mockResolvedValue({
          id: "pi_ok",
          status: "succeeded",
          amount: 1000,
          metadata: { userId: "user_test_123" },
        }),
      },
    });
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        amountCents: 1000,
        type: "purchase",
        paymentIntentId: "pi_ok",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockAddCredits).toHaveBeenCalledWith(
      "user_test_123",
      1000,
      "purchase",
      expect.any(String),
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "credits.purchase" }),
    );
  });
});

describe("POST /api/credits — bonus / referral admin gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user_test_123" });
    mockAddCredits.mockResolvedValue({
      userId: "user_test_123",
      balanceCents: 500,
      lifetimeEarned: 500,
      lifetimeSpent: 0,
    });
  });

  it("returns 404 when a non-admin tries to grant bonus credits", async () => {
    mockIsAdmin.mockReturnValue(false);
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ amountCents: 500, type: "bonus" }));
    expect(res.status).toBe(404);
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("returns 404 when a non-admin tries to grant referral credits", async () => {
    mockIsAdmin.mockReturnValue(false);
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ amountCents: 500, type: "referral" }));
    expect(res.status).toBe(404);
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("allows an admin to grant bonus credits", async () => {
    mockIsAdmin.mockReturnValue(true);
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ amountCents: 500, type: "bonus" }));
    expect(res.status).toBe(200);
    expect(mockAddCredits).toHaveBeenCalledWith(
      "user_test_123",
      500,
      "bonus",
      expect.any(String),
    );
  });
});

describe("POST /api/credits — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user_test_123" });
  });

  it("rejects malformed paymentIntentId (must start with pi_)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        amountCents: 1000,
        type: "purchase",
        paymentIntentId: "not_a_pi",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects amount above safety cap", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ amountCents: 999_999, type: "bonus" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects unknown transaction type", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ amountCents: 100, type: "freebie" }));
    expect(res.status).toBe(400);
  });
});
