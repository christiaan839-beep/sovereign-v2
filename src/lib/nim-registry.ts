/**
 * NVIDIA NIM model registry — typed catalog of the models we route
 * across in `src/lib/ai.ts` + `src/lib/nvidia.ts`.
 *
 * Today the unified router (`ai()`) hard-codes provider strings.
 * That's fine for picking which API client to call, but it doesn't
 * give us:
 *
 *   - cost-per-token attribution per model (NIM is free, but the
 *     abstraction matters when we cascade to paid providers)
 *   - context-window awareness so we can refuse calls that won't
 *     fit before burning a request
 *   - capability flags so the smart-router can pick the right
 *     model for each task (vision, ASR, function-calling, etc.)
 *   - one place to update when NVIDIA ships a new model (today
 *     we'd grep across 10 files)
 *
 * Every entry below is verified against build.nvidia.com — model
 * IDs, context windows, and licenses match what the public
 * `https://integrate.api.nvidia.com/v1/models` endpoint returns.
 *
 * Cost: NIM models served via build.nvidia.com are free with a
 * generous rate-limited tier. We track cost-per-1K-tokens at $0
 * for NIM-served models so the cost-ledger correctly attributes
 * "this customer's run cost $0 in inference" — which is the
 * actual unit economic story we want at scale.
 */

export type NimCapability =
  | "text"
  | "vision"
  | "audio"
  | "embed"
  | "rerank"
  | "tool-use"
  | "code"
  | "long-context";

export interface NimModel {
  /** Provider model id passed to NIM API (`{model: <id>}`). */
  id: string;
  /** Human-readable label for dashboards + logs. */
  label: string;
  /** Open-license badge (CC-BY-4.0, Apache-2.0, NVIDIA Open License). */
  license: string;
  /** Max context window in tokens. */
  contextTokens: number;
  /** What this model is good at. */
  capabilities: NimCapability[];
  /** USD cents per 1K tokens (input+output combined). 0 = free tier. */
  costPer1KCents: number;
  /** True for the small-but-fast pick when latency matters. */
  fast?: boolean;
  /** True for the large-context flagship model in this family. */
  flagship?: boolean;
}

/** Default model for general text generation when no override is supplied. */
export const DEFAULT_NIM_MODEL_ID = "nvidia/llama-3.1-nemotron-ultra-253b-v1";

/**
 * The catalog. Ordered loosely by intended use — flagship reasoning
 * first, then routing/coding, then multimodal, then embeddings/rerank.
 *
 * When NVIDIA ships a new model:
 *   1. add the entry here
 *   2. confirm `npm test` (the registry has self-tests)
 *   3. ship — every consumer (cost-ledger, router, admin UI)
 *      automatically picks it up
 */
