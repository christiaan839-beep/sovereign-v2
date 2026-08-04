/**
 * Tests for /api/_content/schedule POST.
 *
 * Previously this route validated the payload and returned a fake
 * `{ status: "QUEUED" }` success without persisting anything or checking
 * auth — a silent no-op. It now requires auth and writes into the same
 * scheduled_content table the cron publisher polls.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAuth = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: () => mockAuth(),
}));
vi.mock("@/db", () => ({ db: { insert: mockInsert } }));
vi.mock("@/db/schema", () => ({ scheduledContent: {} }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/_content/schedule/route");
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/_content/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  campaignId: "camp_1",
  platform: "linkedin",
  content: "Ship it.",
  executeAt: "2026-08-01T09:00:00.000Z",
};

describe("POST /api/_content/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user_test_123", email: "a@b.com" });
    mockReturning.mockResolvedValue([{ id: "row_1", status: "scheduled" }]);
  });

  it("rejects unauthenticated callers before touching the DB", async () => {
    mockAuth.mockResolvedValue({
      error: new Response(null, { status: 401 }),
    });
    const { POST } = await loadRoute();
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid platform", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ ...validBody, platform: "myspace" }));
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects a non-ISO executeAt", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ ...validBody, executeAt: "next tuesday" }),
    );
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("actually persists the row instead of faking success", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      id: string;
      status: string;
    };
    expect(json.success).toBe(true);
    expect(json.id).toBe("row_1");
    expect(json.status).toBe("scheduled");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "Ship it.",
        platform: "linkedin",
        status: "scheduled",
      }),
    );
  });

  it("returns TRANSMISSION_FAILED (not a fake success) when the insert throws", async () => {
    mockReturning.mockRejectedValue(new Error("db down"));
    const { POST } = await loadRoute();
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("TRANSMISSION_FAILED");
  });
});
