/**
 * Databricks Foundation Model Serving adapter.
 *
 * Databricks hosts DBRX + Llama 4 variants on their workspace-scoped
 * endpoints. The URL is workspace-specific:
 *   https://<workspace-host>/serving-endpoints/<model>/invocations
 *
 * They accept the OpenAI chat-completion body shape at `.../chat/completions`
 * on newer endpoints. We expose the common models; customers can configure
 * their own endpoint via DATABRICKS_HOST env var.
 *
 * Docs: https://docs.databricks.com/en/machine-learning/foundation-model-apis/query-foundation-model-apis.html
 */

import {
  openaiCompatChat,
  requireKey,
  ProviderError,
  type OpenAICompatMessage,
} from "./provider-utils";
import { databricksBreaker } from "@/lib/circuit-breaker";

export const DATABRICKS_MODELS = {
  dbrx: "databricks-dbrx-instruct",
  llama33_70b: "databricks-meta-llama-3-3-70b-instruct",
  mixtral: "databricks-mixtral-8x7b-instruct",
  llama4_maverick: "databricks-meta-llama-4-maverick",
} as const;

export type DatabricksModelKey = keyof typeof DATABRICKS_MODELS;

export interface DatabricksChatArgs {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  apiKey?: string;
  /** Override the workspace host. Defaults to DATABRICKS_HOST env var. */
  host?: string;
}

export async function databricksChat(
  args: DatabricksChatArgs,
): Promise<string> {
  const key = requireKey(
    args.apiKey ?? process.env.DATABRICKS_TOKEN,
    "databricks",
  );
  const host = args.host ?? process.env.DATABRICKS_HOST;
  if (!host) {
    throw new ProviderError(
      "provider_not_configured",
      "databricks",
      "DATABRICKS_HOST env var required (e.g. https://<workspace-id>.cloud.databricks.com)",
    );
  }
  const model = resolveModel(args.model);

  const messages: OpenAICompatMessage[] = [
    ...(args.system ? [{ role: "system" as const, content: args.system }] : []),
    { role: "user" as const, content: args.prompt },
  ];

  const cleanHost = host.replace(/\/$/, "");

  return databricksBreaker.execute(() =>
    openaiCompatChat({
      provider: "databricks",
      model,
      apiKey: key,
      baseUrl: `${cleanHost}/serving-endpoints/${model}/invocations`,
      messages,
      maxTokens: args.maxTokens ?? 2000,
      temperature: args.temperature ?? 0.7,
      timeoutKey: "AI_CALL",
    }),
  );
}

function resolveModel(input?: string): string {
  if (!input) return DATABRICKS_MODELS.dbrx;
  if (input in DATABRICKS_MODELS)
    return DATABRICKS_MODELS[input as DatabricksModelKey];
  return input;
}
