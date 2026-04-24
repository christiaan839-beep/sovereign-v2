/**
 * OpenAI provider adapter.
 *
 * Exposes: gpt-5, gpt-5-mini, gpt-4.1, o1, o3, o3-mini.
 *
 * OpenAI speaks the canonical /v1/chat/completions shape — everything
 * goes through openaiCompatChat(). The only OpenAI-specifics are:
 *   - `Authorization: Bearer <key>` with an organization header when set
 *   - Reasoning models (o1/o3/o3-mini) ignore `temperature` and use more tokens
 */

import {
  openaiCompatChat,
  requireKey,
  type OpenAICompatMessage,
} from "./provider-utils";
import { openaiBreaker } from "@/lib/circuit-breaker";

export const OPENAI_MODELS = {
  gpt5: "gpt-5",
  gpt5Mini: "gpt-5-mini",
  gpt41: "gpt-4.1",
  o1: "o1",
  o3: "o3",
  o3Mini: "o3-mini",
} as const;

export type OpenAIModelKey = keyof typeof OPENAI_MODELS;

const REASONING_MODELS = new Set<string>([
  OPENAI_MODELS.o1,
  OPENAI_MODELS.o3,
  OPENAI_MODELS.o3Mini,
]);

export interface OpenAIChatArgs {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Accepts a full model slug ("gpt-5", "o3", etc.) OR a key ("gpt5"). */
  model?: string;
  /** If set, uses this key instead of process.env.OPENAI_API_KEY. Useful for BYOK flows. */
  apiKey?: string;
  organizationId?: string;
}

export async function openaiChat(args: OpenAIChatArgs): Promise<string> {
  const key = requireKey(args.apiKey ?? process.env.OPENAI_API_KEY, "openai");
  const model = resolveModel(args.model);

  const messages: OpenAICompatMessage[] = [
    ...(args.system ? [{ role: "system" as const, content: args.system }] : []),
    { role: "user" as const, content: args.prompt },
  ];

  // Reasoning models (o1/o3) reject `temperature` — OpenAI returns 400.
  // Strip it + bump maxTokens because these models emit long reasoning.
  const isReasoning = REASONING_MODELS.has(model);
  const maxTokens = isReasoning ? (args.maxTokens ?? 8000) : (args.maxTokens ?? 2000);
  const temperature = isReasoning ? undefined : (args.temperature ?? 0.7);

  const extraHeaders: Record<string, string> = {};
  if (args.organizationId) {
    extraHeaders["OpenAI-Organization"] = args.organizationId;
  }

  return openaiBreaker.execute(() =>
    openaiCompatChat({
      provider: "openai",
      model,
      apiKey: key,
      baseUrl: "https://api.openai.com/v1/chat/completions",
      messages,
      maxTokens,
      temperature,
      extraHeaders,
      // Reasoning models can take a while; give them the deep bucket.
      timeoutKey: isReasoning ? "AI_DEEP" : "AI_CALL",
    }),
  );
}

function resolveModel(input?: string): string {
  if (!input) return OPENAI_MODELS.gpt41;
  // If caller passed a key like "gpt5", resolve it. Otherwise treat as slug.
  if (input in OPENAI_MODELS) {
    return OPENAI_MODELS[input as OpenAIModelKey];
  }
  return input;
}
