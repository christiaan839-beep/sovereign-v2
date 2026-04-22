/**
 * browser-session.ts — tests.
 *
 * Phase 1 of the Computer Use Expansion plan. Covers the adapter interface,
 * the Playwright backend (mocked — no real browser ever launched in CI), the
 * two cloud stubs (Browserbase + Hyperbrowser), and the in-memory session
 * store with TTL cleanup.
 *
 * Playwright is dynamically imported inside the module. We stub it entirely
 * via `vi.hoisted` + `vi.mock("playwright", ...)` so tests run with or
 * without the real package installed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockLaunch, mockNewContext, mockNewPage, mockContextClose, mockBrowserClose } = vi.hoisted(() => {
  const newPage = vi.fn(async () => ({ fill: vi.fn(), close: vi.fn() }));
  const newContext = vi.fn(async () => ({
    newPage,
    close: vi.fn(),
  }));
  const contextClose = vi.fn();
  const browserClose = vi.fn(async () => undefined);
  const launch = vi.fn(async () => ({
    newContext,
    close: browserClose,
  }));
  return {
    mockLaunch: launch,
    mockNewContext: newContext,
    mockNewPage: newPage,
    mockContextClose: contextClose,
    mockBrowserClose: browserClose,
  };
});

vi.mock("playwright", () => ({
  chromium: { launch: mockLaunch },
}));

// Ensure every test starts with a fresh module (resets the in-memory
// session map and re-reads env flags). Without this, sessions created
// in one test would leak into the next and TTL assertions would race.
beforeEach(() => {
  vi.resetModules();
  mockLaunch.mockClear();
  mockNewContext.mockClear();
  mockNewPage.mockClear();
  mockContextClose.mockClear();
  mockBrowserClose.mockClear();
  // Clean slate — no Browserbase / Hyperbrowser creds, flag off by default.
  delete process.env.ENABLE_BROWSER_SESSIONS;
  delete process.env.BROWSERBASE_API_KEY;
  delete process.env.HYPERBROWSER_API_KEY;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("browser-session — env flag gating", () => {
  it("startSession throws when ENABLE_BROWSER_SESSIONS is not 'true'", async () => {
    const { startSession } = await import("@/lib/browser-session");
    await expect(startSession({ userId: "u1" })).rejects.toThrow(
      /ENABLE_BROWSER_SESSIONS/,
    );
  });

  it("startSession throws when flag is literally 'false'", async () => {
    process.env.ENABLE_BROWSER_SESSIONS = "false";
    const { startSession } = await import("@/lib/browser-session");
    await expect(startSession({ userId: "u1" })).rejects.toThrow(
      /ENABLE_BROWSER_SESSIONS/,
    );
  });

  it("does NOT import playwright when flag is off", async () => {
    const { startSession } = await import("@/lib/browser-session");
    // Attempt a start with flag off
    await expect(startSession({ userId: "u1" })).rejects.toThrow();
    // Playwright's chromium.launch must never be called if the flag is off.
    expect(mockLaunch).not.toHaveBeenCalled();
  });
});

describe("browser-session — playwright backend", () => {
  beforeEach(() => {
    process.env.ENABLE_BROWSER_SESSIONS = "true";
  });

  it("startSession returns a non-empty sessionId", async () => {
    const { startSession } = await import("@/lib/browser-session");
    const id = await startSession({ userId: "u1" });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("startSession invokes playwright chromium.launch exactly once", async () => {
    const { startSession } = await import("@/lib/browser-session");
    await startSession({ userId: "u1" });
    expect(mockLaunch).toHaveBeenCalledTimes(1);
  });

  it("getSession returns metadata for a known id", async () => {
    const { startSession, getSession } = await import("@/lib/browser-session");
    const id = await startSession({ userId: "u1", ttlMs: 5000 });
    const meta = getSession(id);
    expect(meta).not.toBeNull();
    expect(meta?.sessionId).toBe(id);
    expect(meta?.userId).toBe("u1");
    expect(meta?.backend).toBe("playwright");
    expect(meta?.ttlMs).toBe(5000);
    expect(meta?.createdAt).toBeLessThanOrEqual(Date.now());
    expect(meta?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("getSession returns null for an unknown id", async () => {
    const { getSession } = await import("@/lib/browser-session");
    expect(getSession("sess_does_not_exist")).toBeNull();
  });

  it("endSession closes the browser and removes the session", async () => {
    const { startSession, getSession, endSession } = await import(
      "@/lib/browser-session"
    );
    const id = await startSession({ userId: "u1" });
    expect(getSession(id)).not.toBeNull();
    await endSession(id);
    expect(getSession(id)).toBeNull();
    expect(mockBrowserClose).toHaveBeenCalled();
  });

  it("endSession is idempotent — calling twice is safe", async () => {
    const { startSession, endSession } = await import("@/lib/browser-session");
    const id = await startSession({ userId: "u1" });
    await endSession(id);
    // Second call must not throw.
    await expect(endSession(id)).resolves.toBeUndefined();
  });

  it("resumeSession returns a context for a live session", async () => {
    const { startSession, resumeSession } = await import(
      "@/lib/browser-session"
    );
    const id = await startSession({ userId: "u1" });
    const ctx = await resumeSession(id);
    expect(ctx).toBeDefined();
    // Every backend returns something that has a newPage method.
    expect(typeof (ctx as { newPage?: unknown }).newPage).toBe("function");
  });

  it("resumeSession throws for an unknown sessionId with a clear message", async () => {
    const { resumeSession } = await import("@/lib/browser-session");
    await expect(resumeSession("sess_nope")).rejects.toThrow(
      /session.*not.*found/i,
    );
  });

  it("TTL cleanup removes the session after expiry", async () => {
    vi.useFakeTimers();
    const { startSession, getSession } = await import("@/lib/browser-session");
    const id = await startSession({ userId: "u1", ttlMs: 100 });
    expect(getSession(id)).not.toBeNull();

    // Advance just past the TTL — cleanup should fire and evict the session.
    await vi.advanceTimersByTimeAsync(150);

    expect(getSession(id)).toBeNull();
  });

  it("TTL cleanup calls the backend close", async () => {
    vi.useFakeTimers();
    const { startSession } = await import("@/lib/browser-session");
    await startSession({ userId: "u1", ttlMs: 50 });
    await vi.advanceTimersByTimeAsync(100);
    expect(mockBrowserClose).toHaveBeenCalled();
  });
});

describe("browser-session — cloud stubs", () => {
  beforeEach(() => {
    process.env.ENABLE_BROWSER_SESSIONS = "true";
  });

  it("browserbase backend throws when BROWSERBASE_API_KEY is unset", async () => {
    const { startSession } = await import("@/lib/browser-session");
    await expect(
      startSession({ userId: "u1", backend: "browserbase" }),
    ).rejects.toThrow(/BROWSERBASE_API_KEY/);
  });

  it("hyperbrowser backend throws when HYPERBROWSER_API_KEY is unset", async () => {
    const { startSession } = await import("@/lib/browser-session");
    await expect(
      startSession({ userId: "u1", backend: "hyperbrowser" }),
    ).rejects.toThrow(/HYPERBROWSER_API_KEY/);
  });

  it("playwright remains the default when no backend is specified", async () => {
    const { startSession, getSession } = await import("@/lib/browser-session");
    const id = await startSession({ userId: "u1" });
    expect(getSession(id)?.backend).toBe("playwright");
  });

  it("unknown backend value throws a validation error", async () => {
    const { startSession } = await import("@/lib/browser-session");
    await expect(
      // @ts-expect-error — intentional invalid backend for the test
      startSession({ userId: "u1", backend: "nope" }),
    ).rejects.toThrow(/unknown backend/i);
  });
});

describe("browser-session — playwright package missing", () => {
  beforeEach(() => {
    process.env.ENABLE_BROWSER_SESSIONS = "true";
  });

  it("produces a helpful error when playwright import fails", async () => {
    // Override the mock specifically for this test: simulate a missing package.
    vi.doMock("playwright", () => {
      throw new Error("Cannot find module 'playwright'");
    });
    vi.resetModules();
    const { startSession } = await import("@/lib/browser-session");
    await expect(startSession({ userId: "u1" })).rejects.toThrow(
      /playwright.*not.*installed|Cannot find module 'playwright'/i,
    );
    // Restore the happy-path mock for subsequent tests.
    vi.doUnmock("playwright");
  });
});
