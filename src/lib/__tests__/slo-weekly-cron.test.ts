/**
 * /api/cron/slo-weekly — tests.
 *
 * Reads SLOs via checkAllSLOs, posts breaches to Slack. Auth-gated
 * via Bearer CRON_SECRET (verifyCron).
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const { mockVerifyCron, mockCheckAllSLOs, mockFetch } = vi.hoisted(() => ({
  mockVerifyCron: vi.fn(),
  mockCheckAllSLOs: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCron: mockVerifyCron }));
vi.mock("@/lib/slo-tracking", () => ({
  checkAllSLOs: mockCheckAllSLOs,
}));

const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockVerifyCron.mockReset();
  mockCheckAllSLOs.mockReset();
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

import { POST, GET } from "@/app/api/cron/slo-weekly/route";

describe("/api/cron/slo-weekly", () => {
  it("401 when auth fails", async () => {
    mockVerifyCron.mockReturnValue(
      new Response("{}", { status: 401 }),
    );
    const res = await POST(new Request("http://l/api/cron/slo-weekly"));
    expect(res.status).toBe(401);
  });

  it("returns reports for all SLOs", async () => {
    mockVerifyCron.mockReturnValue(null);
    mockCheckAllSLOs.mockResolvedValue([
      { slo: "health_availability", breached: false, current: 0.999, target: 0.999, sampleCount: 100, windowDays: 30, message: "OK" },
      { slo: "agent_latency_p95", breached: true, current: 9000, target: 8000, sampleCount: 500, windowDays: 7, message: "p95 9000ms" },
    ]);

    const res = await POST(new Request("http://l/api/cron/slo-weekly"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toHaveLength(2);
    expect(body.breaches).toBe(1);
    expect(body.ok_count).toBe(1);
  });

  it("posts to Slack when any SLO is breached", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    mockVerifyCron.mockReturnValue(null);
    mockCheckAllSLOs.mockResolvedValue([
      { slo: "agent_latency_p95", breached: true, current: 9000, target: 8000, sampleCount: 500, windowDays: 7, message: "p95 9000ms" },
    ]);
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));

    await POST(new Request("http://l/api/cron/slo-weekly"));
    expect(mockFetch).toHaveBeenCalledWith(
      "https://hooks.slack.com/test",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does NOT post to Slack when nothing breached", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    mockVerifyCron.mockReturnValue(null);
    mockCheckAllSLOs.mockResolvedValue([
      { slo: "health_availability", breached: false, current: 0.999, target: 0.999, sampleCount: 100, windowDays: 30, message: "OK" },
    ]);
    await POST(new Request("http://l/api/cron/slo-weekly"));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips Slack when SLACK_WEBHOOK_URL is unset", async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    mockVerifyCron.mockReturnValue(null);
    mockCheckAllSLOs.mockResolvedValue([
      { slo: "agent_latency_p95", breached: true, current: 9000, target: 8000, sampleCount: 500, windowDays: 7, message: "breach" },
    ]);
    const res = await POST(new Request("http://l/api/cron/slo-weekly"));
    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.slackPosted).toBe(false);
  });

  it("GET parity with POST", async () => {
    mockVerifyCron.mockReturnValue(null);
    mockCheckAllSLOs.mockResolvedValue([]);
    const res = await GET(new Request("http://l/api/cron/slo-weekly"));
    expect(res.status).toBe(200);
  });

  it("returns 500 when checkAllSLOs throws", async () => {
    mockVerifyCron.mockReturnValue(null);
    mockCheckAllSLOs.mockRejectedValue(new Error("redis down"));
    const res = await POST(new Request("http://l/api/cron/slo-weekly"));
    expect(res.status).toBe(500);
  });
});

// Restore fetch after the describe block.
afterAll(() => {
  globalThis.fetch = originalFetch;
});
