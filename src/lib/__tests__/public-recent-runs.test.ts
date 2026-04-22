/**
 * GET /api/public/recent-runs — tests.
 *
 * Verifies PII-free payload, empty-state graceful degrade, cache headers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockResolvedRows, shouldThrow } = vi.hoisted(() => ({
  mockResolvedRows: { value: [] as unknown[] },
  shouldThrow: { value: false },
}));

vi.mock("@/db", () => ({
  db: {
    select: () => {
      // Synchronous throw at the top of the chain — emulates a schema
      // error (e.g., table missing) where Drizzle throws before any
      // promise is created. Avoids vitest's unhandled-rejection trap.
      if (shouldThrow.value) throw new Error("table missing");
      return {
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => mockResolvedRows.value,
            }),
          }),
        }),
      };
    },
  },
}));
vi.mock("@/db/schema", () => ({
  playbookRuns: {
    playbookId: "playbook_id",
    playbookName: "playbook_name",
    stepCount: "step_count",
    stepsSucceeded: "steps_succeeded",
    stepsFailed: "steps_failed",
    durationMs: "duration_ms",
    completedAt: "completed_at",
    status: "status",
  },
}));
vi.mock("drizzle-orm", () => ({ desc: vi.fn(), eq: vi.fn() }));

import { GET } from "@/app/api/public/recent-runs/route";

beforeEach(() => {
  mockResolvedRows.value = [];
  shouldThrow.value = false;
});

describe("GET /api/public/recent-runs", () => {
  it("returns recent done runs with PII-free shape", async () => {
    mockResolvedRows.value = [
      {
        playbookId: "lead-blitz",
        playbookName: "Lead Blitz",
        stepCount: 4,
        stepsSucceeded: 4,
        stepsFailed: 0,
        durationMs: 185_000,
        completedAt: new Date(),
      },
    ];
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).not.toHaveProperty("userId");
    expect(body.runs[0]).not.toHaveProperty("inputs");
    expect(body.runs[0]).not.toHaveProperty("userIdHash");
  });

  it("returns empty array on DB error (no 500)", async () => {
    shouldThrow.value = true;
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.runs).toEqual([]);
    expect(body.count).toBe(0);
  });

  it("returns empty array when no runs exist (does NOT synthesize activity)", async () => {
    mockResolvedRows.value = [];
    const res = await GET();
    const body = await res.json();
    expect(body.runs).toEqual([]);
    expect(body.count).toBe(0);
  });

  it("sets edge-cacheable Cache-Control", async () => {
    mockResolvedRows.value = [];
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("max-age");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage");
  });
});
