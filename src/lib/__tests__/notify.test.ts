/**
 * Tests for src/lib/notify.ts — User Notification System
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/activity-persist", () => ({
  persistAgentActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Mock fetch for Slack webhook
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch as unknown as typeof fetch;

import { notifyUser, notifyAgentComplete } from "@/lib/notify";
import { persistAgentActivity } from "@/lib/activity-persist";

describe("notify.ts — Notification System", () => {
  it("always persists to activity feed", async () => {
    await notifyUser("user_123", {
      title: "Leads ready",
      message: "Found 10 leads",
      agent: "leads",
      channel: "app",
    });

    expect(persistAgentActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        agentName: "leads",
        action: "completed",
      })
    );
  });

  it("sends Slack webhook when configured and channel includes slack", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

    await notifyUser("user_123", {
      title: "Report done",
      message: "Client report generated",
      agent: "client-report",
      channel: "slack",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://hooks.slack.com/test",
      expect.objectContaining({ method: "POST" })
    );

    delete process.env.SLACK_WEBHOOK_URL;
  });

  it("does not send Slack when channel is app-only", async () => {
    mockFetch.mockClear();
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

    await notifyUser("user_123", {
      title: "Test",
      message: "Test",
      agent: "test",
      channel: "app",
    });

    // fetch should NOT have been called for Slack
    const slackCalls = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].includes("slack.com")
    );
    expect(slackCalls.length).toBe(0);

    delete process.env.SLACK_WEBHOOK_URL;
  });

  it("notifyAgentComplete is a convenience wrapper", async () => {
    await notifyAgentComplete("user_456", "blog-gen", "Blog post about AI marketing generated");
    expect(persistAgentActivity).toHaveBeenCalled();
  });

  it("does not throw on failure", async () => {
    vi.mocked(persistAgentActivity).mockRejectedValueOnce(new Error("DB down"));

    await expect(
      notifyUser("user_123", {
        title: "Test",
        message: "Test",
        agent: "test",
      })
    ).resolves.not.toThrow();
  });
});
