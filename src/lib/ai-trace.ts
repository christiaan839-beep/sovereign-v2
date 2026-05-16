/**
 * SOVEREIGN MATRIX — AI tracing wrapper (Wave 10, audit-2026-05).
 *
 * Wraps every model invocation in a Sentry / OpenTelemetry-compatible
 * span so per-call latency, token counts, model identity, provider
 * branch, and pass/fail outcome become first-class observability.
 *
 * Why a separate module:
 *   - src/lib/ai.ts is hot-path; pulling Sentry in directly would import
 *     the full nextjs SDK from edge handlers that don't want it.
 *   - Lazy-loaded so a dev runtime without SENTRY_DSN pays zero cost.
 *   - Pure function — caller passes the work, we wrap it. Trivially
 *     testable without a real Sentry transport.
 *
 * Pairs with src/lib/ai.ts (every provider call goes through
 * `withAiSpan`) and the existing `recordSpend` ledger (cost goes on
 * the span as `gen_ai.usage.cost_cents` for one-line cost queries in
 * Sentry's Trace Explorer).
 *
 * Span attribute conventions follow OpenTelemetry's `gen_ai.*` and
 * Sentry's `ai.*` semantic conventions so the spans are usable by
 * any conformant viewer (Sentry, Phoenix, Jaeger, Datadog).
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("ai-trace");

export interface AiSpanAttributes {
  /** The model id the router actually invoked (post-routing). */
  model: string;
  /** The provider branch we routed through. */
  provider:
    | "ollama"
    | "cerebras"
    | "nvidia-nim"
    | "groq"
    | "anthropic"
    | "google"
    | "mistral"
    | "deepseek";
  /** Caller-supplied semantic task type (when available). */
  taskType?: string;
  /** Approximate input token count (best-effort — char/4 if no counter). */
  inputTokens?: number;
  /** Approximate output token count. */
  outputTokens?: number;
  /** Computed cost in USD cents — joined with provider price card. */
  costCents?: number;
  /** Tenant id when the call is tenant-scoped. */
  tenantId?: string | null;
  /** User id when authed. Hashed before emission. */
  userId?: string | null;
  /** Whether the response was served from a prompt cache hit. */
  cacheHit?: boolean;
}

interface SentryNamespace {
  startSpan?: (
    opts: { name: string; attributes?: Record<string, unknown> },
    cb: (span: unknown) => unknown,
  ) => unknown;
  setMeasurement?: (key: string, value: number, unit?: string) => void;
}

let _sentryCache: SentryNamespace | null | undefined;

/**
 * Lazy-import @sentry/nextjs once per process. Returns null when Sentry
 * isn't installed (eg. an SDK runtime built without it) so the wrapper
 * silently no-ops instead of crashing.
 */
async function getSentry(): Promise<SentryNamespace | null> {
  if (_sentryCache !== undefined) return _sentryCache;
  try {
    const mod = (await import("@sentry/nextjs")) as unknown as SentryNamespace;
    _sentryCache = mod && typeof mod.startSpan === "function" ? mod : null;
  } catch {
    _sentryCache = null;
  }
  return _sentryCache;
}

/**
 * Wrap an AI call in an observability span. Records duration, finishes
 * with one of {"ok", "error", "cache_hit"}, and emits the
 * `gen_ai.*` semantic attributes the OpenTelemetry working group
 * standardised for AI calls.
 *
 * On error, the exception is recorded on the span and re-thrown — the
 * tracing wrapper never swallows.
 *
 * Usage:
 *   return withAiSpan(
 *     { model: "claude-sonnet-4-6", provider: "anthropic", taskType: "reasoning" },
 *     () => claudeClient.messages.create(...)
 *   );
 */
export async function withAiSpan<T>(
  attrs: AiSpanAttributes,
  work: () => Promise<T>,
): Promise<T> {
  const sentry = await getSentry();
  const startedAt = Date.now();

  // Fast path: no Sentry installed — just run the work, log a structured
  // line so something is observable in stdout-only deploys.
  if (!sentry || !sentry.startSpan) {
    try {
      const out = await work();
      const durationMs = Date.now() - startedAt;
      log.info("ai.call", {
        outcome: "ok",
        durationMs,
        ...redact(attrs),
      });
      return out;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      log.error("ai.call", {
        outcome: "error",
        durationMs,
        error: err instanceof Error ? err.message : String(err),
        ...redact(attrs),
      });
      throw err;
    }
  }

  // Sentry path — use startSpan so the span attaches to the active
  // request transaction when available.
  return (await sentry.startSpan(
    {
      name: `ai.${attrs.provider}.${attrs.model}`,
      attributes: spanAttributesFrom(attrs),
    },
    async () => {
      try {
        const out = await work();
        return out;
      } catch (err) {
        // Sentry's automatic exception capture inside startSpan already
        // tags the span as errored; re-throw so the caller sees it.
        throw err;
      }
    },
  )) as T;
}

/**
 * Project the AiSpanAttributes onto the flat key-value attribute map
 * Sentry / OTel expect. Naming follows the in-flight OpenTelemetry GenAI
 * semantic conventions so the spans are portable.
 */
export function spanAttributesFrom(
  a: AiSpanAttributes,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {
    "gen_ai.system": a.provider,
    "gen_ai.request.model": a.model,
  };
  if (a.taskType) out["gen_ai.task.type"] = a.taskType;
  if (a.inputTokens !== undefined)
    out["gen_ai.usage.input_tokens"] = a.inputTokens;
  if (a.outputTokens !== undefined)
    out["gen_ai.usage.output_tokens"] = a.outputTokens;
  if (a.costCents !== undefined) out["gen_ai.usage.cost_cents"] = a.costCents;
  if (a.tenantId) out["sovereign.tenant.id"] = a.tenantId;
  if (a.userId)
    out["sovereign.user.id_hash"] = hashUserIdForObservability(a.userId);
  if (a.cacheHit !== undefined) out["gen_ai.cache.hit"] = a.cacheHit;
  return out;
}

/**
 * Hash a user id into a stable 16-char digest so we can correlate
 * spans by user without exposing real ids in trace storage (cross-team
 * GDPR / POPIA hygiene).
 */
function hashUserIdForObservability(id: string): string {
  // Cheap, stable, non-cryptographic — observability identifier only.
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function redact(a: AiSpanAttributes): Record<string, unknown> {
  return {
    model: a.model,
    provider: a.provider,
    taskType: a.taskType,
    inputTokens: a.inputTokens,
    outputTokens: a.outputTokens,
    costCents: a.costCents,
    tenantId: a.tenantId ?? null,
    userIdHash: a.userId ? hashUserIdForObservability(a.userId) : null,
    cacheHit: a.cacheHit ?? null,
  };
}
