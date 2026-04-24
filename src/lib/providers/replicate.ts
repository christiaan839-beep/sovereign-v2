/**
 * Replicate adapter — hosts image + video + audio models (FLUX, SDXL,
 * Stable Video, Whisper) that don't fit the chat-completion shape.
 *
 * PATTERN
 * ───────
 * Replicate is async: POST to start a prediction → poll until `status`
 * is `succeeded` or `failed`. That's different from every chat provider
 * above, so this file is text-model-free — it exposes an `imageGen()`
 * helper that the existing `/api/_agents/image-gen` route can call
 * instead of (or in addition to) the current FLUX path.
 *
 * We ALSO expose a generic `replicatePredict()` that any agent can use
 * to run arbitrary Replicate models (text, vision, audio).
 *
 * Docs: https://replicate.com/docs/reference/http
 */

import { ProviderError, requireKey } from "./provider-utils";
import { replicateBreaker } from "@/lib/circuit-breaker";
import { withTimeout, TIMEOUTS } from "@/lib/with-timeout";

export const REPLICATE_MODELS = {
  fluxPro: "black-forest-labs/flux-pro",
  fluxSchnell: "black-forest-labs/flux-schnell",
  sdxl: "stability-ai/sdxl",
  stableVideo: "stability-ai/stable-video-diffusion",
  whisperLarge: "openai/whisper",
  llama4_405bVision: "meta/llama-4-maverick",
} as const;

export type ReplicateModelKey = keyof typeof REPLICATE_MODELS;

const MAX_POLL_ATTEMPTS = 60; // 60 * 1s = 1min max wait
const POLL_INTERVAL_MS = 1000;

export interface ReplicatePredictArgs {
  /** Model slug or version id. Can be "owner/name" (latest) or "owner/name:<sha>". */
  model: string;
  /** Input payload for the model. Schema varies per model — see Replicate docs. */
  input: Record<string, unknown>;
  apiKey?: string;
  /** Abort polling after this many ms. Default 60s. */
  maxWaitMs?: number;
}

export interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: unknown;
  error: string | null;
}

/**
 * Start + await a Replicate prediction. Returns the full prediction
 * object once `status` is terminal.
 */
export async function replicatePredict(
  args: ReplicatePredictArgs,
): Promise<ReplicatePrediction> {
  const key = requireKey(
    args.apiKey ?? process.env.REPLICATE_API_TOKEN,
    "replicate",
  );
  const maxWaitMs = args.maxWaitMs ?? 60_000;
  const maxAttempts = Math.max(1, Math.ceil(maxWaitMs / POLL_INTERVAL_MS));

  return replicateBreaker.execute(async () => {
    // Phase 1: create prediction
    let createRes: Response;
    try {
      createRes = await withTimeout(
        TIMEOUTS.AI_CALL,
        (signal) =>
          fetch(
            `https://api.replicate.com/v1/models/${args.model}/predictions`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
                Prefer: "wait=1", // some models support sync return; falls back to async
              },
              body: JSON.stringify({ input: args.input }),
              signal,
            },
          ),
        "replicate-create",
      );
    } catch (err) {
      throw new ProviderError(
        "provider_unavailable",
        "replicate",
        err instanceof Error ? err.message : String(err),
      );
    }

    if (createRes.status === 401 || createRes.status === 403) {
      throw new ProviderError(
        "provider_auth_failed",
        "replicate",
        `Replicate auth failed (HTTP ${createRes.status})`,
        createRes.status,
      );
    }
    if (createRes.status === 429) {
      throw new ProviderError(
        "provider_rate_limited",
        "replicate",
        "Replicate rate limit exceeded",
        createRes.status,
      );
    }
    if (!createRes.ok && createRes.status !== 201) {
      const body = await safeText(createRes);
      throw new ProviderError(
        "provider_unavailable",
        "replicate",
        `Replicate create failed HTTP ${createRes.status}: ${body.slice(0, 200)}`,
        createRes.status,
      );
    }

    let prediction = (await createRes.json()) as ReplicatePrediction;

    // Phase 2: poll until terminal
    let attempts = 0;
    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      prediction.status !== "canceled" &&
      attempts < maxAttempts
    ) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      attempts++;
      const pollRes = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { Authorization: `Bearer ${key}` } },
      );
      if (!pollRes.ok) {
        throw new ProviderError(
          "provider_unavailable",
          "replicate",
          `Replicate poll failed HTTP ${pollRes.status}`,
          pollRes.status,
        );
      }
      prediction = (await pollRes.json()) as ReplicatePrediction;
    }

    if (prediction.status !== "succeeded") {
      throw new ProviderError(
        "provider_bad_response",
        "replicate",
        prediction.error ?? `Prediction ended with status ${prediction.status}`,
      );
    }

    return prediction;
  });
}

/**
 * Convenience wrapper for image generation. Returns the URL of the first
 * output image (most image models emit an array of URLs).
 */
export async function imageGen(
  prompt: string,
  opts: {
    model?: string;
    aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
    apiKey?: string;
    maxWaitMs?: number;
  } = {},
): Promise<string> {
  const pred = await replicatePredict({
    model: opts.model ?? REPLICATE_MODELS.fluxSchnell,
    apiKey: opts.apiKey,
    maxWaitMs: opts.maxWaitMs,
    input: {
      prompt,
      aspect_ratio: opts.aspectRatio ?? "1:1",
      output_format: "webp",
      output_quality: 90,
    },
  });

  const output = pred.output;
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  throw new ProviderError(
    "provider_bad_response",
    "replicate",
    `imageGen returned non-URL output: ${JSON.stringify(output).slice(0, 200)}`,
  );
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
