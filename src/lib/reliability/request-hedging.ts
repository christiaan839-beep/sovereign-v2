/**
 * REQUEST HEDGING — speed primitive (R51).
 *
 * The "Tail at Scale" pattern (Dean & Barroso, CACM 2013): when
 * latency matters more than provider cost, fire the request to N
 * providers in parallel and use the first valid response. Cancel
 * the others.
 *
 * Why this matters at $100B-shape scale:
 *   - LLM inference latency has a long-tail distribution. P99 is
 *     5-20× P50. Hedging two providers eliminates the tail almost
 *     entirely.
 *   - At 100K+ requests/day, a P99 cut from 5s → 800ms is the
 *     difference between "feels broken" and "feels fast."
 *   - Composes with R48 circuit breakers (degraded provider →
 *     skipped) and R30 cost-runaway (cap protects against runaway
 *     parallel cost).
 *
 * Pure-function evaluator (`hedgeStrategyDecision`) — same inputs →
 * same launch decision, every time. The runner is async but the
 * scheduling is deterministic.
 *
 * SCHEDULING:
 *
 *   t=0      : launch provider 1 (the primary)
 *   t=staggerMs: if no response yet, launch provider 2 (the hedge)
 *   t=2*staggerMs: launch provider 3 (if configured)
 *   ...
 *
 * The first SUCCESSFUL response wins. All other in-flight requests
 * are aborted via AbortController to prevent wasted compute.
 *
 * USAGE:
 *
 *   const result = await hedgedRequest(async (signal) => {
 *     return [
 *       () => callAnthropic(prompt, { signal }),
 *       () => callOpenAI(prompt, { signal }),
 *     ];
 *   }, { staggerMs: 200, totalTimeoutMs: 5000 });
 *
 * Default config (calibrated to LLM workloads):
 *   - staggerMs: 200 (wait 200ms before launching the hedge)
 *   - maxParallel: 3
 *   - totalTimeoutMs: 30_000 (30s overall budget)
 *
 * Cost discipline: ONLY hedge when the speed gain is worth it.
 * The default policy declines hedging for very-fast primaries
 * (under 50ms typical) — see `shouldHedge` rule.
 */

export interface HedgeConfig {
  /** Time before launching the next provider (ms). */
  staggerMs: number;
  /** Maximum providers in flight at once. */
  maxParallel: number;
  /** Overall budget — fail if no provider responds by then. */
  totalTimeoutMs: number;
}

export const DEFAULT_HEDGE_CONFIG: HedgeConfig = {
  staggerMs: 200,
  maxParallel: 3,
  totalTimeoutMs: 30_000,
};

/**
 * Pure: should we hedge this request given the configured providers
 * and the historical primary latency?
 *
 * The decision is deliberately CONSERVATIVE. Hedging consumes 2-3×
 * the per-request inference cost; we only do it when:
 *   1. There are >= 2 healthy providers configured.
 *   2. The historical P50 latency on the primary is high enough
 *      that hedging actually saves wall-time.
 *
 * Inputs:
 *   - provided count (how many functions are passed)
 *   - estimated P50 of the primary (caller passes from telemetry)
 *   - hedgingPolicy ("always" | "smart" | "never")
 */
export type HedgingPolicy = "always" | "smart" | "never";

export function shouldHedge(input: {
  providerCount: number;
  primaryP50LatencyMs: number;
  policy: HedgingPolicy;
}): { hedge: boolean; reason: string } {
  if (input.policy === "never") {
    return { hedge: false, reason: "policy_never" };
  }
  if (input.providerCount < 2) {
    return { hedge: false, reason: "single_provider" };
  }
  if (input.policy === "always") {
    return { hedge: true, reason: "policy_always" };
  }
  // "smart" policy: only hedge if the primary is slow enough.
  // 50ms threshold matches typical CDN-fast endpoints — anything
  // faster doesn't benefit from a hedge.
  if (input.primaryP50LatencyMs <= 50) {
    return { hedge: false, reason: "primary_already_fast" };
  }
  return { hedge: true, reason: "smart_hedging" };
}

/**
 * Result of a hedged call.
 */
