import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSweep } = vi.hoisted(() => ({ mockSweep: vi.fn() }));
vi.mock("@/lib/credits", () => ({ sweepExpiredHolds: mockSweep }));

beforeEach(() => {
  mockSweep.mockReset();
  process.env.CRON_SECRET = "topsecret-must-be-at-least-16-chars";
});

describe("GET /api/cron/sweep-expired-holds", () => {
  it("returns 401 without the correct Bearer secret", async () => {
    const { GET } = await import("@/app/api/cron/sweep-expired-holds/route");
    const res = await GET(new Request("http://localhost/cron", {
      headers: { Authorization: "Bearer wrong" },
    }));
    expect(res.status).toBe(401);
    expect(mockSweep).not.toHaveBeenCalled();
  });

  it("returns 401 without any Bearer header", async () => {
    const { GET } = await import("@/app/api/cron/sweep-expired-holds/route");
    const res = await GET(new Request("http://localhost/cron"));
    expect(res.status).toBe(401);
  });

  it("calls sweepExpiredHolds and returns count when secret matches", async () => {
    mockSweep.mockResolvedValue(7);
    const { GET } = await import("@/app/api/cron/sweep-expired-holds/route");
    const res = await GET(new Request("http://localhost/cron", {
      headers: { Authorization: "Bearer topsecret-must-be-at-least-16-chars" },
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.swept).toBe(7);
    expect(body.ok).toBe(true);
    expect(mockSweep).toHaveBeenCalledOnce();
  });

  it("returns 503 if CRON_SECRET env var is not set", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/sweep-expired-holds/route");
    const res = await GET(new Request("http://localhost/cron", {
      headers: { Authorization: "Bearer anything" },
    }));
    expect(res.status).toBe(401); // treat missing secret as unauthorized
  });
});