export const NIM_MODELS: readonly NimModel[] = [
  // ── Reasoning + tool-use ──
  {
    id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    label: "Nemotron Ultra 253B",
    license: "NVIDIA Open License",
    contextTokens: 128_000,
    capabilities: ["text", "tool-use", "code", "long-context"],
    costPer1KCents: 0,
    flagship: true,
  },
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1",
    label: "Nemotron Super 49B",
    license: "NVIDIA Open License",
    contextTokens: 128_000,
    capabilities: ["text", "tool-use", "code"],
    costPer1KCents: 0,
  },
  {
    id: "nvidia/nemotron-4-340b-instruct",
    label: "Nemotron 4 340B Instruct",
    license: "NVIDIA Open License",
    contextTokens: 4_096,
    capabilities: ["text", "tool-use"],
    costPer1KCents: 0,
  },
  // ── Cost-efficient routing ──
  {
    id: "deepseek-ai/deepseek-v3.2",
    label: "DeepSeek V3.2",
    license: "DeepSeek License",
    contextTokens: 128_000,
    capabilities: ["text", "code", "tool-use"],
    costPer1KCents: 0,
    fast: true,
  },
  {
    id: "google/gemma-4-31b-it",
    label: "Gemma 4 31B Instruct",
    license: "Gemma Terms of Use",
    contextTokens: 128_000,
    capabilities: ["text", "tool-use"],
    costPer1KCents: 0,
    fast: true,
  },
  {
    id: "mistralai/mistral-large-2-instruct",
    label: "Mistral Large 2",
    license: "Mistral Research License",
    contextTokens: 128_000,
    capabilities: ["text", "tool-use", "code"],
    costPer1KCents: 0,
  },
  // ── Multimodal — the Sensory Mesh ──
  {
    id: "nvidia/nemotron-nano-omni",
    label: "Nemotron Nano Omni (multimodal)",
    license: "NVIDIA Open License",
    contextTokens: 256_000,
    capabilities: ["text", "vision", "audio", "long-context", "tool-use"],
    costPer1KCents: 0,
    flagship: true,
  },
  {
    id: "nvidia/cosmos-reason-32b",
    label: "Cosmos Reason 32B (vision-language)",
    license: "NVIDIA Open License",
    contextTokens: 32_768,
    capabilities: ["text", "vision"],
    costPer1KCents: 0,
  },
  // ── Speech ──
  {
    id: "nvidia/parakeet-tdt-1.1b",
    label: "Parakeet TDT 1.1B (ASR)",
    license: "CC-BY-4.0",
    contextTokens: 0, // audio model — N/A
    capabilities: ["audio"],
    costPer1KCents: 0,
  },
  // ── Embeddings + rerank ──
  {
    id: "nvidia/nv-embedqa-e5-v5",
    label: "NV-EmbedQA-E5 v5",
    license: "NVIDIA Open License",
    contextTokens: 8_192,
    capabilities: ["embed"],
    costPer1KCents: 0,
  },
  {
    id: "nvidia/nv-rerankqa-mistral-4b-v3",
    label: "NV-RerankQA Mistral 4B v3",
    license: "NVIDIA Open License",
    contextTokens: 8_192,
    capabilities: ["rerank"],
    costPer1KCents: 0,
  },
] as const;

/** Look up a model by id. Throws if unknown — fail fast. */
export function getNimModel(id: string): NimModel {
  const m = NIM_MODELS.find((x) => x.id === id);
  if (!m) {
    throw new Error(
      `Unknown NIM model: ${id}. Add it to src/lib/nim-registry.ts.`,
    );
  }
  return m;
}

/** Return all models that satisfy every requested capability. */
export function modelsByCapability(...required: NimCapability[]): NimModel[] {
  return NIM_MODELS.filter((m) =>
    required.every((c) => m.capabilities.includes(c)),
  );
}

/**
 * Choose the cheapest model that satisfies a context-window
 * requirement and all required capabilities. Used by the
 * cost-aware Thompson-sampling cascade.
 */
export function pickCheapestForCapability(args: {
  capabilities: NimCapability[];
  minContextTokens?: number;
  preferFast?: boolean;
}): NimModel | null {
  const candidates = NIM_MODELS.filter(
    (m) =>
      args.capabilities.every((c) => m.capabilities.includes(c)) &&
      (args.minContextTokens ? m.contextTokens >= args.minContextTokens : true),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (args.preferFast) {
      const af = a.fast ? 0 : 1;
      const bf = b.fast ? 0 : 1;
      if (af !== bf) return af - bf;
    }
    return a.costPer1KCents - b.costPer1KCents;
  });
  return candidates[0];
}

/**
 * The flagship-for-task helper. Returns the NVIDIA-branded
 * top-tier model for a given task family. Used by the
 * agent-factory when a route opts in to "best available".
 */
export function flagshipFor(
  task: "reasoning" | "multimodal" | "asr" | "embed" | "rerank",
): NimModel {
  switch (task) {
    case "reasoning":
      return getNimModel("nvidia/llama-3.1-nemotron-ultra-253b-v1");
    case "multimodal":
      return getNimModel("nvidia/nemotron-nano-omni");
    case "asr":
      return getNimModel("nvidia/parakeet-tdt-1.1b");
    case "embed":
      return getNimModel("nvidia/nv-embedqa-e5-v5");
    case "rerank":
      return getNimModel("nvidia/nv-rerankqa-mistral-4b-v3");
  }
}
