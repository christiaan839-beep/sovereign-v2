/**
 * AGENT-TO-ENGINE RECURSION DEPTH TRACKER
 *
 * Round 28 — Power Tools sprint. ADR-0004 listed this as a future
 * sharpening of the cost-runaway guard.
 *
 * Why this exists:
 *   The cost-runaway guard catches recursive A2E loops SYMPTOMATICALLY
 *   (the recursion bills tokens, the daily cap auto-pauses the tenant).
 *   But that's reactive: the abuser's first day of recursion still
 *   bills $50–$200 of provider tokens before the cap fires.
 *
 *   A direct depth limit is the SHARPER tool: a tenant's agent calling
 *   itself (or another agent calling it back) past depth N gets a 422
 *   immediately, before any LLM call is made. Token cost is bounded
 *   to ~N × per-call cost, not unbounded.
 *
 * Implementation:
 *   - AsyncLocalStorage tracks per-request depth across async boundaries
 *   - Edge runtime fallback: per-process counter (acceptable since
 *     Edge functions are short-lived)
 *   - Default limit: 5 (configurable via SOVEREIGN_A2E_MAX_DEPTH env)
 *   - Hard limit: 10 (env can lower but not raise — defence-in-depth)
 *   - Wired into agent-factory pre-execution
 *
 * The chosen depth is the "user contribution" knob:
 *   - 3 — strict (blocks most legitimate sub-agent patterns)
 *   - 5 — balanced default (allows playbook → coordinator → sub-agent → tool)
 *   - 8 — permissive (allows complex DAG-style chains)
 *   - 10 — hard ceiling, env can't exceed
 */

// Re-export the shared types + edge-safe no-op tracker. The Node-side
// installs the real ALS-backed implementation via a2e-depth-node.ts,
// imported from instrumentation.ts.

export interface A2eDepthStore {
  current(): number;
  /**
   * Increment depth for the duration of `fn`. Returns the result of
   * `fn`. The depth is decremented after `fn` resolves or throws.
   */
  enter<T>(fn: () => Promise<T>): Promise<T>;
}

let installedStore: A2eDepthStore | null = null;

/**
 * Install the real ALS-backed store. Called by a2e-depth-node.ts on
 * its import. Idempotent.
 */
export function installA2eDepthStore(store: A2eDepthStore): void {
  installedStore = store;
}

/**
 * Hard ceiling: env can configure the soft limit between 1 and this,
 * but never exceed. Defence-in-depth — a misconfigured env can't
 * disable the recursion limit entirely.
 */
export const A2E_HARD_CEILING = 10;

/**
 * Default soft limit when not configured via env. 5 allows
 * playbook → coordinator → sub-agent → tool → leaf, which covers
 * most legitimate patterns in the agent registry.
 *
 * SHIPPED CHOICE (R29): 5 is the canonical default.
 *
 * Rationale: the deepest legitimate chain in the codebase is
 * playbook-engine → DAG-node → coordinator → leaf-agent → AI-call,
 * which is exactly 5. A misconfigured agent calling itself reaches
 * limit at depth 6 — that's a sharp boundary with no false-positives.
 *
 * Operators can override via SOVEREIGN_A2E_MAX_DEPTH env (capped
 * at A2E_HARD_CEILING=10 — env can lower but never raise above 10).
 *
 * Revisit when an agent author legitimately needs depth 6+ (e.g.
 * a swarm-style coordinator-of-coordinators pattern). At that point
 * either raise the default to 7 or document the env override in
 * the agent's manifest.
 */
export const A2E_DEFAULT_LIMIT = 5;

/**
 * Read the configured soft limit. Clamped to [1, A2E_HARD_CEILING].
 * Pure function — safe to call from anywhere.
 */
export function getA2eMaxDepth(): number {
  const raw = process.env.SOVEREIGN_A2E_MAX_DEPTH;
  if (!raw) return A2E_DEFAULT_LIMIT;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return A2E_DEFAULT_LIMIT;
  return Math.min(n, A2E_HARD_CEILING);
}

/**
 * Edge / no-op fallback. Edge runtime function instances are
 * short-lived (one request per instance, in practice), so a
 * per-instance counter is acceptable. This DOES leak depth across
 * sequential requests on the same instance, but the counter resets
 * after each request via the `enter` finalizer.
 *
 * The fallback is intentionally conservative: when ALS isn't
 * available, we count depth on a single thread-local slot. Overlap
 * with a concurrent request would cause a false reject — acceptable
 * for a security gate (false-positive > false-negative).
 */
