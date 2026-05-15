/**
 * Tests for src/lib/open-agent-ecosystem.ts — Cook 184.
 */

import { describe, it, expect } from "vitest";
import {
  ECOSYSTEM,
  ecosystemSummary,
  findFramework,
  frameworksByCategory,
  frameworksByStatus,
  listFrameworks,
} from "../open-agent-ecosystem";

describe("ECOSYSTEM registry", () => {
  it("includes LangGraph + CrewAI + AutoGen + Swarm in orchestration", () => {
    const ids = frameworksByCategory("orchestration").map((f) => f.id);
    expect(ids).toContain("langgraph");
    expect(ids).toContain("crewai");
    expect(ids).toContain("autogen");
    expect(ids).toContain("openai-swarm");
  });

  it("includes Letta + Mem0 as memory frameworks", () => {
    const memory = frameworksByCategory("memory");
    expect(memory.map((f) => f.id)).toEqual(
      expect.arrayContaining(["letta", "mem0"]),
    );
  });

  it("includes OpenHands + Aider + Cline as coding agents", () => {
    const coders = frameworksByCategory("coding-agent");
    expect(coders.map((f) => f.id)).toEqual(
      expect.arrayContaining(["openhands", "aider", "cline"]),
    );
  });

  it("includes vLLM + Ollama as inference engines", () => {
    const inf = frameworksByCategory("inference");
    expect(inf.map((f) => f.id)).toEqual(
      expect.arrayContaining(["vllm", "ollama"]),
    );
  });

  it("every framework has well-formed metadata", () => {
    for (const f of listFrameworks()) {
      expect(f.id).toMatch(/^[a-z0-9-]+$/);
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.starsK).toBeGreaterThanOrEqual(0);
      expect(f.homepage).toMatch(/^https?:\/\//);
      expect(f.license.length).toBeGreaterThan(0);
    }
  });
});

describe("frameworksByStatus", () => {
  it("returns adapter-shipped frameworks", () => {
    const shipped = frameworksByStatus("adapter-shipped");
    expect(shipped.length).toBeGreaterThan(0);
    expect(shipped.every((f) => f.sovereignStatus === "adapter-shipped")).toBe(
      true,
    );
    // NeMo Guardrails + Ollama + Phoenix are already wired.
    expect(shipped.map((f) => f.id)).toEqual(
      expect.arrayContaining(["nemo-guardrails", "ollama", "phoenix"]),
    );
  });

  it("returns adapter-planned frameworks with cook ids", () => {
    const planned = frameworksByStatus("adapter-planned");
    expect(planned.length).toBeGreaterThan(0);
    for (const f of planned) {
      expect(f.cookId).toBeDefined();
    }
  });
});

describe("ecosystemSummary", () => {
  it("totals match listFrameworks", () => {
    expect(ecosystemSummary().total).toBe(listFrameworks().length);
  });

  it("counts shipped + planned + categories sanely", () => {
    const s = ecosystemSummary();
    expect(s.categoryCount).toBeGreaterThan(0);
    expect(s.shippedAdapters).toBeGreaterThan(0);
    expect(s.plannedAdapters).toBeGreaterThan(0);
    expect(s.totalStarsK).toBeGreaterThan(100); // 100K+ across the ecosystem
  });
});

describe("findFramework", () => {
  it("returns the framework by id", () => {
    expect(findFramework("langgraph")?.name).toContain("LangGraph");
  });
  it("returns undefined for unknown id", () => {
    expect(findFramework("nope")).toBeUndefined();
  });
});

describe("category sanity checks", () => {
  it("every category in the type system has at least one framework", () => {
    const categories: Array<keyof typeof ECOSYSTEM | string> = [
      "orchestration",
      "memory",
      "coding-agent",
      "browser-agent",
      "research-agent",
      "ui",
      "rag",
      "guardrails",
      "evaluation",
      "inference",
      "fine-tuning",
      "observability",
    ];
    for (const c of categories) {
      const fs = frameworksByCategory(c as never);
      expect(fs.length).toBeGreaterThan(0);
    }
  });
});
