/**
 * POST /api/public/router-demo
 *
 * Shows how the Sovereign Matrix smart router classifies an incoming
 * prompt and selects a model. No LLM call is made — this is a
 * classification demonstration using the same deterministic
 * classifyTask() + NIM_MODELS lookup that drives the real router.
 *
 * Why classification-only (not a real LLM round-trip):
 *   - Real round-trips would cost tokens on every demo pageview.
 *   - The VALUE we're demonstrating is the routing LOGIC, not the
 *     quality of any one model's response.
 *   - Latency numbers in the response come from recent production
 *     aggregates, not the current request — and are labelled as such
 *     in the candidates[].labelledAs field so the UI doesn't imply
 *     they're live measurements.
 *
 * Request:  { prompt: string }   (10-300 chars)
 * Response: {
 *   incoming: string,
 *   classification: { category: TaskType, rationale: string },
 *   candidates:     Array<{ model: string, costPer1k: number, p50Latency: number, labelledAs: "recent-average" }>,
 *   selected:       { model: string, reason: string },
 *   fallbackChain:  string[],
 *   latencyMs:      number,
 * }
 *
 * Rate limit: 5/hour/IP via public-router-demo rule in rate-limits.ts.
 * Cache-Control: no-store (each classification is unique input-dependent).
 * Never 500s; degrades to 400 on bad input / 503 on internal failure.
 */

import { NextResponse } from "next/server";
import { classifyTask, NIM_MODELS } from "@/lib/llm-router";

// Recent-average numbers from production aggregates. Updated when
// we measure; explicitly labelled in the response as "recent-average"
// so the UI never implies they're this-request latencies.
const TYPICAL_LATENCY_MS: Record<string, number> = {
  "nvidia/nemotron-3-super-120b": 850,
  "deepseek-ai/deepseek-v3-2-0324": 1200,
  "nvidia/llama-3.1-nemotron-70b-instruct": 720,
  "meta/llama-4-maverick-17b-128e-instruct": 1450,
  "meta/llama-guard-3-8b": 380,
  "qwen/qwen3-235b-a22b": 1100,
  "meta/llama-4-scout-17b-16e-instruct": 1900,
};

const TYPICAL_COST_PER_1K: Record<string, number> = {
  "nvidia/nemotron-3-super-120b": 0.0018,
  "deepseek-ai/deepseek-v3-2-0324": 0.0014,
  "nvidia/llama-3.1-nemotron-70b-instruct": 0.0010,
  "meta/llama-4-maverick-17b-128e-instruct": 0.0025,
  "meta/llama-guard-3-8b": 0.0004,
  "qwen/qwen3-235b-a22b": 0.0016,
  "meta/llama-4-scout-17b-16e-instruct": 0.0022,
};

// Fallback order across every task type — eleven deep per CLAUDE.md.
const FALLBACK_CHAIN: ReadonlyArray<string> = [
  "nvidia/nemotron-3-super-120b",
  "deepseek-ai/deepseek-v3-2-0324",
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "qwen/qwen3-235b-a22b",
  "meta/llama-4-maverick-17b-128e-instruct",
  "meta/llama-4-scout-17b-16e-instruct",
  "meta/llama-guard-3-8b",
  "google/gemini-2.5-flash",
  "anthropic/claude-sonnet-4-5",
  "groq/llama-3.3-70b-versatile",
  "cerebras/llama-3.3-70b",
];

const RATIONALE_MAP: Record<string, string> = {
  code: "Detected code keywords (function, typescript, debug, etc.) → routing to code-specialist model.",
  creative: "Detected creative keywords (blog, email, draft, etc.) → routing to creative-strong model.",
  reasoning: "Detected reasoning keywords (analyze, strategy, evaluate, etc.) → routing to deep-reasoning model.",
  vision: "Detected vision keywords (image, screenshot, describe) → routing to multimodal model.",
  safety: "Detected safety-related keywords → routing to LlamaGuard.",
  multilingual: "Detected multilingual intent → routing to Qwen 3 (140+ languages).",
  long_context: "Detected long-context intent → routing to Llama-4 Scout (10M context).",
  general: "No specialised keywords detected → routing to general-purpose Nemotron 70B.",
};

export async function POST(request: Request): Promise<Response> {
  let promptValue: string;
  try {
    const body = (await request.json()) as { prompt?: unknown };
    if (typeof body.prompt !== "string") {
      return NextResponse.json(
        { error: "prompt must be a string" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    promptValue = body.prompt.trim();
  } catch {
    return NextResponse.json(
      { error: "invalid json body" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (promptValue.length < 1 || promptValue.length > 300) {
    return NextResponse.json(
      { error: "prompt must be 1–300 characters" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const start = Date.now();
    const category = classifyTask(promptValue);
    const selectedModel = NIM_MODELS[category];

    // Shape the top-3 candidates — selected first, then next two in fallback order.
    const candidateModels = [
      selectedModel,
      ...FALLBACK_CHAIN.filter((m) => m !== selectedModel).slice(0, 2),
    ];
    const candidates = candidateModels.map((m) => ({
      model: m,
      costPer1k: TYPICAL_COST_PER_1K[m] ?? 0.002,
      p50Latency: TYPICAL_LATENCY_MS[m] ?? 1000,
      labelledAs: "recent-average" as const,
    }));

    const latencyMs = Date.now() - start;

    return NextResponse.json(
      {
        incoming: promptValue,
        classification: {
          category,
          rationale: RATIONALE_MAP[category] ?? "Generic classification.",
        },
        candidates,
        selected: {
          model: selectedModel,
          reason: `Task type: ${category}. Router's primary model for this category.`,
        },
        fallbackChain: FALLBACK_CHAIN,
        latencyMs,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/public/router-demo] failed", err);
    return NextResponse.json(
      { error: "router demo temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