function makeFallbackStore(): A2eDepthStore {
  let depth = 0;
  return {
    current: () => depth,
    enter: async <T,>(fn: () => Promise<T>): Promise<T> => {
      depth += 1;
      try {
        return await fn();
      } finally {
        depth = Math.max(0, depth - 1);
      }
    },
  };
}

const fallbackStore = makeFallbackStore();

/**
 * The current depth, regardless of which runtime we're on.
 * Returns 0 when no enter() is active.
 */
export function currentA2eDepth(): number {
  return (installedStore ?? fallbackStore).current();
}

/**
 * The PUBLIC entry point: check + increment + run + decrement.
 *
 * If depth would exceed the configured limit, throws an
 * `A2eDepthExceededError` BEFORE invoking `fn`. The agent-factory
 * catches this and returns 422.
 *
 * NEVER skips the limit check — even with `SOVEREIGN_A2E_DISABLED=1`,
 * the hard ceiling is enforced. There is no escape hatch.
 */
export async function withA2eDepthCheck<T>(
  agentName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const limit = getA2eMaxDepth();
  const store = installedStore ?? fallbackStore;
  const next = store.current() + 1;
  if (next > limit) {
    throw new A2eDepthExceededError(agentName, next - 1, limit);
  }
  return store.enter(fn);
}

/**
 * The HTTP header used to propagate A2E depth across fetch
 * boundaries. ALS gives us in-process tracking; for fetch-based
 * recursion (one agent's handler fetches another agent's route),
 * the header threads the depth through the request pipeline.
 *
 * Conventions:
 *   - Sent from the OUTBOUND fetch with the CURRENT depth
 *   - Read on INBOUND request; the receiver runs at depth+1
 *   - Capped at A2E_HARD_CEILING — values above are clamped to 0
 *     (treated as missing) to defeat header-spoofing attempts that
 *     try to "skip" the depth gate by sending negative or huge values
 */
export const A2E_DEPTH_HEADER = "X-A2E-Depth";

/**
 * Parse the X-A2E-Depth header from a Request. Returns 0 for any
 * malformed / hostile / out-of-range value (never throws).
 *
 * The clamping behavior is deliberate:
 *   - missing → 0 (request is the root)
 *   - negative → 0 (defends against underflow attempts)
 *   - non-numeric → 0 (defends against header-injection garbage)
 *   - > A2E_HARD_CEILING → A2E_HARD_CEILING (clamps to ceiling, NOT 0,
 *     so a malicious caller can't forge "depth=999 means I'm at root")
 */
export function readA2eDepthHeader(req: Request): number {
  const raw = req.headers.get(A2E_DEPTH_HEADER);
  if (!raw) return 0;
  // STRICT numeric: only ASCII digits, no signs, no whitespace,
  // no trailing garbage. parseInt() permissively accepts "3; DROP",
  // which we DO NOT want — defence-in-depth treats any non-clean
  // value as missing rather than as the leading numeric prefix.
  if (!/^\d+$/.test(raw)) return 0;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  if (parsed > A2E_HARD_CEILING) return A2E_HARD_CEILING;
  return parsed;
}

/**
 * Build a Headers object for an outbound fetch with the propagated
 * depth. Caller passes their `seed` arg (typically `currentA2eDepth() + headerSeed`)
 * so the receiver sees the next-deeper depth.
 *
 * Use case: when an agent's handler calls another agent via fetch,
 * pass the result of this function to the fetch's `headers`.
 *
 * Example:
 *   const headers = a2eOutboundHeaders({ baseHeaders: { "Content-Type": "application/json" } });
 *   await fetch("/api/_agents/sub-agent", { method: "POST", headers, body: JSON.stringify(...) });
 */
export function a2eOutboundHeaders(opts?: {
  baseHeaders?: HeadersInit;
}): Headers {
  const headers = new Headers(opts?.baseHeaders ?? {});
  // Send CURRENT depth — the receiver will check (depth+1 > limit).
  headers.set(A2E_DEPTH_HEADER, String(currentA2eDepth()));
  return headers;
}

/**
 * Thrown when depth would exceed the configured limit. The factory
 * translates this to a 422 response with a clear error code.
 */
export class A2eDepthExceededError extends Error {
  readonly code = "A2E_DEPTH_EXCEEDED" as const;
  constructor(
    public readonly agentName: string,
    public readonly depthAtCall: number,
    public readonly limit: number,
  ) {
    super(
      `Agent "${agentName}" called at recursion depth ${depthAtCall + 1}; limit is ${limit}. ` +
        `Increase SOVEREIGN_A2E_MAX_DEPTH (max ${A2E_HARD_CEILING}) if this is a legitimate deep chain.`,
    );
    this.name = "A2eDepthExceededError";
  }
}
