/**
 * SOVEREIGN MATRIX — Per-request execution budget + kill-switch (wave 106).
 *
 * Motivation: existing guards cover the wrong failure mode.
 *
 *   - `budget-guard.ts`        → daily-spend cap per tenant (after-the-fact)
 *   - `agent-circuit-breaker`  → per-agent failure counter (not loops)
 *   - `rate-limit.ts`          → per-user-per-window request count
 *
 * NONE catch a single in-flight request whose agent loop calls the
 * same tool 47 times in 30 seconds. The daily-spend guard would
 * eventually trip — but only AFTER the bill has been incurred. This
 * module catches runaway loops WHILE THEY ARE HAPPENING:
 *
 *   1. Hard cap on total tool calls per request (default 50).
 *   2. Hard cap on IDENTICAL-FINGERPRINT repetition per request
 *      (default 5). Same tool + same params hitting 5 times within
 *      one request strongly suggests the agent is stuck in a loop
 *      and not making progress.
 *   3. Hard wall-clock budget per request (default 60s).
 *
 * Scoping is per-request via AsyncLocalStorage — callers wrap the
 * request handler with `withExecutionBudget(...)` and downstream
 * agent code calls `checkpoint(toolName, params)` before each tool
 * invocation. Code that doesn't opt in is unaffected (backward-
 * compatible: `checkpoint` is a no-op when no budget context exists).
 *
 * The kill-switch is INTENTIONALLY conservative — default limits are
 * generous enough for normal agent loops (50 tool calls is a lot)
 * and tight enough that a pathological loop is killed inside ~1s.
 *
 * Audit: on exhaustion, `logExhaustion` emits an `execution.exhausted`
 * audit-log row capturing the reason, request id, fingerprint, and
 * counts. This action is registered in wave-105's RETENTION_POLICIES
 * (30d) — operational telemetry, not evidence.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("execution-budget");

export interface ExecutionBudgetLimits {
  /** Hard cap on total tool calls per request. */
  maxToolCalls: number;
  /** Same (toolName, params) fingerprint hit this many times → kill. */
  maxIdenticalRepeats: number;
  /** Wall-clock budget for the entire request (ms). */
  maxWallClockMs: number;
}

export const DEFAULT_LIMITS: Readonly<ExecutionBudgetLimits> = Object.freeze({
  maxToolCalls: 50,
  // Wave-106 review M2: raised from 5 to 8. Legitimate
  // retry-with-exponential-backoff loops (Stripe/Pinecone/upstream
  // flakiness) commonly retry 3-7x against the same idempotent call.
  // 8 still trips a runaway loop inside ~1s while leaving real
  // retry patterns alone.
  maxIdenticalRepeats: 8,
  maxWallClockMs: 60_000,
});

export type ExhaustionReason =
  | "tool_call_cap"
  | "identical_repeat"
  | "wall_clock";

export interface ExecutionExhaustionDetails {
  reason: ExhaustionReason;
  toolCalls: number;
  durationMs: number;
  /** Present when reason === "identical_repeat". */
  fingerprint?: string;
  fingerprintCount?: number;
  /** Limit value that was breached — useful for operator dashboards. */
  limit: number;
}

export class ExecutionExhaustedError extends Error {
  readonly details: ExecutionExhaustionDetails;
  constructor(details: ExecutionExhaustionDetails) {
    super(
      `Execution budget exhausted (${details.reason}): ` +
        `toolCalls=${details.toolCalls}, durationMs=${details.durationMs}, ` +
        `limit=${details.limit}` +
        (details.fingerprint
          ? `, fingerprint=${details.fingerprint}, count=${details.fingerprintCount}`
          : ""),
    );
    this.name = "ExecutionExhaustedError";
    this.details = details;
  }
}

interface ExecutionContext {
  startedAt: number;
  limits: ExecutionBudgetLimits;
  toolCallsTotal: number;
  fingerprints: Map<string, number>;
  userId: string | null;
  requestId: string;
}

const storage = new AsyncLocalStorage<ExecutionContext>();

/**
 * Wrap an async handler in a per-request execution budget. Downstream
 * code inside `fn` may call `checkpoint(...)` and `getExecutionStats()`
 * via AsyncLocalStorage — no need to thread the context manually.
 *
 * Backward-compat: code that never wraps is unaffected. `checkpoint`
 * is a no-op when no scope exists. This lets us roll the kill-switch
 * out one agent at a time.
 */
