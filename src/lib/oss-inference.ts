/**
 * SOVEREIGN MATRIX — Self-hosted OSS inference adapter (Wave 133).
 *
 * Drops the marginal cost-per-call on high-volume agents toward $0 by
 * routing to user-controlled inference endpoints (vLLM, NIM
 * Microservices, Triton, llama.cpp server) that expose the OpenAI
 * `/v1/chat/completions` interface.
 *
 * Why it exists:
 *   - Hosted NIM costs ~$0.0001-$0.003 per call (volume-dependent)
 *   - At 100K+ calls/day (the trajectory the platform is on) those
 *     fractions multiply — $30-300/day burn rate
 *   - A single A100 / H100 on RunPod ($1.50/hr) or owned hardware
 *     amortizes to a fraction of a cent per call once busy
 *
 * Activation:
 *   Set `OSS_INFERENCE_ENDPOINT` (full URL ending in /v1) + optional
 *   `OSS_INFERENCE_API_KEY` env vars. `isOssInferenceConfigured()` is
 *   the gate every caller should check before routing.
 *
 * Compatibility:
 *   The endpoint MUST speak OpenAI-compatible `/v1/chat/completions`.
 *   vLLM, llama.cpp server, NIM, Triton (with the openai_chat backend),
 *   and most modern OSS servers all satisfy this. The schema is the
 *   intersection of OpenAI + the NIM dialect we already use.
 *
 * Routing:
 *   `smartOssChat(messages, opts)` is the high-level entry point.
 *   `ossChat(model, messages, opts)` is the typed primitive that
 *   mirrors `nimChat()` so swap-in is one line at the call site.
 *
 * Safety:
 *   - All calls go through `outboundFetchAsResponse` with a per-call
 *     ruleId + the configured host as the only allowed destination.
 *     Self-host endpoints are SSRF targets if user-supplied; the
 *     allowlist neutralises that vector by pinning to the env-set host.
 *   - 60-second wall-clock timeout default, configurable per-call.
 *   - Circuit-breaker integration via the shared retry primitive.
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";
import { createLogger } from "@/lib/logger";
import { withRetry } from "@/lib/retry";

const log = createLogger("oss-inference");

/** The full base URL of the OpenAI-compatible endpoint (ends in /v1). */
export function getOssEndpoint(): string | null {
  const raw = process.env.OSS_INFERENCE_ENDPOINT?.trim();
  if (!raw) return null;
  // Normalize: ensure it ends with /v1 (the OpenAI convention)
  return raw.replace(/\/+$/, "");
}

export function getOssApiKey(): string | null {
  const k = process.env.OSS_INFERENCE_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

export function isOssInferenceConfigured(): boolean {
  return !!getOssEndpoint();
}

/**
 * Pull the configured host (sans scheme) for the outboundFetch
 * allowlist. Returns null when no endpoint is set.
 */
export function getOssHost(): string | null {
  const url = getOssEndpoint();
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export interface OssChatOptions {
  /** Max output tokens. Defaults to 2048. */
  maxTokens?: number;
  /** Sampling temperature. Defaults to 0.7. */
  temperature?: number;
  /** Wall-clock timeout in ms. Defaults to 60_000. */
  timeoutMs?: number;
  /** Optional ruleId for the outboundFetch audit trail. */
  ruleId?: string;
  /** Optional top_p. */
  topP?: number;
  /** Optional stop sequences. */
  stop?: string[];
}

/**
 * Typed primitive — mirrors `nimChat()` so swap-in is one line.
 * Throws when the endpoint isn't configured or the upstream returns
 * non-2xx (or no completion content). Callers should treat the same
 * way they treat `nimChat()` failures.
 */
export async function ossChat(
  model: string,
  messages: Array<{
    role: string;
    content:
      | string
      | Array<{
          type: string;
          text?: string;
          image_url?: { url: string };
        }>;
  }>,
  options: OssChatOptions = {},
): Promise<string> {
  const endpoint = getOssEndpoint();
  const host = getOssHost();
  if (!endpoint || !host) {
    throw new Error(
      "OSS inference endpoint not configured. Set OSS_INFERENCE_ENDPOINT.",
    );
  }

  const url = `${endpoint}/chat/completions`;
  const apiKey = getOssApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const body = {
    model,
    messages,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.7,
    stream: false,
    ...(options.topP != null ? { top_p: options.topP } : {}),
    ...(options.stop ? { stop: options.stop } : {}),
  };

  const res = await withRetry(
    async () => {
      const r = await outboundFetchAsResponse(
        url,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
        },
        {
          ruleId: options.ruleId ?? "oss-inference.chat",
          allowedHosts: [host],
        },
      );
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`OSS inference ${r.status}: ${text.slice(0, 240)}`);
      }
      return r;
    },
    { maxRetries: 2, baseDelay: 400, label: "oss-inference.chat" },
  );

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.length === 0) {
    log.warn("OSS inference returned no content", { model });
    throw new Error("OSS inference returned empty response");
  }
  return text;
}

/**
 * High-level entry — picks a sensible default model for self-hosted
 * deployments. Most operators run one of: llama-4-maverick, deepseek-v3,
 * qwen3-235b, mistral-large. The env var `OSS_INFERENCE_DEFAULT_MODEL`
 * pins the default; otherwise we use a vendor-neutral generic id the
 * server is expected to alias.
 */
export async function smartOssChat(
  messages: Array<{ role: string; content: string }>,
  options: OssChatOptions = {},
): Promise<string> {
  const model =
    process.env.OSS_INFERENCE_DEFAULT_MODEL?.trim() || "default-chat";
  return ossChat(model, messages, options);
}

/**
 * Health probe — single HEAD request to verify the endpoint is
 * reachable. Returns `{ ok, latencyMs, error? }`. Never throws.
 * Used by the admin infrastructure page.
 */
export async function probeOssEndpoint(): Promise<{
  ok: boolean;
  latencyMs: number;
  endpoint: string | null;
  error?: string;
}> {
  const endpoint = getOssEndpoint();
  const host = getOssHost();
  if (!endpoint || !host) {
    return { ok: false, latencyMs: 0, endpoint: null, error: "not-configured" };
  }
  const start = Date.now();
  try {
    const apiKey = getOssApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const r = await outboundFetchAsResponse(
      `${endpoint}/models`,
      {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(5_000),
      },
      {
        ruleId: "oss-inference.probe",
        allowedHosts: [host],
      },
    );
    return {
      ok: r.ok,
      latencyMs: Date.now() - start,
      endpoint,
      error: r.ok ? undefined : `HTTP ${r.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      endpoint,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
