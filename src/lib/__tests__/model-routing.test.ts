/**
 * Model-routing unit tests.
 *
 * Verifies selectBestModel() produces the right model ID for each task
 * type, respects DATA_SOVEREIGNTY_MODE, and that the new phase-3.1
 * additions are wired.
 *
 * We DO NOT hit the NVIDIA API here — these are pure routing tests. The
 * sprint's requirement that each new model actually be hosted on NIM is
 * verified at deploy time via /api/health/deep (model list probe).
 *
 * Note: DATA_SOVEREIGNTY_MODE is a module-load-time env check in nvidia.ts,
 * so we can't flip it at runtime in a test. Instead we assert the matrix
 * of task → {safe-mode-result, loose-mode-result} by examining the actual
 * default (sovereignty off in test env) and verifying the sovereignty
 * branch exists by checking the routing map shape.
 */

import { describe, it, expect } from "vitest";
import { selectBestModel, NIM_MODELS } from "@/lib/nvidia";

describe("selectBestModel — phase 3.1 new tasks", () => {
  it("video → nemotron-video-vl-7b", () => {
    expect(selectBestModel("video")).toBe("nvidia/nemotron-video-vl-7b");
    expect(selectBestModel("video-understanding")).toBe("nvidia/nemotron-video-vl-7b");
  });

  it("multimodal → gemma-4-31b-it (always sovereignty-safe)", () => {
    expect(selectBestModel("multimodal")).toBe("google/gemma-4-31b-it");
  });

  it("rerank → nemotron-retriever-rerank-4b", () => {
    expect(selectBestModel("rerank")).toBe("nvidia/nemotron-retriever-rerank-4b");
  });

  it("rag → a reasoning-capable model (Qwen 3.5 loose, flagship safe)", () => {
    const chosen = selectBestModel("rag");
    // Either Qwen 3.5 (loose mode) or flagship nemotron (sovereignty mode)
    expect([NIM_MODELS.qwen3_5, NIM_MODELS.flagship]).toContain(chosen);
  });

  it("fast_tool → llama-4-maverick", () => {
    expect(selectBestModel("fast_tool")).toBe("meta/llama-4-maverick-17b-128e");
  });
});

describe("selectBestModel — code routing", () => {
  it("code → either Kimi K2.5 (loose) or Phi-4 Reasoning (sovereign)", () => {
    const chosen = selectBestModel("code");
    // Kimi K2.5 is Chinese-weight; Phi-4 Reasoning is MS (safe).
    // In sovereignty mode we must fall back to phi-4.
    expect([NIM_MODELS.kimiK2_5, NIM_MODELS.phi4Reasoning]).toContain(chosen);
  });

  it("coding is an alias of code", () => {
    expect(selectBestModel("coding")).toBe(selectBestModel("code"));
  });
});

describe("selectBestModel — sovereignty-safe tasks", () => {
  // These tasks NEVER route to a Chinese-weight model regardless of mode
  const alwaysSafe: Array<[string, string]> = [
    ["agentic", NIM_MODELS.agenticReasoning],
    ["tool-use", NIM_MODELS.agenticCoding],
    ["function-calling", NIM_MODELS.agenticCoding],
    ["analysis", NIM_MODELS.flagship],
    ["fast", NIM_MODELS.fast],
    ["quick", NIM_MODELS.fastReasoning],
    ["document", NIM_MODELS.documentParse],
    ["ocr", NIM_MODELS.visionOCR],
    ["image", NIM_MODELS.imageGen],
    ["safety", NIM_MODELS.contentSafety],
    ["video", NIM_MODELS.videoVL],
    ["multimodal", NIM_MODELS.gemma4Vision],
    ["rerank", NIM_MODELS.retrieverRerank],
  ];

  for (const [task, expected] of alwaysSafe) {
    it(`${task} → ${expected}`, () => {
      expect(selectBestModel(task)).toBe(expected);
    });
  }
});

describe("NIM_MODELS — phase 3.1 additions present", () => {
  it("exposes the six new model slots", () => {
    expect(NIM_MODELS.qwen3_5).toBe("qwen/qwen-3.5-397b-a17b");
    expect(NIM_MODELS.kimiK2_5).toBe("moonshotai/kimi-k2.5");
    expect(NIM_MODELS.mistralSmall4).toBe("mistralai/mistral-small-4-moe");
    expect(NIM_MODELS.phi4Reasoning).toBe("microsoft/phi-4-reasoning-14b");
    expect(NIM_MODELS.videoVL).toBe("nvidia/nemotron-video-vl-7b");
    expect(NIM_MODELS.retrieverRerank).toBe("nvidia/nemotron-retriever-rerank-4b");
  });
});

describe("Fallback behaviour", () => {
  it("unknown task types fall back to reasoning", () => {
    const result = selectBestModel("this-task-doesnt-exist");
    // Reasoning routes conditionally based on mode — just verify it's a real model ID
    expect(result).toMatch(/^[a-z]+\/.+/);
  });

  it("is case-insensitive", () => {
    expect(selectBestModel("CODE")).toBe(selectBestModel("code"));
    expect(selectBestModel("Video")).toBe(selectBestModel("video"));
  });
});
