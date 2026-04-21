/**
 * TELEMETRY — Langfuse-compatible LLM observability.
 *
 * Langfuse is MIT-licensed, self-hostable, and the best open-source option
 * for LLM observability. It gives you:
 *   - Every LLM call traced with input/output/latency/cost
 *   - Per-user token attribution
 *   - Eval datasets and regression tests
 *   - Sessions that group related traces (playbook runs, conversations)
 *
 * This module is a THIN client — no SDK dependency — so we don't add a
 * Python runtime or a complex Node package. Langfuse speaks HTTP with
 * simple JSON bodies; we speak HTTP back. If LANGFUSE_HOST is missing
 * every function is a no-op (fire-and-forget).
 *
 * What gets sent:
 *   - trace(): one logical operation (e.g., "playbook run", "agent call")
 *   - generation(): one LLM call within a trace — input, output, model, tokens
 *   - span(): non-LLM operation within a trace (DB query, tool call, etc.)
 *   - event(): point-in-time marker (e.g., "user-approved", "critic-ran")
 *
 * All calls are async + fire-and-forget (never block the user's request).
 * Failures are logged but never surface to the caller.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("telemetry");

const LANGFUSE_HOST = process.env.LANGFUSE_HOST;
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;

const ENABLED = !!(LANGFUSE_HOST && LANGFUSE_PUBLIC_KEY && LANGFUSE_SECRET_KEY);

/**
 * Base64 encode the basic-auth header for Langfuse. Keeps it out of the
 * hot path — computed once at module load and reused.
 */
const AUTH_HEADER = ENABLED
  ? "Basic " + Buffer.from(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`).toString("base64")
  : "";

/**
 * Enqueue a batch of Langfuse events. We batch per-request (one ingest
 * call carries all spans/generations/events for a trace) so we don't
 * hammer the Langfuse instance with per-event HTTP calls.
 *
 * Fire-and-forget — never awaited by the caller. Errors are logged.
 */
async function sendBatch(events: Array<Record<string, unknown>>): Promise<void> {
  if (!ENABLED || events.length === 0) return;
  try {
    await fetch(`${LANGFUSE_HOST}/api/public/ingestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: AUTH_HEADER,
      },
      body: JSON.stringify({ batch: events }),
      signal: AbortSignal.timeout(3000), // telemetry deadline — never block user
    });
  } catch (err) {
    log.warn("Langfuse send failed", { error: (err as Error).message });
  }
}

/** Generate a Langfuse-compatible ID (UUID v4-ish, good enough). */
function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Public API ──

