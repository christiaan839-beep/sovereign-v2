import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
import { requestApproval, approveRequest, denyRequest, getPendingApprovals, getApproval, pruneApprovals } from "@/lib/hitl-approval";

// Mock fetch for Slack webhook
global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;

describe("hitl-approval.ts — Human-in-the-Loop", () => {
  it("creates a pending approval", async () => {
    const id = await requestApproval({ userId: "u1", agentName: "leads", action: "email.send", description: "Send 100 emails" });
    expect(id).toMatch(/^apr_/);
    const approval = getApproval(id);
    expect(approval?.status).toBe("pending");
  });

  it("approves a request", async () => {
    const id = await requestApproval({ userId: "u2", agentName: "abm", action: "email.bulk", description: "Bulk send" });
    expect(approveRequest(id, "admin@test.com")).toBe(true);
    expect(getApproval(id)?.status).toBe("approved");
    expect(getApproval(id)?.decidedBy).toBe("admin@test.com");
  });

  it("denies a request", async () => {
    const id = await requestApproval({ userId: "u3", agentName: "voice", action: "call.outbound", description: "Call client" });
    expect(denyRequest(id, "manager@test.com")).toBe(true);
    expect(getApproval(id)?.status).toBe("denied");
  });

  it("cannot approve already decided request", async () => {
    const id = await requestApproval({ userId: "u4", agentName: "test", action: "test", description: "Test" });
    approveRequest(id, "admin");
    expect(approveRequest(id, "admin2")).toBe(false); // Already approved
  });

  it("cannot deny already decided request", async () => {
    const id = await requestApproval({ userId: "u5", agentName: "test", action: "test", description: "Test" });
    denyRequest(id, "admin");
    expect(denyRequest(id, "admin2")).toBe(false);
  });

  it("lists pending approvals for user", async () => {
    await requestApproval({ userId: "u6", agentName: "a1", action: "act1", description: "D1" });
    await requestApproval({ userId: "u6", agentName: "a2", action: "act2", description: "D2" });
    const pending = getPendingApprovals("u6");
    expect(pending.length).toBeGreaterThanOrEqual(2);
  });

  it("returns undefined for nonexistent approval", () => {
    expect(getApproval("apr_nonexistent")).toBeUndefined();
  });

  it("prune removes nothing when all recent", () => {
    const pruned = pruneApprovals();
    expect(pruned).toBe(0); // All created just now
  });
});