export interface HedgeResult<T> {
  /** The successful response. */
  result: T;
  /** Index of the provider that won (0 = primary). */
  winnerIndex: number;
  /** Total wall-clock time (ms). */
  elapsedMs: number;
  /** How many providers were launched in parallel. */
  launchCount: number;
  /** Reasons each non-winning provider was discarded. */
  discardReasons: string[];
}

/**
 * Errors specific to hedged execution.
 */
export class HedgeTimeoutError extends Error {
  readonly code = "HEDGE_TIMEOUT" as const;
  constructor(public readonly elapsedMs: number) {
    super(`hedged request timed out after ${elapsedMs}ms`);
    this.name = "HedgeTimeoutError";
  }
}

export class HedgeAllFailedError extends Error {
  readonly code = "HEDGE_ALL_FAILED" as const;
  constructor(public readonly causes: unknown[]) {
    super(`all ${causes.length} hedged providers failed`);
    this.name = "HedgeAllFailedError";
  }
}

/**
 * The runner. Takes an array of `() => Promise<T>` provider
 * functions. Each function MUST accept an AbortSignal so cancellation
 * propagates. Returns the first successful response.
 *
 * Strategy:
 *   1. Launch provider 0 immediately.
 *   2. Wait `staggerMs`. If no response, launch provider 1.
 *   3. Continue until maxParallel reached.
 *   4. First success wins; cancel others.
 *   5. If all fail, throw HedgeAllFailedError.
 *   6. If totalTimeoutMs elapses, throw HedgeTimeoutError.
 */
export async function hedgedRequest<T>(
  buildProviders: (signal: AbortSignal) => Array<() => Promise<T>>,
  config: Partial<HedgeConfig> = {},
): Promise<HedgeResult<T>> {
  const finalConfig: HedgeConfig = { ...DEFAULT_HEDGE_CONFIG, ...config };
  const start = Date.now();
  const overallController = new AbortController();
  const providers = buildProviders(overallController.signal);

  if (providers.length === 0) {
    overallController.abort();
    throw new HedgeAllFailedError([]);
  }

  const causes: unknown[] = [];
  let nextProviderIdx = 0;
  const launchCount = Math.min(providers.length, finalConfig.maxParallel);

  // Single shared Deferred. The first launch to fulfill calls
  // resolve(); when ALL launches have failed (or no more pending),
  // we reject with HedgeAllFailedError.
  let winnerResolve!: (v: { idx: number; value: T }) => void;
  let winnerReject!: (e: unknown) => void;
  const winnerPromise = new Promise<{ idx: number; value: T }>(
    (resolve, reject) => {
      winnerResolve = resolve;
      winnerReject = reject;
    },
  );

  let resolved = false;
  let failureCount = 0;

  function maybeFailAll(): void {
    if (resolved) return;
    if (failureCount >= launchCount) {
      resolved = true;
      winnerReject(new HedgeAllFailedError(causes));
    }
  }

  function launchOne(): void {
    if (resolved) return;
    const idx = nextProviderIdx++;
    if (idx >= launchCount) return;
    providers[idx]()
      .then((value) => {
        if (resolved) return;
        resolved = true;
        winnerResolve({ idx, value });
      })
      .catch((err) => {
        causes[idx] = err;
        failureCount++;
        maybeFailAll();
      });
  }
  // Launch the primary immediately.
  launchOne();

  // Schedule the staggered hedges.
  const staggerTimers: NodeJS.Timeout[] = [];
  for (let i = 1; i < launchCount; i++) {
    const delayMs = i * finalConfig.staggerMs;
    staggerTimers.push(setTimeout(launchOne, delayMs));
  }

  // Overall timeout.
  let timeoutTimer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      reject(new HedgeTimeoutError(Date.now() - start));
    }, finalConfig.totalTimeoutMs);
  });

  function cleanup(): void {
    overallController.abort();
    staggerTimers.forEach((t) => clearTimeout(t));
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }

  try {
    const winner = await Promise.race([winnerPromise, timeoutPromise]);
    cleanup();
    return {
      result: winner.value,
      winnerIndex: winner.idx,
      elapsedMs: Date.now() - start,
      launchCount: nextProviderIdx,
      discardReasons: causes
        .map((c, i) =>
          i === winner.idx
            ? null
            : c
              ? `failed: ${String(c)}`
              : "aborted",
        )
        .filter((r): r is string => r !== null),
    };
  } catch (err) {
    cleanup();
    throw err;
  }
}
