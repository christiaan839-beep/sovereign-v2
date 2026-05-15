/**
 * Tests for src/lib/receipt-envelope-disclosure.ts — Cook 112.
 */

import { describe, it, expect } from "vitest";
import {
  commitEnvelope,
  discloseEnvelopeField,
  verifyEnvelopeDisclosure,
} from "../receipt-envelope-disclosure";

const ENV = {
  tenantId: "t-acme",
  agentSlug: "lead-blitz",
  committedAt: "2026-05-15T10:00:00Z",
  modelUsed: "nim",
  qualityScore: 0.94,
  inputBytes: 1234,
};

describe("commitEnvelope", () => {
  it("returns a 64-char hex root", () => {
    const c = commitEnvelope(ENV);
    expect(/^[a-f0-9]{64}$/.test(c.root)).toBe(true);
  });

  it("sorts fields alphabetically (stable order)", () => {
    const c = commitEnvelope(ENV);
    expect(c.fields).toEqual([...c.fields].sort());
  });

  it("rejects empty envelopes", () => {
    expect(() => commitEnvelope({})).toThrow();
  });

  it("is deterministic across runs", () => {
    expect(commitEnvelope(ENV).root).toBe(commitEnvelope({ ...ENV }).root);
  });

  it("differs when one field changes", () => {
    expect(commitEnvelope(ENV).root).not.toBe(
      commitEnvelope({ ...ENV, qualityScore: 0.95 }).root,
    );
  });
});

describe("discloseEnvelopeField + verifyEnvelopeDisclosure", () => {
  it("verifies the disclosed field against the published root", () => {
    const c = commitEnvelope(ENV);
    for (const field of c.fields) {
      const proof = discloseEnvelopeField(ENV, field);
      expect(verifyEnvelopeDisclosure(proof, c.root)).toBe(true);
    }
  });

  it("rejects a tampered value", () => {
    const c = commitEnvelope(ENV);
    const proof = discloseEnvelopeField(ENV, "tenantId");
    expect(
      verifyEnvelopeDisclosure({ ...proof, value: "t-attacker" }, c.root),
    ).toBe(false);
  });

  it("rejects a tampered sibling", () => {
    const c = commitEnvelope(ENV);
    const proof = discloseEnvelopeField(ENV, "tenantId");
    const sibs = [...proof.siblings];
    sibs[0] = "0".repeat(64);
    expect(verifyEnvelopeDisclosure({ ...proof, siblings: sibs }, c.root)).toBe(
      false,
    );
  });

  it("rejects an index parity flip", () => {
    const c = commitEnvelope(ENV);
    const proof = discloseEnvelopeField(ENV, "tenantId");
    expect(
      verifyEnvelopeDisclosure({ ...proof, index: proof.index ^ 1 }, c.root),
    ).toBe(false);
  });

  it("throws when field is not in the envelope", () => {
    expect(() => discloseEnvelopeField(ENV, "ghost")).toThrow();
  });
});

describe("non-disclosure property", () => {
  it("inclusion proof does not contain other field values verbatim", () => {
    commitEnvelope(ENV);
    const proof = discloseEnvelopeField(ENV, "tenantId");
    const serialized = JSON.stringify(proof);
    // None of the other field values should appear in the proof envelope.
    expect(serialized).not.toContain("lead-blitz");
    expect(serialized).not.toContain("2026-05-15T10:00:00Z");
    expect(serialized).not.toContain("0.94");
    expect(serialized).not.toContain("1234");
  });
});

describe("odd-field-count padding", () => {
  it("verifies records that aren't a power-of-two field count", () => {
    const odd = { a: 1, b: 2, c: 3 };
    const c = commitEnvelope(odd);
    const proof = discloseEnvelopeField(odd, "b");
    expect(verifyEnvelopeDisclosure(proof, c.root)).toBe(true);
  });

  it("verifies single-field records", () => {
    const one = { only: "field" };
    const c = commitEnvelope(one);
    const proof = discloseEnvelopeField(one, "only");
    expect(verifyEnvelopeDisclosure(proof, c.root)).toBe(true);
  });
});
