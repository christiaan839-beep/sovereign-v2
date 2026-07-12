/**
 * Auth contract for /api/portal/metrics (wave 122, BACKLOG H4).
 *
 * Pins the fix for the unauthenticated tenant-telemetry exposure: the
 * route must reject requests without a valid portal token whose subject
 * matches the requested clientId. The DB layer is mocked to throw — the
 * route's graceful catch turns that into a zeros payload, which is fine:
 * these tests assert the AUTH gate, not the aggregation.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mintPortalToken } from "@/lib/portal-tokens";

// No rate limiting in tests.
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ check: async () => null }),
}));

// DB throws — exercises the route's graceful degradation path.
vi.mock("@/db", () => ({
  db: {
    select: () => {
      throw new Error("no db in tests");
    },
  },
}));
vi.mock("@/db/schema", () => ({
  leads: {},
  generations: {},
  bookings: {},
  agentActivity: {},
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const SECRET = "test-portal-secret-with-adequate-length";

function makeReq(url: string, headers?: Record<string, string>): Request {
  return new Request(url, { headers });
}

beforeEach(() => {
  process.env.PORTAL_TOKEN_SIGNING_SECRET = SECRET;
});

describe("portal metrics auth gate", () => {
  it("returns 400 when clientId is missing", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      makeReq("http://localhost/api/portal/metrics") as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when no token is presented", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      makeReq(
        "http://localhost/api/portal/metrics?clientId=victim%40example.com",
      ) as never,
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for a garbage token", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      makeReq(
        "http://localhost/api/portal/metrics?clientId=victim%40example.com&token=garbage",
      ) as never,
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when the token was minted for a DIFFERENT clientId", async () => {
    const { GET } = await import("../route");
    const minted = mintPortalToken({ clientId: "attacker@example.com" });
    const res = await GET(
      makeReq(
        `http://localhost/api/portal/metrics?clientId=victim%40example.com&token=${encodeURIComponent(minted.token)}`,
      ) as never,
    );
    expect(res.status).toBe(401);
  });

  it("accepts a valid token via query param (200, zeros from mocked-out DB)", async () => {
    const { GET } = await import("../route");
    const minted = mintPortalToken({ clientId: "client@example.com" });
    const res = await GET(
      makeReq(
        `http://localhost/api/portal/metrics?clientId=client%40example.com&token=${encodeURIComponent(minted.token)}`,
      ) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("accepts a valid token via Authorization: Bearer", async () => {
    const { GET } = await import("../route");
    const minted = mintPortalToken({ clientId: "client@example.com" });
    const res = await GET(
      makeReq(
        "http://localhost/api/portal/metrics?clientId=client%40example.com",
        { authorization: `Bearer ${minted.token}` },
      ) as never,
    );
    expect(res.status).toBe(200);
  });
});
