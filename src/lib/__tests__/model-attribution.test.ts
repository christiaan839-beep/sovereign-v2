/**
 * Tests for src/lib/model-attribution.ts
 *
 * Regression coverage: the unified AI router (`src/lib/ai.ts`) and the NIM
 * gateway (`src/lib/nvidia.ts`) lazy-import this module to record which
 * model handled the current request. If this module disappears or throws,
 * every AI call in the platform breaks (see git history for the original
 * incident where it went missing for an entire branch).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordModel,
  getLastModel,
  getLastBucket,
  resetModelAttribution,
  bucketOf,
} from "@/lib/model-attribution";

describe("model-attribution", () => {
  beforeEach(() => {
    resetModelAttribution();
  });

  describe("bucketOf", () => {
    it("buckets Claude variants to 'anthropic'", () => {
      expect(bucketOf("claude-opus-4-6")).toBe("anthropic");
      expect(bucketOf("claude-sonnet-4-6")).toBe("anthropic");
      expect(bucketOf("anthropic/claude")).toBe("anthropic");
    });

    it("buckets Gemini variants to 'google-gemini'", () => {
      expect(bucketOf("gemini-2.5-pro")).toBe("google-gemini");
      expect(bucketOf("gemini-2.5-flash")).toBe("google-gemini");
    });

    it("buckets NVIDIA NIM models to 'nvidia-nim'", () => {
      expect(bucketOf("nvidia/llama-3.1-nemotron-ultra-253b-v1")).toBe(
        "nvidia-nim",
      );
      expect(bucketOf("mistralai/mistral-large-2-instruct")).toBe("mistral");
    });

    it("buckets Groq-hosted models to 'groq'", () => {
      expect(bucketOf("llama-3.1-8b-instant")).toBe("groq");
      expect(bucketOf("deepseek-r1-distill-llama-70b")).toBe("groq");
      expect(bucketOf("qwen-2.5-coder-32b")).toBe("groq");
    });

    it("buckets local Ollama / Cerebras", () => {
      expect(bucketOf("ollama-local")).toBe("ollama-local");
      expect(bucketOf("cerebras")).toBe("cerebras");
    });

    it("returns 'unknown' for empty or unrecognized model IDs", () => {
      expect(bucketOf("")).toBe("unknown");
      expect(bucketOf("some-future-model")).toBe("unknown");
    });
  });

  describe("recordModel / getLastModel", () => {
    it("records the last-recorded model", () => {
      recordModel("claude-sonnet-4-6");
      expect(getLastModel()).toBe("claude-sonnet-4-6");
      expect(getLastBucket()).toBe("anthropic");
    });

    it("overwrites on subsequent calls", () => {
      recordModel("claude-sonnet-4-6");
      recordModel("gemini-2.5-flash");
      expect(getLastModel()).toBe("gemini-2.5-flash");
      expect(getLastBucket()).toBe("google-gemini");
    });

    it("ignores empty / non-string input without throwing", () => {
      recordModel("claude-sonnet-4-6");
      // @ts-expect-error — testing runtime safety
      recordModel(undefined);
      // @ts-expect-error — testing runtime safety
      recordModel(null);
      recordModel("");
      // Last valid record should still be there
      expect(getLastModel()).toBe("claude-sonnet-4-6");
    });
  });

  describe("resetModelAttribution", () => {
    it("clears state", () => {
      recordModel("claude-sonnet-4-6");
      resetModelAttribution();
      expect(getLastModel()).toBeUndefined();
      expect(getLastBucket()).toBeUndefined();
    });
  });
});
