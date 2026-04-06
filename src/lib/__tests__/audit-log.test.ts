/**
 * Tests for src/lib/audit-log.ts — SOC 2 Audit Trail
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (...args: unknown[]) => ({ queryChunks: args }),
    { raw: (s: string) => s }
  ),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { auditLog } from "@/lib/audit-log";
import { db } from "@/db";

describe("audit-log.ts — SOC 2 Compliance", () => {
  it("logs an audit event to the database", async () => {
    await auditLog({
      userId: "user_123",
      action: "agent.execute",
      resource: "leads",
      details: { durationMs: 1200, success: true },
    });
    expect(db.execute).toHaveBeenCalled();
  });

  it("does not throw on DB failure", async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error("DB down"));
    await expect(
      auditLog({ userId: "user_123", action: "agent.execute" })
    ).resolves.not.toThrow();
  });
});
