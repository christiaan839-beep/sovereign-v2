/**
 * Tests for src/lib/adversarial-eval.ts.
 *
 * Uses the REAL detectJailbreak against the REAL corpus — no mocks
 * for the substance of the eval. The signing surface is mocked so
 * the test doesn't need a real ML-DSA-65 key.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { signMock, pqEnabledMock } = vi.hoisted(() => ({
  signMock: vi.fn<() => string | null>(() => null),
  pqEnabledMock: vi.fn(() => false),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/pq-sign", () => ({
  signMlDsa65: () => signMock(),
  isPqDualSignEnabled: () => pqEnabledMock(),
}));

import {
  runAdversarialEval,
  canonicalizeEvalResult,
  hashEvalResult,
  ADVERSARIAL_EVAL_SCHEMA,
} from "../adversarial-eval";
import {
  FAST_PATH_CORPUS,
  BENIGN_PROMPTS,
  corpusFingerprint,
} from "../adversarial-corpus";

beforeEach(() => {
  signMock.mockReset();
  signMock.mockReturnValue(null);
  pqEnabledMock.mockReset();
  pqEnabledMock.mockReturnValue(false);
});

describe("runAdversarialEval", () => {
  it("returns the same schema + corpus fingerprint as the corpus module", async () => {
    const r = await runAdversarialEval();
    expect(r.schema).toBe(ADVERSARIAL_EVAL_SCHEMA);
    expect(r.corpusFingerprint).toBe(corpusFingerprint());
  });

  it("attack.total equals FAST_PATH_CORPUS length", async () => {
    const r = await runAdversarialEval();
    expect(r.attack.total).toBe(FAST_PATH_CORPUS.length);
  });

  it("benign.total equals BENIGN_PROMPTS length", async () => {
    const r = await runAdversarialEval();
    expect(r.benign.total).toBe(BENIGN_PROMPTS.length);
  });

  it("achieves ≥95% blockRate (matches the CI gate)", async () => {
    const r = await runAdversarialEval();
    expect(r.attack.blockRate).toBeGreaterThanOrEqual(0.95);
  });

  it("byCategory totals sum to the full corpus", async () => {
    const r = await runAdversarialEval();
    let totalAcrossCats = 0;
    for (const cat of Object.values(r.attack.byCategory)) {
      totalAcrossCats += cat.total;
    }
    expect(totalAcrossCats).toBe(r.attack.total);
  });

  it("composite score reflects blockRate × precision", async () => {
    const r = await runAdversarialEval();
    const precision =
      (r.benign.total - r.benign.falsePositives) / r.benign.total;
    expect(r.compositeScore).toBeCloseTo(r.attack.blockRate * precision, 6);
  });

  it("records mldsa65Sig when signing key is configured", async () => {
    signMock.mockReturnValue("sig-base64-placeholder");
    pqEnabledMock.mockReturnValue(true);
    const r = await runAdversarialEval();
    expect(r.mldsa65Sig).toBe("sig-base64-placeholder");
    expect(r.pqEnabled).toBe(true);
  });

  it("returns mldsa65Sig=null gracefully when no signing key", async () => {
    const r = await runAdversarialEval();
    expect(r.mldsa65Sig).toBeNull();
    expect(r.pqEnabled).toBe(false);
  });

  it("durationMs is non-negative", async () => {
    const r = await runAdversarialEval();
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("canonicalizeEvalResult", () => {
  it("produces fixed key order", () => {
    const r = {
      schema: ADVERSARIAL_EVAL_SCHEMA as typeof ADVERSARIAL_EVAL_SCHEMA,
      ranAt: "2026-05-19T00:00:00.000Z",
      durationMs: 100,
      corpusFingerprint: "a".repeat(64),
      attack: {
        total: 10,
        blocked: 9,
        blockRate: 0.9,
        byCategory: {
          z_cat: { total: 1, blocked: 1 },
          a_cat: { total: 2, blocked: 2 },
        },
      },
      benign: { total: 5, falsePositives: 0, falsePositivePrompts: [] },
      compositeScore: 0.9,
    };
    const c = canonicalizeEvalResult(r);
    // schema appears before ranAt; a_cat appears before z_cat.
    expect(c.indexOf('"schema"')).toBeLessThan(c.indexOf('"ranAt"'));
    expect(c.indexOf('"a_cat"')).toBeLessThan(c.indexOf('"z_cat"'));
  });

  it("is byte-identical for the same logical result", () => {
    const r = {
      schema: ADVERSARIAL_EVAL_SCHEMA as typeof ADVERSARIAL_EVAL_SCHEMA,
      ranAt: "2026-05-19T00:00:00.000Z",
      durationMs: 100,
      corpusFingerprint: "a".repeat(64),
      attack: {
        total: 10,
        blocked: 9,
        blockRate: 0.9,
        byCategory: { a: { total: 10, blocked: 9 } },
      },
      benign: {
        total: 5,
        falsePositives: 1,
        falsePositivePrompts: ["bad benign"],
      },
      compositeScore: 0.72,
    };
    expect(canonicalizeEvalResult(r)).toBe(canonicalizeEvalResult(r));
  });
});

describe("hashEvalResult", () => {
  it("returns a 64-char hex SHA-256", () => {
    const r = {
      schema: ADVERSARIAL_EVAL_SCHEMA as typeof ADVERSARIAL_EVAL_SCHEMA,
      ranAt: "2026-05-19T00:00:00.000Z",
      durationMs: 1,
      corpusFingerprint: "x".repeat(64),
      attack: { total: 0, blocked: 0, blockRate: 0, byCategory: {} },
      benign: { total: 0, falsePositives: 0, falsePositivePrompts: [] },
      compositeScore: 0,
    };
    const h = hashEvalResult(r);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("corpusFingerprint", () => {
  it("is deterministic", () => {
    expect(corpusFingerprint()).toBe(corpusFingerprint());
  });

  it("is a 64-char hex SHA-256", () => {
    expect(corpusFingerprint()).toMatch(/^[0-9a-f]{64}$/);
  });
});
