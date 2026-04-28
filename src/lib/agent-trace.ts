/**
 * AGENT EXECUTION TRACE — the forensic flame graph.
 *
 * Round 31 — closes R30's staged trace schema with a full
 * implementation. Every agent run captures a per-step trace:
 * which model was called, which tool was invoked, how long each
 * took, what cost each. Persisted at the end of execution to
 * `agent_traces` (see drizzle/0043).
 *
 * Why this is the highest-leverage next move:
 *   * Customer trust artifact: "show me how the agent reasoned"
 *     becomes a queryable URL (/dashboard/admin/trace/[id])
 *   * Cost attribution: per-step, not whole-run
 *   * Debugging: replay any past run from the captured trace
 *   * Eval baseline: drift detection compares trace shapes over time
 *   * Public reasoning trace (future): anonymized public endpoint
 *     showing how an agent arrived at any output
 *
 * Pattern: AsyncLocalStorage propagates the active trace through
 * every async boundary (model calls, tool calls, sub-agents).
 * Same pattern as a2e-depth.ts — the Node-side install is in
 * agent-trace-node.ts, gated to server-only entry points.
 *
 * SAFETY: tracing is FAIL-OPEN. A trace recorder error must NEVER
 * break the user's response. The lib swallows internal errors;
 * persistence is best-effort; the audit log is the durable backstop.
 */

export interface TraceSpan {
  id: string;
  parentId: string | null;
  kind: "model_call" | "tool_call" | "agent_call" | "decision";
  name: string;
  /** ms relative to trace start */
  startMs: number;
  durationMs: number;
  costCents: number;
  inputBytes: number;
  outputBytes: number;
  error?: string;
}

export interface TraceContext {
  traceId: string;
  rootAgentName: string;
  startedAtMs: number;
  /** Parent of the next addSpan() call. Null = root. */
  currentParentId: string | null;
  spans: TraceSpan[];
  /** Optional cap on span count; over this we drop new spans (with warning). */
  maxSpans: number;
}

export type TraceOutcome<T> =
  | { result: T; trace: TraceContext; error?: undefined }
  | { error: unknown; trace: TraceContext; result?: undefined };

export interface TraceStore {
  current(): TraceContext | null;
  /** Run `fn` inside a fresh trace context. Returns the result + final context. */
  run<T>(rootAgentName: string, fn: () => Promise<T>): Promise<TraceOutcome<T>>;
}

let installedStore: TraceStore | null = null;

/**
 * Install the real ALS-backed store. Called by agent-trace-node.ts
 * on its import. Idempotent.
 */
export function installAgentTraceStore(store: TraceStore): void {
  installedStore = store;
}

/** Maximum spans per trace. Trims if exceeded; tracing should not
 *  inflate JSONB beyond ~1MB even for very chatty agents. */
export const MAX_SPANS_PER_TRACE = 1000;

/**
 * Edge / no-op fallback. Edge functions don't have async_hooks;
 * tracing is best-effort there. Returns a context that records
 * spans but won't propagate across async boundaries the same way
 * ALS does. Acceptable since Edge functions are short-lived.
 */
function makeFallbackStore(): TraceStore {
  let active: TraceContext | null = null;
  return {
    current: () => active,
    async run<T>(
      rootAgentName: string,
      fn: () => Promise<T>,
    ): Promise<TraceOutcome<T>> {
      const trace: TraceContext = {
        traceId: cryptoRandomId(),
        rootAgentName,
        startedAtMs: Date.now(),
        currentParentId: null,
        spans: [],
        maxSpans: MAX_SPANS_PER_TRACE,
      };
      const prev = active;
      active = trace;
      try {
        const result = await fn();
        return { result, trace };
      } catch (error) {
        return { error, trace };
      } finally {
        active = prev;
      }
    },
  };
}

const fallbackStore = makeFallbackStore();

/**
 * Get the currently active trace context, or null if no trace is
 * active. Pure read; safe to call from anywhere.
 */
export function currentTrace(): TraceContext | null {
  return (installedStore ?? fallbackStore).current();
}

/**
 * Append a span to the current trace. NEVER throws — if there's
 * no active trace, it silently no-ops. If the trace is at its
 * span cap, the span is dropped (and a warning span replaces it
 * — only once per trace).
 */
