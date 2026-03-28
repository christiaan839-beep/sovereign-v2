/**
 * LLM Router Tests
 *
 * Validates task classification logic and NIM model registry.
 * Does NOT test routeAgenticExecution (calls external APIs).
 */

import { describe, it, expect } from "vitest";
import { classifyTask, NIM_MODELS } from "@/lib/llm-router";

describe("classifyTask", () => {
  it('should return "code" for coding prompts', () => {
    expect(classifyTask("Write code for a REST API in TypeScript")).toBe("code");
    expect(classifyTask("Debug this Python function")).toBe("code");
    expect(classifyTask("Refactor the JavaScript component")).toBe("code");
  });

  it('should return "reasoning" for analysis prompts', () => {
    expect(classifyTask("Analyze this market strategy for weaknesses")).toBe("reasoning");
    expect(classifyTask("Compare these two approaches and evaluate trade-offs")).toBe("reasoning");
    expect(classifyTask("Investigate the root cause of this issue")).toBe("reasoning");
  });

  it('should return "multilingual" for translation prompts', () => {
    expect(classifyTask("Translate this document to Spanish")).toBe("multilingual");
    expect(classifyTask("Localize the UI for Japanese users")).toBe("multilingual");
    expect(classifyTask("Convert this text to French and German")).toBe("multilingual");
  });

  it('should return "long_context" for document analysis', () => {
    expect(classifyTask("Summarize all chapters of this long document")).toBe("long_context");
    expect(classifyTask("Process the entire codebase in full context")).toBe("long_context");
    expect(classifyTask("Read this large file and summarize all of it")).toBe("long_context");
  });

  it('should return "vision" for image prompts', () => {
    expect(classifyTask("Describe this screenshot of the dashboard")).toBe("vision");
    expect(classifyTask("Analyze the image for text using OCR")).toBe("vision");
    expect(classifyTask("What is shown in this photo?")).toBe("vision");
  });

  it('should return "creative" for writing prompts', () => {
    expect(classifyTask("Write a blog post about marketing")).toBe("creative");
    expect(classifyTask("Draft a social media post for LinkedIn")).toBe("creative");
    expect(classifyTask("Create an email newsletter for our audience")).toBe("creative");
  });

  it('should return "safety" for moderation prompts', () => {
    expect(classifyTask("Is this harmful or toxic?")).toBe("safety");
    expect(classifyTask("Run the guardrail on the input")).toBe("safety");
  });

  it('should return "general" for generic prompts', () => {
    expect(classifyTask("Hello, how are you?")).toBe("general");
    expect(classifyTask("What time is it?")).toBe("general");
  });
});

describe("NIM_MODELS registry", () => {
  const expectedTypes = [
    "code", "reasoning", "creative", "vision",
    "safety", "multilingual", "long_context", "general",
  ];

  it("should have entries for all task types", () => {
    for (const type of expectedTypes) {
      expect(NIM_MODELS).toHaveProperty(type);
      expect(typeof NIM_MODELS[type as keyof typeof NIM_MODELS]).toBe("string");
    }
  });

  it("should use nvidia model for code tasks", () => {
    expect(NIM_MODELS.code).toContain("nvidia");
  });

  it("should use deepseek model for reasoning tasks", () => {
    expect(NIM_MODELS.reasoning).toContain("deepseek");
  });

  it("should use meta/llama-guard for safety tasks", () => {
    expect(NIM_MODELS.safety).toContain("llama-guard");
  });

  it("should use qwen model for multilingual tasks", () => {
    expect(NIM_MODELS.multilingual).toContain("qwen");
  });
});
