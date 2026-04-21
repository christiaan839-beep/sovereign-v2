import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockGetBalance, mockGetUserTier } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetBalance: vi.fn(),
  mockGetUserTier: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/credits", () => ({ getBalance: mockGetBalance }));
vi.mock("@/lib/free-tier", () => ({ getUserTier: mockGetUserTier }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { GET } from "@/app/api/credits/balance/route";

beforeEach(() => {
  mockAuth.mockReset();
  mockGetBalance.mockReset();
  mockGetUserTier.mockReset();
});

describe("GET /api/credits/balance", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns balance + plan + allocation for signed-in user", async () => {
    mockAuth.mockResolvedValue({ userId: "user_42" });
    mockGetBalance.mockResolvedValue(750);
    mockGetUserTier.mockResolvedValue("array");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.balanceCents).toBe(750);
    expect(body.plan).toBe("array");
    expect(body.monthlyAllocationCents).toBe(1500); // Growth allocation
    expect(body.lowBalance).toBe(false); // 750c > 100c threshold
  });

  it("flags lowBalance when balance < 100 cents", async () => {
    mockAuth.mockResolvedValue({ userId: "user_poor" });
    mockGetBalance.mockResolvedValue(42);
    mockGetUserTier.mockResolvedValue("free");
    const res = await GET();
    const body = await res.json();
    expect(body.lowBalance).toBe(true);
  });

  it("handles unknown plan gracefully (free fallback)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_ghost" });
    mockGetBalance.mockResolvedValue(0);
    mockGetUserTier.mockResolvedValue("mystery_plan" as unknown as "free");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(typeof body.monthlyAllocationCents).toBe("number");
  });
});
