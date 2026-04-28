/**
 * NODE-ONLY half of the agent execution trace.
 *
 * Same Edge-vs-Node split pattern as request-context-node.ts,
 * a2e-depth-node.ts. Imports `node:async_hooks` which doesn't
 * exist on Edge or in client bundles, so this file is gated to
 * server-only entry points (instrumentation.ts).
 *
 * The Edge fallback (per-instance counter) lives in agent-trace.ts.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import {
  installAgentTraceStore,
  type TraceContext,
  type TraceStore,
  type TraceOutcome,
  MAX_SPANS_PER_TRACE,
} from "./agent-trace";

let installed = false;

export function setupAgentTraceStore(): void {
  if (installed) return;
  installed = true;

  const als = new AsyncLocalStorage<TraceContext>();
  const store: TraceStore = {
    current(): TraceContext | null {
      return als.getStore() ?? null;
    },
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
      try {
        const result = await als.run(trace, fn);
        return { result, trace };
      } catch (error) {
        return { error, trace };
      }
    },
  };
  installAgentTraceStore(store);
}

setupAgentTraceStore();

function cryptoRandomId(): string {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const buf = new Uint8Array(16);
    globalThis.crypto.getRandomValues(buf);
    return Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}
