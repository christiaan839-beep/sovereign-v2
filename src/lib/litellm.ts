/**
 * LITELLM ADAPTER — unified LLM proxy (MIT license, self-hosted on Hetzner).
 *
 * LiteLLM sits between this app and every LLM provider. It provides:
 *   - OpenAI-compatible API format for ALL providers (NIM, Gemini, Claude, Groq, Ollama)
 *   - Automatic retries, caching, fallbacks at the infrastructure level
 *   - Cost tracking per-model, per-key, per-user
 *   - Token counting that matches billing
 *   - Load balancing across multiple keys for the same provider
 *
 * When to route through LiteLLM (vs calling providers directly):
 *   - LITELLM_URL is set → prefer LiteLLM (it has caching + fallbacks)
 *   - LITELLM_URL absent → direct provider calls (ai.ts logic)
 *
 * This adapter is a THIN wrapper. It doesn't replace ai.ts — it offers
 * an optional proxy path for callers who want LiteLLM's features.
 */

import { createLogger } from "@/lib/logger";
import { withTimeout, TIMEOUTS } from "@/lib/with-timeout";

const log = createLogger("litellm");

const LITELLM_URL = process.env.LITELLM_URL;
const LITELLM_API_KEY = process.env.LITELLM_API_KEY;

export interface LiteLLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LiteLLMOptions {
  /**
   * The LiteLLM-side model alias — NOT a provider model name.
   * Defined in the LiteLLM proxy config, e.g., "fast", "smart", "cheap".
   * Falls back to "default" if omitted.
   */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Whether LiteLLM should use its cache for this call */
  cache?: boolean;
  /**
   * User identifier for LiteLLM's per-user cost tracking + rate limits.
   * Pass the Clerk user ID so LiteLLM can enforce per-user budgets.
   */
  user?: string;
}

export interface LiteLLMResponse {
  text: string;
  model: string; // which underlying model LiteLLM actually routed to
  /** Token counts — exactly what LiteLLM bills for */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  /** True if LiteLLM served this from its cache (zero provider cost) */
  cached?: boolean;
}

/**
 * Lightweight check — true if LITELLM_URL is set and reachable.
 * Use at startup to decide whether ai.ts should prefer LiteLLM.
 */
export async function isLiteLLMAvailable(): Promise<boolean> {
  if (!LITELLM_URL) return false;
  try {
    const res = await withTimeout(
      TIMEOUTS.HTTP,
      (signal) => fetch(`${LITELLM_URL}/health`, { signal }),
      "LiteLLM health",
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * OpenAI-compatible chat completion via LiteLLM proxy. Returns parsed
 * text + usage metadata + cache hit signal.
 */
export async function liteLLMChat(
  messages: LiteLLMMessage[],
  options: LiteLLMOptions = {},
): Promise<LiteLLMResponse> {
  if (!LITELLM_URL) throw new Error("LITELLM_URL not configured");

  const body = {
    model: options.model ?? "default",
    messages,
    max_tokens: options.maxTokens ?? 2000,
    temperature: options.temperature ?? 0.4,
    ...(options.user ? { user: options.user } : {}),
    ...(options.cache === false ? { cache: { "no-cache": true } } : {}),
  };

  const res = await withTimeout(
    TIMEOUTS.AI_CALL,
    (signal) =>
      fetch(`${LITELLM_URL}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(LITELLM_API_KEY ? { Authorization: `Bearer ${LITELLM_API_KEY}` } : {}),
        },
        body: JSON.stringify(body),
      }),
    `LiteLLM (${body.model})`,
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LiteLLM error ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  const usage = data?.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined;

  // LiteLLM surfaces a cache hit via x-litellm-cache-hit header or
  // via a response field — handle both shapes.
  const cached =
    res.headers.get("x-litellm-cache-hit") === "true" ||
    data?._litellm_cache_hit === true;

  if (cached) {
    log.info("LiteLLM cache hit", { model: data?.model });
  }

  return {
    text,
    model: data?.model ?? body.model,
    usage,
    cached,
  };
}

/**
 * Simple text-in-text-out wrapper for parity with ai.ts callers.
 * Drop-in replacement for `nimChat(model, messages, opts)` when users
 * want LiteLLM routing instead of direct NIM.
 */
export async function liteLLMText(
  prompt: string,
  system?: string,
  options: LiteLLMOptions = {},
): Promise<string> {
  const messages: LiteLLMMessage[] = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    { role: "user" as const, content: prompt },
  ];
  const result = await liteLLMChat(messages, options);
  return result.text;
}
