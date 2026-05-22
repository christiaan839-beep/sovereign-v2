/**
 * Tests for src/lib/federated-aggregator.ts — Wave 146.
 *
 * Pure-function tests pinning the federated mean, trimmed mean,
 * outlier rejection by tensor norm, and Laplace DP noise.
 */
import { describe, it, expect } from "vitest";

import {
  aggregate,
  laplaceNoise,
  type Contribution,
} from "@/lib/federated-aggregator";

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

describe("aggregate — empty + edge", () => {
  it("returns zero-shape on empty input", () => {
    const r = aggregate([]);
    expect(r.contributorsUsed).toBe(0);
    expect(r.scalar).toBeUndefined();
    expect(r.tensor).toBeUndefined();
  });

  it("returns scalar but undefined tensor when no tensor contributions", () => {
    const r = aggregate([
      { contributorId: "a", scalar: 0.5 },
      { contributorId: "b", scalar: 0.7 },
    ]);
    expect(r.scalar).toBeCloseTo(0.6, 2);
    expect(r.tensor).toBeUndefined();
  });
});

describe("aggregate — weighted scalar mean", () => {
  it("computes unweighted mean", () => {
    const r = aggregate([
      { contributorId: "a", scalar: 0.4 },
      { contributorId: "b", scalar: 0.6 },
      { contributorId: "c", scalar: 0.8 },
    ]);
    expect(r.scalar).toBeCloseTo(0.6, 4);
  });

  it("weights by sample count", () => {
    const r = aggregate([
      { contributorId: "a", scalar: 0.4, weight: 100 },
      { contributorId: "b", scalar: 0.9, weight: 1 },
    ]);
    expect(r.scalar).toBeCloseTo((0.4 * 100 + 0.9) / 101, 4);
  });

  it("ignores contributions without scalar", () => {
    const r = aggregate([
      { contributorId: "a", scalar: 0.5 },
      { contributorId: "b", tensor: [1, 2, 3] },
    ]);
    expect(r.scalar).toBe(0.5);
  });
});

describe("aggregate — tensor mean", () => {
  it("element-wise averages tensors", () => {
    const r = aggregate([
      { contributorId: "a", tensor: [1, 2, 3] },
      { contributorId: "b", tensor: [3, 4, 5] },
    ]);
    expect(r.tensor).toEqual([2, 3, 4]);
  });

  it("weights tensors", () => {
    const r = aggregate([
      { contributorId: "a", tensor: [0, 0], weight: 100 },
      { contributorId: "b", tensor: [10, 20], weight: 1 },
    ]);
    expect(r.tensor![0]).toBeCloseTo(10 / 101, 4);
    expect(r.tensor![1]).toBeCloseTo(20 / 101, 4);
  });

  it("throws on tensor length mismatch", () => {
    expect(() =>
      aggregate([
        { contributorId: "a", tensor: [1, 2, 3] },
        { contributorId: "b", tensor: [1, 2] },
      ]),
    ).toThrow(/length mismatch/i);
  });
});

describe("aggregate — outlier rejection by tensor norm", () => {
  it("drops contributors with norm > k × median", () => {
    const r = aggregate(
      [
        { contributorId: "a", tensor: [1, 1] }, // norm √2
        { contributorId: "b", tensor: [1, 1] },
        { contributorId: "c", tensor: [1, 1] },
        { contributorId: "evil", tensor: [100, 100] }, // outlier
      ],
      { outlierRejectK: 5 },
    );
    expect(r.contributorsDropped).toBeGreaterThanOrEqual(1);
    expect(r.tensor).toBeDefined();
    // Outlier rejected → mean should be near [1, 1]
    expect(r.tensor![0]).toBeLessThan(10);
    expect(r.tensor![1]).toBeLessThan(10);
  });

  it("keeps everyone when no outliers", () => {
    const r = aggregate(
      [
        { contributorId: "a", tensor: [1, 1] },
        { contributorId: "b", tensor: [1.2, 0.9] },
        { contributorId: "c", tensor: [0.8, 1.1] },
      ],
      { outlierRejectK: 5 },
    );
    expect(r.contributorsDropped).toBe(0);
    expect(r.contributorsUsed).toBe(3);
  });
});

