/**
 * SOVEREIGN MATRIX — Open-source model registry (Cook 183).
 *
 * Formal catalog of every LLM the cascade router (src/lib/ai.ts)
 * can route to, with metadata on provider, license, cost,
 * capability tier, and use-case fit. Pure module — no I/O.
 *
 * The router itself stays simple (switch on model name). This
 * registry is the **source of truth** for:
 *   - The /oss public page (lists models we support)
 *   - The smart router's capability-based selection
 *     ("give me a reasoning model" → looks up the highest-tier
 *     reasoning model with cost ≤ caller budget)
 *   - The investor data room's "8 LLM providers" claim
 *   - Documentation surfaces (/docs, /spec)
 */

// ── Public types ──────────────────────────────────────────────────────────

export type ModelProvider =
  | "ollama"
  | "cerebras"
  | "nvidia-nim"
  | "groq"
  | "anthropic"
  | "google"
  | "openai"
  | "together"
  | "xai"
  | "deepseek"
  | "mistral";

export type ModelLicense =
  | "MIT"
  | "Apache-2.0"
  | "Llama-3-Community"
  | "Mistral-Research"
  | "Gemma"
  | "CC-BY-NC-4.0"
  | "Proprietary"
  | "OpenRAIL-M";

export type CapabilityTier =
  | "frontier" // Claude Opus / GPT-4o / Llama 405B class
  | "high" // Sonnet / Llama 70B / DeepSeek-V3
  | "reasoning" // o1 / DeepSeek-R1 / QwQ — slow but thoughtful
  | "fast" // Haiku / Cerebras / Groq — sub-second
  | "code" // Qwen Coder / DeepSeek Coder
  | "small" // Phi-3 / Llama 8B — cheap edge
  | "voice" // Whisper / Parakeet
  | "embedding" // BGE / Nomic / text-embedding-3
  | "vision"; // GPT-4V / Llama Vision / Qwen-VL

export interface ModelMetadata {
  /** Stable id used by the cascade router. */
  id: string;
  /** Display name for UI surfaces. */
  name: string;
  provider: ModelProvider;
  license: ModelLicense;
  capabilityTier: CapabilityTier;
  /** Approximate cost per million input tokens (USD). 0 = self-hosted. */
  costPerMillionInputUsd: number;
  /** Approximate cost per million output tokens (USD). 0 = self-hosted. */
  costPerMillionOutputUsd: number;
  /** Context window in tokens. */
  contextWindow: number;
  /** Parameter count — best public estimate. */
  paramsBillion: number | null;
  /** True if model weights are publicly downloadable. */
  weightsOpen: boolean;
  /** Sovereign-internal use case the router favours this model for. */
  preferredFor: string[];
  /** Status as of 2026-05. Some flagship models change quarterly. */
  status: "production" | "beta" | "deprecated";
  /** Useful link for the /oss page. */
  homepage: string;
}

// ── The canonical registry ────────────────────────────────────────────────

