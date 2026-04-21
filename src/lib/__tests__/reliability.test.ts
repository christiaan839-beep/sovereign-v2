/**
 * RELIABILITY TESTS — deterministic, offline unit tests for the new
 * reliability + quality primitives:
 *   - with-timeout.ts
 *   - ai-parse.ts (extractJson, parseWithSchema, parseWithRepair)
 *   - degradation.ts
 *   - confidence-gate.ts
 *
 * These tests run on every PR (via ci.yml) WITHOUT requiring provider keys.
 * Any regression to the timeout / parsing / degradation logic fails CI.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { withTimeout, raceTimeout, TimeoutError, TIMEOUTS } from "@/lib/with-timeout";
import { extractJson, parseWithSchema, parseWithRepair, ParseError } from "@/lib/ai-parse";
import {
  getDegradationMode,
  setDegradationMode,
  features,
  maxTokensFor,
} from "@/lib/degradation";
import {
  normalizeConfidence,
  thresholdFor,
  extractConfidence,
} from "@/lib/confidence-gate";

// ── with-timeout ──────────────────────────────────────────

describe("withTimeout", () => {
  it("resolves fast work within the deadline", async () => {
    const result = await withTimeout(100, async () => "ok", "test");
    expect(result).toBe("ok");
  });

  it("throws TimeoutError when work exceeds deadline", async () => {
    await expect(
      withTimeout(50, () => new Promise((r) => setTimeout(() => r("late"), 200)), "slow"),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("passes the AbortSignal to the callee so fetches get cancelled", async () => {
    const controller = { aborted: false };
    await expect(
      withTimeout(
        50,
        (signal) =>
          new Promise((_, reject) => {
            signal.addEventListener("abort", () => {
              controller.aborted = true;
              reject(new Error("aborted"));
            });
          }),
        "abortable",
      ),
    ).rejects.toThrow();
    expect(controller.aborted).toBe(true);
  });
});

describe("raceTimeout", () => {
  it("wins when the work finishes first", async () => {
    const result = await raceTimeout(100, async () => "done", "fast");
    expect(result).toBe("done");
  });

  it("loses when the work is too slow", async () => {
    await expect(
      raceTimeout(30, () => new Promise((r) => setTimeout(() => r(null), 200)), "slow"),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("TIMEOUTS", () => {
  it("has sensible defaults", () => {
    expect(TIMEOUTS.AI_FAST).toBeLessThan(TIMEOUTS.AI_CALL);
    expect(TIMEOUTS.AI_CALL).toBeLessThan(TIMEOUTS.AI_DEEP);
    expect(TIMEOUTS.DB).toBeLessThan(TIMEOUTS.AI_CALL);
  });
});

// ── ai-parse ──────────────────────────────────────────────

describe("extractJson", () => {
  it("strips ```json fences", () => {
    const raw = '```json\n{"foo":"bar"}\n```';
    expect(extractJson(raw)).toBe('{"foo":"bar"}');
  });

  it("strips plain ``` fences", () => {
    const raw = '```\n{"foo":"bar"}\n```';
    expect(extractJson(raw)).toBe('{"foo":"bar"}');
  });

  it("strips prose preamble with trailing JSON", () => {
    const raw = 'Sure, here is the JSON:\n{"foo":"bar"}';
    expect(extractJson(raw)).toContain('"foo":"bar"');
  });

  it("repairs trailing commas", () => {
    const raw = '{"foo":"bar",}';
    const extracted = extractJson(raw);
    expect(extracted).not.toContain(",}");
    expect(() => JSON.parse(extracted)).not.toThrow();
  });

  it("leaves valid JSON untouched", () => {
    const raw = '{"a":1,"b":[2,3]}';
    expect(extractJson(raw)).toBe(raw);
  });
});

describe("parseWithSchema", () => {
  const Schema = z.object({ name: z.string(), count: z.number() });

  it("parses clean JSON matching schema", () => {
    const result = parseWithSchema('{"name":"x","count":1}', Schema);
    expect(result).toEqual({ name: "x", count: 1 });
  });

  it("parses JSON wrapped in markdown", () => {
    const result = parseWithSchema('```json\n{"name":"y","count":2}\n```', Schema);
    expect(result).toEqual({ name: "y", count: 2 });
  });

  it("throws ParseError on invalid JSON", () => {
    expect(() => parseWithSchema("not json", Schema)).toThrow(ParseError);
  });

  it("throws ParseError on schema mismatch", () => {
    expect(() => parseWithSchema('{"name":"x"}', Schema)).toThrow(ParseError);
  });

  it("ParseError preserves the raw input for debugging", () => {
    try {
      parseWithSchema("garbage", Schema);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      expect((err as ParseError).raw).toBe("garbage");
    }
  });
});

describe("parseWithRepair", () => {
  const Schema = z.object({ value: z.number() });

  it("passes through on first successful parse", async () => {
    const repairFn = vi.fn();
    const result = await parseWithRepair('{"value":42}', Schema, repairFn);
    expect(result).toEqual({ value: 42 });
    expect(repairFn).not.toHaveBeenCalled();
  });

  it("attempts repair on malformed JSON", async () => {
    const repairFn = vi.fn().mockResolvedValue('{"value":42}');
    const result = await parseWithRepair("this is broken", Schema, repairFn);
    expect(result).toEqual({ value: 42 });
    expect(repairFn).toHaveBeenCalledOnce();
  });

  it("throws original error when repair also fails", async () => {
    const repairFn = vi.fn().mockResolvedValue("still broken");
    await expect(parseWithRepair("broken", Schema, repairFn)).rejects.toBeInstanceOf(
      ParseError,
    );
  });
});

// ── degradation ───────────────────────────────────────────

describe("degradation", () => {
  afterEach(() => {
    setDegradationMode("normal"); // reset between tests
  });

  it("defaults to normal mode", () => {
    expect(getDegradationMode()).toBe("normal");
  });

  it("flip to reduced disables rejectionSampling but not research", () => {
    setDegradationMode("reduced");
    expect(features.rejectionSampling()).toBe(false);
    expect(features.research()).toBe(true);
  });

  it("flip to minimal disables everything except hitl", () => {
    setDegradationMode("minimal");
    expect(features.rejectionSampling()).toBe(false);
    expect(features.research()).toBe(false);
    expect(features.vectorMemory()).toBe(false);
    expect(features.playbooks()).toBe(false);
    expect(features.hitl()).toBe(true); // HITL always on for safety
  });

  it("maxTokensFor shrinks budget as mode tightens", () => {
    setDegradationMode("normal");
    const normal = maxTokensFor("medium");
    setDegradationMode("minimal");
    const minimal = maxTokensFor("medium");
    expect(minimal).toBeLessThan(normal);
  });

  it("setDegradationMode returns the previous mode", () => {
    setDegradationMode("normal");
    const prev = setDegradationMode("reduced");
    expect(prev).toBe("normal");
  });
});

// ── confidence-gate ───────────────────────────────────────

describe("normalizeConfidence", () => {
  it("passes through values in [0,1]", () => {
    expect(normalizeConfidence(0.5)).toBe(0.5);
    expect(normalizeConfidence(0)).toBe(0);
    expect(normalizeConfidence(1)).toBe(1);
  });

  it("clamps out-of-range values", () => {
    expect(normalizeConfidence(-0.5)).toBe(0);
    expect(normalizeConfidence(1.5)).toBe(1);
  });

  it("coerces non-numeric to 0", () => {
    expect(normalizeConfidence(undefined)).toBe(0);
    expect(normalizeConfidence("high")).toBe(0);
    expect(normalizeConfidence(NaN)).toBe(0);
  });
});

describe("thresholdFor", () => {
  it("returns agent-specific threshold when configured", () => {
    expect(thresholdFor("cold-email-sender")).toBeGreaterThan(0.9);
    expect(thresholdFor("task-classifier")).toBeLessThan(0.7);
  });

  it("falls back to default for unknown agents", () => {
    expect(thresholdFor("completely-new-agent")).toBe(0.8);
  });
});

describe("extractConfidence", () => {
  it("separates confidence from result", () => {
    const out = extractConfidence({ name: "x", confidence: 0.85 });
    expect(out.confidence).toBe(0.85);
    expect(out.result).toEqual({ name: "x" });
  });

  it("defaults to 0.5 when not self-reported", () => {
    const out = extractConfidence({ name: "x" });
    expect(out.confidence).toBe(0.5);
  });

  it("extracts assumptions array when present", () => {
    const out = extractConfidence({
      name: "x",
      confidence: 0.7,
      assumptions: ["A", "B"],
    });
    expect(out.assumptions).toEqual(["A", "B"]);
  });
});
