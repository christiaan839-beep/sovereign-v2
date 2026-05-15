/**
 * Tests for src/lib/active-learning.ts — Cook 109.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetForTests,
  ACTIVE_LEARNING_CONSTANTS,
  batchFor,
  exportAll,
  record,
  type FeedbackEvent,
} from "../active-learning";

function event(
  id: string,
  agent: string,
  kind: FeedbackEvent["kind"] = "confidence-escalate",
  humanLabel?: FeedbackEvent["humanLabel"],
): FeedbackEvent {
  return {
    id,
    agentSlug: agent,
    tenantId: "t-1",
    kind,
    output: "model said X",
    correction: humanLabel === "wrong" ? "human said Y" : undefined,
    agentConfidence: 0.7,
    humanLabel,
    occurredAt: Date.now(),
  };
}

beforeEach(() => {
  _resetForTests();
});

describe("record", () => {
  it("rejects missing agentSlug / id", () => {
    expect(() => record({ ...event("a", ""), agentSlug: "" })).toThrow();
    expect(() => record({ ...event("", "x"), id: "" })).toThrow();
  });

  it("is idempotent on duplicate id", () => {
    record(event("e1", "lead-blitz"));
    record(event("e1", "lead-blitz"));
    expect(batchFor("lead-blitz").count).toBe(1);
  });

  it("drops oldest when buffer overflows", () => {
    for (let i = 0; i <= ACTIVE_LEARNING_CONSTANTS.MAX_BUFFER_PER_AGENT; i++) {
      record(event(`e-${i}`, "x"));
    }
    const b = batchFor("x");
    expect(b.count).toBe(ACTIVE_LEARNING_CONSTANTS.MAX_BUFFER_PER_AGENT);
    expect(b.events[0].id).not.toBe("e-0");
  });
});

describe("batchFor", () => {
  it("aggregates by kind", () => {
    record(event("a", "x", "confidence-escalate"));
    record(event("b", "x", "ensemble-override"));
    record(event("c", "x", "ensemble-override"));
    record(event("d", "x", "user-flag"));
    const b = batchFor("x");
    expect(b.count).toBe(4);
    expect(b.byKind["confidence-escalate"]).toBe(1);
    expect(b.byKind["ensemble-override"]).toBe(2);
    expect(b.byKind["user-flag"]).toBe(1);
  });

  it("computes errorRate from labelled events only", () => {
    record(event("a", "x", "user-flag", "correct"));
    record(event("b", "x", "user-flag", "wrong"));
    record(event("c", "x", "user-flag", "wrong"));
    record(event("d", "x", "user-flag")); // unlabelled
    const b = batchFor("x");
    expect(b.errorRate).toBeCloseTo(2 / 3, 4);
  });

  it("returns -1 errorRate when nothing is labelled", () => {
    record(event("a", "x", "user-flag"));
    expect(batchFor("x").errorRate).toBe(-1);
  });

  it("returns empty batch for unknown agent", () => {
    const b = batchFor("missing");
    expect(b.count).toBe(0);
    expect(b.events).toEqual([]);
  });
});

describe("exportAll", () => {
  it("returns one batch per agent that has events", () => {
    record(event("a", "agent-1"));
    record(event("b", "agent-2"));
    record(event("c", "agent-1"));
    const all = exportAll();
    expect(all.length).toBe(2);
    const a1 = all.find((b) => b.agentSlug === "agent-1")!;
    expect(a1.count).toBe(2);
  });
});
