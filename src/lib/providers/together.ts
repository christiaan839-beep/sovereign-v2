/**
 * Together AI adapter — the best host for open-source frontier models.
 *
 * Together hosts the open-weight leaders (Llama 4 405B, Mixtral 8x22B,
 * Qwen 2.5 72B, DeepSeek V3) at prices usually 3-10× cheaper than
 * first-party APIs. Speaks /v1/chat/completions.
 *
 * Docs: https://docs.together.ai/reference/chat-completions
 */

import {
  openaiCompatChat,
  requireKey,
  type OpenAICompatMessage,
} from "./provider-utils";
import { togetherBreaker } from "@/lib/circuit-breaker";

export const TOGETHER_MODELS = {
  llama4_405b: "meta-llama/Llama-4-Maverick-405B-Instruct",
  llama3_70b: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  mixtral8x22b: "mistralai/Mixtral-8x22B-Instruct-v0.1",
  qwen25_72b: "Qwen/Qwen2.5-72B-Instruct-Turbo",
  deepseekV3: "deepseek-ai/DeepSeek-V3",
  deepseekR1: "deepseek-ai/DeepSeek-R1",
  qwen25Coder: "Qwen/Qwen2.5-Coder-32B-Instruct",
} as const;

export type TogetherModelKey = keyof typeof TOGETHER_MODELS;

export interface TogetherChatArgs {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  apiKey?: string;
}

export async function togetherChat(args: TogetherChatArgs): Promise<string> {
  const key = requireKey(
    args.apiKey ?? process.env.TOGETHER_API_KEY,
    "together",
  );
  const model = resolveModel(args.model);

  const messages: OpenAICompatMessage[] = [
    ...(args.system ? [{ role: "system" as const, content: args.system }] : []),
    { role: "user" as const, content: args.prompt },
  ];

  return togetherBreaker.execute(() =>
    openaiCompatChat({
      provider: "together",
      model,
      apiKey: key,
      baseUrl: "https://api.together.xyz/v1/chat/completions",
      messages,
      maxTokens: args.maxTokens ?? 2000,
      temperature: args.temperature ?? 0.7,
      // Together accepts but sometimes warns about implicit streaming —
      // explicit is safer.
      forceNonStream: true,
      timeoutKey: "AI_CALL",
    }),
  );
}

function resolveModel(input?: string): string {
  if (!input) return TOGETHER_MODELS.llama4_405b;
  if (input in TOGETHER_MODELS)
    return TOGETHER_MODELS[input as TogetherModelKey];
  return input;
}
