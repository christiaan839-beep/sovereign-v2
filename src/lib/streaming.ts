/**
 * SOVEREIGN MATRIX — SSE streaming (Cook 39 / Tier 1 #4)
 *
 * Server-Sent Events helper for long-running agents. Today the
 * default model is "wait 30s → blob". Streaming makes it perceived
 * 5× faster: the client sees tokens land as they're generated.
 *
 * Event contract:
 *
 *   event: token       data: {"value":"the next chunk"}
 *   event: progress    data: {"step":"1/3","label":"safety check"}
 *   event: tool        data: <ToolCallResult shape from tool-registry>
 *   event: done        data: {"finalAnswer":"...", "receipt":{...}}
 *   event: error       data: {"message":"..."}
 *
 * The encoder is a thin Response-builder; the runtime is whatever
 * Next.js gives us (Node or Edge). We avoid framework-specific
 * helpers so the same module works in both runtimes.
 */

// ── Event encoding ────────────────────────────────────────────────────────

const TEXT_ENCODER = new TextEncoder();

/** Stable event names — kept short to minimize per-frame overhead. */
export type StreamEventName = "token" | "progress" | "tool" | "done" | "error";

export interface StreamEvent {
  event: StreamEventName;
  data: unknown;
  /** Optional message id for client-side resumption. */
  id?: string;
}

/**
 * Encode a single SSE frame as bytes. The format is two lines per
 * field (event:, data:, optional id:) followed by a BLANK LINE — the
 * blank line is what flushes the event to the client.
 */
export function encodeEvent(ev: StreamEvent): Uint8Array {
  const lines: string[] = [`event: ${ev.event}`];
  if (ev.id) lines.push(`id: ${ev.id}`);
  // data: lines are JSON. Multi-line strings need per-line "data: " prefix
  // per the SSE spec; using JSON.stringify guarantees a single line.
  lines.push(`data: ${JSON.stringify(ev.data)}`);
  lines.push("", ""); // blank line + trailing \n
  return TEXT_ENCODER.encode(lines.join("\n"));
}

/** Convenience: encode a token event. */
export const tokenEvent = (value: string): Uint8Array =>
  encodeEvent({ event: "token", data: { value } });

/** Convenience: encode a progress event. */
export const progressEvent = (step: string, label?: string): Uint8Array =>
  encodeEvent({ event: "progress", data: { step, label } });

/** Convenience: encode a done event. */
export const doneEvent = (payload: Record<string, unknown>): Uint8Array =>
  encodeEvent({ event: "done", data: payload });

/** Convenience: encode an error event. */
export const errorEvent = (message: string): Uint8Array =>
  encodeEvent({ event: "error", data: { message } });

// ── Stream builders ───────────────────────────────────────────────────────

/** Headers required for an SSE response to survive proxies + caches. */
export const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disable nginx buffering — it would hold frames back until N bytes accumulate.
  "X-Accel-Buffering": "no",
};

/**
 * Build a ReadableStream from a producer. The producer receives an
 * emit() function and an isAborted() probe, and runs to completion;
 * the helper handles encoding, error frames, and stream close.
 */
export function buildSSE(
  produce: (
    emit: (ev: StreamEvent) => void,
    isAborted: () => boolean,
  ) => Promise<void>,
  options?: { signal?: AbortSignal },
): ReadableStream<Uint8Array> {
  let aborted = false;
  if (options?.signal) {
    if (options.signal.aborted) aborted = true;
    options.signal.addEventListener("abort", () => {
      aborted = true;
    });
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: StreamEvent) => {
        if (aborted) return;
        controller.enqueue(encodeEvent(ev));
      };
      try {
        await produce(emit, () => aborted);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        try {
          controller.enqueue(errorEvent(message));
        } catch {
          /* controller may already be closed */
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* idempotent close */
        }
      }
    },
  });
}

/**
 * Build a Response that streams the supplied producer. Sets the
 * required SSE headers and wires the request's abort signal through
 * so the producer can stop when the client disconnects.
 */
export function streamResponse(
  produce: (
    emit: (ev: StreamEvent) => void,
    isAborted: () => boolean,
  ) => Promise<void>,
  options?: { signal?: AbortSignal },
): Response {
  return new Response(buildSSE(produce, options), { headers: SSE_HEADERS });
}

// ── Parser (for tests + clients) ──────────────────────────────────────────

/**
 * Parse a raw SSE byte/text stream into discrete events. Lossy by
 * design — frames missing the trailing blank line are dropped (per spec).
 */
export function parseEvents(raw: string): StreamEvent[] {
  const frames = raw.split("\n\n").filter((f) => f.trim().length > 0);
  const out: StreamEvent[] = [];
  for (const frame of frames) {
    let event: StreamEventName | null = null;
    let id: string | undefined;
    const dataLines: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim() as StreamEventName;
      } else if (line.startsWith("id:")) {
        id = line.slice(3).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (!event || dataLines.length === 0) continue;
    let data: unknown = null;
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      data = dataLines.join("\n");
    }
    out.push({ event, data, ...(id ? { id } : {}) });
  }
  return out;
}
