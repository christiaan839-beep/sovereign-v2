/**
 * Provider utilities — shared infra for frontier-provider adapters.
 *
 * Every file in src/lib/providers/<name>.ts uses these helpers so the
 * adapters stay tiny and consistent (auth → request → parse → error).
 *
 * WHAT YOU GET FROM HERE
 * ──────────────────────
 * - `openaiCompatChat()`: wraps the dozen providers that copy OpenAI's
 *   /v1/chat/completions shape (OpenAI itself, xAI, Together, OpenRouter,
 *   Databricks, Mistral, and many more). One implementation, many hosts.
 * - `ProviderError`: structured error with a code clients can switch on.
 * - `requireKey()`: consistent "key missing" error that the router
 *   recognizes + uses to try the next failover step.
 *
 * STAY-ELITE rule 4 (graceful degradation) — if the caller has no key,
 * we throw ProviderError("provider_not_configured") without ever hitting
 * the network. The router in ai.ts catches it and falls through.
 */

import { withTimeout, TIMEOUTS } from "@/lib/with-timeout";
import { createLogger } from "@/lib/logger";

const log = createLogger("provider-utils");

export class ProviderError extends Error {
  constructor(
    public code:
      | "provider_not_configured"
      | "provider_unavailable"
      | "provider_rate_limited"
      | "provider_timeout"
      | "provider_bad_response"
      | "provider_auth_failed",
    public provider: string,
    message: string,
    public httpStatus?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Throws if `key` is empty/undefined. Router catches + falls through. */
export function requireKey(key: string | undefined, provider: string): string {
  if (!key || key.trim().length === 0) {
    throw new ProviderError(
      "provider_not_configured",
      provider,
      `${provider} API key not configured. Set ${providerEnvHint(provider)}.`,
    );
  }
  return key;
}

function providerEnvHint(provider: string): string {
  const hints: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    xai: "XAI_API_KEY",
    mistral: "MISTRAL_API_KEY",
    cohere: "COHERE_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    together: "TOGETHER_API_KEY",
    databricks: "DATABRICKS_TOKEN + DATABRICKS_HOST",
    replicate: "REPLICATE_API_TOKEN",
  };
  return hints[provider] ?? `${provider.toUpperCase()}_API_KEY`;
}

export interface OpenAICompatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAICompatOptions {
  model: string;
  apiKey: string;
  baseUrl: string;
  messages: OpenAICompatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Used in telemetry + circuit-breaker names; must match the provider file. */
  provider: string;
  /** Optional extra headers (e.g. Databricks workspace ID, OpenRouter app ID). */
  extraHeaders?: Record<string, string>;
  /** If true, add `stream: false` to body. Most hosts default to non-streaming but
   *  Together + Replicate need it explicit. */
  forceNonStream?: boolean;
  /** Timeout bucket from with-timeout.ts. Defaults to AI_CALL (30s). */
  timeoutKey?: keyof typeof TIMEOUTS;
}

/**
 * Single shared chat completion for every OpenAI-shape provider.
 *
 * All of these accept identical request bodies:
 *   - OpenAI (platform.openai.com/v1/chat/completions)
 *   - xAI (api.x.ai/v1/chat/completions)
 *   - Mistral (api.mistral.ai/v1/chat/completions)
 *   - OpenRouter (openrouter.ai/api/v1/chat/completions)
 *   - Together AI (api.together.xyz/v1/chat/completions)
 *   - Databricks (<workspace>/serving-endpoints/<model>/invocations — see databricks.ts)
 *
 * We accept the `baseUrl` per call so each adapter stays ignorant of the
 * others. Cohere has a different response shape — it gets its own path.
 */
export async function openaiCompatChat(
  opts: OpenAICompatOptions,
): Promise<string> {
  const { provider, model, apiKey, baseUrl, messages } = opts;
  const maxTokens = opts.maxTokens ?? 2000;
  const timeoutMs = TIMEOUTS[opts.timeoutKey ?? "AI_CALL"];

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
  };
  // Only include temperature when the caller passed one. Reasoning models
  // (OpenAI o1/o3) reject the field — adapters pass `undefined` to opt out.
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.forceNonStream) body.stream = false;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...(opts.extraHeaders ?? {}),
  };

  let res: Response;
  try {
    res = await withTimeout(
      timeoutMs,
      (signal) =>
        fetch(baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal,
        }),
      `${provider}-chat`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("timeout")) {
      throw new ProviderError("provider_timeout", provider, message);
    }
    throw new ProviderError("provider_unavailable", provider, message);
  }

  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(
      "provider_auth_failed",
      provider,
      `${provider} rejected the API key (HTTP ${res.status})`,
      res.status,
    );
  }
  if (res.status === 429) {
    throw new ProviderError(
      "provider_rate_limited",
      provider,
      `${provider} rate limit exceeded`,
      res.status,
    );
  }
  if (!res.ok) {
    const body = await safeText(res);
    throw new ProviderError(
      "provider_unavailable",
      provider,
      `${provider} returned HTTP ${res.status}: ${body.slice(0, 200)}`,
      res.status,
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ProviderError(
      "provider_bad_response",
      provider,
      `${provider} returned non-JSON body`,
    );
  }

  const text = extractChoiceText(json);
  if (!text) {
    log.warn("Provider returned no choice text", { provider, json });
    throw new ProviderError(
      "provider_bad_response",
      provider,
      `${provider} response has no choice content`,
    );
  }
  return text;
}

function extractChoiceText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    output_text?: string; // some providers
    text?: string; // Cohere-old shape
  };
  const firstChoice = obj.choices?.[0]?.message?.content;
  if (typeof firstChoice === "string") return firstChoice;
  if (Array.isArray(firstChoice)) {
    // OpenAI response-format array sometimes returns content as
    // [{ type: "text", text: "..." }] — concatenate.
    return firstChoice
      .map((p) => (typeof p === "object" && p && "text" in p ? p.text : null))
      .filter((t): t is string => typeof t === "string")
      .join("");
  }
  if (typeof obj.output_text === "string") return obj.output_text;
  if (typeof obj.text === "string") return obj.text;
  return null;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
