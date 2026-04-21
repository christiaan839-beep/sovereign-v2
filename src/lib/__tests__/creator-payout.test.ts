/**
 * creator-payout.ts — tests.
 *
 * Verifies the no-payout guardrails: missing metadata row, missing
 * creator, zero pricing, self-run. Happy path credits creator via
 * creditCreatorPayout.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect, mockPayout } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockPayout: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockSelect(),
        }),
      }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({
  agentMetadata: { slug: "slug", creatorUserId: "creator_user_id", pricingCents: "pricing_cents" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/credits", () => ({ creditCreatorPayout: mockPayout }));

import { payoutCreatorIfApplicable } from "@/lib/creator-payout";

beforeEach(() => {
  mockSelect.mockReset();
  mockPayout.mockReset();
  mockPayout.mockResolvedValue(80);
});

describe("payoutCreatorIfApplicable", () => {
  const base = {
    agentSlug: "seo-dominator",
    capturedCents: 100,
    holdId: "hold_1",
    sourceUserId: "u_runner",
  };

  it("no-op when capturedCents <= 0", async () => {
    const result = await payoutCreatorIfApplicable({ ...base, capturedCents: 0 });
    expect(result).toBe(0);
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockPayout).not.toHaveBeenCalled();
  });

  it("no-op when agent_metadata row missing", async () => {
    mockSelect.mockResolvedValue([]);
    const result = await payoutCreatorIfApplicable(base);
    expect(result).toBe(0);
    expect(mockPayout).not.toHaveBeenCalled();
  });

  it("no-op when creator_user_id is null (first-party agent)", async () => {
    mockSelect.mockResolvedValue([{ creatorUserId: null, pricingCents: 499 }]);
    const result = await payoutCreatorIfApplicable(base);
    expect(result).toBe(0);
    expect(mockPayout).not.toHaveBeenCalled();
  });

  it("no-op when pricing is 0 (free agent)", async () => {
    mockSelect.mockResolvedValue([{ creatorUserId: "u_creator", pricingCents: 0 }]);
    const result = await payoutCreatorIfApplicable(base);
    expect(result).toBe(0);
    expect(mockPayout).not.toHaveBeenCalled();
  });

  it("no-op when creator is the same user running the agent", async () => {
    mockSelect.mockResolvedValue([{ creatorUserId: "u_runner", pricingCents: 499 }]);
    const result = await payoutCreatorIfApplicable(base);
    expect(result).toBe(0);
    expect(mockPayout).not.toHaveBeenCalled();
  });

  it("pays the creator 80% of capturedCents on the happy path", async () => {
    mockSelect.mockResolvedValue([{ creatorUserId: "u_creator", pricingCents: 499 }]);
    const result = await payoutCreatorIfApplicable(base);
    expect(result).toBe(80);
    expect(mockPayout).toHaveBeenCalledWith({
      creatorUserId: "u_creator",
      capturedCents: 100,
      sharePct: 0.8,
      agentSlug: "seo-dominator",
      sourceHoldId: "hold_1",
      sourceUserId: "u_runner",
    });
  });

  it("honors a custom sharePct", async () => {
    mockSelect.mockResolvedValue([{ creatorUserId: "u_creator", pricingCents: 499 }]);
    await payoutCreatorIfApplicable({ ...base, sharePct: 0.5 });
    expect(mockPayout).toHaveBeenCalledWith(expect.objectContaining({ sharePct: 0.5 }));
  });

  it("returns 0 on DB error without throwing", async () => {
    mockSelect.mockRejectedValue(new Error("connection reset"));
    const result = await payoutCreatorIfApplicable(base);
    expect(result).toBe(0);
    expect(mockPayout).not.toHaveBeenCalled();
  });
});