export function withExecutionBudget<T>(
  opts: {
    userId: string | null;
    requestId: string;
    limits?: Partial<ExecutionBudgetLimits>;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const ctx: ExecutionContext = {
    startedAt: Date.now(),
    limits: { ...DEFAULT_LIMITS, ...(opts.limits ?? {}) },
    toolCallsTotal: 0,
    fingerprints: new Map(),
    userId: opts.userId,
    requestId: opts.requestId,
  };
  return storage.run(ctx, fn);
}

/**
 * Stable canonical fingerprint for (toolName, params). Sorted-key
 * JSON keeps the fingerprint deterministic across key-order
 * variations — `{a:1,b:2}` and `{b:2,a:1}` produce the same fp.
 *
 * Hashed when the canonical form exceeds 256 chars — keeps audit
 * rows small and prevents an adversary from polluting the
 * fingerprint map with megabyte-sized "different" calls.
 */
export function fingerprint(toolName: string, params: unknown): string {
  try {
    const canonical = canonicalJson(params);
    const base =
      canonical.length > 256
        ? createHash("sha256").update(canonical).digest("hex").slice(0, 32)
        : canonical;
    return `${toolName}::${base}`;
  } catch {
    // Wave-106 review L2: params containing circular refs or non-JSON
    // primitives (BigInt, Symbol) would throw inside JSON.stringify.
    // Returning a sentinel keeps the kill-switch operational — every
    // such call collides on the same fingerprint, so an attacker
    // crafting unserialisable payloads to evade detection would
    // actually accelerate the identical_repeat trip.
    return `${toolName}::__unserialisable__`;
  }
}

/**
 * Audit-safe form of a fingerprint. The in-memory fingerprint may
 * embed verbatim canonical JSON of `params` (when ≤256 chars) for
 * dev-ergonomic debugging — but `params` can legitimately contain
 * PII (emails, names, prompt fragments from agent tool calls), and
 * the wave-105 retention policy keeps `execution.exhausted` rows
 * for 30d. Hash unconditionally before the value crosses the audit
 * boundary so 30d of audit storage never holds raw user data from
 * a kill-switch trip.
 *
 * Wave-106 review M1 fix.
 */
export function auditSafeFingerprint(fp: string): string {
  const sep = fp.indexOf("::");
  if (sep < 0)
    return createHash("sha256").update(fp).digest("hex").slice(0, 32);
  const toolName = fp.slice(0, sep);
  const rest = fp.slice(sep + 2);
  return `${toolName}::${createHash("sha256").update(rest).digest("hex").slice(0, 32)}`;
}

function canonicalJson(v: unknown): string {
  if (v === undefined) return "undefined";
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(val).sort()) {
        sorted[key] = (val as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return val;
  });
}

/**
 * Pre-tool-call checkpoint. Throws ExecutionExhaustedError if the
 * call would exceed any limit. Callers should invoke this BEFORE
 * running the tool — that way an exhausted request never incurs
 * the cost of the call it was about to make.
 *
 * No-op when called outside `withExecutionBudget` (backward-compat).
 */
export function checkpoint(toolName: string, params: unknown): void {
  const ctx = storage.getStore();
  if (!ctx) return;

  const now = Date.now();
  const elapsed = now - ctx.startedAt;

  if (elapsed > ctx.limits.maxWallClockMs) {
    throw new ExecutionExhaustedError({
      reason: "wall_clock",
      toolCalls: ctx.toolCallsTotal,
      durationMs: elapsed,
      limit: ctx.limits.maxWallClockMs,
    });
  }

  if (ctx.toolCallsTotal >= ctx.limits.maxToolCalls) {
    throw new ExecutionExhaustedError({
      reason: "tool_call_cap",
      toolCalls: ctx.toolCallsTotal,
      durationMs: elapsed,
      limit: ctx.limits.maxToolCalls,
    });
  }

  const fp = fingerprint(toolName, params);
  const repeats = (ctx.fingerprints.get(fp) ?? 0) + 1;
  if (repeats > ctx.limits.maxIdenticalRepeats) {
    throw new ExecutionExhaustedError({
      reason: "identical_repeat",
      toolCalls: ctx.toolCallsTotal,
      durationMs: elapsed,
      fingerprint: fp,
      fingerprintCount: repeats,
      limit: ctx.limits.maxIdenticalRepeats,
    });
  }
  ctx.fingerprints.set(fp, repeats);
  // Increment AFTER the trip checks above — an exhaustion throw
  // means the tool never ran, so it shouldn't count against the cap.
  // Don't move this above the checks in a future "cleanup" PR.
  ctx.toolCallsTotal++;
}

/**
 * Read-only view of the current execution context — useful for
 * dashboards / telemetry that want to surface "this request used
 * 12/50 tool calls in 4.3s" without mutating the budget. Returns
 * null outside `withExecutionBudget`.
 */
