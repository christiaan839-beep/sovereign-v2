/**
 * Cohere adapter.
 *
 * Cohere's chat API differs from OpenAI's — it uses `message` + `chat_history`
 * (not `messages`) and `text` (not `choices[].message.content`). We write a
 * purpose-built fetch here rather than shoehorn the OpenAI-compat helper.
 *
 * Why we want Cohere: Command R+ is the best-in-class RAG-tuned model.
 * Essential for our enterprise-vertical agents (healthcare coding with
 * ICD-10 lookups, legal with case-law grounding, insurance with COI
 * cross-reference).
 *
 * Docs: https://docs.cohere.com/reference/chat
 */

import { ProviderError, requireKey } from "./provider-utils";
import { cohereBreaker } from "@/lib/circuit-breaker";
import { withTimeout, TIMEOUTS } from "@/lib/with-timeout";

export const COHERE_MODELS = {
  commandRPlus: "command-r-plus-08-2024",
  commandR: "command-r-08-2024",
  commandR7b: "command-r7b-12-2024",
} as const;

export type CohereModelKey = keyof typeof COHERE_MODELS;

export interface CohereChatArgs {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  apiKey?: string;
}

export async function cohereChat(args: CohereChatArgs): Promise<string> {
  const key = requireKey(args.apiKey ?? process.env.COHERE_API_KEY, "cohere");
  const model = resolveModel(args.model);

  const body: Record<string, unknown> = {
    model,
    message: args.prompt,
    max_tokens: args.maxTokens ?? 2000,
    temperature: args.temperature ?? 0.7,
  };
  if (args.system) {
    body.preamble = args.system;
  }

  return cohereBreaker.execute(async () => {
    let res: Response;
    try {
      res = await withTimeout(
        TIMEOUTS.AI_CALL,
        (signal) =>
          fetch("https://api.cohere.com/v1/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
              Accept: "application/json",
            },
            body: JSON.stringify(body),
            signal,
          }),
        "cohere-chat",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("timeout")) {
        throw new ProviderError("provider_timeout", "cohere", message);
      }
      throw new ProviderError("provider_unavailable", "cohere", message);
    }

    if (res.status === 401 || res.status === 403) {
      throw new ProviderError(
        "provider_auth_failed",
        "cohere",
        `Cohere rejected the API key (HTTP ${res.status})`,
        res.status,
      );
    }
    if (res.status === 429) {
      throw new ProviderError(
        "provider_rate_limited",
        "cohere",
        "Cohere rate limit exceeded",
        res.status,
      );
    }
    if (!res.ok) {
      const text = await safeText(res);
      throw new ProviderError(
        "provider_unavailable",
        "cohere",
        `Cohere returned HTTP ${res.status}: ${text.slice(0, 200)}`,
        res.status,
      );
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new ProviderError(
        "provider_bad_response",
        "cohere",
        "Cohere returned non-JSON body",
      );
    }

    // Cohere response shape: { text: "...", generation_id: "...", finish_reason: "..." }
    const text =
      json && typeof json === "object" && "text" in json
        ? (json as { text?: unknown }).text
        : undefined;
    if (typeof text !== "string" || text.length === 0) {
      throw new ProviderError(
        "provider_bad_response",
        "cohere",
        "Cohere response has no text",
      );
    }
    return text;
  });
}

function resolveModel(input?: string): string {
  if (!input) return COHERE_MODELS.commandRPlus;
  if (input in COHERE_MODELS) return COHERE_MODELS[input as CohereModelKey];
  return input;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
