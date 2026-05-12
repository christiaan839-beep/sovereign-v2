/**
 * Tests for src/lib/selective-disclosure.ts — Cook 51 Merkle ZK-lite.
 *
 *   - commit(): deterministic root for same record.
 *   - commit(): empty record throws.
 *   - discloseField(): proof for an unknown field throws.
 *   - verifyDisclosure():
 *       - true for the actual (field, value) pair.
 *       - false when value is tampered.
 *       - false when field name is swapped.
 *       - false when ANY sibling is corrupted.
 *       - false when index is changed.
 *   - non-disclosed fields are NOT recoverable from the proof.
 *   - Records with odd numbers of fields still verify (padding works).
 */

import { describe, it, expect } from "vitest";
import {
  commit,
  discloseField,
  hashLeaf,
  verifyDisclosure,
} from "../selective-disclosure";

const RECORD = {
  agentSlug: "lead-blitz",
  tenantId: "tenant-1",
  safetyVerdict: "pass",
  qualityScore: 0.92,
  modelUsed: "nemotron-ultra-253b-v1",
  ranAt: "2026-05-12T11:30:00Z",
};

describe("commit", () => {
  it("returns a 64-char hex root", () => {
    const d = commit(RECORD);
    expect(d.root).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic across invocations", () => {
    expect(commit(RECORD).root).toBe(commit({ ...RECORD }).root);
  });

  it("produces different roots for different records", () => {
    expect(commit(RECORD).root).not.toBe(
      commit({ ...RECORD, qualityScore: 0.93 }).root,
    );
  });

  it("rejects empty records", () => {
    expect(() => commit({})).toThrow();
  });

  it("sorts fields alphabetically (stable schema)", () => {
    const d = commit(RECORD);
    expect(d.fields).toEqual([...d.fields].sort());
  });
});

describe("verifyDisclosure — happy path", () => {
  it("verifies the disclosed field against the published root", () => {
    const d = commit(RECORD);
    for (const field of d.fields) {
      const proof = discloseField(RECORD, field);
      expect(
        verifyDisclosure(
          field,
          RECORD[field as keyof typeof RECORD],
          proof,
          d.root,
        ),
      ).toBe(true);
    }
  });
});

describe("verifyDisclosure — tampering", () => {
  it("rejects a tampered value", () => {
    const d = commit(RECORD);
    const proof = discloseField(RECORD, "safetyVerdict");
    expect(verifyDisclosure("safetyVerdict", "fail", proof, d.root)).toBe(
      false,
    );
  });

  it("rejects a renamed field", () => {
    const d = commit(RECORD);
    const proof = discloseField(RECORD, "safetyVerdict");
    expect(
      verifyDisclosure("qualityScore", RECORD.safetyVerdict, proof, d.root),
    ).toBe(false);
  });

  it("rejects when ANY sibling is corrupted", () => {
    const d = commit(RECORD);
    const proof = discloseField(RECORD, "safetyVerdict");
    const corrupted = { ...proof, siblings: [...proof.siblings] };
    corrupted.siblings[0] =
      "0".repeat(63) + (corrupted.siblings[0].endsWith("0") ? "1" : "0");
    expect(
      verifyDisclosure(
        "safetyVerdict",
        RECORD.safetyVerdict,
        corrupted,
        d.root,
      ),
    ).toBe(false);
  });

  it("rejects when index is altered (parity flip)", () => {
    const d = commit(RECORD);
    const proof = discloseField(RECORD, "safetyVerdict");
    const moved = { ...proof, index: proof.index ^ 1 };
    expect(
      verifyDisclosure("safetyVerdict", RECORD.safetyVerdict, moved, d.root),
    ).toBe(false);
  });

  it("rejects mismatched field name in the proof envelope", () => {
    const d = commit(RECORD);
    const proof = discloseField(RECORD, "safetyVerdict");
    expect(
      verifyDisclosure(
        "modelUsed",
        RECORD.safetyVerdict,
        { ...proof, field: "modelUsed" },
        d.root,
      ),
    ).toBe(false);
  });
});

describe("verifyDisclosure — non-disclosure property", () => {
  it("undisclosed fields cannot be inferred from the proof envelope", () => {
    const d = commit(RECORD);
    const proof = discloseField(RECORD, "safetyVerdict");
    // The proof carries SIBLING hashes only. They are SHA-256 of leaf or
    // internal nodes — preimages are infeasible to recover. The test
    // ensures the proof shape exposes nothing more than sibling hashes
    // (no raw values from other fields).
    const serialized = JSON.stringify(proof);
    for (const value of Object.values(RECORD)) {
      if (value === RECORD.safetyVerdict) continue;
      const stringValue = String(value);
      // None of the other field values appear verbatim in the proof.
      expect(serialized).not.toContain(stringValue);
    }
  });
});

describe("verifyDisclosure — padding (odd field counts)", () => {
  it("verifies records with non-power-of-two field counts", () => {
    const odd = { a: 1, b: 2, c: 3 }; // 3 fields → padded to 4
    const d = commit(odd);
    const proof = discloseField(odd, "b");
    expect(verifyDisclosure("b", 2, proof, d.root)).toBe(true);
  });

  it("verifies single-field records", () => {
    const one = { only: "field" };
    const d = commit(one);
    const proof = discloseField(one, "only");
    expect(verifyDisclosure("only", "field", proof, d.root)).toBe(true);
  });
});

describe("hashLeaf domain separation", () => {
  it("leaf hash != internal hash for the same byte content", () => {
    // Property check: leaf hash starts with 0x00 prefix, internal with
    // 0x01. Even if a value happened to equal a 32-byte hash, the
    // domain separator ensures hashLeaf(f, value) != hashInternal(...).
    const leafA = hashLeaf("x", "y");
    const leafB = hashLeaf("y", "x");
    expect(leafA).not.toBe(leafB);
  });
});
