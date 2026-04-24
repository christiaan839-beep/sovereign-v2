/**
 * src/lib/providers — barrel + unified catalog.
 *
 * Everything a caller needs from the provider layer is re-exported
 * here so import paths stay short:
 *   import { openaiChat, xaiChat, mistralDirectChat } from "@/lib/providers";
 *
 * The FRONTIER_MODELS catalog is the single source of truth for what
 * frontier models are addressable. `getFrontierModelCount()` is what
 * the landing page + /compare use so the "N models" claim auto-updates
 * when a provider adds a new slug.
 */

export {
  openaiChat,
  OPENAI_MODELS,
  type OpenAIChatArgs,
  type OpenAIModelKey,
} from "./openai";

export {
  xaiChat,
  XAI_MODELS,
  type XAIChatArgs,
  type XAIModelKey,
} from "./xai";

export {
  mistralDirectChat,
  MISTRAL_MODELS,
  type MistralChatArgs,
  type MistralModelKey,
} from "./mistral";

export {
  cohereChat,
  COHERE_MODELS,
  type CohereChatArgs,
  type CohereModelKey,
} from "./cohere";

export {
  openrouterChat,
  OPENROUTER_MODELS,
  type OpenRouterChatArgs,
  type OpenRouterModelKey,
} from "./openrouter";

export {
  togetherChat,
  TOGETHER_MODELS,
  type TogetherChatArgs,
  type TogetherModelKey,
} from "./together";

export {
  databricksChat,
  DATABRICKS_MODELS,
  type DatabricksChatArgs,
  type DatabricksModelKey,
} from "./databricks";

export {
  replicatePredict,
  imageGen,
  REPLICATE_MODELS,
  type ReplicatePredictArgs,
  type ReplicatePrediction,
  type ReplicateModelKey,
} from "./replicate";

export {
  ProviderError,
  requireKey,
  openaiCompatChat,
  type OpenAICompatMessage,
  type OpenAICompatOptions,
} from "./provider-utils";

// ────────────────────────────────────────────────────────────────
// FRONTIER_MODELS — the single source of truth for what's addressable.
// Used by: /compare page, landing ModelRouterSection, weekly-health.mjs.
// Every entry here MUST be reachable through one of the adapters above.
// ────────────────────────────────────────────────────────────────

import { OPENAI_MODELS } from "./openai";
import { XAI_MODELS } from "./xai";
import { MISTRAL_MODELS } from "./mistral";
import { COHERE_MODELS } from "./cohere";
import { OPENROUTER_MODELS } from "./openrouter";
import { TOGETHER_MODELS } from "./together";
import { DATABRICKS_MODELS } from "./databricks";
import { REPLICATE_MODELS } from "./replicate";

export interface FrontierModelEntry {
  provider: string;
  slug: string;
  family: "closed" | "open" | "meta";
  modality: "text" | "vision" | "image" | "video" | "audio" | "multimodal";
  /** True when this model is suitable for consensus-style verified calls. */
  consensusEligible: boolean;
}

export const FRONTIER_MODELS: FrontierModelEntry[] = [
  // OpenAI (closed)
  ...Object.values(OPENAI_MODELS).map((slug) => ({
    provider: "openai",
    slug,
    family: "closed" as const,
    modality: "text" as const,
    consensusEligible: true,
  })),

  // xAI (closed)
  ...Object.values(XAI_MODELS).map((slug) => ({
    provider: "xai",
    slug,
    family: "closed" as const,
    modality: "text" as const,
    consensusEligible: true,
  })),

  // Mistral (open weights, closed hosting)
  ...Object.values(MISTRAL_MODELS).map((slug) => ({
    provider: "mistral",
    slug,
    family: "open" as const,
    modality: slug.includes("pixtral") ? ("multimodal" as const) : ("text" as const),
    consensusEligible: true,
  })),

  // Cohere (closed)
  ...Object.values(COHERE_MODELS).map((slug) => ({
    provider: "cohere",
    slug,
    family: "closed" as const,
    modality: "text" as const,
    consensusEligible: true,
  })),

  // OpenRouter (meta — skips FRONTIER_MODELS double-count since we list via direct providers)
  // Keep only the "auto" router entry so OpenRouter is represented but doesn't inflate counts.
  {
    provider: "openrouter",
    slug: OPENROUTER_MODELS.auto,
    family: "meta",
    modality: "text",
    consensusEligible: false,
  },

  // Together (open)
  ...Object.values(TOGETHER_MODELS).map((slug) => ({
    provider: "together",
    slug,
    family: "open" as const,
    modality: "text" as const,
    consensusEligible: true,
  })),

  // Databricks (open-on-enterprise-hosting)
  ...Object.values(DATABRICKS_MODELS).map((slug) => ({
    provider: "databricks",
    slug,
    family: "open" as const,
    modality: "text" as const,
    consensusEligible: true,
  })),

  // Replicate (image/video/audio — not text consensus)
  ...Object.values(REPLICATE_MODELS).map((slug) => ({
    provider: "replicate",
    slug,
    family: "open" as const,
    modality: slug.includes("whisper")
      ? ("audio" as const)
      : slug.includes("video")
        ? ("video" as const)
        : slug.includes("llama")
          ? ("text" as const)
          : ("image" as const),
    consensusEligible: false,
  })),
];

export function getFrontierModelCount(): {
  total: number;
  byProvider: Record<string, number>;
  byFamily: Record<string, number>;
  byModality: Record<string, number>;
} {
  const byProvider: Record<string, number> = {};
  const byFamily: Record<string, number> = {};
  const byModality: Record<string, number> = {};
  for (const m of FRONTIER_MODELS) {
    byProvider[m.provider] = (byProvider[m.provider] ?? 0) + 1;
    byFamily[m.family] = (byFamily[m.family] ?? 0) + 1;
    byModality[m.modality] = (byModality[m.modality] ?? 0) + 1;
  }
  return {
    total: FRONTIER_MODELS.length,
    byProvider,
    byFamily,
    byModality,
  };
}

/**
 * Consensus-diverse model pool — picks K models from different families
 * so errors are uncorrelated. Used by verifiedAi()/consensusAi() in
 * src/lib/consensus.ts when the caller doesn't specify which models.
 *
 * Pattern:
 *   - 1 closed-source giant (gpt-5 / claude-opus / grok-4)
 *   - 1 open-source giant (llama-4-405b / qwen-3.5 / deepseek-v3)
 *   - 1 reasoning-tuned (o3 / qwen-thinking)
 *   - 1 fast / cheap (gpt-5-mini / command-r7b)
 */
export function getDiverseConsensusPool(k = 4): FrontierModelEntry[] {
  const eligible = FRONTIER_MODELS.filter((m) => m.consensusEligible);
  const closed = eligible.filter((m) => m.family === "closed");
  const open = eligible.filter((m) => m.family === "open");

  // Naive round-robin: take alternating closed / open up to k.
  const pool: FrontierModelEntry[] = [];
  const maxIters = Math.min(k, closed.length + open.length);
  for (let i = 0; i < maxIters; i++) {
    const pick = i % 2 === 0 ? closed[Math.floor(i / 2)] : open[Math.floor(i / 2)];
    if (pick) pool.push(pick);
  }
  return pool.slice(0, k);
}
