/**
 * guardrails/guardrails-adapter (R71) — tests.
 *
 * The adapter framework that lets customers BYO open-source
 * guardrails (NeMo, OpenGuardrails, LlamaFirewall, custom).
 *
 * Covers:
 *   - composeVerdicts: pure-function composite verdict math
 *     * any block → composite block
 *     * no block + any warn → composite warn
 *     * all allow → composite allow
 *     * findings merged correctly
 *     * blockingAdapter identified
 *   - classifyGuardrailHealth: clean/elevated/alert/critical
 *   - registerAdapters / listAdapters / reset
 *   - StubGuardrailsAdapter throws closed on evaluate
 *   - The 3 skeletons (NeMo, OpenGuardrails, LlamaFirewall)
 *     describe themselves correctly
 *   - evaluatePromptAcrossAdapters runs adapters in parallel
 *   - per-adapter results preserved
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  composeVerdicts,
  classifyGuardrailHealth,
  registerAdapters,
  listAdapters,
  _resetAdaptersForTesting,
  evaluatePromptAcrossAdapters,
  evaluateOutputAcrossAdapters,
  StubGuardrailsAdapter,
  NEMO_GUARDRAILS_SKELETON,
  OPENGUARDRAILS_SKELETON,
  LLAMA_FIREWALL_SKELETON,
  type GuardrailsAdapter,
  type EvaluationResult,
} from "../guardrails/guardrails-adapter";

const NOW = "2026-04-29T12:00:00.000Z";

const allowResult = (
  adapter: string,
  durationMs = 50,
): EvaluationResult => ({
  verdict: "allow",
  findings: [],
  evaluatedAt: NOW,
  durationMs,
});

const warnResult = (
  adapter: string,
  durationMs = 50,
): EvaluationResult => ({
  verdict: "warn",
  findings: [
    {
      category: "off_topic",
      severity: "warning",
      adapter,
      message: "Off-topic warning",
    },
  ],
  evaluatedAt: NOW,
  durationMs,
});

const blockResult = (
  adapter: string,
  durationMs = 50,
): EvaluationResult => ({
  verdict: "block",
  findings: [
    {
      category: "prompt_injection",
      severity: "block",
      adapter,
      message: "Detected prompt injection",
      confidence: 0.95,
    },
  ],
  evaluatedAt: NOW,
  durationMs,
});

describe("composeVerdicts (pure)", () => {
  it("all allow → composite allow", () => {
    const r = composeVerdicts([
      allowResult("a"),
      allowResult("b"),
      allowResult("c"),
    ]);
    expect(r.verdict).toBe("allow");
    expect(r.findings).toEqual([]);
    expect(r.blockingAdapter).toBeUndefined();
  });

  it("no block + any warn → composite warn", () => {
    const r = composeVerdicts([
      allowResult("a"),
      warnResult("b"),
      allowResult("c"),
    ]);
    expect(r.verdict).toBe("warn");
    expect(r.findings.length).toBe(1);
  });

  it("any single block → composite block (regardless of others)", () => {
    const r = composeVerdicts([
      allowResult("a"),
      warnResult("b"),
      blockResult("nemo-guardrails"),
      allowResult("c"),
    ]);
    expect(r.verdict).toBe("block");
    expect(r.blockingAdapter).toBe("nemo-guardrails");
  });

  it("multiple blocks → first blocking adapter wins blockingAdapter", () => {
    const r = composeVerdicts([
      blockResult("first-blocker"),
      blockResult("second-blocker"),
    ]);
    expect(r.verdict).toBe("block");
    expect(r.blockingAdapter).toBe("first-blocker");
    // But all findings preserved.
    expect(r.findings.length).toBe(2);
  });

  it("merges findings from ALL adapters (composite finding list)", () => {
    const r = composeVerdicts([
      warnResult("a"),
      warnResult("b"),
      warnResult("c"),
    ]);
    expect(r.findings.length).toBe(3);
    const adapterNames = r.findings.map((f) => f.adapter).sort();
    expect(adapterNames).toEqual(["a", "b", "c"]);
  });

  it("aggregates totalDurationMs across results", () => {
    const r = composeVerdicts([
      allowResult("a", 10),
      allowResult("b", 20),
      allowResult("c", 30),
    ]);
    expect(r.totalDurationMs).toBe(60);
  });

  it("empty results array → composite allow with 0 findings", () => {
    const r = composeVerdicts([]);
    expect(r.verdict).toBe("allow");
    expect(r.findings).toEqual([]);
    expect(r.totalDurationMs).toBe(0);
  });
});

describe("classifyGuardrailHealth (pure)", () => {
  it("zero recent evaluations → clean", () => {
    expect(
      classifyGuardrailHealth({
        recentEvaluations: 0,
        blocks: 0,
        warns: 0,
        baselineBlockRate: 0.01,
        baselineWarnRate: 0.05,
      }),
    ).toBe("clean");
  });

  it("baseline-level → clean", () => {
    expect(
      classifyGuardrailHealth({
        recentEvaluations: 100,
        blocks: 1, // 1%
        warns: 5, // 5%
        baselineBlockRate: 0.01,
        baselineWarnRate: 0.05,
      }),
    ).toBe("clean");
  });

  it("warn rate 2x baseline → elevated", () => {
    expect(
      classifyGuardrailHealth({
        recentEvaluations: 100,
        blocks: 1,
        warns: 12, // 12%, baseline 5%
        baselineBlockRate: 0.01,
        baselineWarnRate: 0.05,
      }),
    ).toBe("elevated");
  });

  it("block rate 3x baseline → alert", () => {
    expect(
      classifyGuardrailHealth({
        recentEvaluations: 100,
        blocks: 4, // 4%, baseline 1%
        warns: 5,
        baselineBlockRate: 0.01,
        baselineWarnRate: 0.05,
      }),
    ).toBe("alert");
  });

  it("warn rate > 30% → alert", () => {
    expect(
      classifyGuardrailHealth({
        recentEvaluations: 100,
        blocks: 1,
        warns: 35, // 35%
        baselineBlockRate: 0.01,
        baselineWarnRate: 0.05,
      }),
    ).toBe("alert");
  });

  it("block rate > 50% → critical (even if baseline is high)", () => {
    expect(
      classifyGuardrailHealth({
        recentEvaluations: 100,
        blocks: 60, // 60%
        warns: 10,
        baselineBlockRate: 0.10, // baseline 10%
        baselineWarnRate: 0.05,
      }),
    ).toBe("critical");
  });

  it("block rate 10x baseline → critical", () => {
    expect(
      classifyGuardrailHealth({
        recentEvaluations: 100,
        blocks: 15, // 15%, baseline 1%
        warns: 5,
        baselineBlockRate: 0.01,
        baselineWarnRate: 0.05,
      }),
    ).toBe("critical");
  });
});

describe("Adapter registry + reset", () => {
  beforeEach(() => {
    _resetAdaptersForTesting();
  });

  it("starts empty after reset", () => {
    expect(listAdapters()).toEqual([]);
  });

  it("registerAdapters appends to registry", () => {
    const adapter1 = NEMO_GUARDRAILS_SKELETON;
    registerAdapters(adapter1);
    expect(listAdapters().length).toBe(1);
    expect(listAdapters()[0].describe().name).toBe("nemo-guardrails");
  });

  it("registerAdapters can take multiple at once", () => {
    registerAdapters(
      NEMO_GUARDRAILS_SKELETON,
      OPENGUARDRAILS_SKELETON,
      LLAMA_FIREWALL_SKELETON,
    );
    expect(listAdapters().length).toBe(3);
  });

  it("listAdapters returns a defensive copy (mutation-safe)", () => {
    registerAdapters(NEMO_GUARDRAILS_SKELETON);
    const list = listAdapters();
    list.length = 0; // mutate the copy
    expect(listAdapters().length).toBe(1); // original is unchanged
  });
});

describe("StubGuardrailsAdapter — fails closed (operator skeleton)", () => {
  it("describe() reflects upstream project + license + coverage", () => {
    const stub = new StubGuardrailsAdapter(
      "test-stub",
      "github.com/test/stub",
      "MIT",
      ["prompt_injection", "jailbreak_attempt"],
    );
    const info = stub.describe();
    expect(info.name).toBe("test-stub");
    expect(info.upstreamProject).toBe("github.com/test/stub");
    expect(info.upstreamLicense).toBe("MIT");
    expect(info.productionGrade).toBe(false);
    expect(info.coversCategories).toContain("prompt_injection");
  });

  it("evaluatePrompt throws (operators must implement)", async () => {
    const stub = new StubGuardrailsAdapter("x", "y", "z", []);
    await expect(
      stub.evaluatePrompt({ prompt: "test" }),
    ).rejects.toThrow(/operators must implement/);
  });

  it("evaluateOutput throws (operators must implement)", async () => {
    const stub = new StubGuardrailsAdapter("x", "y", "z", []);
    await expect(
      stub.evaluateOutput({ prompt: "x", output: "y" }),
    ).rejects.toThrow(/operators must implement/);
  });
});

describe("Pre-built skeletons (NeMo, OpenGuardrails, LlamaFirewall)", () => {
  it("NeMo skeleton describes Apache-2.0 + NVIDIA upstream", () => {
    const info = NEMO_GUARDRAILS_SKELETON.describe();
    expect(info.name).toBe("nemo-guardrails");
    expect(info.upstreamProject).toContain("NVIDIA/NeMo-Guardrails");
    expect(info.upstreamLicense).toBe("Apache-2.0");
    expect(info.coversCategories).toContain("prompt_injection");
  });

  it("OpenGuardrails skeleton describes Apache-2.0 + SOTA project", () => {
    const info = OPENGUARDRAILS_SKELETON.describe();
    expect(info.name).toBe("openguardrails");
    expect(info.upstreamLicense).toBe("Apache-2.0");
    expect(info.coversCategories).toContain("data_leakage");
    expect(info.coversCategories).toContain("pii_disclosure");
  });

  it("LlamaFirewall skeleton describes Meta upstream + verify-license note", () => {
    const info = LLAMA_FIREWALL_SKELETON.describe();
    expect(info.name).toBe("llama-firewall");
    expect(info.upstreamProject).toContain("meta-llama/llama-firewall");
    // The license note must instruct operators to verify before commercial use.
    expect(info.upstreamLicense.toLowerCase()).toContain("verify");
    expect(info.coversCategories).toContain("insecure_output");
    expect(info.coversCategories).toContain("unauthorized_tool_call");
  });
});

describe("evaluatePromptAcrossAdapters — composition runtime", () => {
  beforeEach(() => {
    _resetAdaptersForTesting();
  });

  it("returns composite allow when all adapters allow", async () => {
    const a1: GuardrailsAdapter = {
      describe: () => ({
        name: "a1",
        display: "Adapter 1",
        upstreamProject: "x",
        upstreamLicense: "MIT",
        productionGrade: true,
        coversCategories: [],
      }),
      evaluatePrompt: async () => allowResult("a1"),
      evaluateOutput: async () => allowResult("a1"),
    };
    registerAdapters(a1);
    const result = await evaluatePromptAcrossAdapters({ prompt: "hello" });
    expect(result.verdict).toBe("allow");
    expect(result.perAdapterResults.length).toBe(1);
  });

  it("returns composite block when one adapter blocks", async () => {
    const allow: GuardrailsAdapter = {
      describe: () => ({
        name: "allow",
        display: "x",
        upstreamProject: "x",
        upstreamLicense: "MIT",
        productionGrade: true,
        coversCategories: [],
      }),
      evaluatePrompt: async () => allowResult("allow"),
      evaluateOutput: async () => allowResult("allow"),
    };
    const block: GuardrailsAdapter = {
      describe: () => ({
        name: "block",
        display: "x",
        upstreamProject: "x",
        upstreamLicense: "MIT",
        productionGrade: true,
        coversCategories: [],
      }),
      evaluatePrompt: async () => blockResult("block"),
      evaluateOutput: async () => blockResult("block"),
    };
    registerAdapters(allow, block);
    const result = await evaluatePromptAcrossAdapters({ prompt: "bad" });
    expect(result.verdict).toBe("block");
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.perAdapterResults.length).toBe(2);
  });

  it("evaluateOutputAcrossAdapters works the same way", async () => {
    const a: GuardrailsAdapter = {
      describe: () => ({
        name: "a",
        display: "x",
        upstreamProject: "x",
        upstreamLicense: "MIT",
        productionGrade: true,
        coversCategories: [],
      }),
      evaluatePrompt: async () => allowResult("a"),
      evaluateOutput: async () => warnResult("a"),
    };
    registerAdapters(a);
    const result = await evaluateOutputAcrossAdapters({
      prompt: "x",
      output: "y",
    });
    expect(result.verdict).toBe("warn");
  });

  it("totalDurationMs reflects parallel runtime (not sum)", async () => {
    const slowA: GuardrailsAdapter = {
      describe: () => ({
        name: "a",
        display: "x",
        upstreamProject: "x",
        upstreamLicense: "MIT",
        productionGrade: true,
        coversCategories: [],
      }),
      evaluatePrompt: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return allowResult("a", 50);
      },
      evaluateOutput: async () => allowResult("a"),
    };
    const slowB: GuardrailsAdapter = {
      describe: () => ({
        name: "b",
        display: "x",
        upstreamProject: "x",
        upstreamLicense: "MIT",
        productionGrade: true,
        coversCategories: [],
      }),
      evaluatePrompt: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return allowResult("b", 50);
      },
      evaluateOutput: async () => allowResult("b"),
    };
    registerAdapters(slowA, slowB);
    const result = await evaluatePromptAcrossAdapters({ prompt: "x" });
    // Parallel ≈ 50ms wall time; serial would be ≈ 100ms.
    expect(result.totalDurationMs).toBeLessThan(95);
  });
});
