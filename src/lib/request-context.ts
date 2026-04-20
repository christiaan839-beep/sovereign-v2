import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

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
 * What DOESN'T live here:
 *   - Secrets (CRON_SECRET, API tokens) — those never touch request state
 *   - PII (email, prompts) — those stay in their audit-logged tables
 *   - Response-shaping data (modelsConsulted) — that's model-attribution.ts
 *
 * Why a separate store from model-attribution.ts:
 *   - Model attribution is a Set<string>; request context is a struct.
 *     Merging them creates type complexity and makes downstream
 *     consumers read everything when they only need one.
 *   - Both run in parallel ALS contexts — they don't conflict.
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

const requestStore = new AsyncLocalStorage<RequestContext>();

/** Generate a stable-ish unique request ID. 12 chars of hex ≈ 48 bits of entropy. */
export function generateRequestId(): string {
  return randomBytes(6).toString("hex");
}

/**
 * Run the given handler inside a request context. The agent-factory
 * + any top-level route that wants correlation wraps itself with this.
 */
export function runWithRequestContext<T>(
  ctx: Omit<RequestContext, "startedAt">,
  fn: () => T | Promise<T>,
): Promise<T> | T {
  return requestStore.run({ ...ctx, startedAt: Date.now() }, fn);
}

/** Read the current request context, if we're inside one. */
export function getRequestContext(): RequestContext | undefined {
  return requestStore.getStore();
}

/** Shortcut: just the requestId, or null outside a context. */
export function getRequestId(): string | null {
  return requestStore.getStore()?.requestId ?? null;
}

/** Mutate the current context — useful when agentName is known only
 *  after the factory wraps the handler but before the handler runs.
 *  Safe because each request gets its own Store instance. */
export function setAgentName(name: string): void {
  const ctx = requestStore.getStore();
  if (ctx) ctx.agentName = name;
}

/** Set authenticated user once resolved (e.g., after Clerk guard). */
export function setUserId(userId: string): void {
  const ctx = requestStore.getStore();
  if (ctx) ctx.userId = userId;
}

/** How long has the current request been running? Useful for timing
 *  without passing `startTime` through every function. */
export function getElapsedMs(): number {
  const ctx = requestStore.getStore();
  if (!ctx) return 0;
  return Date.now() - ctx.startedAt;
}
