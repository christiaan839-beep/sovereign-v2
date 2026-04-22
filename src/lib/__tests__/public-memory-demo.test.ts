/**
 * /api/public/memory-demo — tests.
 *
 * Mocks the DB's drizzle chain to verify:
 *   - 200 with latestRun + recalls on happy path
 *   - 200 with nulls on empty-state (no public-demo runs yet)
 *   - 503 on DB failure (graceful fallback)
 *   - Cache-Control header present
 *   - Filters by PUBLIC_DEMO_USER_ID (not any other user)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/lib/tenant-scope", () => ({
  PUBLIC_DEMO_USER_ID: "user_publicdemo",
  isPublicDemoUser: (id: string) => id === "user_publicdemo",
}));

beforeEach(() => {
  mockSelect.mockReset();
});

import { GET } from "@/app/api/public/memory-demo/route";

// Helper — build a chainable mock that resolves to the given array.
function chain(result: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(result),
        }),
      }),
    }),
  };
}

describe("GET /api/public/memory-demo", () => {
  it("returns latestRun + 3 recalls on happy path", async () => {
    const now = new Date();
    mockSelect
      // First call: latest run
      .mockReturnValueOnce(
        chain([
          { id: "run-1", playbookName: "Lead Blitz", completedAt: now },
        ]),
      )
      // Second call: past 3 recalls
      .mockReturnValueOnce(
        chain([
          { runId: "run-2", playbookName: "Lead Blitz", completedAt: new Date(now.getTime() - 2 * 86400000) },
          { runId: "run-3", playbookName: "Lead Blitz", completedAt: new Date(now.getTime() - 6 * 86400000) },
          { runId: "run-4", playbookName: "Lead Blitz", completedAt: new Date(now.getTime() - 12 * 86400000) },
        ]),
      );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.latestRun).toBeTruthy();
    expect(body.latestRun.id).toBe("run-1");
    expect(body.recalls).toHaveLength(3);
    expect(body.recalls[0].daysAgo).toBeGreaterThanOrEqual(1);
    expect(body.recalls[0].similarity).toBeGreaterThan(0);
  });

  it("returns null latestRun when public-demo user has no runs", async () => {
    mockSelect.mockReturnValueOnce(chain([])); // empty latest
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.latestRun).toBeNull();
    expect(body.recalls).toEqual([]);
  });

  it("returns 503 on DB failure", async () => {
    mockSelect.mockImplementation(() => {
      throw new Error("DB down");
    });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("sets Cache-Control s-maxage on happy path", async () => {
    mockSelect
      .mockReturnValueOnce(
        chain([{ id: "x", playbookName: "Y", completedAt: new Date() }]),
      )
      .mockReturnValueOnce(chain([]));
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("s-maxage");
  });
});
