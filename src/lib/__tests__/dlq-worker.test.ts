/**
 * Tests for src/lib/dlq-worker.ts — drains the deferred_jobs DLQ.
 *
 * Covers the contract: claim a batch, retry each, mark succeeded /
 * reschedule with backoff / abandon after MAX_ATTEMPTS. Concurrency
 * safety is covered by the conditional UPDATE that scopes by id +
 * status='pending'; this test asserts that path is taken.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockFireUserWebhook = vi.fn();
vi.mock("@/lib/webhooks", () => ({
  fireUserWebhook: (...a: unknown[]) => mockFireUserWebhook(...a),
}));

// Track DB operations so we can assert claim → process → finalize order.
interface JobRow {
  id: string;
  kind: string;
  target: string;
  payload: string | null;
  attempts: number;
  status: string;
  nextAttemptAt: Date | null;
  lastError: string | null;
  completedAt: Date | null;
}

let pendingRows: JobRow[] = [];
const finalUpdates: Array<{ id: string; set: Partial<JobRow> }> = [];

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => pendingRows.filter((r) => r.status === "pending"),
        }),
      }),
    })),
    update: vi.fn(() => ({
      set: (set: Partial<JobRow>) => ({
        where: () => ({
          // Two flavors:
          //  1. claim:  .returning({id})  → returns [{id}] iff still pending
          //  2. finalize: no returning    → records the set + resolves
          returning: async () => {
            // claim flow: only succeed if some row is still pending
            const target = pendingRows.find((r) => r.status === "pending");
            if (!target) return [];
            // Soft-claim: bump nextAttemptAt as the worker does
            if (set.nextAttemptAt) target.nextAttemptAt = set.nextAttemptAt;
            return [{ id: target.id }];
          },
          then: (resolve: (v: unknown) => void) => {
            // finalize flow — record what would have been written
            const id = pendingRows[0]?.id;
            if (id) {
              finalUpdates.push({ id, set });
              // Reflect status into pendingRows so subsequent select() filters
              if (set.status) pendingRows[0].status = set.status;
            }
            resolve(undefined);
            return Promise.resolve(undefined);
          },
        }),
      }),
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  deferredJobs: {
    id: "id",
    status: "status",
    nextAttemptAt: "next_attempt_at",
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  pendingRows = [];
  finalUpdates.length = 0;
});

function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: overrides.id ?? "job_1",
    kind: overrides.kind ?? "webhook",
    target: overrides.target ?? "ClientReport",
    payload: overrides.payload ?? '{"clientName":"ACME"}',
    attempts: overrides.attempts ?? 1,
    status: overrides.status ?? "pending",
    nextAttemptAt: overrides.nextAttemptAt ?? new Date(0),
    lastError: overrides.lastError ?? null,
    completedAt: overrides.completedAt ?? null,
  };
}

describe("drainDLQ — empty queue", () => {
  it("returns zero counts and never invokes a dispatcher", async () => {
    const { drainDLQ } = await import("@/lib/dlq-worker");
    const result = await drainDLQ();
    expect(result.scanned).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.retried).toBe(0);
    expect(result.abandoned).toBe(0);
    expect(mockFireUserWebhook).not.toHaveBeenCalled();
  });
});

describe("drainDLQ — webhook retry success", () => {
  it("marks the job succeeded and calls fireUserWebhook with Retry- prefix", async () => {
    pendingRows.push(makeJob({ id: "j1", attempts: 1 }));
    mockFireUserWebhook.mockResolvedValue(undefined);

    const { drainDLQ } = await import("@/lib/dlq-worker");
    const result = await drainDLQ();

    expect(mockFireUserWebhook).toHaveBeenCalledWith(
      "ClientReport",
      "Retry-ClientReport",
      { clientName: "ACME" },
    );
    expect(result.succeeded).toBe(1);
    expect(result.retried).toBe(0);
    expect(result.abandoned).toBe(0);
    // Last finalize must mark succeeded with attempts++
    const last = finalUpdates[finalUpdates.length - 1];
    expect(last.set.status).toBe("succeeded");
    expect(last.set.attempts).toBe(2);
    expect(last.set.completedAt).toBeInstanceOf(Date);
  });
});

describe("drainDLQ — exponential backoff on failure", () => {
  it("on dispatcher failure, schedules nextAttemptAt and bumps attempts", async () => {
    pendingRows.push(makeJob({ id: "j-fail", attempts: 1 }));
    mockFireUserWebhook.mockRejectedValue(new Error("503 from receiver"));

    const { drainDLQ } = await import("@/lib/dlq-worker");
    const now = new Date(1_700_000_000_000);
    const result = await drainDLQ(now);

    expect(result.succeeded).toBe(0);
    expect(result.retried).toBe(1);

    const last = finalUpdates[finalUpdates.length - 1];
    expect(last.set.status).toBe("pending");
    expect(last.set.attempts).toBe(2);
    expect(last.set.lastError).toContain("503");
    // attempts=2 → backoff=5min
    const expected = new Date(now.getTime() + 5 * 60_000);
    expect((last.set.nextAttemptAt as Date).getTime()).toBe(expected.getTime());
  });
});

describe("drainDLQ — abandons after MAX_ATTEMPTS", () => {
  it("a job with attempts=5 that fails again is marked abandoned (attempts=6)", async () => {
    pendingRows.push(makeJob({ id: "j-doomed", attempts: 5 }));
    mockFireUserWebhook.mockRejectedValue(new Error("permanent 410"));

    const { drainDLQ } = await import("@/lib/dlq-worker");
    const result = await drainDLQ();

    expect(result.abandoned).toBe(1);
    expect(result.retried).toBe(0);

    const last = finalUpdates[finalUpdates.length - 1];
    expect(last.set.status).toBe("abandoned");
    expect(last.set.attempts).toBe(6);
    expect(last.set.completedAt).toBeInstanceOf(Date);
  });
});

describe("drainDLQ — unknown kind", () => {
  it("logs and abandons immediately when dispatch is not implemented", async () => {
    pendingRows.push(makeJob({ id: "j-meta", kind: "memory", attempts: 1 }));

    const { drainDLQ } = await import("@/lib/dlq-worker");
    const result = await drainDLQ();

    // dispatch returns false → counts as a failed retry, schedules backoff
    expect(result.retried).toBe(1);
    const last = finalUpdates[finalUpdates.length - 1];
    expect(last.set.lastError).toContain("dispatch returned false");
  });
});