export function getExecutionStats(): Readonly<{
  toolCallsTotal: number;
  durationMs: number;
  distinctFingerprints: number;
  limits: ExecutionBudgetLimits;
  requestId: string;
  userId: string | null;
}> | null {
  const ctx = storage.getStore();
  if (!ctx) return null;
  return Object.freeze({
    toolCallsTotal: ctx.toolCallsTotal,
    durationMs: Date.now() - ctx.startedAt,
    distinctFingerprints: ctx.fingerprints.size,
    limits: ctx.limits,
    requestId: ctx.requestId,
    userId: ctx.userId,
  });
}

/**
 * Emit an audit-log row for an exhausted execution. Imported
 * dynamically so the audit-log dependency stays optional — keeps
 * this module tree-shakable for non-Next contexts (CLI, tests).
 *
 * Best-effort: failures are swallowed. The kill-switch's primary
 * job is to STOP the loop; logging is secondary.
 */
export async function logExhaustion(
  err: ExecutionExhaustedError,
  userId: string | null,
  requestId: string,
): Promise<void> {
  log.warn("execution exhausted — kill-switch fired", {
    requestId,
    userId,
    ...err.details,
  });
  if (!userId) return;
  try {
    const { auditLog } = await import("@/lib/audit-log");
    // Wave-106 review M1: hash the fingerprint before it crosses the
    // audit boundary so 30d of retained audit rows never hold raw
    // user data from a kill-switch trip.
    const safeDetails: Record<string, unknown> = {
      ...err.details,
      requestId,
    };
    if (err.details.fingerprint) {
      safeDetails.fingerprint = auditSafeFingerprint(err.details.fingerprint);
    }
    await auditLog({
      userId,
      action: "execution.exhausted",
      resource: `kill-switch:${err.details.reason}`,
      details: safeDetails,
    }).catch(() => {});
  } catch {
    /* non-blocking */
  }
}

/**
 * Wave-107 ergonomic wrapper for route handlers.
 *
 * Combines `withExecutionBudget` + `ExecutionExhaustedError`-to-429
 * translation + `logExhaustion` audit into a single call. The result
 * discriminated-union shape lets a route handler write:
 *
 *   const result = await runWithBudgetAndAudit(
 *     { userId, requestId },
 *     async () => { ...your existing handler body... }
 *   );
 *   if (!result.ok) {
 *     return NextResponse.json(
 *       { error: "Execution budget exceeded", reason: result.reason },
 *       { status: result.status, headers: result.headers },
 *     );
 *   }
 *   return NextResponse.json(result.value);
 *
 * Any non-ExecutionExhaustedError throw inside `fn` propagates to the
 * caller untouched — this helper does NOT swallow real errors. The
 * 429 status (not 500) is intentional: kill-switch trips are "you're
 * hitting our anti-loop ceiling", not "we broke", and clients can
 * retry with backoff after addressing the loop.
 */
export type BudgetRunResult<T> =
  | { ok: true; value: T; stats: ReturnType<typeof getExecutionStats> }
  | {
      ok: false;
      status: 429;
      reason: ExhaustionReason;
      details: ExecutionExhaustionDetails;
      headers: Record<string, string>;
    };

export async function runWithBudgetAndAudit<T>(
  opts: {
    userId: string | null;
    requestId: string;
    limits?: Partial<ExecutionBudgetLimits>;
  },
  fn: () => Promise<T>,
): Promise<BudgetRunResult<T>> {
  try {
    // Capture stats INSIDE the budget scope — once the storage.run()
    // returns, AsyncLocalStorage has torn down and getExecutionStats()
    // would return null.
    let capturedStats: ReturnType<typeof getExecutionStats> = null;
    const value = await withExecutionBudget(opts, async () => {
      const v = await fn();
      capturedStats = getExecutionStats();
      return v;
    });
    return { ok: true, value, stats: capturedStats };
  } catch (err) {
    if (err instanceof ExecutionExhaustedError) {
      // Fire audit row but do not await — kill-switch translation must
      // be fast so the client gets the 429 immediately.
      void logExhaustion(err, opts.userId, opts.requestId);
      return {
        ok: false,
        status: 429,
        reason: err.details.reason,
        details: err.details,
        headers: {
          "X-Sovereign-Reason": `kill-switch:${err.details.reason}`,
          "X-Sovereign-Request-Id": opts.requestId,
          // Retry-After is a soft hint — the underlying loop must
          // change for the next request to succeed, so a long
          // backoff is appropriate.
          "Retry-After": "30",
        },
      };
    }
    throw err;
  }
}
