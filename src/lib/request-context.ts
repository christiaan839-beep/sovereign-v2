/**
 * REQUEST CONTEXT — a tiny per-request store threaded through async
 * boundaries via Node's AsyncLocalStorage.
 *
 * Why it exists:
 *   - When a customer reports "my agent run took 47s", we need to
 *     correlate every log line, every AI call, every DB query, and
 *     the Sentry error to that ONE request.
 *   - Without ALS, each layer would need a `context` param passed
 *     explicitly — 40+ function signatures to change, easy to forget.
 *   - With ALS, log() / ai() / nimChat() / DB queries just READ the
 *     context, no plumbing.
 *
 * What lives in the context:
 *   - requestId: stable 12-char random hex; emitted as X-Request-Id
 *     response header + in every log line
 *   - userId: resolved Clerk user ID (if authenticated) for per-user
 *     filtering in Sentry / log aggregators
 *   - agentName: which agent is running (leads / booking / etc.)
 *   - startedAt: wall-clock epoch ms for duration measurement
 *   - path: the URL path the request hit (for grouping)
 *
 * RUNTIME COMPAT — read this before changing imports
 * ──────────────────────────────────────────────────
 * `logger.ts` re-exports `getRequestId()` so EVERY module that ever
 * logs ends up importing this file — including modules that get
 * bundled for Edge runtime, OG image routes, and (transitively, via
 * shared utils like rbac.ts) Client Components running in the browser.
 *
 * `node:async_hooks` does NOT exist in Edge or in the browser. Even
 * "lazy require" or `(0, eval)("require")` patterns fail under
 * Turbopack 16 because:
 *   - Static `require()` of `node:async_hooks` gets traced into Edge
 *     bundles → "node module not supported in edge runtime" error
 *   - `eval` is banned in Edge bundles outright → "Dynamic Code
 *     Evaluation not allowed in Edge Runtime" error
 *
 * THE FIX (globalThis late-binding):
 *   - This file ships a NO-OP store by default. `runWithRequestContext`
 *     just calls the function; `getStore()` returns undefined. Logging
 *     still works; per-request correlation simply has no effect when
 *     there's no real ALS available.
 *   - Server-only callers can install a real `AsyncLocalStorage`-backed
 *     store by calling `installRequestContextStore()` from a Node-only
 *     module (`request-context-node.ts`). That module imports
 *     `node:async_hooks` and is itself only ever imported from
 *     server-only code paths (instrumentation.ts), so Turbopack never
 *     sees the Node import in Edge/Browser bundles.
 *
 * The public API (runWithRequestContext / getRequestContext / etc.)
 * is unchanged.
 */

export interface RequestContext {
  /** Stable ID for log correlation. Also emitted as X-Request-Id response header. */
  requestId: string;
  /** Authenticated Clerk user ID, or undefined for public routes. */
  userId?: string;
  /** Agent identifier (createAgentRoute config.name) if this is an agent request. */
  agentName?: string;
  /** URL path for grouping in observability tools. */
  path?: string;
  /** Wall-clock epoch ms when the context was opened. */
  startedAt: number;
}

/**
 * Pluggable store interface — same shape as the methods we use from
 * AsyncLocalStorage. Real implementation comes from
 * request-context-node.ts at server startup; the no-op fallback lives
 * in this file so Edge/Browser bundles can use it without dragging in
 * any Node modules.
 */
export interface RequestContextStore {
  run<T>(ctx: RequestContext, fn: () => T | Promise<T>): T | Promise<T>;
  getStore(): RequestContext | undefined;
}

const NOOP_STORE: RequestContextStore = {
  run: (_ctx, fn) => fn(),
  getStore: () => undefined,
};

// We stash the active store on globalThis so a server-only module can
// install the real `AsyncLocalStorage`-backed implementation without
// either side having to statically import the other.
const STORE_KEY = "__sovereignRequestStore" as const;

interface GlobalWithStore {
  [STORE_KEY]?: RequestContextStore;
}

function getActiveStore(): RequestContextStore {
  return (globalThis as GlobalWithStore)[STORE_KEY] ?? NOOP_STORE;
}

/**
 * Server-only module's entry point. Called once from
 * request-context-node.ts during instrumentation; idempotent.
 */
export function installRequestContextStore(store: RequestContextStore): void {
  (globalThis as GlobalWithStore)[STORE_KEY] = store;
}

// ─── Request ID generation ──────────────────────────────────────────

/**
 * Generate a stable-ish unique request ID. 12 chars of hex ≈ 48 bits
 * of entropy — plenty for log-correlation uniqueness, well below
 * security-grade.
 *
 * Uses Web Crypto (`globalThis.crypto.getRandomValues`) which works in
 * Node 20+, Edge runtime, and modern browsers. Falls back to
 * `Math.random()` only on extremely ancient runtimes (good enough for
 * IDs since the input space is huge and there's no security
 * requirement).
 */
export function generateRequestId(): string {
  const buf = new Uint8Array(6);
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    webCrypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Public API (signatures unchanged from the original module) ─────

/**
 * Run the given handler inside a request context. The agent-factory
 * + any top-level route that wants correlation wraps itself with this.
 */
export function runWithRequestContext<T>(
  ctx: Omit<RequestContext, "startedAt">,
  fn: () => T | Promise<T>,
): Promise<T> | T {
  return getActiveStore().run({ ...ctx, startedAt: Date.now() }, fn);
}

/** Read the current request context, if we're inside one. */
export function getRequestContext(): RequestContext | undefined {
  return getActiveStore().getStore();
}

/** Shortcut: just the requestId, or null outside a context. */
export function getRequestId(): string | null {
  return getActiveStore().getStore()?.requestId ?? null;
}

/**
 * Mutate the current context — useful when agentName is known only
 * after the factory wraps the handler but before the handler runs.
 * Safe because each request gets its own Store instance.
 */
export function setAgentName(name: string): void {
  const ctx = getActiveStore().getStore();
  if (ctx) ctx.agentName = name;
}

/** Set authenticated user once resolved (e.g., after Clerk guard). */
export function setUserId(userId: string): void {
  const ctx = getActiveStore().getStore();
  if (ctx) ctx.userId = userId;
}

/**
 * How long has the current request been running? Useful for timing
 * without passing `startTime` through every function.
 */
export function getElapsedMs(): number {
  const ctx = getActiveStore().getStore();
  if (!ctx) return 0;
  return Date.now() - ctx.startedAt;
}
