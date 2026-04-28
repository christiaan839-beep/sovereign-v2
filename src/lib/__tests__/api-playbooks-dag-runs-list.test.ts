/**
 * GET /api/playbooks/dag/runs — filter + pagination tests.
 *
 * Round 16 added:
 *   - status filter (running|completed|failed)
 *   - before cursor (ISO timestamp)
 *   - nextCursor in response (when page is full)
 *
 * Verifies:
 *   - Bad status enum → 400
 *   - Bad cursor format → 400
 *   - Filters forwarded correctly to the store
 *   - nextCursor passed through from store
 *   - Existing dagId / limit handling still works
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockListDagRuns } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockListDagRuns: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/playbook-dag-store", () => ({ listDagRuns: mockListDagRuns }));

import { GET } from "@/app/api/playbooks/dag/runs/route";

const fakeUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

function req(query = ""): Request {
  return new Request(`http://l/api/playbooks/dag/runs${query}`);
}

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockListDagRuns.mockReset();
  mockListDagRuns.mockResolvedValue({ runs: [], nextCursor: null });
});

describe("GET /api/playbooks/dag/runs — Round 16 filters", () => {
  it("rejects bogus status enum with 400", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    const res = await GET(req("?status=on-fire"));
    expect(res.status).toBe(400);
    expect(mockListDagRuns).not.toHaveBeenCalled();
  });

  it("forwards status=running to the store", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    await GET(req("?status=running"));
    expect(mockListDagRuns).toHaveBeenCalledWith(
      expect.objectContaining({ status: "running" }),
    );
  });

  it("forwards status=completed to the store", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    await GET(req("?status=completed"));
    expect(mockListDagRuns).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("rejects bogus before cursor with 400", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    const res = await GET(req("?before=not-a-date"));
    expect(res.status).toBe(400);
  });

  it("forwards a valid before cursor to the store", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    await GET(req("?before=2026-04-28T00:00:00.000Z"));
    expect(mockListDagRuns).toHaveBeenCalledWith(
      expect.objectContaining({ before: "2026-04-28T00:00:00.000Z" }),
    );
  });

  it("returns nextCursor in the response when the store provides one", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockListDagRuns.mockResolvedValue({
      runs: [
        {
          id: fakeUuid,
          dagId: null,
          status: "completed",
          nodeCount: 2,
          edgeCount: 1,
          totalDurationMs: 250,
          failedAt: null,
          progressNodesCompleted: 2,
          createdAt: "2026-04-28T00:00:00.000Z",
        },
      ],
      nextCursor: "2026-04-27T00:00:00.000Z",
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nextCursor).toBe("2026-04-27T00:00:00.000Z");
    expect(body.runs).toHaveLength(1);
    // Round 16: list response now includes progressNodesCompleted so
    // the dashboard widget can render running-state progress.
    expect(body.runs[0].progressNodesCompleted).toBe(2);
  });

  it("combines dagId + status + before in one query", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    await GET(
      req(
        `?dagId=${fakeUuid}&status=failed&before=2026-04-28T00:00:00.000Z`,
      ),
    );
    expect(mockListDagRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        dagId: fakeUuid,
        status: "failed",
        before: "2026-04-28T00:00:00.000Z",
      }),
    );
  });
});
