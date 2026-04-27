/**
 * Tests for src/lib/safe-async.ts — replacement for `.catch(() => {})`.
 *
 * Both helpers must be totally non-throwing — fire-and-forget callers
 * cannot afford a rogue exception bubbling up through the request handler.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockLogWarn = vi.fn();
const mockLogError = vi.fn();
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: mockLogWarn,
    error: mockLogError,
    debug: vi.fn(),
  }),
}));

const mockDbInsert = vi.fn();
vi.mock("@/db", () => ({
  db: { insert: () => ({ values: (v: unknown) => mockDbInsert(v) }) },
}));

vi.mock("@/db/schema", () => ({ deferredJobs: { __table: "deferred_jobs" } }));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── loggedFireForget ──────────────────────────────────────────────────────

describe("loggedFireForget", () => {
  it("does nothing for a resolved promise", async () => {
    const { loggedFireForget } = await import("@/lib/safe-async");
    loggedFireForget(Promise.resolve(42), { source: "test:happy" });
    // Yield to microtask queue
    await new Promise((r) => setImmediate(r));
    expect(mockLogWarn).not.toHaveBeenCalled();
  });

  it("logs a warning when the promise rejects, never throws", async () => {
    const { loggedFireForget } = await import("@/lib/safe-async");
    loggedFireForget(Promise.reject(new Error("network blew up")), {
      source: "test:bad",
      meta: { userId: "u1" },
    });
    await new Promise((r) => setImmediate(r));
    expect(mockLogWarn).toHaveBeenCalledTimes(1);
    const [msg, ctx] = mockLogWarn.mock.calls[0];
    expect(msg).toBe("fire-and-forget failed");
    expect(ctx.source).toBe("test:bad");
    expect(ctx.error).toContain("network blew up");
    expect(ctx.userId).toBe("u1");
  });

  it("is a no-op for null/undefined promises (drop-in for legacy code)", async () => {
    const { loggedFireForget } = await import("@/lib/safe-async");
    loggedFireForget(null, { source: "test:null" });
    loggedFireForget(undefined, { source: "test:undef" });
    expect(mockLogWarn).not.toHaveBeenCalled();
  });
});

// ── withDLQ ───────────────────────────────────────────────────────────────

describe("withDLQ", () => {
  it("returns the result on success and never enqueues to DLQ", async () => {
    const { withDLQ } = await import("@/lib/safe-async");
    mockDbInsert.mockResolvedValue([]);

    const result = await withDLQ(async () => "ok", {
      kind: "webhook",
      target: "TestWebhook",
    });
    expect(result).toBe("ok");
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("enqueues to deferred_jobs on failure and returns null", async () => {
    const { withDLQ } = await import("@/lib/safe-async");
    mockDbInsert.mockResolvedValue([]);

    const result = await withDLQ(
      async () => {
        throw new Error("webhook 503");
      },
      {
        kind: "webhook",
        target: "ClientReport",
        payload: { clientName: "ACME" },
        userId: "user_x",
      },
    );

    expect(result).toBeNull();
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    const row = mockDbInsert.mock.calls[0][0];
    expect(row.kind).toBe("webhook");
    expect(row.target).toBe("ClientReport");
    expect(row.userId).toBe("user_x");
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(1);
    expect(row.lastError).toContain("webhook 503");
    expect(row.payload).toBe(JSON.stringify({ clientName: "ACME" }));
    expect(row.nextAttemptAt).toBeInstanceOf(Date);
  });

  it("never throws even if the DLQ insert ALSO fails", async () => {
    const { withDLQ } = await import("@/lib/safe-async");
    mockDbInsert.mockRejectedValue(new Error("dlq table missing"));

    const result = await withDLQ(
      async () => {
        throw new Error("primary failure");
      },
      { kind: "audit", target: "test" },
    );

    expect(result).toBeNull();
    // The original failure logs as warn; the DLQ failure logs as error.
    expect(mockLogWarn).toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalled();
    const [errMsg] = mockLogError.mock.calls[0];
    expect(errMsg).toContain("DLQ enqueue ALSO failed");
  });

  it("works without optional fields (kind + target alone)", async () => {
    const { withDLQ } = await import("@/lib/safe-async");
    mockDbInsert.mockResolvedValue([]);

    await withDLQ(
      async () => {
        throw new Error("x");
      },
      { kind: "memory", target: "tenantMemory" },
    );

    const row = mockDbInsert.mock.calls[0][0];
    expect(row.payload).toBeNull();
    expect(row.userId).toBeNull();
  });
});
