/**
 * @sovereign/ai-router — types
 */

import type { ModelPrice } from "./model-prices";

export type ProviderName =
  | "anthropic"
  | "openai"
  | "google"
  | "cerebras"
  | "nvidia-nim"
  | "groq"
  | "deepseek"
  | "ollama-local";

export interface ProviderConfig {
  name: ProviderName;
  /** API key. Set via env var in production; the router never logs this. */
  apiKey?: string;
  /** Override the default base URL (eg for proxies / vendor mirrors). */
  baseUrl?: string;
  /** Default model when the caller doesn't specify one. */
  defaultModel?: string;
  /** Per-provider request timeout in milliseconds. Default 30s. */
  timeoutMs?: number;
}

export type RoutingPriority = "speed" | "balanced" | "best" | "cheapest";

export interface BudgetConfig {
  /** Hard daily cap in USD cents. Once a userId hits this in a calendar
   *  day, the router rejects further calls (or falls back to free
   *  providers, depending on `onCapReached`). */
  dailyCapCents: number;
  /** What to do when the cap is hit. */
  onCapReached: "throw" | "fallback-to-free" | "silent-skip";
  /** Optional callback for spend metering. Called after every paid call. */
  onSpend?: (event: SpendEvent) => void | Promise<void>;
  /** Optional callback for reads. Called when the router needs to know
   *  the current daily spend for a userId. Return `undefined` to use the
   *  in-memory tally. Override this in production to query Postgres. */
  readDailySpend?: (userId: string) => Promise<number> | number;
}

export interface SpendEvent {
  userId: string;
  modelId: string;
  provider: ProviderName | "unknown";
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  occurredAt: Date;
}

export interface RouterConfig {
  /** Providers in priority order. The router routes by priority + cost +
   *  availability, falling through on errors. */
  providers: ProviderConfig[];
  /** Optional budget enforcement. Skip to disable. */
  budget?: BudgetConfig;
  /** Routing strategy. Default "balanced". */
  defaultPriority?: RoutingPriority;
  /** Optional logger override. Defaults to no-op. */
  logger?: {
    info: (msg: string, data?: Record<string, unknown>) => void;
    warn: (msg: string, data?: Record<string, unknown>) => void;
    error: (msg: string, data?: Record<string, unknown>) => void;
  };
}

export interface CompleteOptions {
  prompt: string;
  /** System / instruction message. */
  system?: string;
  /** Max output tokens. Default 2000. */
  maxTokens?: number;
  /** Temperature 0–1. Default 0.7. */
  temperature?: number;
  /** Force a specific model. Bypasses routing. */
  model?: string;
  /** Force a specific provider. Bypasses routing. */
  provider?: ProviderName;
  /** Routing priority for this call. Overrides router default. */
  priority?: RoutingPriority;
  /** User identifier for budget tracking. Required if budget is configured. */
  userId?: string;
}

export interface CompleteResult {
  /** Generated text. */
  text: string;
  /** Model that was actually used (post-routing). */
  modelUsed: string;
  /** Provider bucket. */
  providerUsed: ProviderName | "unknown";
  /** Computed cost in USD cents (0 for free models). */
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  /** Any providers that were tried and failed before this one succeeded. */
  fallbacksTried: string[];
}

export class BudgetExceededError extends Error {
  constructor(
    public userId: string,
    public dailyCents: number,
    public capCents: number,
  ) {
    super(
      `Daily budget exceeded for user ${userId}: ${dailyCents}c spent / ${capCents}c cap`,
    );
    this.name = "BudgetExceededError";
  }
}

export class AllProvidersFailedError extends Error {
  constructor(public providerErrors: Record<string, string>) {
    super(
      `All AI providers failed: ${Object.entries(providerErrors)
        .map(([p, e]) => `${p}=${e}`)
        .join(", ")}`,
    );
    this.name = "AllProvidersFailedError";
  }
}

export type { ModelPrice };
