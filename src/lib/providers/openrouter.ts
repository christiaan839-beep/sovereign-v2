/**
 * OpenRouter meta-gateway adapter.
 *
 * OpenRouter is the escape hatch: one API key unlocks 100+ models from
 * 20+ labs (OpenAI, Anthropic, Mistral, Meta, Google, xAI, Cohere, Perplexity,
 * DeepSeek, Qwen, Yi, ...). Ideal last-resort in the failover chain — when
 * every direct provider is rate-limited or down, OpenRouter's own routing
 * finds a working host.
 *
 * ENDPOINT PATTERN
 * ────────────────
 * Uses the canonical openai-compat chat completion. Model slugs are
 * prefixed: "openai/gpt-5", "anthropic/claude-opus-4.5", "meta/llama-4-405b".
 *
 * Extra headers recommended (per OpenRouter docs):
 *   HTTP-Referer: our production URL (for leaderboards + spend attribution)
 *   X-Title: app name (displayed in OpenRouter dashboard)
 *
 * Docs: https://openrouter.ai/docs
 */

import {
  openaiCompatChat,
  requireKey,
  type OpenAICompatMessage,
} from "./provider-utils";
import { openrouterBreaker } from "@/lib/circuit-breaker";

/**
 * A small curated catalog of OpenRouter slugs we know work well.
 * Callers can still pass any slug string — this is just for discoverability.
 */
export const OPENROUTER_MODELS = {
  gpt5: "openai/gpt-5",
  claudeOpus: "anthropic/claude-opus-4.5",
  gemini3Pro: "google/gemini-3-pro",
  llama4_405b: "meta-llama/llama-4-maverick-405b",
  deepseekV3: "deepseek/deepseek-chat-v3",
  qwen35_397b: "qwen/qwen-3.5-397b-a17b",
  perplexitySonar: "perplexity/llama-3.1-sonar-large",
  mixtral8x22b: "mistralai/mixtral-8x22b-instruct",
  yiLarge: "01-ai/yi-large",
  /** Let OpenRouter pick the cheapest model that matches the prompt type.
   *  "auto" is OR's built-in router — great fallback-of-fallbacks. */
  auto: "openrouter/auto",
} as const;

export type OpenRouterModelKey = keyof typeof OPENROUTER_MODELS;

export interface OpenRouterChatArgs {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  apiKey?: string;
  /** Overrides HTTP-Referer — leaves production default otherwise. */
  referer?: string;
  /** Overrides X-Title. */
  appName?: string;
}

export async function openrouterChat(
  args: OpenRouterChatArgs,
): Promise<string> {
  const key = requireKey(
    args.apiKey ?? process.env.OPENROUTER_API_KEY,
    "openrouter",
  );
  const model = resolveModel(args.model);

  const messages: OpenAICompatMessage[] = [
    ...(args.system ? [{ role: "system" as const, content: args.system }] : []),
    { role: "user" as const, content: args.prompt },
  ];

  const extraHeaders: Record<string, string> = {
    "HTTP-Referer": args.referer ?? "https://sovereignmatrix.agency",
    "X-Title": args.appName ?? "Sovereign Matrix",
  };

  return openrouterBreaker.execute(() =>
    openaiCompatChat({
      provider: "openrouter",
      model,
      apiKey: key,
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      messages,
      maxTokens: args.maxTokens ?? 2000,
      temperature: args.temperature ?? 0.7,
      extraHeaders,
      timeoutKey: "AI_CALL",
    }),
  );
}

function resolveModel(input?: string): string {
  if (!input) return OPENROUTER_MODELS.auto;
  if (input in OPENROUTER_MODELS) {
    return OPENROUTER_MODELS[input as OpenRouterModelKey];
  }
  return input;
}
