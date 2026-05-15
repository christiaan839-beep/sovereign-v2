/**
 * SOVEREIGN MATRIX — Streaming-everywhere helper (Cook 113).
 *
 * Wraps any long-running agent producer in the Cook 39 SSE primitive
 * with a stable lifecycle:
 *
 *   - emit progress events at key stages
 *   - emit token events while the model streams
 *   - emit tool events for every Cook 36 dispatch
 *   - emit a final done event with the signed receipt id
 *
 * Pure composition over Cook 39 — no new I/O. Adopting this in
 * a route is a 5-line wrap.
 */

import {
  buildSSE,
  doneEvent,
  errorEvent,
  progressEvent,
  tokenEvent,
  type StreamEvent,
} from "@/lib/streaming";

// ── Public types ──────────────────────────────────────────────────────────

export interface AgentStreamContext {
  emit: (ev: StreamEvent) => void;
  isAborted: () => boolean;
  /** Convenience helpers — caller can use these instead of emit(). */
  token: (value: string) => void;
  progress: (step: string, label?: string) => void;
  tool: (payload: Record<string, unknown>) => void;
  done: (payload: Record<string, unknown>) => void;
}

export type AgentStreamProducer = (ctx: AgentStreamContext) => Promise<void>;

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Wrap a streaming agent producer in an SSE response.
 *
 * Lifecycle:
 *   1. Emits `progress: "1/4" "start"` immediately so the client
 *      sees the connection is alive.
 *   2. Caller streams tokens / tool events / progress.
 *   3. Final `done` event carries the receipt id + summary.
 *   4. Any unhandled throw becomes a structured `error` frame.
 */
export function streamAgentResponse(
  produce: AgentStreamProducer,
  options?: { signal?: AbortSignal },
): Response {
  const stream = buildSSE(async (emit, isAborted) => {
    const ctx: AgentStreamContext = {
      emit,
      isAborted,
      token: (value: string) => emit({ event: "token", data: { value } }),
      progress: (step: string, label?: string) =>
        emit({ event: "progress", data: { step, label } }),
      tool: (payload: Record<string, unknown>) =>
        emit({ event: "tool", data: payload }),
      done: (payload: Record<string, unknown>) =>
        emit({ event: "done", data: payload }),
    };

    // Heartbeat: emit progress immediately so the client buffer flushes.
    ctx.progress("1/4", "stream-opened");

    await produce(ctx);
  }, options);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Tiny helper that converts a token-producing async iterator into a
 * sequence of SSE events. Use this when the agent's model returns
 * an `AsyncIterable<string>` (Vercel AI SDK, Anthropic SDK stream).
 */
export async function pipeTokens(
  ctx: AgentStreamContext,
  iter: AsyncIterable<string>,
): Promise<string> {
  let buffer = "";
  for await (const token of iter) {
    if (ctx.isAborted()) return buffer;
    buffer += token;
    ctx.token(token);
  }
  return buffer;
}

/** Re-exports so callers don't need to import both modules. */
export { progressEvent, doneEvent, errorEvent, tokenEvent };
