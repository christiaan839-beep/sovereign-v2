/**
 * Tests for src/lib/execution-budget.ts (wave 106).
 *
 * Coverage:
 *  - Pure helpers (fingerprint, canonicalJson via fingerprint)
 *  - Backward-compat no-op when no scope
 *  - Each of the three trip conditions in isolation
 *  - AsyncLocalStorage scoping (concurrent requests are isolated)
 *  - getExecutionStats read-only view
 *  - logExhaustion best-effort + audit row
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { auditLogMock } = vi.hoisted(() => ({
  auditLogMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/audit-log", () => ({
  auditLog: auditLogMock,
}));

import {
  withExecutionBudget,
  checkpoint,
  fingerprint,
  auditSafeFingerprint,
  ExecutionExhaustedError,
  DEFAULT_LIMITS,
  getExecutionStats,
  logExhaustion,
  runWithBudgetAndAudit,
} from "../execution-budget";

beforeEach(() => {
  auditLogMock.mockReset();
  auditLogMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fingerprint — pure helper", () => {
  it("is deterministic across key-order variations", () => {
    const a = fingerprint("tool", { x: 1, y: 2 });
    const b = fingerprint("tool", { y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it("differs when toolName differs", () => {
    expect(fingerprint("t1", { x: 1 })).not.toBe(fingerprint("t2", { x: 1 }));
  });

  it("differs when params differ", () => {
    expect(fingerprint("t", { x: 1 })).not.toBe(fingerprint("t", { x: 2 }));
  });

  it("handles undefined params", () => {
    expect(fingerprint("t", undefined)).toBe("t::undefined");
  });

  it("handles null params", () => {
    expect(fingerprint("t", null)).toBe("t::null");
  });

  it("handles arrays without key-sort confusion", () => {
    // arrays preserve order; [1,2] != [2,1]
    expect(fingerprint("t", [1, 2])).not.toBe(fingerprint("t", [2, 1]));
  });

  it("hashes large canonical forms (>256 chars) to keep fp small", () => {
    const big = { data: "x".repeat(500) };
    const fp = fingerprint("t", big);
    expect(fp.length).toBeLessThan(80); // "t::" + 32 hex chars
    expect(fp.startsWith("t::")).toBe(true);
  });

  it("nested objects also get key-sort canonicalisation", () => {
    const a = fingerprint("t", { outer: { a: 1, b: 2 } });
    const b = fingerprint("t", { outer: { b: 2, a: 1 } });
    expect(a).toBe(b);
  });

  it("returns sentinel on unserialisable params (review L2 fix)", () => {
    // BigInt cannot be JSON-stringified; previously would throw and
    // bypass the kill-switch. Now returns the sentinel so colliding
    // unserialisable payloads accelerate the identical_repeat trip.
    const fp = fingerprint("t", { x: BigInt(123) });
    expect(fp).toBe("t::__unserialisable__");
  });

  it("returns sentinel on circular references (review L2 fix)", () => {
    const obj: { self?: unknown } = {};
    obj.self = obj;
    const fp = fingerprint("t", obj);
    expect(fp).toBe("t::__unserialisable__");
  });
});

describe("auditSafeFingerprint — PII guard (review M1 fix)", () => {
  it("hashes the params portion so verbatim user data never reaches audit_logs", () => {
    const fp = fingerprint("send_email", {
      to: "user@example.com",
      body: "secret",
    });
    const safe = auditSafeFingerprint(fp);
    expect(safe).not.toContain("user@example.com");
    expect(safe).not.toContain("secret");
    expect(safe.startsWith("send_email::")).toBe(true);
  });

  it("is deterministic — same in-memory fp → same audit fp", () => {
    const fp1 = fingerprint("t", { a: 1, b: "x" });
    const fp2 = fingerprint("t", { b: "x", a: 1 });
    expect(auditSafeFingerprint(fp1)).toBe(auditSafeFingerprint(fp2));
  });

  it("handles fingerprints with no separator (defensive)", () => {
    expect(auditSafeFingerprint("malformed")).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe("checkpoint — no-op outside scope (backward compat)", () => {
  it("does not throw when called outside withExecutionBudget", () => {
    expect(() => checkpoint("t", { x: 1 })).not.toThrow();
  });

  it("getExecutionStats returns null outside scope", () => {
    expect(getExecutionStats()).toBeNull();
  });
});

describe("checkpoint — tool_call_cap trip", () => {
  it("trips at maxToolCalls+1", async () => {
    await expect(
      withExecutionBudget(
        { userId: "u", requestId: "r", limits: { maxToolCalls: 3 } },
        async () => {
          checkpoint("t", { i: 1 });
          checkpoint("t", { i: 2 });
          checkpoint("t", { i: 3 });
          // 4th call exceeds cap=3
          checkpoint("t", { i: 4 });
        },
      ),
    ).rejects.toThrow(ExecutionExhaustedError);
  });

  it("details capture toolCalls + limit at trip time", async () => {
    let caught: ExecutionExhaustedError | null = null;
    await withExecutionBudget(
      { userId: "u", requestId: "r", limits: { maxToolCalls: 2 } },
      async () => {
        try {
          checkpoint("t", { i: 1 });
          checkpoint("t", { i: 2 });
          checkpoint("t", { i: 3 });
        } catch (e) {
          caught = e as ExecutionExhaustedError;
        }
      },
    );
    expect(caught).toBeInstanceOf(ExecutionExhaustedError);
    expect(caught!.details.reason).toBe("tool_call_cap");
    expect(caught!.details.toolCalls).toBe(2);
    expect(caught!.details.limit).toBe(2);
  });
});

describe("checkpoint — identical_repeat trip (the T-F1 exhaustion pattern)", () => {
  it("trips when same fingerprint hits maxIdenticalRepeats+1 times", async () => {
    let caught: ExecutionExhaustedError | null = null;
    await withExecutionBudget(
      { userId: "u", requestId: "r", limits: { maxIdenticalRepeats: 3 } },
      async () => {
        try {
          checkpoint("loop_tool", { same: "params" });
          checkpoint("loop_tool", { same: "params" });
          checkpoint("loop_tool", { same: "params" });
          checkpoint("loop_tool", { same: "params" }); // 4th = trip
        } catch (e) {
          caught = e as ExecutionExhaustedError;
        }
      },
    );
    expect(caught).toBeInstanceOf(ExecutionExhaustedError);
    expect(caught!.details.reason).toBe("identical_repeat");
    expect(caught!.details.fingerprintCount).toBe(4);
    expect(caught!.details.fingerprint).toBeDefined();
  });

  it("does NOT trip for distinct fingerprints", async () => {
    await expect(
      withExecutionBudget(
        { userId: "u", requestId: "r", limits: { maxIdenticalRepeats: 2 } },
        async () => {
          checkpoint("t", { i: 1 });
          checkpoint("t", { i: 2 });
          checkpoint("t", { i: 3 });
          checkpoint("t", { i: 4 });
          // 4 distinct calls; no fingerprint repeated → no trip
        },
      ),
    ).resolves.not.toThrow();
  });

  it("trips even when tool_call_cap is far from being reached", async () => {
    // Real-world scenario: agent loops on same params well before
    // exhausting the per-request call budget.
    await expect(
      withExecutionBudget(
        {
          userId: "u",
          requestId: "r",
          limits: { maxToolCalls: 1000, maxIdenticalRepeats: 2 },
        },
        async () => {
          checkpoint("t", { stuck: true });
          checkpoint("t", { stuck: true });
          checkpoint("t", { stuck: true }); // 3rd = trip
        },
      ),
    ).rejects.toThrow(/identical_repeat/);
  });
});

describe("checkpoint — wall_clock trip", () => {
  it("trips when elapsed exceeds maxWallClockMs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
    let caught: ExecutionExhaustedError | null = null;
    await withExecutionBudget(
      { userId: "u", requestId: "r", limits: { maxWallClockMs: 1000 } },
      async () => {
        checkpoint("t", { i: 1 });
        vi.setSystemTime(new Date("2026-05-20T12:00:02.000Z")); // +2s
        try {
          checkpoint("t", { i: 2 });
        } catch (e) {
          caught = e as ExecutionExhaustedError;
        }
      },
    );
    expect(caught).toBeInstanceOf(ExecutionExhaustedError);
    expect(caught!.details.reason).toBe("wall_clock");
    expect(caught!.details.durationMs).toBeGreaterThanOrEqual(2000);
    expect(caught!.details.limit).toBe(1000);
  });
});

describe("withExecutionBudget — AsyncLocalStorage isolation", () => {
  it("concurrent budgets do not bleed into each other", async () => {
    const results: Array<{ id: string; calls: number }> = [];
    await Promise.all([
      withExecutionBudget(
        { userId: "a", requestId: "req-a", limits: { maxToolCalls: 100 } },
        async () => {
          checkpoint("t", { a: 1 });
          checkpoint("t", { a: 2 });
          await new Promise((r) => setTimeout(r, 5));
          checkpoint("t", { a: 3 });
          const s = getExecutionStats();
          results.push({ id: s!.requestId, calls: s!.toolCallsTotal });
        },
      ),
      withExecutionBudget(
        { userId: "b", requestId: "req-b", limits: { maxToolCalls: 100 } },
        async () => {
          checkpoint("t", { b: 1 });
          await new Promise((r) => setTimeout(r, 3));
          const s = getExecutionStats();
          results.push({ id: s!.requestId, calls: s!.toolCallsTotal });
        },
      ),
    ]);
    const a = results.find((r) => r.id === "req-a");
    const b = results.find((r) => r.id === "req-b");
    expect(a?.calls).toBe(3);
    expect(b?.calls).toBe(1);
  });

  it("default limits are used when none are supplied", async () => {
    await withExecutionBudget({ userId: "u", requestId: "r" }, async () => {
      const s = getExecutionStats();
      expect(s?.limits.maxToolCalls).toBe(DEFAULT_LIMITS.maxToolCalls);
      expect(s?.limits.maxIdenticalRepeats).toBe(
        DEFAULT_LIMITS.maxIdenticalRepeats,
      );
      expect(s?.limits.maxWallClockMs).toBe(DEFAULT_LIMITS.maxWallClockMs);
    });
  });

  it("default maxIdenticalRepeats is generous enough for retry loops (review M2)", () => {
    // Legitimate retry-with-exponential-backoff against Stripe/Pinecone
    // commonly retries 3-7x. Default must not mis-fire on healthy code.
    expect(DEFAULT_LIMITS.maxIdenticalRepeats).toBeGreaterThanOrEqual(8);
  });
});

describe("getExecutionStats — read-only view", () => {
  it("reflects tool calls + distinct fingerprints accurately", async () => {
    await withExecutionBudget({ userId: "u", requestId: "r" }, async () => {
      checkpoint("a", { x: 1 });
      checkpoint("a", { x: 2 });
      checkpoint("b", { x: 1 });
      const s = getExecutionStats();
      expect(s?.toolCallsTotal).toBe(3);
      expect(s?.distinctFingerprints).toBe(3);
    });
  });

  it("is frozen (read-only)", async () => {
    await withExecutionBudget({ userId: "u", requestId: "r" }, async () => {
      const s = getExecutionStats();
      expect(Object.isFrozen(s)).toBe(true);
    });
  });
});

describe("logExhaustion — best-effort audit", () => {
  it("emits an audit row with the kill-switch details", async () => {
    const err = new ExecutionExhaustedError({
      reason: "identical_repeat",
      toolCalls: 5,
      durationMs: 200,
      fingerprint: "tool::abc",
      fingerprintCount: 6,
      limit: 5,
    });
    await logExhaustion(err, "user-123", "req-xyz");
    expect(auditLogMock).toHaveBeenCalledTimes(1);
    const call = auditLogMock.mock.calls[0][0];
    expect(call.userId).toBe("user-123");
    expect(call.action).toBe("execution.exhausted");
    expect(call.resource).toBe("kill-switch:identical_repeat");
    expect(call.details.requestId).toBe("req-xyz");
    // Wave-106 review M1: fingerprint is hashed before crossing the
    // audit boundary; the verbatim params form must NOT appear.
    expect(call.details.fingerprint).not.toBe("tool::abc");
    expect(call.details.fingerprint).toMatch(/^tool::[a-f0-9]{32}$/);
  });

  it("scrubs PII from fingerprint when emitting to audit_logs (review M1)", async () => {
    const fp = fingerprint("send_email", {
      to: "victim@example.com",
      subject: "secret-leak",
    });
    const err = new ExecutionExhaustedError({
      reason: "identical_repeat",
      toolCalls: 8,
      durationMs: 50,
      fingerprint: fp,
      fingerprintCount: 9,
      limit: 8,
    });
    await logExhaustion(err, "user-x", "req-x");
    const auditedFp = auditLogMock.mock.calls[0][0].details.fingerprint;
    expect(auditedFp).not.toContain("victim@example.com");
    expect(auditedFp).not.toContain("secret-leak");
    expect(auditedFp.startsWith("send_email::")).toBe(true);
  });

  it("skips audit when userId is null (anonymous)", async () => {
    const err = new ExecutionExhaustedError({
      reason: "wall_clock",
      toolCalls: 0,
      durationMs: 99999,
      limit: 60000,
    });
    await logExhaustion(err, null, "req-anon");
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("swallows audit-log throws (kill-switch's first job is to STOP)", async () => {
    auditLogMock.mockRejectedValueOnce(new Error("db unreachable"));
    const err = new ExecutionExhaustedError({
      reason: "tool_call_cap",
      toolCalls: 50,
      durationMs: 100,
      limit: 50,
    });
    await expect(
      logExhaustion(err, "user-x", "req-y"),
    ).resolves.toBeUndefined();
  });
});

describe("runWithBudgetAndAudit — wave-107 route-handler ergonomic wrapper", () => {
  it("returns ok:true with the value when fn completes normally", async () => {
    const r = await runWithBudgetAndAudit(
      { userId: "u", requestId: "r" },
      async () => 42,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe(42);
      expect(r.stats?.requestId).toBe("r");
    }
  });

  it("returns ok:false with 429 + Retry-After when the kill-switch trips", async () => {
    const r = await runWithBudgetAndAudit(
      { userId: "u", requestId: "r", limits: { maxIdenticalRepeats: 1 } },
      async () => {
        checkpoint("t", { same: 1 });
        checkpoint("t", { same: 1 }); // 2nd same fp = trip with cap=1
        return "should not reach";
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(429);
      expect(r.reason).toBe("identical_repeat");
      expect(r.headers["Retry-After"]).toBe("30");
      expect(r.headers["X-Sovereign-Reason"]).toContain("kill-switch");
      expect(r.headers["X-Sovereign-Request-Id"]).toBe("r");
    }
  });

  it("emits an audit row when the kill-switch trips", async () => {
    auditLogMock.mockReset();
    auditLogMock.mockResolvedValue(undefined);
    await runWithBudgetAndAudit(
      {
        userId: "audit-user",
        requestId: "audit-req",
        limits: { maxToolCalls: 1 },
      },
      async () => {
        checkpoint("t", { i: 1 });
        checkpoint("t", { i: 2 });
      },
    );
    // logExhaustion is fire-and-forget — give the microtask queue a tick
    await new Promise((r) => setTimeout(r, 5));
    expect(auditLogMock).toHaveBeenCalledTimes(1);
    expect(auditLogMock.mock.calls[0][0].userId).toBe("audit-user");
    expect(auditLogMock.mock.calls[0][0].action).toBe("execution.exhausted");
  });

  it("does NOT swallow non-ExecutionExhaustedError throws", async () => {
    await expect(
      runWithBudgetAndAudit({ userId: "u", requestId: "r" }, async () => {
        throw new Error("real bug");
      }),
    ).rejects.toThrow("real bug");
  });

  it("works with userId=null (anonymous calls)", async () => {
    const r = await runWithBudgetAndAudit(
      { userId: null, requestId: "anon", limits: { maxIdenticalRepeats: 1 } },
      async () => {
        checkpoint("t", { x: 1 });
        checkpoint("t", { x: 1 });
      },
    );
    expect(r.ok).toBe(false);
  });
});
