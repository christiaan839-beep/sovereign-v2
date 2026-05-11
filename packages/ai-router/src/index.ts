/**
 * @sovereign/ai-router — main router.
 *
 * createRouter(config) returns a router with .complete(opts) that:
 *   1. Resolves provider order by priority + availability
 *   2. Checks the budget cap (if userId + budget configured)
 *   3. Calls the first available provider
 *   4. Falls through on error to the next provider
 *   5. Records spend if a paid model was used
 *   6. Throws AllProvidersFailedError only if every provider fails
 */

import { calculateCostCents, getModelPrice } from "./model-prices";
import {
  callAnthropic,
  callOpenAI,
  callOpenAICompatible,
  PROVIDER_DEFAULTS,
  type ProviderResponse,
} from "./providers";
import {
  AllProvidersFailedError,
  BudgetExceededError,
  type CompleteOptions,
  type CompleteResult,
  type ProviderConfig,
  type ProviderName,
  type RouterConfig,
  type RoutingPriority,
  type SpendEvent,
} from "./types";

const NO_OP_LOGGER = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** Default routing order per priority level. Free providers first for
 *  speed/cheapest; paid providers first for best. */
const PROVIDER_ORDER_BY_PRIORITY: Record<RoutingPriority, ProviderName[]> = {
  speed: [
    "cerebras",
    "groq",
    "ollama-local",
    "nvidia-nim",
    "google",
    "openai",
    "anthropic",
    "deepseek",
  ],
  cheapest: [
    "ollama-local",
    "cerebras",
    "groq",
    "nvidia-nim",
    "deepseek",
    "google",
    "openai",
    "anthropic",
  ],
  balanced: [
    "cerebras",
    "nvidia-nim",
    "ollama-local",
    "anthropic",
    "openai",
    "google",
    "groq",
    "deepseek",
  ],
  best: [
    "anthropic",
    "openai",
    "google",
    "cerebras",
    "nvidia-nim",
    "ollama-local",
    "groq",
    "deepseek",
  ],
};

/** Sort the configured providers into the priority-respecting fallback
 *  order. Configured providers that aren't in the priority list fall
 *  back to the bottom. */
function orderProviders(
  configs: ProviderConfig[],
  priority: RoutingPriority,
): ProviderConfig[] {
  const order = PROVIDER_ORDER_BY_PRIORITY[priority];
  const ordered: ProviderConfig[] = [];
  for (const name of order) {
    const found = configs.find((c) => c.name === name);
    if (found) ordered.push(found);
  }
  for (const c of configs) {
    if (!ordered.includes(c)) ordered.push(c);
  }
  return ordered;
}

/** Default in-process spend tally — used only when no
 *  budget.readDailySpend is configured. NOT cold-start safe; production
 *  callers MUST override readDailySpend with a DB-backed read. */
const inMemorySpend = new Map<string, { cents: number; day: string }>();

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function recordInMemorySpend(userId: string, costCents: number) {
  const key = `${userId}:${todayKey()}`;
  const existing = inMemorySpend.get(key);
  inMemorySpend.set(key, {
    cents: (existing?.cents ?? 0) + costCents,
    day: todayKey(),
  });
}

function readInMemorySpend(userId: string): number {
  const key = `${userId}:${todayKey()}`;
  return inMemorySpend.get(key)?.cents ?? 0;
}

/** Test-only helper. */
export function _resetInMemorySpend(): void {
  inMemorySpend.clear();
}

/** Dispatch one call to the right provider client. */
async function callProvider(
  config: ProviderConfig,
  prompt: string,
  system: string | undefined,
  maxTokens: number,
  temperature: number,
  model: string,
): Promise<ProviderResponse> {
  const call = { prompt, system, maxTokens, temperature, model };
  switch (config.name) {
    case "anthropic":
      return callAnthropic(config, call);
    case "openai":
      return callOpenAI(config, call);
    case "nvidia-nim":
    case "cerebras":
    case "groq":
    case "deepseek":
    case "ollama-local":
      return callOpenAICompatible(
        config,
        call,
        PROVIDER_DEFAULTS[config.name].baseUrl,
      );
    case "google":
      // Google Gemini has its own protocol; left as a known limitation.
      // Add Google client here when needed; for now Gemini calls bypass
      // the router and use @google/generative-ai directly.
      throw new Error("Google Gemini is not yet supported in this router");
    default:
      throw new Error(`Unknown provider: ${config.name}`);
  }
}

