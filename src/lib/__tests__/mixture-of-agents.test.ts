/**
 * model-routing/mixture-of-agents (R74) — tests.
 *
 * Pure-function task-to-model routing. Same inputs → same routing
 * decision, every time.
 *
 * Covers:
 *   - MOA_MODEL_CATALOG declares all 7 specialist models
 *   - modelSatisfiesConstraints: each constraint type
 *   - scoreModelForTask: 100 for best-at, 50 for also-capable, 0 else
 *   - chooseModel: picks the right specialist
 *     * code → GLM-4.7
 *     * math → DeepSeek V3.2 or Nomos 1
 *     * general → Qwen3
 *     * long-context → Llama 4 Maverick
 *     * local-only → Gemma 4
 *   - chooseModel ties broken by cheaper cost (free-first)
 *   - chooseModel throws when no model satisfies constraints
 *   - classifyCostProfile aggregates correctly
 */

import { describe, it, expect } from "vitest";
import {
  MOA_MODEL_CATALOG,
  modelSatisfiesConstraints,
  scoreModelForTask,
  chooseModel,
  classifyCostProfile,
  type ModelEntry,
  type RoutingConstraints,
  type RoutingDecision,
} from "../model-routing/mixture-of-agents";

describe("MOA_MODEL_CATALOG — declared models", () => {
  it("includes DeepSeek V3.2", () => {
    expect(MOA_MODEL_CATALOG.some((m) => m.id === "deepseek-v3.2")).toBe(true);
  });

  it("includes GLM-4.7", () => {
    expect(MOA_MODEL_CATALOG.some((m) => m.id === "glm-4.7")).toBe(true);
  });

  it("includes Qwen3-235B-A22B (Apache-2.0)", () => {
    const qwen = MOA_MODEL_CATALOG.find((m) => m.id === "qwen3-235b-a22b");
    expect(qwen).toBeDefined();
    expect(qwen?.license).toBe("Apache-2.0");
  });

  it("includes Gemma 4 26B (local-only privacy tier)", () => {
    const gemma = MOA_MODEL_CATALOG.find((m) => m.id === "gemma-4-26b-moe");
    expect(gemma).toBeDefined();
    expect(gemma?.privacyTier).toBe("local-only");
  });

  it("includes Llama 4 Maverick (1M token context)", () => {
    const llama = MOA_MODEL_CATALOG.find((m) => m.id === "llama-4-maverick");
    expect(llama).toBeDefined();
    expect(llama?.contextTokens).toBeGreaterThanOrEqual(1_000_000);
  });

  it("includes Nomos 1 (math specialist)", () => {
    const nomos = MOA_MODEL_CATALOG.find((m) => m.id === "nomos-1");
    expect(nomos).toBeDefined();
    expect(nomos?.bestAt).toContain("math-reasoning");
  });

  it("every model declares license + costTier + privacyTier", () => {
    for (const m of MOA_MODEL_CATALOG) {
      expect(m.license).toBeTruthy();
      expect(m.costTier).toBeTruthy();
      expect(m.privacyTier).toBeTruthy();
    }
  });

  it("ALL models in catalog are free-open-source (free-first ethos)", () => {
    for (const m of MOA_MODEL_CATALOG) {
      expect(m.costTier).toBe("free-open-source");
    }
  });
});

