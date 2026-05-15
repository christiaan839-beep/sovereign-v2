/**
 * Tests for src/lib/async-task-queue.ts — Cook 127.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetForTests,
  ack,
  enqueue,
  get,
  lease,
  listByStatus,
  listForTenant,
  nack,
} from "../async-task-queue";

beforeEach(() => {
  _resetForTests();
});

describe("enqueue", () => {
  it("rejects missing tenantId / kind", () => {
    expect(() => enqueue({ tenantId: "", kind: "x", payload: {} })).toThrow();
    expect(() => enqueue({ tenantId: "t", kind: "", payload: {} })).toThrow();
  });

  it("creates a task with pending status + tsk_ prefix", () => {
    const t = enqueue({ tenantId: "t-1", kind: "audit", payload: { x: 1 } });
    expect(t.status).toBe("pending");
    expect(t.id.startsWith("tsk_")).toBe(true);
  });
});

describe("lease — selection", () => {
  it("returns null when nothing is eligible", () => {
    expect(lease({ tenantId: "t-1" })).toBeNull();
  });

  it("picks the highest-priority pending task", () => {
    const low = enqueue({
      tenantId: "t-1",
      kind: "audit",
      payload: {},
      priority: 1,
    });
    const high = enqueue({
      tenantId: "t-1",
      kind: "audit",
      payload: {},
      priority: 10,
    });
    void low;
    const leased = lease({ tenantId: "t-1" });
    expect(leased?.id).toBe(high.id);
  });

  it("respects FIFO for equal priorities", () => {
    enqueue({ tenantId: "t-1", kind: "audit", payload: { a: 1 }, now: 1 });
    const second = enqueue({
      tenantId: "t-1",
      kind: "audit",
      payload: { b: 2 },
      now: 2,
    });
    void second;
    const leased = lease({ tenantId: "t-1" });
    expect((leased?.payload as { a: number }).a).toBe(1);
  });

  it("filters by kind", () => {
    enqueue({ tenantId: "t-1", kind: "audit", payload: {} });
    const x = enqueue({ tenantId: "t-1", kind: "delivery", payload: {} });
    const leased = lease({ tenantId: "t-1", kinds: ["delivery"] });
    expect(leased?.id).toBe(x.id);
  });

  it("filters by tenant", () => {
    enqueue({ tenantId: "t-a", kind: "audit", payload: {} });
    const t = enqueue({ tenantId: "t-b", kind: "audit", payload: {} });
    const leased = lease({ tenantId: "t-b" });
    expect(leased?.id).toBe(t.id);
  });

  it("marks task in-flight + sets leaseExpiresAt", () => {
    enqueue({
      tenantId: "t",
      kind: "audit",
      payload: {},
      now: 1000,
    });
    const leased = lease({
      tenantId: "t",
      visibilityTimeoutMs: 30_000,
      now: 1000,
    });
    expect(leased?.status).toBe("in-flight");
    expect(leased?.leaseExpiresAt).toBe(31_000);
  });
});

describe("ack", () => {
  it("transitions an in-flight task to succeeded", () => {
    enqueue({ tenantId: "t", kind: "audit", payload: {} });
    const leased = lease({ tenantId: "t" })!;
    expect(ack(leased.id)).toBe(true);
    expect(get(leased.id)?.status).toBe("succeeded");
  });

  it("returns false on non-in-flight task", () => {
    const t = enqueue({ tenantId: "t", kind: "audit", payload: {} });
    expect(ack(t.id)).toBe(false);
  });
});

describe("nack", () => {
  it("reschedules with delay when attempts < max", () => {
    enqueue({
      tenantId: "t",
      kind: "audit",
      payload: {},
      maxAttempts: 3,
      now: 1000,
    });
    const leased = lease({ tenantId: "t", now: 1000 })!;
    nack({ id: leased.id, error: "transient", delayMs: 5000, now: 1000 });
    const rec = get(leased.id)!;
    expect(rec.status).toBe("pending");
    expect(rec.visibleAt).toBe(6000);
    expect(rec.lastError).toBe("transient");
  });

  it("moves to dead when max attempts exhausted", () => {
    enqueue({
      tenantId: "t",
      kind: "audit",
      payload: {},
      maxAttempts: 2,
    });
    const a = lease({ tenantId: "t" })!;
    nack({ id: a.id, error: "err1", now: 1000 });
    const b = lease({ tenantId: "t" })!;
    nack({ id: b.id, error: "err2", now: 2000 });
    expect(get(a.id)?.status).toBe("dead");
  });
});

describe("lease — visibility-timeout recovery", () => {
  it("re-leases a task whose lease has expired", () => {
    enqueue({ tenantId: "t", kind: "audit", payload: {}, now: 0 });
    const first = lease({ tenantId: "t", visibilityTimeoutMs: 100, now: 0 })!;
    // Don't ack — let the lease expire.
    const second = lease({ tenantId: "t", now: 200 });
    expect(second?.id).toBe(first.id);
    expect(second?.attempts).toBe(2);
  });
});

describe("listByStatus + listForTenant", () => {
  it("groups tasks by status", () => {
    enqueue({ tenantId: "t", kind: "a", payload: {} });
    enqueue({ tenantId: "t", kind: "b", payload: {} });
    expect(listByStatus("pending").length).toBe(2);
  });

  it("listForTenant returns newest-first", () => {
    enqueue({ tenantId: "t", kind: "a", payload: {}, now: 1 });
    enqueue({ tenantId: "t", kind: "b", payload: {}, now: 2 });
    expect(listForTenant("t")[0].kind).toBe("b");
  });
});
