/**
 * Tests for src/lib/activity-persist.ts — Agent Activity Persistence
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  agentActivity: {},
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { persistAgentActivity } from "@/lib/activity-persist";
import { db } from "@/db";

describe("activity-persist.ts", () => {
  it("inserts activity record to database", async () => {
    await persistAgentActivity({
      userId: "user_123",
      agentName: "leads",
      agentType: "leads",
      action: "completed",
      summary: "Found 10 leads",
    });

    expect(db.insert).toHaveBeenCalled();
  });

  it("does not throw on DB failure (fire-and-forget)", async () => {
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockRejectedValue(new Error("DB down")),
    } as never);

    // Should not throw
    await expect(
      persistAgentActivity({
        userId: "user_123",
        agentName: "leads",
        agentType: "leads",
        action: "failed",
        summary: "Error occurred",
      })
    ).resolves.toBeUndefined();
  });

  it("passes correct fields", async () => {
    const mockValues = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

    await persistAgentActivity({
      userId: "user_456",
      agentName: "blog-gen",
      agentType: "blog-gen",
      action: "completed",
      summary: "Blog post generated",
      metadata: '{"durationMs": 1200}',
    });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_456",
        agentName: "blog-gen",
        action: "completed",
        summary: "Blog post generated",
        metadata: '{"durationMs": 1200}',
        isRead: false,
      })
    );
  });
});