export interface TraceOptions {
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface Trace {
  id: string;
  end: (output?: unknown) => Promise<void>;
  generation: (opts: GenerationOptions) => Promise<Generation>;
  span: (opts: SpanOptions) => Promise<Span>;
  event: (opts: EventOptions) => Promise<void>;
}

export interface GenerationOptions {
  name: string;
  model: string;
  input: string | Array<{ role: string; content: string }>;
  metadata?: Record<string, unknown>;
}

export interface Generation {
  end: (output: string, usage?: { promptTokens?: number; completionTokens?: number }) => Promise<void>;
}

export interface SpanOptions {
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export interface Span {
  end: (output?: unknown) => Promise<void>;
}

export interface EventOptions {
  name: string;
  data?: Record<string, unknown>;
}

/**
 * Start a trace. Returns handles for the trace's generations/spans/events.
 * When ENABLED is false, all handles are no-ops — safe to use unconditionally.
 *
 * Usage:
 *   const trace = startTrace({ name: "playbook:lead-blitz", userId });
 *   const gen = await trace.generation({ name: "classify", model: "nim", input: prompt });
 *   const result = await ai(prompt);
 *   await gen.end(result);
 *   await trace.end({ leadsFound: 42 });
 */
export function startTrace(options: TraceOptions): Trace {
  const traceId = genId();
  const startedAt = Date.now();

  if (!ENABLED) {
    // No-op trace for when Langfuse isn't configured — same API shape,
    // lets callers use startTrace() without conditional branches.
    const noop = async () => {};
    const noopGen: Generation = { end: noop };
    const noopSpan: Span = { end: noop };
    return {
      id: traceId,
      end: noop,
      generation: async () => noopGen,
      span: async () => noopSpan,
      event: noop,
    };
  }

  // Buffer events and flush them all on end() — one HTTP call per trace.
  const events: Array<Record<string, unknown>> = [
    {
      id: genId(),
      type: "trace-create",
      timestamp: new Date().toISOString(),
      body: {
        id: traceId,
        name: options.name,
        userId: options.userId,
        sessionId: options.sessionId,
        metadata: options.metadata,
        tags: options.tags,
      },
    },
  ];

  return {
    id: traceId,
    async end(output?: unknown) {
      events.push({
        id: genId(),
        type: "trace-create",
        timestamp: new Date().toISOString(),
        body: {
          id: traceId,
          output,
          metadata: {
            ...options.metadata,
            durationMs: Date.now() - startedAt,
          },
        },
      });
      // Fire-and-forget ship
      void sendBatch(events);
    },
    async generation(opts: GenerationOptions): Promise<Generation> {
      const genId_ = genId();
      const genStart = Date.now();
      events.push({
        id: genId(),
        type: "generation-create",
        timestamp: new Date(genStart).toISOString(),
        body: {
          id: genId_,
          traceId,
          name: opts.name,
          model: opts.model,
          input: opts.input,
          metadata: opts.metadata,
          startTime: new Date(genStart).toISOString(),
        },
      });
      return {
        async end(output: string, usage?: { promptTokens?: number; completionTokens?: number }) {
          events.push({
            id: genId(),
            type: "generation-update",
            timestamp: new Date().toISOString(),
            body: {
              id: genId_,
              traceId,
              output,
              endTime: new Date().toISOString(),
              usage,
            },
          });
        },
      };
    },
    async span(opts: SpanOptions): Promise<Span> {
      const spanId = genId();
      const spanStart = Date.now();
      events.push({
        id: genId(),
        type: "span-create",
        timestamp: new Date(spanStart).toISOString(),
        body: {
          id: spanId,
          traceId,
          name: opts.name,
          input: opts.input,
          metadata: opts.metadata,
          startTime: new Date(spanStart).toISOString(),
        },
      });
      return {
        async end(output?: unknown) {
          events.push({
            id: genId(),
            type: "span-update",
            timestamp: new Date().toISOString(),
            body: {
              id: spanId,
              traceId,
              output,
              endTime: new Date().toISOString(),
            },
          });
        },
      };
    },
    async event(opts: EventOptions) {
      events.push({
        id: genId(),
        type: "event-create",
        timestamp: new Date().toISOString(),
        body: {
          traceId,
          name: opts.name,
          metadata: opts.data,
        },
      });
    },
  };
}

/**
 * One-shot helper: wrap any function call in a trace + single generation.
 * For callers who just want observability on one LLM call without
 * threading a trace handle through their code.
 */
export async function observedAi<T>(
  name: string,
  model: string,
  input: string,
  fn: () => Promise<T>,
  options: { userId?: string; metadata?: Record<string, unknown> } = {},
): Promise<T> {
  const trace = startTrace({
    name,
    userId: options.userId,
    metadata: options.metadata,
  });
  const gen = await trace.generation({ name, model, input });
  try {
    const result = await fn();
    await gen.end(typeof result === "string" ? result : JSON.stringify(result).slice(0, 2000));
    await trace.end(result);
    return result;
  } catch (err) {
    await trace.event({ name: "error", data: { message: (err as Error).message } });
    await trace.end(null);
    throw err;
  }
}

export function isTelemetryEnabled(): boolean {
  return ENABLED;
}
