/**
 * xAI (Grok) provider adapter.
 *
 * xAI deliberately mirrors OpenAI's /v1/chat/completions shape — same
 * request body, same response. Drop-in via openaiCompatChat().
 *
 * Exposes: grok-4, grok-3, grok-3-mini, grok-3-mini-fast.
 *
 * Docs: https://docs.x.ai/api
 */

import {
  openaiCompatChat,
  requireKey,
  type OpenAICompatMessage,
} from "./provider-utils";
import { xaiBreaker } from "@/lib/circuit-breaker";

export const XAI_MODELS = {
  grok4: "grok-4",
  grok3: "grok-3",
  grok3Mini: "grok-3-mini",
  grok3MiniFast: "grok-3-mini-fast",
} as const;

export type XAIModelKey = keyof typeof XAI_MODELS;

export interface XAIChatArgs {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  apiKey?: string;
}

export async function xaiChat(args: XAIChatArgs): Promise<string> {
  const key = requireKey(args.apiKey ?? process.env.XAI_API_KEY, "xai");
  const model = resolveModel(args.model);

  const messages: OpenAICompatMessage[] = [
    ...(args.system ? [{ role: "system" as const, content: args.system }] : []),
    { role: "user" as const, content: args.prompt },
  ];

  return xaiBreaker.execute(() =>
    openaiCompatChat({
      provider: "xai",
      model,
      apiKey: key,
      baseUrl: "https://api.x.ai/v1/chat/completions",
      messages,
      maxTokens: args.maxTokens ?? 2000,
      temperature: args.temperature ?? 0.7,
      timeoutKey: "AI_CALL",
    }),
  );
}

function resolveModel(input?: string): string {
  if (!input) return XAI_MODELS.grok3;
  if (input in XAI_MODELS) return XAI_MODELS[input as XAIModelKey];
  return input;
}
