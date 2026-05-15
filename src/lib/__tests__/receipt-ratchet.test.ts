/**
 * Tests for src/lib/receipt-ratchet.ts — Cook 94.
 *
 *   - initRatchet rejects empty root.
 *   - advance produces a different key each epoch.
 *   - signWithEpoch + verifyWithEpoch round-trip.
 *   - reachEpoch matches the iterative chain (forward secrecy contract).
 *   - leaked epoch key cannot sign as an earlier epoch.
 *   - tampered signature is rejected.
 */

import { describe, it, expect } from "vitest";
import {
  advance,
  initRatchet,
  reachEpoch,
  signWithEpoch,
  verifyWithEpoch,
} from "../receipt-ratchet";

const ROOT = "test-root-key-32-chars-or-more-yes-it-is";

describe("initRatchet", () => {
  it("rejects empty root", () => {
    expect(() => initRatchet("")).toThrow();
  });

  it("produces a 64-char hex epoch-0 key", () => {
    const s = initRatchet(ROOT);
    expect(s.current.index).toBe(0);
    expect(/^[a-f0-9]{64}$/.test(s.current.key)).toBe(true);
  });
});

describe("advance", () => {
  it("produces a different key each epoch", () => {
    let s = initRatchet(ROOT);
    const seen = new Set([s.current.key]);
    for (let i = 0; i < 8; i++) {
      const adv = advance(s);
      expect(seen.has(adv.next.current.key)).toBe(false);
      seen.add(adv.next.current.key);
      s = adv.next;
    }
  });

  it("increments index by 1 per advance", () => {
    const s0 = initRatchet(ROOT);
    const s1 = advance(s0).next;
    const s2 = advance(s1).next;
    expect(s1.current.index).toBe(1);
    expect(s2.current.index).toBe(2);
  });
});

describe("sign + verify", () => {
  it("round-trips a canonical payload", () => {
    const s = initRatchet(ROOT);
    const sig = signWithEpoch(s, "canonical-string");
    expect(verifyWithEpoch(s.current, "canonical-string", sig.signature)).toBe(
      true,
    );
  });

  it("rejects a tampered payload", () => {
    const s = initRatchet(ROOT);
    const sig = signWithEpoch(s, "canonical-string");
    expect(verifyWithEpoch(s.current, "tampered", sig.signature)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const s = initRatchet(ROOT);
    const sig = signWithEpoch(s, "x");
    const bad =
      sig.signature.slice(0, -2) + (sig.signature.endsWith("0") ? "11" : "00");
    expect(verifyWithEpoch(s.current, "x", bad)).toBe(false);
  });
});

describe("reachEpoch", () => {
  it("matches the iteratively-advanced chain", () => {
    let s = initRatchet(ROOT);
    for (let i = 0; i < 5; i++) s = advance(s).next;
    const reached = reachEpoch(ROOT, 5);
    expect(reached.key).toBe(s.current.key);
    expect(reached.index).toBe(5);
  });

  it("rejects negative index", () => {
    expect(() => reachEpoch(ROOT, -1)).toThrow();
  });
});

describe("forward secrecy", () => {
  it("a later epoch key cannot sign as an earlier epoch", () => {
    // Sign with epoch 0; capture k0.
    const s0 = initRatchet(ROOT);
    const sig0 = signWithEpoch(s0, "msg");
    // Reach epoch 5 from root.
    const e5 = reachEpoch(ROOT, 5);
    // Verifying sig0 (an epoch-0 sig) under epoch 5's key must fail.
    expect(verifyWithEpoch(e5, "msg", sig0.signature)).toBe(false);
  });
});
