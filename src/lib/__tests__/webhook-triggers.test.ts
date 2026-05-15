/**
 * Tests for src/lib/webhook-triggers.ts — Cook 47.
 *
 *   - register: duplicate id throws.
 *   - dispatch: fires the matching agent; preserves order with multiple matches.
 *   - condition gate: returns "skipped" with the original trigger id.
 *   - unknown event type: returns "unknown-event".
 *   - signature verifier: missing secret OR bad signature returns invalid-signature.
 *   - buildInput shapes the payload.
 *   - runner exception: returns "error" with the message.
 */

import { describe, it, expect, vi } from "vitest";
import { TriggerRegistry, type AgentDispatcher } from "../webhook-triggers";

describe("TriggerRegistry — registration", () => {
  it("throws on duplicate id", () => {
    const r = new TriggerRegistry();
    r.register({
      id: "t1",
      source: "stripe",
      eventType: "checkout.session.completed",
      agent: "lead-blitz",
    });
    expect(() =>
      r.register({
        id: "t1",
        source: "stripe",
        eventType: "x",
        agent: "y",
      }),
    ).toThrow(/already registered/);
  });

  it("list() returns every registered trigger", () => {
    const r = new TriggerRegistry();
    r.register({
      id: "a",
      source: "stripe",
      eventType: "checkout.session.completed",
      agent: "x",
    });
    r.register({
      id: "b",
      source: "github",
      eventType: "pull_request.opened",
      agent: "y",
    });
    expect(r.list().map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("TriggerRegistry — dispatch happy path", () => {
  it("fires the matching agent with the raw payload", async () => {
    const runner = vi.fn().mockResolvedValue({ ok: true });
    const r = new TriggerRegistry();
    r.register({
      id: "stripe-checkout",
      source: "stripe",
      eventType: "checkout.session.completed",
      agent: "onboarding",
    });
    const out = await r.dispatch(
      {
        source: "stripe",
        eventType: "checkout.session.completed",
        payload: { amount: 50000 },
        rawBody: "",
        headers: {},
      },
      runner,
    );
    expect(out).toHaveLength(1);
    expect(out[0].outcome).toBe("fired");
    expect(runner).toHaveBeenCalledWith("onboarding", { amount: 50000 });
  });

  it("applies buildInput when provided", async () => {
    const runner = vi.fn().mockResolvedValue({});
    const r = new TriggerRegistry();
    r.register<{ amount: number }>({
      id: "t",
      source: "stripe",
      eventType: "checkout.session.completed",
      agent: "x",
      buildInput: (p) => ({ cents: p.amount }),
    });
    await r.dispatch(
      {
        source: "stripe",
        eventType: "checkout.session.completed",
        payload: { amount: 1234 },
        rawBody: "",
        headers: {},
      },
      runner,
    );
    expect(runner).toHaveBeenCalledWith("x", { cents: 1234 });
  });
});

describe("TriggerRegistry — condition gate", () => {
  it("returns skipped when condition returns false", async () => {
    const runner = vi.fn();
    const r = new TriggerRegistry();
    r.register<{ amount: number }>({
      id: "big-only",
      source: "stripe",
      eventType: "checkout.session.completed",
      agent: "vip-onboard",
      condition: (p) => p.amount > 100_000,
    });
    const out = await r.dispatch(
      {
        source: "stripe",
        eventType: "checkout.session.completed",
        payload: { amount: 5_000 },
        rawBody: "",
        headers: {},
      },
      runner,
    );
    expect(out[0].outcome).toBe("skipped");
    expect(runner).not.toHaveBeenCalled();
  });
});

describe("TriggerRegistry — unknown event", () => {
  it("returns unknown-event when nothing matches", async () => {
    const r = new TriggerRegistry();
    const out = await r.dispatch(
      {
        source: "github",
        eventType: "pull_request.opened",
        payload: {},
        rawBody: "",
        headers: {},
      },
      vi.fn(),
    );
    expect(out[0].outcome).toBe("unknown-event");
  });
});

describe("TriggerRegistry — signature verification", () => {
  it("requires a secret when a verifier is registered", async () => {
    const r = new TriggerRegistry();
    r.setVerifier("stripe", () => true);
    r.register({
      id: "t",
      source: "stripe",
      eventType: "x",
      agent: "y",
    });
    const out = await r.dispatch(
      {
        source: "stripe",
        eventType: "x",
        payload: {},
        rawBody: "",
        headers: {},
      },
      vi.fn(),
    );
    expect(out[0].outcome).toBe("invalid-signature");
    expect(out[0].message).toContain("Missing secret");
  });

  it("returns invalid-signature when verifier rejects", async () => {
    const r = new TriggerRegistry();
    r.setVerifier("stripe", () => false);
    r.register({
      id: "t",
      source: "stripe",
      eventType: "x",
      agent: "y",
    });
    const runner = vi.fn();
    const out = await r.dispatch(
      {
        source: "stripe",
        eventType: "x",
        payload: {},
        rawBody: "body",
        headers: {},
        secret: "s",
      },
      runner,
    );
    expect(out[0].outcome).toBe("invalid-signature");
    expect(runner).not.toHaveBeenCalled();
  });

  it("dispatches when verifier accepts", async () => {
    const r = new TriggerRegistry();
    r.setVerifier("stripe", () => true);
    r.register({
      id: "t",
      source: "stripe",
      eventType: "x",
      agent: "y",
    });
    const runner = vi.fn().mockResolvedValue("done");
    const out = await r.dispatch(
      {
        source: "stripe",
        eventType: "x",
        payload: {},
        rawBody: "body",
        headers: {},
        secret: "s",
      },
      runner,
    );
    expect(out[0].outcome).toBe("fired");
  });
});

describe("TriggerRegistry — runner errors", () => {
  it("returns error outcome when the runner throws", async () => {
    const r = new TriggerRegistry();
    r.register({
      id: "t",
      source: "generic",
      eventType: "boom",
      agent: "y",
    });
    const runner: AgentDispatcher = async () => {
      throw new Error("nope");
    };
    const out = await r.dispatch(
      {
        source: "generic",
        eventType: "boom",
        payload: {},
        rawBody: "",
        headers: {},
      },
      runner,
    );
    expect(out[0].outcome).toBe("error");
    expect(out[0].message).toContain("nope");
  });
});
