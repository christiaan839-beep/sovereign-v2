/**
 * Provider clients — one minimal HTTP client per provider that the router
 * fans out to. Each returns the same shape so the router stays
 * provider-agnostic.
 */

import type { ProviderConfig } from "./types";

export interface ProviderResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

interface ProviderCall {
  prompt: string;
  system?: string;
  maxTokens: number;
  temperature: number;
  model: string;
}

/** Anthropic Claude — Messages API. */
export async function callAnthropic(
  config: ProviderConfig,
  call: ProviderCall,
): Promise<ProviderResponse> {
  const apiKey = config.apiKey;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const baseUrl = config.baseUrl ?? "https://api.anthropic.com";
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: call.model,
      max_tokens: call.maxTokens,
      temperature: call.temperature,
      ...(call.system ? { system: call.system } : {}),
      messages: [{ role: "user", content: call.prompt }],
    }),
    signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };
  return {
    text: data.content?.[0]?.text ?? "",
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

/** OpenAI Chat Completions. */
export async function callOpenAI(
  config: ProviderConfig,
  call: ProviderCall,
): Promise<ProviderResponse> {
  const apiKey = config.apiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const baseUrl = config.baseUrl ?? "https://api.openai.com";
  const messages = [
    ...(call.system ? [{ role: "system", content: call.system }] : []),
    { role: "user", content: call.prompt },
  ];
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: call.model,
      max_tokens: call.maxTokens,
      temperature: call.temperature,
      messages,
    }),
    signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

/** Generic OpenAI-compatible call — used for NIM, Cerebras, Groq,
 *  DeepSeek, Ollama, and any other provider speaking the OpenAI Chat
 *  Completions wire format. */
export async function callOpenAICompatible(
  config: ProviderConfig,
  call: ProviderCall,
  defaultBaseUrl: string,
): Promise<ProviderResponse> {
  const baseUrl = config.baseUrl ?? defaultBaseUrl;
  const messages = [
    ...(call.system ? [{ role: "system", content: call.system }] : []),
    { role: "user", content: call.prompt },
  ];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: call.model,
      max_tokens: call.maxTokens,
      temperature: call.temperature,
      messages,
    }),
    signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${config.name} ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

/** Default base URLs per provider. */
export const PROVIDER_DEFAULTS: Record<
  string,
  { baseUrl: string; defaultModel: string }
> = {
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-4-6",
  },
  openai: {
    baseUrl: "https://api.openai.com",
    defaultModel: "gpt-4o-mini",
  },
  "nvidia-nim": {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  },
  cerebras: {
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "cerebras-llama-3.3-70b",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "groq-llama-3.3-70b",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-ai/deepseek-v3.2",
  },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
  },
  "ollama-local": {
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "ollama-local",
  },
};