export function addSpan(input: {
  kind: TraceSpan["kind"];
  name: string;
  startedAtMs?: number;
  durationMs: number;
  costCents?: number;
  inputBytes?: number;
  outputBytes?: number;
  error?: string;
}): string | null {
  const trace = currentTrace();
  if (!trace) return null;

  if (trace.spans.length >= trace.maxSpans) {
    // Trim warning — append once, then nothing.
    const lastSpan = trace.spans[trace.spans.length - 1];
    if (lastSpan?.name !== "[trace truncated]") {
      trace.spans.push({
        id: cryptoRandomId(),
        parentId: trace.currentParentId,
        kind: "decision",
        name: "[trace truncated]",
        startMs: Date.now() - trace.startedAtMs,
        durationMs: 0,
        costCents: 0,
        inputBytes: 0,
        outputBytes: 0,
      });
    }
    return null;
  }

  const id = cryptoRandomId();
  const startedAtMs = input.startedAtMs ?? Date.now();
  trace.spans.push({
    id,
    parentId: trace.currentParentId,
    kind: input.kind,
    name: input.name,
    startMs: Math.max(0, startedAtMs - trace.startedAtMs),
    durationMs: input.durationMs,
    costCents: input.costCents ?? 0,
    inputBytes: input.inputBytes ?? 0,
    outputBytes: input.outputBytes ?? 0,
    error: input.error,
  });
  return id;
}

/**
 * Run `fn` with a span scoped to it. The span gets `parentId` set
 * to the current parent; nested addSpan() calls within `fn` chain
 * under this span. After `fn`, the parent reverts. Useful for
 * grouping related steps.
 *
 * NEVER throws on tracing errors — fn's errors propagate normally.
 */
export async function withSpan<T>(
  input: {
    kind: TraceSpan["kind"];
    name: string;
    costCents?: number;
    inputBytes?: number;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const trace = currentTrace();
  if (!trace) return fn();

  const start = Date.now();
  const id = cryptoRandomId();
  const prevParent = trace.currentParentId;
  const placeholder: TraceSpan = {
    id,
    parentId: prevParent,
    kind: input.kind,
    name: input.name,
    startMs: Math.max(0, start - trace.startedAtMs),
    durationMs: 0,
    costCents: input.costCents ?? 0,
    inputBytes: input.inputBytes ?? 0,
    outputBytes: 0,
  };
  trace.spans.push(placeholder);
  trace.currentParentId = id;
  try {
    const result = await fn();
    placeholder.durationMs = Date.now() - start;
    return result;
  } catch (err) {
    placeholder.durationMs = Date.now() - start;
    placeholder.error = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    trace.currentParentId = prevParent;
  }
}

/**
 * The PUBLIC entry point: run `fn` inside a fresh trace context.
 * Returns the trace at the end (success OR failure).
 *
 * Always returns a trace, even when fn throws — the caller decides
 * whether to log the trace + propagate the error, or swallow.
 */
export async function withTrace<T>(
  rootAgentName: string,
  fn: () => Promise<T>,
): Promise<TraceOutcome<T>> {
  return (installedStore ?? fallbackStore).run(rootAgentName, fn);
}

/**
 * Compute the total cost of a trace by summing per-span costs.
 * Pure helper; safe in any runtime.
 */
export function traceTotalCostCents(trace: TraceContext): number {
  return trace.spans.reduce((sum, s) => sum + (s.costCents ?? 0), 0);
}

/**
 * Find the first error in a trace. Returns null if none.
 */
export function traceFirstError(trace: TraceContext): string | null {
  for (const s of trace.spans) {
    if (s.error) return s.error;
  }
  return null;
}

// ── Internal helpers ────────────────────────────────────────────────

function cryptoRandomId(): string {
  // 16 bytes of base16 = 32 hex chars; cryptographically random.
  // crypto.randomUUID() would also work but uses dashes; we want a
  // compact id for the JSONB column.
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const buf = new Uint8Array(16);
    globalThis.crypto.getRandomValues(buf);
    return Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Math.random fallback (only triggers if crypto is unavailable —
  // unlikely on Node 20+, edge runtimes have crypto built in).
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}
