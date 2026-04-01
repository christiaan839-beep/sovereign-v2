import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey, multimodalAnalyze } from "@/lib/nvidia";
import { createLogger } from "@/lib/logger";

const log = createLogger("vision-analyze");

/**
 * VISION ANALYZER — Multi-model vision pipeline
 *
 * Model priority chain:
 *   1. Kimi K2.5 (moonshotai/kimi-k2.5) — best overall vision reasoning
 *   2. Nemotron Nano VL 12B — fast NVIDIA-native fallback
 *   3. Llama 3.2 90B Vision — large-scale fallback
 *
 * Uses NVIDIA NIM vision-language models to analyze:
 * - Documents (invoices, receipts, contracts)
 * - Screenshots (UI analysis, competitor pages)
 * - Photos (product images, brand assets)
 * - Charts & graphs (data extraction)
 *
 * Input: { imageUrl OR imageBase64, question?, model? }
 * Output: { analysis, model }
 */

const NIM_BASE = "https://integrate.api.nvidia.com/v1/chat/completions";

/** Vision model cascade — tried in order until one succeeds */
const VISION_MODELS = [
  { id: "moonshotai/kimi-k2.5", label: "kimi-k2.5", maxTokens: 4096 },
  { id: "nvidia/nemotron-nano-12b-v2-vl", label: "nemotron-nano-vl", maxTokens: 2000 },
  { id: "meta/llama-3.2-90b-vision-instruct", label: "llama-3.2-90b-vision", maxTokens: 2000 },
] as const;

async function callVisionModel(
  modelId: string,
  imageContent: { type: "image_url"; image_url: { url: string } },
  question: string,
  maxTokens: number,
  nimKey: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(NIM_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${nimKey}` },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              imageContent,
              { type: "text", text: question },
            ],
          },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${res.statusText}: ${errBody.slice(0, 200)}` };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    if (!text) return { ok: false, error: "Empty response from model" };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown fetch error" };
  }
}

export const POST = createAgentRoute({
  name: "vision-analyze",
  requiredFields: [],
  handler: async ({ input }) => {
    const imageUrl = input.imageUrl as string | undefined;
    const imageBase64 = input.imageBase64 as string | undefined;
    const question = (input.question as string) || "Analyze this image in detail. Describe what you see, extract any text, identify the purpose, and note anything notable.";
    const preferredModel = input.model as string | undefined;

    if (!imageUrl && !imageBase64) {
      return { error: "Provide either imageUrl or imageBase64." };
    }

    const nimKey = await getNimKey();
    if (!nimKey) {
      return { error: "AI model API key not configured. Add it in Settings > API Keys." };
    }

    const imageContent = imageUrl
      ? { type: "image_url" as const, image_url: { url: imageUrl } }
      : { type: "image_url" as const, image_url: { url: `data:image/png;base64,${imageBase64}` } };

    // Try Qwen 3.5 VLM 400B (multimodalAnalyze) first — best multimodal model on NIM.
    // Only when no specific model is preferred and we have a URL (not base64, since
    // multimodalAnalyze expects a URL).
    if (!preferredModel && imageUrl) {
      try {
        log.info("Trying multimodalAnalyze (Qwen 3.5 VLM 400B)");
        const result = await multimodalAnalyze(imageUrl, question, { maxTokens: 4096 });
        if (result) {
          log.info("multimodalAnalyze succeeded");
          return { analysis: result, model: "qwen3.5-vl-400b" };
        }
      } catch (err) {
        log.warn("multimodalAnalyze failed, falling back to cascade", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // If caller requested a specific model, try it first
    const modelQueue = preferredModel
      ? [
          ...VISION_MODELS.filter(m => m.id === preferredModel || m.label === preferredModel),
          ...VISION_MODELS.filter(m => m.id !== preferredModel && m.label !== preferredModel),
        ]
      : [...VISION_MODELS];

    // Cascade through models until one succeeds
    const errors: string[] = [];
    for (const model of modelQueue) {
      log.info("Trying vision model", { model: model.label });
      const result = await callVisionModel(model.id, imageContent, question, model.maxTokens, nimKey);

      if (result.ok) {
        log.info("Vision model succeeded", { model: model.label });
        return {
          analysis: result.text,
          model: model.label,
          ...(errors.length > 0 ? { fallbacksAttempted: errors.length } : {}),
        };
      }

      log.warn("Vision model failed, trying next", { model: model.label, error: result.error });
      errors.push(`${model.label}: ${result.error}`);
    }

    return {
      error: "All vision models failed",
      details: errors,
    };
  },
});
