/**
 * SOVEREIGN MATRIX — Model Registry
 *
 * Centralized model configuration used by the chat UI, smart router,
 * and model switcher. Single source of truth for all available models.
 */

export interface ModelConfig {
  id: string;
  name: string;
  provider: "nvidia" | "google" | "anthropic" | "groq" | "meta" | "deepseek" | "alibaba" | "zhipu" | "local";
  description: string;
  tags: ModelTag[];
  contextWindow: number;
  speedTier: "instant" | "fast" | "standard" | "slow";
  costTier: "free" | "byok" | "metered";
  color: string; // provider accent color
}

export type ModelTag = "reasoning" | "code" | "vision" | "thinking" | "fast" | "streaming" | "agentic" | "long-context" | "free" | "tools" | "voice" | "multilingual" | "creative";

export const PROVIDER_COLORS: Record<ModelConfig["provider"], string> = {
  nvidia: "#76B900",
  google: "#4285F4",
  anthropic: "#D4A574",
  groq: "#F55036",
  meta: "#0668E1",
  deepseek: "#4D6BFE",
  alibaba: "#FF6A00",
  zhipu: "#4A90D9",
  local: "#10B981",
};

export const PROVIDER_LABELS: Record<ModelConfig["provider"], string> = {
  nvidia: "NVIDIA NIM",
  google: "Google",
  anthropic: "Anthropic",
  groq: "Groq",
  meta: "Meta",
  deepseek: "DeepSeek",
  alibaba: "Alibaba",
  zhipu: "Zhipu AI",
  local: "Local",
};

export const MODEL_REGISTRY: ModelConfig[] = [
  {
    id: "auto",
    name: "Auto",
    provider: "nvidia",
    description: "Smart routing picks the best model for your task",
    tags: ["reasoning", "code", "fast"],
    contextWindow: 128000,
    speedTier: "fast",
    costTier: "free",
    color: PROVIDER_COLORS.nvidia,
  },
  {
    id: "nemotron",
    name: "Nemotron Ultra",
    provider: "nvidia",
    description: "253B — synthesis, debate, deep reasoning",
    tags: ["reasoning", "agentic", "free"],
    contextWindow: 32768,
    speedTier: "standard",
    costTier: "free",
    color: PROVIDER_COLORS.nvidia,
  },
  {
    id: "qwen3",
    name: "Qwen 3",
    provider: "alibaba",
    description: "235B MoE — dual thinking/fast mode",
    tags: ["thinking", "code", "multilingual", "free"],
    contextWindow: 131072,
    speedTier: "standard",
    costTier: "free",
    color: PROVIDER_COLORS.alibaba,
  },
  {
    id: "deepseek",
    name: "DeepSeek V3",
    provider: "deepseek",
    description: "Deep reasoning + code generation",
    tags: ["reasoning", "code", "free"],
    contextWindow: 65536,
    speedTier: "standard",
    costTier: "free",
    color: PROVIDER_COLORS.deepseek,
  },
  {
    id: "llama4",
    name: "Llama 4 Maverick",
    provider: "meta",
    description: "17B multimodal — images + text",
    tags: ["vision", "creative", "free"],
    contextWindow: 128000,
    speedTier: "fast",
    costTier: "free",
    color: PROVIDER_COLORS.meta,
  },
  {
    id: "glm5",
    name: "GLM-5",
    provider: "zhipu",
    description: "400B — long-horizon agentic tasks",
    tags: ["agentic", "reasoning", "free"],
    contextWindow: 128000,
    speedTier: "slow",
    costTier: "free",
    color: PROVIDER_COLORS.zhipu,
  },
  {
    id: "nemotron3",
    name: "Nemotron 3 Super",
    provider: "nvidia",
    description: "120B — 1M context, hybrid architecture",
    tags: ["long-context", "reasoning", "free"],
    contextWindow: 1048576,
    speedTier: "standard",
    costTier: "free",
    color: PROVIDER_COLORS.nvidia,
  },
  {
    id: "devstral",
    name: "Devstral 2",
    provider: "nvidia",
    description: "123B — code specialist, HTML/CSS/JS",
    tags: ["code", "free"],
    contextWindow: 131072,
    speedTier: "fast",
    costTier: "free",
    color: PROVIDER_COLORS.nvidia,
  },
  {
    id: "claude",
    name: "Claude",
    provider: "anthropic",
    description: "Sonnet — reasoning, tools, structured output",
    tags: ["reasoning", "tools", "code"],
    contextWindow: 200000,
    speedTier: "fast",
    costTier: "byok",
    color: PROVIDER_COLORS.anthropic,
  },
  {
    id: "gemini",
    name: "Gemini 2.5",
    provider: "google",
    description: "Flash — fast streaming, multimodal",
    tags: ["fast", "streaming", "vision"],
    contextWindow: 1048576,
    speedTier: "instant",
    costTier: "free",
    color: PROVIDER_COLORS.google,
  },
  // ─── Frontier Models (Wave 3) ───
  {
    id: "kimi-dev-72b",
    name: "Kimi-Dev-72B",
    provider: "local",
    description: "72B — SOTA SWE-bench, best open-source code model",
    tags: ["code", "free"],
    contextWindow: 131072,
    speedTier: "standard",
    costTier: "free",
    color: PROVIDER_COLORS.local,
  },
  {
    id: "llama4-scout",
    name: "Llama 4 Scout",
    provider: "meta",
    description: "17B — 10M context window, natively multimodal",
    tags: ["long-context", "vision", "free"],
    contextWindow: 10485760,
    speedTier: "fast",
    costTier: "free",
    color: PROVIDER_COLORS.meta,
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek-R1 Full",
    provider: "deepseek",
    description: "97.3% MATH-500 — frontier reasoning model",
    tags: ["reasoning", "thinking", "free"],
    contextWindow: 131072,
    speedTier: "slow",
    costTier: "free",
    color: PROVIDER_COLORS.deepseek,
  },
  {
    id: "phi-4",
    name: "Phi-4",
    provider: "local",
    description: "14B — rivals larger models, great for edge/local",
    tags: ["fast", "free"],
    contextWindow: 16384,
    speedTier: "instant",
    costTier: "free",
    color: PROVIDER_COLORS.local,
  },
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    provider: "local",
    description: "1T params — vision, code, reasoning, math",
    tags: ["vision", "code", "reasoning", "free"] as ModelTag[],
    contextWindow: 262144,
    speedTier: "standard" as const,
    costTier: "free" as const,
    color: PROVIDER_COLORS.local,
  },
];

export function getModel(id: string): ModelConfig {
  return MODEL_REGISTRY.find(m => m.id === id) || MODEL_REGISTRY[0];
}

export function getModelsByTag(tag: ModelTag): ModelConfig[] {
  return MODEL_REGISTRY.filter(m => m.tags.includes(tag));
}

export function getFreeModels(): ModelConfig[] {
  return MODEL_REGISTRY.filter(m => m.costTier === "free");
}