export const MODELS: Record<string, ModelMetadata> = {
  // ── Frontier reasoning ────────────────────────────────────────────────
  "deepseek-r1": {
    id: "deepseek-r1",
    name: "DeepSeek-R1",
    provider: "deepseek",
    license: "MIT",
    capabilityTier: "reasoning",
    costPerMillionInputUsd: 0.55,
    costPerMillionOutputUsd: 2.19,
    contextWindow: 128_000,
    paramsBillion: 671,
    weightsOpen: true,
    preferredFor: [
      "consensus engine (verifiedAi)",
      "compliance reasoning chains",
      "regulatory pack drafting",
      "multi-step agent planning",
    ],
    status: "production",
    homepage: "https://huggingface.co/deepseek-ai/DeepSeek-R1",
  },
  "deepseek-v3": {
    id: "deepseek-v3",
    name: "DeepSeek-V3",
    provider: "deepseek",
    license: "MIT",
    capabilityTier: "high",
    costPerMillionInputUsd: 0.27,
    costPerMillionOutputUsd: 1.1,
    contextWindow: 64_000,
    paramsBillion: 671,
    weightsOpen: true,
    preferredFor: ["general agent work", "cost-efficient high-quality"],
    status: "production",
    homepage: "https://huggingface.co/deepseek-ai/DeepSeek-V3",
  },
  "qwq-32b": {
    id: "qwq-32b",
    name: "QwQ-32B",
    provider: "groq",
    license: "Apache-2.0",
    capabilityTier: "reasoning",
    costPerMillionInputUsd: 0.0, // free via NIM tier
    costPerMillionOutputUsd: 0.0,
    contextWindow: 32_768,
    paramsBillion: 32,
    weightsOpen: true,
    preferredFor: ["fast reasoning under cost constraint"],
    status: "production",
    homepage: "https://huggingface.co/Qwen/QwQ-32B-Preview",
  },

  // ── Frontier open ────────────────────────────────────────────────────
  "llama-3.3-70b": {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B Instruct",
    provider: "ollama",
    license: "Llama-3-Community",
    capabilityTier: "high",
    costPerMillionInputUsd: 0.0,
    costPerMillionOutputUsd: 0.0,
    contextWindow: 128_000,
    paramsBillion: 70,
    weightsOpen: true,
    preferredFor: [
      "self-hosted air-gapped deployments",
      "default Ollama model",
      "Tier-1 fallback when Claude/Gemini unavailable",
    ],
    status: "production",
    homepage: "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct",
  },
  "llama-3.1-405b": {
    id: "llama-3.1-405b",
    name: "Llama 3.1 405B Instruct",
    provider: "together",
    license: "Llama-3-Community",
    capabilityTier: "frontier",
    costPerMillionInputUsd: 3.5,
    costPerMillionOutputUsd: 3.5,
    contextWindow: 128_000,
    paramsBillion: 405,
    weightsOpen: true,
    preferredFor: ["frontier-quality without vendor lock-in"],
    status: "production",
    homepage: "https://huggingface.co/meta-llama/Llama-3.1-405B-Instruct",
  },

  // ── Code specialist ──────────────────────────────────────────────────
  "qwen-2.5-coder-32b": {
    id: "qwen-2.5-coder-32b",
    name: "Qwen 2.5 Coder 32B Instruct",
    provider: "ollama",
    license: "Apache-2.0",
    capabilityTier: "code",
    costPerMillionInputUsd: 0.0,
    costPerMillionOutputUsd: 0.0,
    contextWindow: 32_768,
    paramsBillion: 32,
    weightsOpen: true,
    preferredFor: [
      "agent-tool dispatch",
      "code generation in agent-factory",
      "best open-source coding model as of 2026-05",
    ],
    status: "production",
    homepage: "https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct",
  },
  "deepseek-coder-v2": {
    id: "deepseek-coder-v2",
    name: "DeepSeek-Coder-V2",
    provider: "deepseek",
    license: "MIT",
    capabilityTier: "code",
    costPerMillionInputUsd: 0.14,
    costPerMillionOutputUsd: 0.28,
    contextWindow: 128_000,
    paramsBillion: 236,
    weightsOpen: true,
    preferredFor: ["large-context code review", "PR-scale refactors"],
    status: "production",
    homepage: "https://huggingface.co/deepseek-ai/DeepSeek-Coder-V2-Instruct",
  },

  // ── Mixture-of-Experts ──────────────────────────────────────────────
  "mixtral-8x22b": {
    id: "mixtral-8x22b",
    name: "Mixtral 8x22B Instruct",
    provider: "nvidia-nim",
    license: "Apache-2.0",
    capabilityTier: "high",
    costPerMillionInputUsd: 0.0,
    costPerMillionOutputUsd: 0.0,
    contextWindow: 65_536,
    paramsBillion: 141,
    weightsOpen: true,
    preferredFor: ["multilingual workloads", "cost-efficient MoE"],
    status: "production",
    homepage: "https://huggingface.co/mistralai/Mixtral-8x22B-Instruct-v0.1",
  },

  // ── Frontier closed (paid fallback) ──────────────────────────────────
  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    license: "Proprietary",
    capabilityTier: "frontier",
    costPerMillionInputUsd: 3.0,
    costPerMillionOutputUsd: 15.0,
    contextWindow: 200_000,
    paramsBillion: null,
    weightsOpen: false,
    preferredFor: [
      "default frontier path when budget allows",
      "compliance + regulatory drafting (highest accuracy)",
    ],
    status: "production",
    homepage: "https://www.anthropic.com/claude",
  },
  "claude-opus-4-7": {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    provider: "anthropic",
    license: "Proprietary",
    capabilityTier: "frontier",
    costPerMillionInputUsd: 15.0,
    costPerMillionOutputUsd: 75.0,
    contextWindow: 200_000,
    paramsBillion: null,
    weightsOpen: false,
    preferredFor: [
      "highest-quality drafting (CSRD disclosure, BIMO inspection prep)",
      "extended thinking",
    ],
    status: "production",
    homepage: "https://www.anthropic.com/claude",
  },
  "gemini-2.5-pro": {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    license: "Proprietary",
    capabilityTier: "frontier",
    costPerMillionInputUsd: 1.25,
    costPerMillionOutputUsd: 5.0,
    contextWindow: 2_000_000,
    paramsBillion: null,
    weightsOpen: false,
    preferredFor: ["long-context document review (2M tokens)", "vision"],
    status: "production",
    homepage: "https://ai.google.dev",
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    license: "Proprietary",
    capabilityTier: "fast",
    costPerMillionInputUsd: 0.075,
    costPerMillionOutputUsd: 0.3,
    contextWindow: 1_000_000,
    paramsBillion: null,
    weightsOpen: false,
    preferredFor: ["default low-cost paid tier", "free-tier visitors"],
    status: "production",
    homepage: "https://ai.google.dev",
  },

  // ── Fast / edge ──────────────────────────────────────────────────────
  cerebras: {
    id: "cerebras",
    name: "Cerebras Llama 3.1 70B (2000+ tok/s)",
    provider: "cerebras",
    license: "Llama-3-Community",
    capabilityTier: "fast",
    costPerMillionInputUsd: 0.85,
    costPerMillionOutputUsd: 1.2,
    contextWindow: 8_192,
    paramsBillion: 70,
    weightsOpen: true,
    preferredFor: ["request-routing classification", "sub-second latency UI"],
    status: "production",
    homepage: "https://cerebras.ai",
  },
  "phi-3-medium": {
    id: "phi-3-medium",
    name: "Phi-3 Medium 14B",
    provider: "ollama",
    license: "MIT",
    capabilityTier: "small",
    costPerMillionInputUsd: 0.0,
    costPerMillionOutputUsd: 0.0,
    contextWindow: 128_000,
    paramsBillion: 14,
    weightsOpen: true,
    preferredFor: ["edge deployments", "cheap classification"],
    status: "production",
    homepage: "https://huggingface.co/microsoft/Phi-3-medium-128k-instruct",
  },

  // ── Voice ────────────────────────────────────────────────────────────
  "whisper-large-v3": {
    id: "whisper-large-v3",
    name: "Whisper Large v3",
    provider: "groq",
    license: "MIT",
    capabilityTier: "voice",
    costPerMillionInputUsd: 0.0,
    costPerMillionOutputUsd: 0.0,
    contextWindow: 0,
    paramsBillion: 1.55,
    weightsOpen: true,
    preferredFor: ["voice-agent input", "podcast / call transcription"],
    status: "production",
    homepage: "https://huggingface.co/openai/whisper-large-v3",
  },
  "f5-tts": {
    id: "f5-tts",
    name: "F5-TTS",
    provider: "ollama",
    license: "MIT",
    capabilityTier: "voice",
    costPerMillionInputUsd: 0.0,
    costPerMillionOutputUsd: 0.0,
    contextWindow: 0,
    paramsBillion: 0.3,
    weightsOpen: true,
    preferredFor: ["voice-agent output (TTS)", "natural prosody"],
    status: "beta",
    homepage: "https://huggingface.co/SWivid/F5-TTS",
  },

  // ── Vision ───────────────────────────────────────────────────────────
  "llama-3.2-vision-90b": {
    id: "llama-3.2-vision-90b",
    name: "Llama 3.2 90B Vision",
    provider: "together",
    license: "Llama-3-Community",
    capabilityTier: "vision",
    costPerMillionInputUsd: 1.2,
    costPerMillionOutputUsd: 1.2,
    contextWindow: 128_000,
    paramsBillion: 90,
    weightsOpen: true,
    preferredFor: ["document OCR with reasoning", "image-grounded receipts"],
    status: "production",
    homepage: "https://huggingface.co/meta-llama/Llama-3.2-90B-Vision-Instruct",
  },
  "qwen-vl-2.5": {
    id: "qwen-vl-2.5",
    name: "Qwen-VL 2.5",
    provider: "ollama",
    license: "Apache-2.0",
    capabilityTier: "vision",
    costPerMillionInputUsd: 0.0,
    costPerMillionOutputUsd: 0.0,
    contextWindow: 32_768,
    paramsBillion: 72,
    weightsOpen: true,
    preferredFor: ["self-hosted multimodal", "Asia-language documents"],
    status: "production",
    homepage: "https://huggingface.co/Qwen/Qwen2-VL-72B-Instruct",
  },

  // ── Embeddings ───────────────────────────────────────────────────────
  "bge-m3": {
    id: "bge-m3",
    name: "BGE M3 (multilingual)",
    provider: "ollama",
    license: "MIT",
    capabilityTier: "embedding",
    costPerMillionInputUsd: 0.0,
    costPerMillionOutputUsd: 0.0,
    contextWindow: 8_192,
    paramsBillion: 0.5,
    weightsOpen: true,
    preferredFor: ["RAG embedding for EU/SA multilingual content"],
    status: "production",
    homepage: "https://huggingface.co/BAAI/bge-m3",
  },
  "nomic-embed": {
    id: "nomic-embed",
    name: "Nomic Embed v1.5",
    provider: "ollama",
    license: "Apache-2.0",
    capabilityTier: "embedding",
    costPerMillionInputUsd: 0.0,
    costPerMillionOutputUsd: 0.0,
    contextWindow: 8_192,
    paramsBillion: 0.14,
    weightsOpen: true,
    preferredFor: ["default embeddings, fully open"],
    status: "production",
    homepage: "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────

/** Every model in the registry. */
export function listModels(): ModelMetadata[] {
  return Object.values(MODELS);
}

/** Models filtered by capability tier. */
export function modelsByTier(tier: CapabilityTier): ModelMetadata[] {
  return listModels().filter((m) => m.capabilityTier === tier);
}

/** Models filtered by whether they have open weights. */
export function openWeightsOnly(): ModelMetadata[] {
  return listModels().filter((m) => m.weightsOpen);
}

/** Models filtered by max acceptable cost (USD per million input tokens). */
export function modelsUnderBudget(maxInputUsd: number): ModelMetadata[] {
  return listModels().filter(
    (m) => m.costPerMillionInputUsd <= maxInputUsd && m.status === "production",
  );
}

/**
 * Capability-based router preference. Returns models sorted by
 * cost-ascending, filtered to the requested tier, in production
 * status. Highest signal-to-cost ratio first.
 */
export function preferredFor(
  tier: CapabilityTier,
  maxInputUsd: number = Infinity,
): ModelMetadata[] {
  return modelsByTier(tier)
    .filter(
      (m) =>
        m.costPerMillionInputUsd <= maxInputUsd && m.status === "production",
    )
    .sort((a, b) => a.costPerMillionInputUsd - b.costPerMillionInputUsd);
}

/** Models grouped by provider — useful for the /oss public catalog. */
export function modelsByProvider(): Record<ModelProvider, ModelMetadata[]> {
  const out: Partial<Record<ModelProvider, ModelMetadata[]>> = {};
  for (const m of listModels()) {
    if (!out[m.provider]) out[m.provider] = [];
    out[m.provider]!.push(m);
  }
  return out as Record<ModelProvider, ModelMetadata[]>;
}

/** Find one model by id; undefined if unknown. */
export function findModel(id: string): ModelMetadata | undefined {
  return MODELS[id];
}

/**
 * Summary stats for the /oss page hero — "we route to N models
 * across M providers, K of which have open weights."
 */
export function registrySummary(): {
  modelCount: number;
  providerCount: number;
  openWeightsCount: number;
  averageInputCostUsd: number;
} {
  const all = listModels();
  const providers = new Set(all.map((m) => m.provider));
  const open = all.filter((m) => m.weightsOpen);
  const avg =
    all.reduce((acc, m) => acc + m.costPerMillionInputUsd, 0) / all.length;
  return {
    modelCount: all.length,
    providerCount: providers.size,
    openWeightsCount: open.length,
    averageInputCostUsd: Number(avg.toFixed(2)),
  };
}
