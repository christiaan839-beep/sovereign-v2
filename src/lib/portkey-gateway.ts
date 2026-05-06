/**
 * Portkey gateway — paid-provider fallback router.
 *
 * https://portkey.ai (open-source AI gateway, MIT-licensed; the
 * hosted free tier covers our throughput for the first ~year)
 *
 * What it does for us
 * ───────────────────
 * Today `src/lib/ai.ts` cascades NIM → Cerebras → Anthropic →
 * Gemini → Groq directly, each provider hit via its own client.
 * That works but every provider's quirks (rate-limit headers,
 * retry semantics, streaming formats) leak into the call sites.
 *
 * Portkey is the "Stripe of AI gateways": one API, dozens of
 * providers, automatic retries, fallbacks, load-balancing across
 * keys, request caching, and full prompt logging — all without
 * us writing the glue. The free hosted tier covers ~1M requests/
 * month; or you can self-host the open-source gateway in Docker
 * (`portkey-ai/gateway` image) for $0.
 *
 * When this module is used
 * ────────────────────────
 * Only when `PORTKEY_API_KEY` is set in env. The `ai()` router in
 * `src/lib/ai.ts` checks `isPortkeyConfigured()` and, when true,
 * delegates the cascade to Portkey instead of hand-cascading.
 * Without the env var, the existing direct-provider cascade
 * continues working unchanged — zero behaviour change at runtime.
 *
 * Why this is OPTIONAL not the default
 * ────────────────────────────────────
 * 1. NIM is free and our default. Portkey adds cost only if we
 *    cascade to a paid provider — but that's already true today.
 * 2. The hosted free tier is rate-limited; once we have 50+
 *    customers we'll either upgrade or self-host. Not yet
 *    worth wiring.
 * 3. Provider-specific features (Anthropic Extended Thinking,
 *    Gemini grounded search) can be passed through Portkey but
 *    the routing config gets non-trivial. Direct calls are
 *    simpler until we feel the pain.
 *
 * Failure modes
 * ─────────────
 *   - `PORTKEY_API_KEY` unset → `routeViaPortkey()` returns
 *     `{ ok: false, reason: "..." }`. Caller falls back to
 *     direct providers in `ai.ts`.
 *   - Portkey gateway 5xx / timeout → same, `{ ok: false }` with
 *     the upstream error preserved. Caller's existing fallback
 *     cascade fires.
 *
 * The function returns the same string contract as `ai()` — just
 * the completion text — so swapping in/out is trivial.
 */

import { fetchWithTimeout } from "@/lib/with-timeout";
import { captureException } from "@/lib/sentry";
import { recordModel } from "@/lib/model-attribution";
import { createLogger } from "@/lib/logger";
import type { AIModel } from "@/types";

const log = createLogger("portkey");

/** Map our internal `AIModel` slugs to Portkey provider + model id. */
const PORTKEY_PROVIDER_MAP: Record<
  AIModel,
  { provider: string; defaultModel: string }
> = {
  claude: {
    provider: "anthropic",
    defaultModel: "claude-sonnet-4-6",
  },
  gemini: {
    provider: "google",
    defaultModel: "gemini-2.0-flash",
  },
  nim: {
    provider: "nvidia",
    defaultModel: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  },
  ollama: {
    provider: "ollama",
    defaultModel: "llama3.1:70b",
  },
  groq: {
    provider: "groq",
    defaultModel: "llama-3.3-70b-versatile",
  },
  deepseek: {
    provider: "deepseek",
    defaultModel: "deepseek-chat",
  },
  mistral: {
    provider: "mistralai",
    defaultModel: "mistral-large-latest",
  },
  qwen: {
    provider: "groq",
    defaultModel: "qwen-2.5-72b",
  },
  cerebras: {
    provider: "cerebras",
    defaultModel: "llama-3.3-70b",
  },
};

export interface PortkeyRouteArgs {
  prompt: string;
  system?: string;
  /** Internal model slug; mapped to a Portkey provider + model. */
  model: AIModel;
  /** Override the default model id for the chosen provider. */
  modelOverride?: string;
  maxTokens?: number;
  /** Per-call timeout in ms. Default 60s. */
  timeoutMs?: number;
}

export type PortkeyResult =
  | { ok: true; text: string; provider: string; model: string }
  | { ok: false; reason: string };

const DEFAULT_TIMEOUT_MS = 60_000;
const PORTKEY_BASE_URL =
  process.env.PORTKEY_BASE_URL?.trim() || "https://api.portkey.ai/v1";

export function isPortkeyConfigured(): boolean {
  return Boolean(process.env.PORTKEY_API_KEY?.trim());
}

/**
 * Route one chat-completion through Portkey. Returns the completion
 * text on success, or `{ ok: false }` on any failure — caller is
 * expected to fall back to the direct-provider cascade.
 */
export async function routeViaPortkey(
  args: PortkeyRouteArgs,
): Promise<PortkeyResult> {
  const apiKey = process.env.PORTKEY_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "PORTKEY_API_KEY not configured" };
  }

  const mapping = PORTKEY_PROVIDER_MAP[args.model];
  if (!mapping) {
    return {
      ok: false,
      reason: `Portkey has no mapping for AIModel "${args.model}"`,
    };
  }

  const modelId = args.modelOverride ?? mapping.defaultModel;
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Each provider needs its own auth key; Portkey reads them from
  // env vars at the gateway. We just pass the provider name and
  // the gateway handles credentials + retries + fallback chains
  // configured in the Portkey dashboard / virtual key.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-portkey-api-key": apiKey,
    "x-portkey-provider": mapping.provider,
  };

  // If you've configured a Portkey "Virtual Key" (recommended) — a
  // saved provider+credentials+retry config — pass its alias here
  // and Portkey ignores `x-portkey-provider`. We support both.
  const virtualKey = process.env.PORTKEY_VIRTUAL_KEY?.trim();
  if (virtualKey) headers["x-portkey-virtual-key"] = virtualKey;

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (args.system) messages.push({ role: "system", content: args.system });
  messages.push({ role: "user", content: args.prompt });

  try {
    const res = await fetchWithTimeout(
      `${PORTKEY_BASE_URL.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: modelId,
          messages,
          max_tokens: args.maxTokens ?? 2_000,
        }),
        timeoutMs,
        label: "portkey-chat",
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const reason = `Portkey HTTP ${res.status}: ${body.slice(0, 200) || "no body"}`;
      log.warn(reason, { provider: mapping.provider, model: modelId });
      return { ok: false, reason };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";

    if (!text) {
      return { ok: false, reason: "Portkey returned empty completion" };
    }

    recordModel(`portkey:${mapping.provider}:${modelId}`);
    return { ok: true, text, provider: mapping.provider, model: modelId };
  } catch (err) {
    captureException(err, {
      module: "portkey-gateway",
      action: "chat-completion",
      severity: "warning",
      extra: { provider: mapping.provider, model: modelId },
    });
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