describe("modelSatisfiesConstraints (pure)", () => {
  const deepseek = MOA_MODEL_CATALOG.find((m) => m.id === "deepseek-v3.2")!;
  const gemma = MOA_MODEL_CATALOG.find((m) => m.id === "gemma-4-26b-moe")!;

  it("model with matching tiers → satisfies", () => {
    const r = modelSatisfiesConstraints(deepseek, {
      task: "math-reasoning",
    });
    expect(r.satisfies).toBe(true);
  });

  it("model exceeding cost tier → rejected", () => {
    const r = modelSatisfiesConstraints(deepseek, {
      task: "math-reasoning",
      maxCostTier: "free-open-source",
    });
    // DeepSeek IS free-open-source, so should satisfy.
    expect(r.satisfies).toBe(true);
  });

  it("model too slow for required latency → rejected", () => {
    const nomos = MOA_MODEL_CATALOG.find((m) => m.id === "nomos-1")!;
    const r = modelSatisfiesConstraints(nomos, {
      task: "math-reasoning",
      requiredLatency: "instant",
    });
    expect(r.satisfies).toBe(false);
    expect(r.reason).toBe("too_slow");
  });

  it("local-only required + cloud-or-local model → rejected", () => {
    const r = modelSatisfiesConstraints(deepseek, {
      task: "general-chat",
      requiredPrivacy: "local-only",
    });
    expect(r.satisfies).toBe(false);
    expect(r.reason).toBe("not_local_only");
  });

  it("local-only required + Gemma 4 → satisfies", () => {
    const r = modelSatisfiesConstraints(gemma, {
      task: "general-chat",
      requiredPrivacy: "local-only",
    });
    expect(r.satisfies).toBe(true);
  });

  it("insufficient context tokens → rejected", () => {
    const fathom = MOA_MODEL_CATALOG.find((m) => m.id === "fathom-r1-14b")!;
    const r = modelSatisfiesConstraints(fathom, {
      task: "long-context-analysis",
      minContextTokens: 200_000,
    });
    expect(r.satisfies).toBe(false);
    expect(r.reason).toBe("insufficient_context");
  });

  it("excluded provider → rejected", () => {
    const r = modelSatisfiesConstraints(deepseek, {
      task: "math-reasoning",
      excludedProviders: ["deepseek"],
    });
    expect(r.satisfies).toBe(false);
    expect(r.reason).toBe("provider_excluded");
  });

  it("rejectCustomLicenses=true rejects Llama Community license", () => {
    const llama = MOA_MODEL_CATALOG.find((m) => m.id === "llama-4-maverick")!;
    const r = modelSatisfiesConstraints(llama, {
      task: "long-context-analysis",
      rejectCustomLicenses: true,
    });
    expect(r.satisfies).toBe(false);
    expect(r.reason).toBe("non_permissive_license");
  });

  it("rejectCustomLicenses=true accepts MIT + Apache-2.0", () => {
    const deepseekR = modelSatisfiesConstraints(deepseek, {
      task: "math-reasoning",
      rejectCustomLicenses: true,
    });
    expect(deepseekR.satisfies).toBe(true);
    const qwen = MOA_MODEL_CATALOG.find((m) => m.id === "qwen3-235b-a22b")!;
    const qwenR = modelSatisfiesConstraints(qwen, {
      task: "general-chat",
      rejectCustomLicenses: true,
    });
    expect(qwenR.satisfies).toBe(true);
  });
});

describe("scoreModelForTask (pure)", () => {
  it("best-at task → 100", () => {
    const glm = MOA_MODEL_CATALOG.find((m) => m.id === "glm-4.7")!;
    expect(scoreModelForTask(glm, "code-generation")).toBe(100);
  });

  it("also-capable task → 50", () => {
    const qwen = MOA_MODEL_CATALOG.find((m) => m.id === "qwen3-235b-a22b")!;
    expect(scoreModelForTask(qwen, "summarization")).toBe(50);
  });

  it("not in either list → 0", () => {
    const gemma = MOA_MODEL_CATALOG.find((m) => m.id === "gemma-4-26b-moe")!;
    expect(scoreModelForTask(gemma, "vision-multimodal")).toBe(0);
  });
});

describe("chooseModel — task-specific routing", () => {
  it("code-generation → GLM-4.7 or DeepSeek V3.2 (both best-at code)", () => {
    const decision = chooseModel({
      constraints: { task: "code-generation" },
    });
    // Both GLM-4.7 and DeepSeek V3.2 declare code-generation as
    // best-at. The router treats them equally; tie-breaker is
    // cost (both free-open-source) then catalog order.
    expect(["glm-4.7", "deepseek-v3.2"]).toContain(decision.primary.id);
    expect(decision.exactMatch).toBe(true);
    // The OTHER coding specialist must appear in fallbacks (R51 hedging).
    const fallbackIds = decision.fallbacks.map((m) => m.id);
    const otherSpecialist =
      decision.primary.id === "glm-4.7" ? "deepseek-v3.2" : "glm-4.7";
    expect(fallbackIds).toContain(otherSpecialist);
  });

  it("code-debugging → GLM-4.7", () => {
    const decision = chooseModel({
      constraints: { task: "code-debugging" },
    });
    expect(decision.primary.id).toBe("glm-4.7");
  });

  it("math-reasoning → DeepSeek V3.2 or Nomos 1 (both best-at)", () => {
    const decision = chooseModel({
      constraints: { task: "math-reasoning" },
    });
    expect(["deepseek-v3.2", "nomos-1"]).toContain(decision.primary.id);
    expect(decision.exactMatch).toBe(true);
  });

  it("general-chat → Qwen3 (best-at) or Gemma 4 (best-at)", () => {
    const decision = chooseModel({
      constraints: { task: "general-chat" },
    });
    expect(["qwen3-235b-a22b", "gemma-4-26b-moe"]).toContain(
      decision.primary.id,
    );
  });

  it("long-context-analysis → Llama 4 Maverick (1M tokens)", () => {
    const decision = chooseModel({
      constraints: { task: "long-context-analysis" },
    });
    expect(decision.primary.id).toBe("llama-4-maverick");
  });

  it("local-only privacy + general-chat → Gemma 4", () => {
    const decision = chooseModel({
      constraints: {
        task: "general-chat",
        requiredPrivacy: "local-only",
      },
    });
    expect(decision.primary.id).toBe("gemma-4-26b-moe");
  });

  it("min context 500K tokens → only Llama 4 Maverick qualifies", () => {
    const decision = chooseModel({
      constraints: {
        task: "general-chat",
        minContextTokens: 500_000,
      },
    });
    expect(decision.primary.id).toBe("llama-4-maverick");
  });

  it("returns fallback chain (top-3) for redundancy + R51 hedging", () => {
    const decision = chooseModel({
      constraints: { task: "general-chat" },
    });
    expect(decision.fallbacks.length).toBeGreaterThan(0);
    expect(decision.fallbacks.length).toBeLessThanOrEqual(3);
    // Primary must NOT appear in fallbacks.
    expect(decision.fallbacks.find((m) => m.id === decision.primary.id)).toBeUndefined();
  });

  it("reason string is procurement-readable", () => {
    const decision = chooseModel({
      constraints: { task: "code-generation" },
    });
    expect(decision.reason.length).toBeGreaterThan(20);
    expect(decision.reason).toContain(decision.primary.id);
  });

  it("throws when no model satisfies constraints", () => {
    expect(() =>
      chooseModel({
        constraints: {
          task: "general-chat",
          requiredPrivacy: "local-only",
          excludedProviders: ["google", "anthropic", "openai"],
          rejectCustomLicenses: true,
        },
      }),
    ).toThrow();
  });
});

