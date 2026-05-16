/**
 * Tests for src/lib/event-bus.ts — Wave 21.
 *
 * Pure in-process pub/sub. Every test resets the bus via the
 * test-only helper so subscriber state doesn't leak between cases.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  publish,
  subscribe,
  subscriberCount,
  publishAgentRunSealed,
  publishTokenIssued,
  publishGuardianBlock,
  _resetBusForTests,
} from "@/lib/event-bus";

beforeEach(() => {
  _resetBusForTests();
});

describe("publish + subscribe", () => {
  it("delivers an event to a same-tenant subscriber", () => {
    const seen: unknown[] = [];
    subscribe("tenant_a", (e) => seen.push(e));
    publish("agent.run.sealed", "tenant_a", { x: 1 });
    expect(seen).toHaveLength(1);
  });

  it("does NOT deliver tenant_a's events to a tenant_b subscriber", () => {
    const seen: unknown[] = [];
    subscribe("tenant_b", (e) => seen.push(e));
    publish("agent.run.sealed", "tenant_a", { x: 1 });
    expect(seen).toHaveLength(0);
  });

  it("delivers platform-wide ('*') events to every tenant subscriber", () => {
    const seenA: unknown[] = [];
    const seenB: unknown[] = [];
    subscribe("tenant_a", (e) => seenA.push(e));
    subscribe("tenant_b", (e) => seenB.push(e));
    publish("guardian.verdict.block", "*", { critical: true });
    expect(seenA).toHaveLength(1);
    expect(seenB).toHaveLength(1);
  });

  it("'*' subscribers (admin) receive every tenant's events", () => {
    const seen: unknown[] = [];
    subscribe("*", (e) => seen.push(e));
    publish("agent.run.sealed", "tenant_a", { x: 1 });
    publish("agent.run.sealed", "tenant_b", { x: 2 });
    publish("agent.run.sealed", "*", { x: 3 });
    expect(seen).toHaveLength(3);
  });

  it("assigns a monotonically-increasing event id", () => {
    const a = publish("agent.run.sealed", "*", {});
    const b = publish("agent.run.sealed", "*", {});
    expect(a.id).toMatch(/^evt_\d+$/);
    expect(b.id).toMatch(/^evt_\d+$/);
    expect(Number(b.id.slice(4))).toBe(Number(a.id.slice(4)) + 1);
  });

  it("stamps an ISO-8601 emittedAt", () => {
    const e = publish("agent.run.sealed", "*", {});
    expect(e.emittedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});

describe("subscribe — unsubscribe + isolation", () => {
  it("returns an unsubscribe function that removes the listener", () => {
    const seen: unknown[] = [];
    const off = subscribe("tenant_a", (e) => seen.push(e));
    publish("agent.run.sealed", "tenant_a", {});
    off();
    publish("agent.run.sealed", "tenant_a", {});
    expect(seen).toHaveLength(1);
  });

  it("subscriberCount reflects add + unsubscribe", () => {
    expect(subscriberCount()).toBe(0);
    const off1 = subscribe("tenant_a", () => {});
    const off2 = subscribe("*", () => {});
    expect(subscriberCount()).toBe(2);
    off1();
    expect(subscriberCount()).toBe(1);
    off2();
    expect(subscriberCount()).toBe(0);
  });

  it("isolates throwing subscribers — one bad listener doesn't break the chain", () => {
    const seen: unknown[] = [];
    subscribe("*", () => {
      throw new Error("bad listener");
    });
    subscribe("*", (e) => seen.push(e));
    expect(() => publish("agent.run.sealed", "*", {})).not.toThrow();
    expect(seen).toHaveLength(1);
  });
});

describe("typed publisher helpers", () => {
  it("publishAgentRunSealed emits the agent.run.sealed type", () => {
    const seen: Array<{ type: string }> = [];
    subscribe("*", (e) => seen.push(e));
    publishAgentRunSealed("tenant_a", {
      receiptId: "rcpt_1",
      agentName: "lead-blitz",
      modelUsed: "claude-sonnet-4-6",
      durationMs: 800,
      trustDecision: "auto-approved",
    });
    expect(seen[0]!.type).toBe("agent.run.sealed");
  });

  it("publishTokenIssued emits the agent.token.issued type", () => {
    const seen: Array<{ type: string }> = [];
    subscribe("*", (e) => seen.push(e));
    publishTokenIssued("tenant_a", {
      tokenId: "tok_1",
      agentSlug: "x",
      scopes: ["agent:run"],
    });
    expect(seen[0]!.type).toBe("agent.token.issued");
  });

  it("publishGuardianBlock emits the guardian.verdict.block type with payload", () => {
    const seen: Array<{ type: string; data: unknown }> = [];
    subscribe("*", (e) => seen.push(e));
    publishGuardianBlock("tenant_a", {
      verdictId: "v_1",
      agentSlug: "x",
      ruleId: "always-block",
      reason: "deny",
    });
    expect(seen[0]!.type).toBe("guardian.verdict.block");
    expect((seen[0]!.data as { ruleId: string }).ruleId).toBe("always-block");
  });

  it("late subscribers do NOT receive past events", () => {
    publish("agent.run.sealed", "*", {});
    const seen: unknown[] = [];
    subscribe("*", (e) => seen.push(e));
    expect(seen).toHaveLength(0);
  });
});

describe("delivery ordering", () => {
  it("delivers events to subscribers synchronously and in publish order", () => {
    const seen: number[] = [];
    subscribe("*", (e) => seen.push((e.data as { n: number }).n));
    publish("agent.run.sealed", "*", { n: 1 });
    publish("agent.run.sealed", "*", { n: 2 });
    publish("agent.run.sealed", "*", { n: 3 });
    expect(seen).toEqual([1, 2, 3]);
  });

  it("calls every matching subscriber exactly once per publish", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribe("tenant_x", a);
    subscribe("*", b);
    publish("agent.run.sealed", "tenant_x", {});
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