describe("aggregate — trimmed mean for scalars", () => {
  it("drops top + bottom k% before averaging", () => {
    const r = aggregate(
      [
        { contributorId: "a", scalar: 0 }, // dropped
        { contributorId: "b", scalar: 0.4 },
        { contributorId: "c", scalar: 0.5 },
        { contributorId: "d", scalar: 0.6 },
        { contributorId: "e", scalar: 1 }, // dropped
      ],
      { trimFraction: 0.2 },
    );
    expect(r.contributorsDropped).toBeGreaterThanOrEqual(2);
    expect(r.scalar).toBeCloseTo(0.5, 2);
  });

  it("ignores trim when fewer than 4 contributors", () => {
    const r = aggregate(
      [
        { contributorId: "a", scalar: 0 },
        { contributorId: "b", scalar: 1 },
      ],
      { trimFraction: 0.5 },
    );
    expect(r.scalar).toBe(0.5);
  });

  it("caps trimFraction at 0.5 (can't trim more than half)", () => {
    const r = aggregate(
      [
        { contributorId: "a", scalar: 0 },
        { contributorId: "b", scalar: 0.4 },
        { contributorId: "c", scalar: 0.6 },
        { contributorId: "d", scalar: 1 },
      ],
      { trimFraction: 0.9 },
    );
    expect(r.scalar).toBeDefined();
  });
});

describe("aggregate — differential privacy noise", () => {
  it("does not add noise when dpEpsilon is 0", () => {
    const r = aggregate(
      [
        { contributorId: "a", scalar: 0.5 },
        { contributorId: "b", scalar: 0.5 },
      ],
      { dpEpsilon: 0 },
    );
    expect(r.scalar).toBe(0.5);
  });

  it("adds bounded noise with positive epsilon (deterministic via seeded RNG)", () => {
    const r = aggregate(
      [
        { contributorId: "a", scalar: 0.5 },
        { contributorId: "b", scalar: 0.5 },
      ],
      { dpEpsilon: 1, dpSensitivity: 0.1, rng: seededRng(42) },
    );
    expect(r.scalar).toBeDefined();
    // Noise is unbiased — over many samples the mean → original
    expect(Math.abs(r.scalar! - 0.5)).toBeLessThan(2); // bounded
  });

  it("noise scale grows as epsilon shrinks", () => {
    const lowEpsilon = aggregate([{ contributorId: "a", scalar: 0.5 }], {
      dpEpsilon: 0.01,
      dpSensitivity: 1,
      rng: seededRng(7),
    });
    const highEpsilon = aggregate([{ contributorId: "a", scalar: 0.5 }], {
      dpEpsilon: 100,
      dpSensitivity: 1,
      rng: seededRng(7),
    });
    // Both use the same RNG seed; the only difference is scale.
    // |delta-from-0.5| in lowEpsilon should be much larger.
    expect(Math.abs((lowEpsilon.scalar ?? 0.5) - 0.5)).toBeGreaterThan(
      Math.abs((highEpsilon.scalar ?? 0.5) - 0.5) * 100,
    );
  });
});

describe("laplaceNoise — primitive", () => {
  it("returns 0 for u = 0.5 (median of distribution)", () => {
    // Force rng to return 0.5 so u - 0.5 = 0 → noise = -sign(0)*log(1)*scale = 0
    const r = laplaceNoise(1, () => 0.5);
    expect(r).toBeCloseTo(0, 6);
  });

  it("scales linearly with the scale parameter", () => {
    const rng = seededRng(99);
    const r1 = laplaceNoise(1, rng);
    const rng2 = seededRng(99);
    const r2 = laplaceNoise(5, rng2);
    expect(Math.abs(r2)).toBeCloseTo(Math.abs(r1) * 5, 2);
  });

  it("can produce positive and negative samples", () => {
    const samples = [];
    const rng = seededRng(13);
    for (let i = 0; i < 200; i++) samples.push(laplaceNoise(1, rng));
    expect(samples.some((s) => s > 0)).toBe(true);
    expect(samples.some((s) => s < 0)).toBe(true);
  });
});

describe("integration — Byzantine-robust federation", () => {
  it("federated mean is robust to one malicious huge-norm contributor", () => {
    const honest: Contribution[] = Array.from({ length: 10 }, (_, i) => ({
      contributorId: `honest-${i}`,
      scalar: 0.7,
      tensor: [0.5, 0.5, 0.5],
      weight: 1,
    }));
    const evil: Contribution = {
      contributorId: "byzantine",
      scalar: 999, // adversarial scalar
      tensor: [1000, 1000, 1000], // adversarial tensor (huge norm)
      weight: 1,
    };
    const r = aggregate([...honest, evil], {
      trimFraction: 0.1,
      outlierRejectK: 5,
    });
    expect(r.scalar).toBeLessThan(2); // adversary trimmed
    expect(r.tensor![0]).toBeLessThan(2); // adversary outlier-rejected
    expect(r.contributorsDropped).toBeGreaterThanOrEqual(1);
  });
});
