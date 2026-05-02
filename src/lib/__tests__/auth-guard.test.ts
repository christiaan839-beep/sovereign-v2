/**
 * Tests for src/lib/auth-guard.ts
 *
 * The single auth wrapper used across protected API routes. Verifies:
 *  - 401 when Clerk has no session
 *  - 401 when user has no primary email
 *  - 401 when Clerk throws (treated as auth failure, not 500)
 *  - 200 path returns email + userId
 *  - Per-user rate limit returns 429 with Retry-After header
 *  - rateLimit:false opts out of the rate-limit check
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const currentUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: () => currentUserMock(),
}));

// Use unique userIds per test so the in-memory rate-limit store doesn't bleed.
const uid = (label: string) => `auth-guard-${label}-${Math.random()}`;

describe("requireAuth", () => {
  beforeEach(() => {
    currentUserMock.mockReset();
  });

  it("returns 401 when Clerk reports no user", async () => {
    currentUserMock.mockResolvedValue(null);
    const { requireAuth } = await import("@/lib/auth-guard");
    const auth = await requireAuth();
    expect(auth.error).toBeDefined();
    expect(auth.error!.status).toBe(401);
    const body = await auth.error!.json();
    expect(body.error).toMatch(/sign in/i);
  });

  it("returns 401 when user has no primary email address", async () => {
    currentUserMock.mockResolvedValue({
      id: uid("no-email"),
      primaryEmailAddress: null,
    });
    const { requireAuth } = await import("@/lib/auth-guard");
    const auth = await requireAuth();
    expect(auth.error).toBeDefined();
    expect(auth.error!.status).toBe(401);
  });

  it("returns 401 when Clerk throws (graceful auth failure)", async () => {
    currentUserMock.mockRejectedValue(new Error("Clerk service down"));
    const { requireAuth } = await import("@/lib/auth-guard");
    const auth = await requireAuth();
    expect(auth.error).toBeDefined();
    expect(auth.error!.status).toBe(401);
  });

  it("returns email + userId on the happy path", async () => {
    const userId = uid("happy");
    currentUserMock.mockResolvedValue({
      id: userId,
      primaryEmailAddress: { emailAddress: "user@example.com" },
    });
    const { requireAuth } = await import("@/lib/auth-guard");
    const auth = await requireAuth();
    expect(auth.error).toBeUndefined();
    expect(auth.email).toBe("user@example.com");
    expect(auth.userId).toBe(userId);
  });

  it("returns 429 with Retry-After header once the rate limit is exhausted", async () => {
    const userId = uid("rate-limit");
    currentUserMock.mockResolvedValue({
      id: userId,
      primaryEmailAddress: { emailAddress: "rate@example.com" },
    });
    const { requireAuth } = await import("@/lib/auth-guard");

    // 60 req/min default — burn through and verify the next call is blocked.
    for (let i = 0; i < 60; i++) {
      const ok = await requireAuth();
      expect(ok.error).toBeUndefined();
    }
    const blocked = await requireAuth();
    expect(blocked.error).toBeDefined();
    expect(blocked.error!.status).toBe(429);
    expect(blocked.error!.headers.get("Retry-After")).toBeTruthy();
    const body = await blocked.error!.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(typeof body.resetIn).toBe("number");
  });

  it("rateLimit:false skips the rate-limit check", async () => {
    const userId = uid("opt-out");
    currentUserMock.mockResolvedValue({
      id: userId,
      primaryEmailAddress: { emailAddress: "opt@example.com" },
    });
    const { requireAuth } = await import("@/lib/auth-guard");

    // Make >60 calls — none should be blocked because rate limiting is off.
    for (let i = 0; i < 100; i++) {
      const auth = await requireAuth({ rateLimit: false });
      expect(auth.error).toBeUndefined();
      expect(auth.email).toBe("opt@example.com");
    }
  });

  it("rate-limit state is isolated per user", async () => {
    const userA = uid("iso-a");
    const userB = uid("iso-b");
    const { requireAuth } = await import("@/lib/auth-guard");

    // Exhaust user A
    currentUserMock.mockResolvedValue({
      id: userA,
      primaryEmailAddress: { emailAddress: "a@example.com" },
    });
    for (let i = 0; i < 61; i++) await requireAuth();

    // User B should still get through cleanly
    currentUserMock.mockResolvedValue({
      id: userB,
      primaryEmailAddress: { emailAddress: "b@example.com" },
    });
    const b = await requireAuth();
    expect(b.error).toBeUndefined();
    expect(b.email).toBe("b@example.com");
  });
});
