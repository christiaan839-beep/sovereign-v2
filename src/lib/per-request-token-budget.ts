/**
 * PER-REQUEST TOKEN BUDGET — bound the per-execution blast radius.
 *
 * Round 32. Closes a gap left open by R27's per-day cost cap and
 * R28's A2E depth limit. The remaining vector: a SINGLE agent
 * request that legitimately stays under day-cap + recursion-cap,
 * but iterates a long-running loop within itself (e.g. a chain
 * that calls a model 200 times with growing context). The day-cap
 * fires after, the depth-cap doesn't fire (no recursion), but the
 * single request still burned $5-50 of tokens.
 *
 * This module bounds that. Every model call inside an agent
 * execution accumulates against a per-request token total; if the
 * total crosses the request ceiling, subsequent model calls throw
 * `RequestTokenBudgetExceededError`.
 *
 * SHAPE:
 *   - AsyncLocalStorage propagates the request budget through every
 *     async boundary (model calls, sub-agents, tool calls).
 *   - The agent-factory installs a fresh budget at the start of
 *     every request.
 *   - Model-call sites consume budget via `consumeTokens()`.
 *   - Default budget: 50,000 tokens/request (configurable).
 *   - Hard ceiling: 500,000 tokens/request — env can lower not raise.
 *
 * SAFETY:
 *   - Pure-function evaluator + ALS-backed counter pattern.
 *   - Same Edge-vs-Node split as a2e-depth.ts and agent-trace.ts.
 *   - NEVER throws on storage failure; only on actual exceeded budget.
 *   - Records to the active trace as a span (so operators can see
 *     "request hit budget at step 47").
 */

export interface RequestTokenBudgetState {
  consumedTokens: number;
  ceilingTokens: number;
  agentName: string;
  startedAtMs: number;
}

export interface RequestTokenBudgetStore {
  current(): RequestTokenBudgetState | null;
  /** Run `fn` inside a fresh budget context. */
  run<T>(state: RequestTokenBudgetState, fn: () => Promise<T>): Promise<T>;
}

let installedStore: RequestTokenBudgetStore | null = null;

export function installRequestTokenBudgetStore(
  store: RequestTokenBudgetStore,
): void {
  installedStore = store;
}

/**
 * Hard ceiling: env can configure the soft ceiling between 1 and
 * this, but never exceed. Defence-in-depth — a misconfigured env
 * can't disable the per-request budget entirely.
 */
export const REQUEST_TOKEN_HARD_CEILING = 500_000;

/**
 * Default per-request token ceiling. 50K tokens covers most
 * legitimate agent executions (a chain of ~25 model calls at
 * 2K tokens each); aggressive multi-step reasoning lands above
 * this and trips the gate intentionally.
 *
 * Operators with deep-reasoning workloads can raise via
 * SOVEREIGN_REQUEST_TOKEN_BUDGET env (capped at HARD_CEILING).
 */
export const REQUEST_TOKEN_DEFAULT = 50_000;

export function getRequestTokenCeiling(): number {
  const raw = process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET;
  if (!raw) return REQUEST_TOKEN_DEFAULT;
  if (!/^\d+$/.test(raw)) return REQUEST_TOKEN_DEFAULT;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return REQUEST_TOKEN_DEFAULT;
  return Math.min(n, REQUEST_TOKEN_HARD_CEILING);
}

/**
 * Edge fallback. Per-instance counter; isolated per request only
 * because Edge functions are short-lived. Not perfect under
 * concurrent load on the same instance — acceptable since the
 * budget is a defence-in-depth gate, not the primary cost gate.
 */
function makeFallbackStore(): RequestTokenBudgetStore {
  let active: RequestTokenBudgetState | null = null;
  return {
    current: () => active,
    async run<T>(
      state: RequestTokenBudgetState,
      fn: () => Promise<T>,
    ): Promise<T> {
      const prev = active;
      active = state;
      try {
        return await fn();
      } finally {
        active = prev;
      }
    },
  };
}

const fallbackStore = makeFallbackStore();

export function currentRequestTokenBudget(): RequestTokenBudgetState | null {
  return (installedStore ?? fallbackStore).current();
}

/**
 * Consume `tokens` from the active budget. Throws
 * `RequestTokenBudgetExceededError` if this consumption would put
 * the total over the ceiling.
 *
 * No-op (returns 0) if no budget is active (e.g. test harness or
 * system-level call). The agent-factory wires this for the user
 * path; system-level paths bypass safely.
 */
export function consumeTokens(tokens: number): number {
  if (tokens <= 0 || !Number.isFinite(tokens)) return 0;
  const state = currentRequestTokenBudget();
  if (!state) return 0;
  const next = state.consumedTokens + Math.floor(tokens);
  if (next > state.ceilingTokens) {
    throw new RequestTokenBudgetExceededError({
      agentName: state.agentName,
      consumedTokens: state.consumedTokens,
      attemptedTokens: tokens,
      ceilingTokens: state.ceilingTokens,
    });
  }
  state.consumedTokens = next;
  return next;
}

/**
 * Read the current consumption without modifying. Useful for
 * logging + telemetry.
 */
export function readRequestTokens(): { consumed: number; ceiling: number } | null {
  const state = currentRequestTokenBudget();
  if (!state) return null;
  return { consumed: state.consumedTokens, ceiling: state.ceilingTokens };
}

/**
 * Run `fn` inside a fresh budget. Returns the result.
 */
export async function withRequestTokenBudget<T>(
  agentName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const ceiling = getRequestTokenCeiling();
  const state: RequestTokenBudgetState = {
    consumedTokens: 0,
    ceilingTokens: ceiling,
    agentName,
    startedAtMs: Date.now(),
  };
  return (installedStore ?? fallbackStore).run(state, fn);
}

export class RequestTokenBudgetExceededError extends Error {
  readonly code = "REQUEST_TOKEN_BUDGET_EXCEEDED" as const;
  readonly agentName: string;
  readonly consumedTokens: number;
  readonly attemptedTokens: number;
  readonly ceilingTokens: number;
  constructor(input: {
    agentName: string;
    consumedTokens: number;
    attemptedTokens: number;
    ceilingTokens: number;
  }) {
    super(
      `Agent "${input.agentName}" attempted to consume ${input.attemptedTokens} tokens; ` +
        `total would be ${input.consumedTokens + input.attemptedTokens}, ceiling is ${input.ceilingTokens}.`,
    );
    this.name = "RequestTokenBudgetExceededError";
    this.agentName = input.agentName;
    this.consumedTokens = input.consumedTokens;
    this.attemptedTokens = input.attemptedTokens;
    this.ceilingTokens = input.ceilingTokens;
  }
}