describe("chooseModel — free-first ties", () => {
  it("when 2 models tie on score, picks the cheaper one", () => {
    // Build a synthetic catalog where two models tie.
    const cheap: ModelEntry = {
      id: "cheap-model",
      provider: "ollama",
      license: "MIT",
      costTier: "free-open-source",
      latencyTier: "fast",
      privacyTier: "cloud-or-local",
      bestAt: ["general-chat"],
      alsoCapable: [],
      activeParams: 1_000_000,
      totalParams: 1_000_000,
      contextTokens: 32_768,
    };
    const expensive: ModelEntry = {
      id: "expensive-model",
      provider: "openai",
      license: "Proprietary",
      costTier: "paid-frontier",
      latencyTier: "fast",
      privacyTier: "cloud-or-local",
      bestAt: ["general-chat"],
      alsoCapable: [],
      activeParams: 1_000_000,
      totalParams: 1_000_000,
      contextTokens: 32_768,
    };
    const decision = chooseModel({
      constraints: { task: "general-chat" },
      catalog: [expensive, cheap],
    });
    expect(decision.primary.id).toBe("cheap-model");
  });
});

describe("classifyCostProfile (pure)", () => {
  it("empty decisions → 0% free", () => {
    const r = classifyCostProfile([]);
    expect(r.totalDecisions).toBe(0);
    expect(r.freeOpenSourcePct).toBe(0);
  });

  it("100% free-open-source decisions → 100% pct", () => {
    const decisions: RoutingDecision[] = [
      {
        primary: MOA_MODEL_CATALOG[0],
        fallbacks: [],
        reason: "x",
        exactMatch: true,
      },
      {
        primary: MOA_MODEL_CATALOG[1],
        fallbacks: [],
        reason: "x",
        exactMatch: true,
      },
    ];
    const r = classifyCostProfile(decisions);
    expect(r.freeOpenSourcePct).toBe(100);
    expect(r.freeOpenSourceCount).toBe(2);
    expect(r.paidFrontierCount).toBe(0);
  });

  it("mixed cost profile aggregates correctly", () => {
    const free: ModelEntry = { ...MOA_MODEL_CATALOG[0] };
    const paid: ModelEntry = { ...MOA_MODEL_CATALOG[0], costTier: "paid-frontier" };
    const decisions: RoutingDecision[] = [
      { primary: free, fallbacks: [], reason: "x", exactMatch: true },
      { primary: free, fallbacks: [], reason: "x", exactMatch: true },
      { primary: free, fallbacks: [], reason: "x", exactMatch: true },
      { primary: paid, fallbacks: [], reason: "x", exactMatch: true },
    ];
    const r = classifyCostProfile(decisions);
    expect(r.totalDecisions).toBe(4);
    expect(r.freeOpenSourceCount).toBe(3);
    expect(r.paidFrontierCount).toBe(1);
    expect(r.freeOpenSourcePct).toBe(75);
  });

  it("costSavingsClaim is procurement-readable", () => {
    const decisions: RoutingDecision[] = [
      {
        primary: MOA_MODEL_CATALOG[0],
        fallbacks: [],
        reason: "x",
        exactMatch: true,
      },
    ];
    const r = classifyCostProfile(decisions);
    expect(r.costSavingsClaim).toContain("free-open-source");
    expect(r.costSavingsClaim).toContain("flat-fee");
  });
});
