/**
 * Tests for src/lib/model-fingerprint.ts — Cook 130.
 */

import { describe, it, expect } from "vitest";
import {
  sealFingerprint,
  tokenSimilarity,
  verifyFingerprint,
  type BehaviorSample,
  type ModelIdentity,
} from "../model-fingerprint";

const ID: ModelIdentity = {
  provider: "anthropic",
  modelId: "claude-sonnet-4-6",
  announcedVersion: "2026-04-15",
};

function sample(prompt: string, output: string): BehaviorSample {
  return {
    prompt,
    output,
    params: { temperature: 0, max_tokens: 50 },
  };
}

describe("sealFingerprint", () => {
  it("rejects empty samples", () => {
    expect(() => sealFingerprint(ID, [])).toThrow();
  });

  it("returns deterministic hash for same inputs", () => {
    const s = [sample("canary-1", "alpha bravo"), sample("canary-2", "delta")];
    expect(sealFingerprint(ID, s).hash).toBe(sealFingerprint(ID, s).hash);
  });

  it("returns same hash regardless of sample order", () => {
    const a = sealFingerprint(ID, [
      sample("a", "1"),
      sample("b", "2"),
      sample("c", "3"),
    ]);
    const b = sealFingerprint(ID, [
      sample("c", "3"),
      sample("a", "1"),
      sample("b", "2"),
    ]);
    expect(a.hash).toBe(b.hash);
  });

  it("differs when identity differs", () => {
    const s = [sample("a", "1")];
    const a = sealFingerprint(ID, s);
    const b = sealFingerprint({ ...ID, modelId: "different" }, s);
    expect(a.hash).not.toBe(b.hash);
  });

  it("differs when sample output differs", () => {
    const a = sealFingerprint(ID, [sample("a", "1")]);
    const b = sealFingerprint(ID, [sample("a", "2")]);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("verifyFingerprint", () => {
  it("matches when live + recorded fingerprints are identical", () => {
    const samples = [sample("a", "1"), sample("b", "2")];
    const recorded = sealFingerprint(ID, samples);
    const v = verifyFingerprint(recorded, samples);
    expect(v.matches).toBe(true);
    expect(v.similarity).toBe(1);
  });

  it("rejects when output drifts", () => {
    const recorded = sealFingerprint(ID, [sample("a", "1")]);
    const v = verifyFingerprint(recorded, [sample("a", "DIFFERENT")]);
    expect(v.matches).toBe(false);
    expect(v.reason).toBeDefined();
  });
});

describe("tokenSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(tokenSimilarity("alpha bravo", "alpha bravo")).toBe(1);
  });

  it("returns 0 for disjoint strings", () => {
    expect(tokenSimilarity("alpha bravo", "delta echo")).toBe(0);
  });

  it("returns partial similarity for partial overlap", () => {
    const s = tokenSimilarity("alpha bravo charlie", "alpha bravo delta");
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });

  it("returns 1 for two empty strings", () => {
    expect(tokenSimilarity("", "")).toBe(1);
  });
});
