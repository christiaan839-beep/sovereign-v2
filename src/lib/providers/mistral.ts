/**
 * Mistral La Plateforme direct adapter.
 *
 * Distinct from `mistralText()` in src/lib/ai.ts, which currently routes
 * Mistral Large 2 THROUGH NVIDIA NIM. This adapter talks directly to
 * Mistral's own API (`api.mistral.ai`) so we get:
 *   - EU-hosted inference for sovereignty-sensitive customers
 *   - Newer model slugs (Codestral, Mistral Small 3, Mistral Nemo)
 *   - First-party rate limits + support
 *
 * Docs: https://docs.mistral.ai/api
 */

import {
  openaiCompatChat,
  requireKey,
  type OpenAICompatMessage,
} from "./provider-utils";
import { mistralDirectBreaker } from "@/lib/circuit-breaker";

export const MISTRAL_MODELS = {
  largeLatest: "mistral-large-latest",
  codestral: "codestral-latest",
  nemo: "open-mistral-nemo",
  small3: "mistral-small-latest",
  pixtral: "pixtral-large-latest",
} as const;

export type MistralModelKey = keyof typeof MISTRAL_MODELS;

export interface MistralChatArgs {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  apiKey?: string;
}

export async function mistralDirectChat(args: MistralChatArgs): Promise<string> {
  const key = requireKey(
    args.apiKey ?? process.env.MISTRAL_API_KEY,
    "mistral",
  );
  const model = resolveModel(args.model);

  const messages: OpenAICompatMessage[] = [
    ...(args.system ? [{ role: "system" as const, content: args.system }] : []),
    { role: "user" as const, content: args.prompt },
  ];

  return mistralDirectBreaker.execute(() =>
    openaiCompatChat({
      provider: "mistral",
      model,
      apiKey: key,
      baseUrl: "https://api.mistral.ai/v1/chat/completions",
      messages,
      maxTokens: args.maxTokens ?? 2000,
      temperature: args.temperature ?? 0.7,
      timeoutKey: "AI_CALL",
    }),
  );
}

function resolveModel(input?: string): string {
  if (!input) return MISTRAL_MODELS.largeLatest;
  if (input in MISTRAL_MODELS) return MISTRAL_MODELS[input as MistralModelKey];
  return input;
}
