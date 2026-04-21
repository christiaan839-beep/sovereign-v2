import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockListDueNow, mockMarkDispatched, mockMarkFailed, mockFetch, mockGetBaseUrl } =
  vi.hoisted(() => ({
    mockListDueNow: vi.fn(),
    mockMarkDispatched: vi.fn().mockResolvedValue(undefined),
    mockMarkFailed: vi.fn().mockResolvedValue(undefined),
    mockFetch: vi.fn(),
    mockGetBaseUrl: vi.fn(() => "http://localhost:3000"),
  }));

vi.mock("@/lib/scheduled-playbooks", () => ({
  listDueNow: mockListDueNow,
  markDispatched: mockMarkDispatched,
  markFailed: mockMarkFailed,
}));
vi.mock("@/lib/base-url", () => ({ getBaseUrl: mockGetBaseUrl }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Replace global fetch
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockListDueNow.mockReset();
  mockMarkDispatched.mockReset().mockResolvedValue(undefined);
  mockMarkFailed.mockReset().mockResolvedValue(undefined);
  mockFetch.mockReset();
  process.env.CRON_SECRET = "test-secret-1234567890"; // ≥16 chars required
});

describe("GET /api/cron/dispatch-scheduled-playbooks", () => {
  it("returns 401 without the correct Bearer secret", async () => {
    const { GET } = await import("@/app/api/cron/dispatch-scheduled-playbooks/route");
    const res = await GET(new Request("http://l/cron", {
      headers: { Authorization: "Bearer wrong" },
    }));
    expect(res.status).toBe(401);
    expect(mockListDueNow).not.toHaveBeenCalled();
  });

  it("returns 0 dispatched when nothing is due", async () => {
    mockListDueNow.mockResolvedValue([]);
    const { GET } = await import("@/app/api/cron/dispatch-scheduled-playbooks/route");
    const res = await GET(new Request("http://l/cron", {
      headers: { Authorization: "Bearer test-secret-1234567890" },
    }));
    const body = await res.json();
    expect(body.dispatched).toBe(0);
    expect(body.failed).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("dispatches due schedules via internal HTTP call with both headers", async () => {
    mockListDueNow.mockResolvedValue([
      {
        id: "sch_1",
        userId: "user_a",
        playbookId: "lead-blitz",
        inputs: '{"niche":"SaaS"}',
      },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ runId: "run_abc" }),
    });

    const { GET } = await import("@/app/api/cron/dispatch-scheduled-playbooks/route");
    const res = await GET(new Request("http://l/cron", {
      headers: { Authorization: "Bearer test-secret-1234567890" },
    }));
    const body = await res.json();

    expect(body.dispatched).toBe(1);
    expect(body.failed).toBe(0);
    expect(mockFetch).toHaveBeenCalledOnce();

    // Verify the internal-auth headers are both present
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/playbooks/run");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Sovereign-Internal-Secret"]).toBe("test-secret-1234567890");
    expect(headers["X-Sovereign-User-Id"]).toBe("user_a");

    // markDispatched called with the returned run ID
    expect(mockMarkDispatched).toHaveBeenCalledWith("sch_1", "run_abc");
    expect(mockMarkFailed).not.toHaveBeenCalled();
  });

  it("marks failed when the internal call returns non-OK", async () => {
    mockListDueNow.mockResolvedValue([
      { id: "sch_2", userId: "user_b", playbookId: "p", inputs: "{}" },
    ]);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402, // insufficient credits — still a dispatch failure
      json: async () => ({ error: "Insufficient credits" }),
    });

    const { GET } = await import("@/app/api/cron/dispatch-scheduled-playbooks/route");
    const res = await GET(new Request("http://l/cron", {
      headers: { Authorization: "Bearer test-secret-1234567890" },
    }));
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(mockMarkFailed).toHaveBeenCalledWith("sch_2");
    expect(mockMarkDispatched).not.toHaveBeenCalled();
  });

  it("marks failed when fetch throws (network error)", async () => {
    mockListDueNow.mockResolvedValue([
      { id: "sch_3", userId: "user_c", playbookId: "p", inputs: "{}" },
    ]);
    mockFetch.mockRejectedValue(new Error("Network unreachable"));

    const { GET } = await import("@/app/api/cron/dispatch-scheduled-playbooks/route");
    const res = await GET(new Request("http://l/cron", {
      headers: { Authorization: "Bearer test-secret-1234567890" },
    }));
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(mockMarkFailed).toHaveBeenCalledWith("sch_3");
  });

  it("treats malformed inputs JSON as empty object (doesn't break the tick)", async () => {
    mockListDueNow.mockResolvedValue([
      { id: "sch_4", userId: "user_d", playbookId: "p", inputs: "not json {{{" },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ runId: "run_xyz" }),
    });

    const { GET } = await import("@/app/api/cron/dispatch-scheduled-playbooks/route");
    const res = await GET(new Request("http://l/cron", {
      headers: { Authorization: "Bearer test-secret-1234567890" },
    }));

    expect(res.status).toBe(200);
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    // Empty inputs — not a crash
    expect(body.inputs).toEqual({});
  });

  it("processes multiple schedules in a single tick", async () => {
    mockListDueNow.mockResolvedValue([
      { id: "sch_a", userId: "u1", playbookId: "p1", inputs: "{}" },
      { id: "sch_b", userId: "u2", playbookId: "p2", inputs: "{}" },
      { id: "sch_c", userId: "u3", playbookId: "p3", inputs: "{}" },
    ]);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ runId: "r" }) });

    const { GET } = await import("@/app/api/cron/dispatch-scheduled-playbooks/route");
    const res = await GET(new Request("http://l/cron", {
      headers: { Authorization: "Bearer test-secret-1234567890" },
    }));
    const body = await res.json();

    expect(body.dispatched).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockMarkDispatched).toHaveBeenCalledTimes(3);
  });
});