export function createRouter(config: RouterConfig) {
  const logger = config.logger ?? NO_OP_LOGGER;
  const defaultPriority = config.defaultPriority ?? "balanced";

  async function getDailySpend(userId: string): Promise<number> {
    if (!config.budget) return 0;
    if (config.budget.readDailySpend) {
      return await config.budget.readDailySpend(userId);
    }
    return readInMemorySpend(userId);
  }

  async function complete(opts: CompleteOptions): Promise<CompleteResult> {
    const priority = opts.priority ?? defaultPriority;
    const maxTokens = opts.maxTokens ?? 2000;
    const temperature = opts.temperature ?? 0.7;

    // ── Budget gate ──
    if (config.budget && opts.userId) {
      const spent = await getDailySpend(opts.userId);
      if (spent >= config.budget.dailyCapCents) {
        switch (config.budget.onCapReached) {
          case "throw":
            throw new BudgetExceededError(
              opts.userId,
              spent,
              config.budget.dailyCapCents,
            );
          case "silent-skip":
            return {
              text: "",
              modelUsed: "",
              providerUsed: "unknown",
              costCents: 0,
              inputTokens: 0,
              outputTokens: 0,
              fallbacksTried: ["budget-cap"],
            };
          case "fallback-to-free":
            // Re-route to the cheapest path (free providers only).
            opts = { ...opts, priority: "cheapest" };
            break;
        }
      }
    }

    // ── Forced model/provider — bypass routing ──
    if (opts.provider) {
      const cfg = config.providers.find((p) => p.name === opts.provider);
      if (!cfg) {
        throw new Error(
          `Provider ${opts.provider} not configured in this router`,
        );
      }
      const model = opts.model ?? cfg.defaultModel ?? "";
      const result = await callProvider(
        cfg,
        opts.prompt,
        opts.system,
        maxTokens,
        temperature,
        model,
      );
      return finalize(opts, cfg.name, model, result, []);
    }

    // ── Routed path ──
    const providers = orderProviders(config.providers, priority);
    const errors: Record<string, string> = {};
    const fallbacks: string[] = [];

    for (const cfg of providers) {
      const model =
        opts.model ??
        cfg.defaultModel ??
        PROVIDER_DEFAULTS[cfg.name]?.defaultModel ??
        "";
      try {
        const result = await callProvider(
          cfg,
          opts.prompt,
          opts.system,
          maxTokens,
          temperature,
          model,
        );
        return finalize(opts, cfg.name, model, result, fallbacks);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors[cfg.name] = msg;
        fallbacks.push(cfg.name);
        logger.warn(`provider ${cfg.name} failed`, { error: msg });
      }
    }

    throw new AllProvidersFailedError(errors);
  }

  function finalize(
    opts: CompleteOptions,
    providerUsed: ProviderName,
    modelUsed: string,
    raw: ProviderResponse,
    fallbacksTried: string[],
  ): CompleteResult {
    const costCents = calculateCostCents(
      modelUsed,
      raw.inputTokens,
      raw.outputTokens,
    );
    const result: CompleteResult = {
      text: raw.text,
      modelUsed,
      providerUsed,
      costCents,
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
      fallbacksTried,
    };

    // Spend hook (sync or async fire-and-forget).
    if (config.budget && opts.userId && costCents > 0) {
      const event: SpendEvent = {
        userId: opts.userId,
        modelId: modelUsed,
        provider: providerUsed,
        inputTokens: raw.inputTokens,
        outputTokens: raw.outputTokens,
        costCents,
        occurredAt: new Date(),
      };
      if (config.budget.onSpend) {
        Promise.resolve(config.budget.onSpend(event)).catch((err: unknown) =>
          logger.warn("onSpend hook failed", { error: String(err) }),
        );
      }
      // Always update the in-memory tally (used as default when no
      // readDailySpend is configured).
      if (!config.budget.readDailySpend) {
        recordInMemorySpend(opts.userId, costCents);
      }
    }

    return result;
  }

  return {
    complete,
    getDailySpend,
    /** Returns the price catalog for a model. Useful for UI cost previews. */
    getModelPrice,
  };
}

// Re-exports for ergonomics.
export { calculateCostCents, getModelPrice } from "./model-prices";
export type {
  BudgetConfig,
  CompleteOptions,
  CompleteResult,
  ProviderConfig,
  ProviderName,
  RouterConfig,
  RoutingPriority,
  SpendEvent,
} from "./types";
export { AllProvidersFailedError, BudgetExceededError } from "./types";
