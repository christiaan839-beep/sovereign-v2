/**
 * Tests for src/lib/metered-endpoint.ts — Universal metering wrapper.
 *
 * The wrapper is on the hot path of every metered route (marketplace/submit,
 * _misc/ai/stream, etc.). Failure modes here directly impact revenue:
 *  - quota bypass → free users run unlimited agents
 *  - usage increment on 4xx → users get charged for their own bad input
 *  - rate-limit fail-open → denial-of-wallet
 *  - 429 missing upgrade payload → users stuck with no path forward
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextResponse } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockGuardRoute = vi.fn();
vi.mock("@/lib/api-guard", () => ({
  guardRoute: () => mockGuardRoute(),
}));

const mockCheckFreeUsage = vi.fn();
const mockIncrementUsage = vi.fn();
const mockGetSmartUpgradeInfo = vi.fn();
vi.mock("@/lib/free-tier", () => ({
  checkFreeUsage: (...a: unknown[]) => mockCheckFreeUsage(...a),
  incrementUsage: (...a: unknown[]) => mockIncrementUsage(...a),
  getSmartUpgradeInfo: (...a: unknown[]) => mockGetSmartUpgradeInfo(...a),
}));

const mockRateLimitCheck = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ check: (req: Request) => mockRateLimitCheck(req) }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function buildRequest(): Request {
  return new Request("https://app.test/api/metered-route", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "1.2.3.4",
    },
    body: JSON.stringify({ ping: 1 }),
  });
}

async function loadModule() {
  vi.resetModules();
  return await import("@/lib/metered-endpoint");
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default happy-path: rate-limit OK, authed, quota OK
  mockRateLimitCheck.mockResolvedValue(null);
  mockGuardRoute.mockResolvedValue({
    authorized: true,
    userId: "user_abc",
    email: "user@test.com",
  });
  mockCheckFreeUsage.mockResolvedValue({
    allowed: true,
    remaining: 49,
    limit: 50,
  });
  mockIncrementUsage.mockResolvedValue(undefined);
  mockGetSmartUpgradeInfo.mockResolvedValue({
    currentPlan: "free",
    currentLimit: 50,
    used: 50,
    nextPlan: "starter",
    nextLimit: 500,
    nextPrice: "$19",
    upgradeUrl: "/pricing",
    resetDate: "2026-05-01",
  });
});

describe("withMetering — happy path", () => {
  it("runs the handler and increments usage exactly once on 2xx", async () => {
    const { withMetering } = await loadModule();
    const handler = vi.fn(async () =>
      NextResponse.json({ ok: true }, { status: 200 }),
    );
    const POST = withMetering("test-route", handler);

    const res = await POST(buildRequest());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockIncrementUsage).toHaveBeenCalledTimes(1);
    expect(mockIncrementUsage).toHaveBeenCalledWith("user_abc", "test-route");
  });

  it("calls rate-limit BEFORE auth (denial-of-wallet defense)", async () => {
    const { withMetering } = await loadModule();
    const calls: string[] = [];
    mockRateLimitCheck.mockImplementation(async () => {
      calls.push("rate");
      return null;
    });
    mockGuardRoute.mockImplementation(async () => {
      calls.push("auth");
      return { authorized: true, userId: "u", email: "e@x" };
    });
    const handler = vi.fn(async () => {
      calls.push("handler");
      return NextResponse.json({ ok: true });
    });

    await withMetering("ordering", handler)(buildRequest());

    expect(calls).toEqual(["rate", "auth", "handler"]);
  });
});

describe("withMetering — auth", () => {
  it("returns guardRoute's 401 when not authorized and never runs handler", async () => {
    const { withMetering } = await loadModule();
    mockGuardRoute.mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));

    const res = await withMetering("authed", handler)(buildRequest());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(mockIncrementUsage).not.toHaveBeenCalled();
  });

  it("with public:true skips auth and still runs handler", async () => {
    const { withMetering } = await loadModule();
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));

    const res = await withMetering("public", handler, { public: true })(
      buildRequest(),
    );
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
    expect(mockGuardRoute).not.toHaveBeenCalled();
  });
});

describe("withMetering — rate limit", () => {
  it("short-circuits on rate-limit hit and never calls auth or handler", async () => {
    const { withMetering } = await loadModule();
    mockRateLimitCheck.mockResolvedValue(
      NextResponse.json({ error: "Rate limited" }, { status: 429 }),
    );
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));

    const res = await withMetering("rl-hit", handler)(buildRequest());
    expect(res.status).toBe(429);
    expect(mockGuardRoute).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(mockIncrementUsage).not.toHaveBeenCalled();
  });
});

describe("withMetering — plan-limit gate (revenue protection)", () => {
  it("returns 429 with upgrade payload when over plan limit", async () => {
    const { withMetering } = await loadModule();
    mockCheckFreeUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
      limit: 50,
    });
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));

    const res = await withMetering("over-limit", handler)(buildRequest());
    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
    expect(mockIncrementUsage).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.code).toBe("USAGE_LIMIT_REACHED");
    expect(body.upgrade).toBeDefined();
    expect(body.upgrade.upgradeUrl).toBe("/pricing");
    expect(res.headers.get("X-Free-Remaining")).toBe("0");
  });

  it("fails OPEN if checkFreeUsage throws (don't lock everyone out on a DB blip)", async () => {
    const { withMetering } = await loadModule();
    mockCheckFreeUsage.mockRejectedValue(new Error("Neon down"));
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));

    const res = await withMetering("db-blip", handler)(buildRequest());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it("with skipUsageTracking does not gate or increment", async () => {
    const { withMetering } = await loadModule();
    mockCheckFreeUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
      limit: 50,
    });
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));

    const res = await withMetering("admin", handler, {
      skipUsageTracking: true,
    })(buildRequest());
    expect(res.status).toBe(200);
    expect(mockCheckFreeUsage).not.toHaveBeenCalled();
    expect(mockIncrementUsage).not.toHaveBeenCalled();
  });
});

describe("withMetering — usage increment correctness", () => {
  it("does NOT increment on a 4xx (don't bill users for bad input)", async () => {
    const { withMetering } = await loadModule();
    const handler = vi.fn(async () =>
      NextResponse.json({ error: "bad input" }, { status: 400 }),
    );

    const res = await withMetering("bad-input", handler)(buildRequest());
    expect(res.status).toBe(400);
    expect(handler).toHaveBeenCalled();
    expect(mockIncrementUsage).not.toHaveBeenCalled();
  });

  it("does NOT increment on a 5xx (never charge for our bugs)", async () => {
    const { withMetering } = await loadModule();
    const handler = vi.fn(async () =>
      NextResponse.json({ error: "server" }, { status: 500 }),
    );

    await withMetering("server-err", handler)(buildRequest());
    expect(mockIncrementUsage).not.toHaveBeenCalled();
  });

  it("does NOT increment when handler throws (caught → 500)", async () => {
    const { withMetering } = await loadModule();
    const handler = vi.fn(async () => {
      throw new Error("boom");
    });

    const res = await withMetering("throw", handler)(buildRequest());
    expect(res.status).toBe(500);
    expect(mockIncrementUsage).not.toHaveBeenCalled();
  });

  it("awaits the increment (Vercel-kill-safe) before returning", async () => {
    const { withMetering } = await loadModule();
    let incrementResolved = false;
    mockIncrementUsage.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      incrementResolved = true;
    });
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));

    await withMetering("awaited", handler)(buildRequest());
    // If the increment was fire-and-forget, this would be false here.
    expect(incrementResolved).toBe(true);
  });
});
