"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useSovereignEvents — Wave 21 React hook.
 *
 * Subscribes to /api/events (SSE). Returns the running buffer of
 * events (newest first) plus the connection status. Auto-reconnects
 * with exponential backoff on connection loss.
 *
 * Usage:
 *   const { events, status } = useSovereignEvents({
 *     types: ["agent.run.sealed", "agent.token.revoked"],
 *     maxBuffer: 50,
 *   });
 *
 * Set `scope: "*"` (admin only — endpoint enforces) for fleet-wide.
 *
 * SSR safety: no fetch on the server. The `EventSource` is browser-only;
 * the hook noops cleanly during SSR by deferring all work to `useEffect`.
 */

export type SovereignEventType =
  | "agent.run.sealed"
  | "agent.token.issued"
  | "agent.token.revoked"
  | "anomaly.login.flagged"
  | "budget.threshold.crossed"
  | "guardian.verdict.block"
  | "commerce.envelope.issued"
  | "stream.open";

export interface SovereignEvent<T = unknown> {
  id: string;
  type: SovereignEventType;
  tenantId: string | "*";
  emittedAt: string;
  data: T;
}

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "error"
  | "closed";

export interface UseSovereignEventsOptions {
  /** Filter the buffer to these types. Empty = all. */
  types?: SovereignEventType[];
  /** Max buffer size — older events drop off the tail. Default 100. */
  maxBuffer?: number;
  /** Admin-only — request the platform-wide stream. */
  scope?: "tenant" | "*";
  /** Disable the connection without unmounting (useful for pause toggles). */
  enabled?: boolean;
}

export interface UseSovereignEventsResult {
  events: SovereignEvent[];
  status: ConnectionStatus;
  /** Most recent connection error message, if any. */
  lastError: string | null;
}

const MAX_BACKOFF_MS = 30_000;

export function useSovereignEvents(
  opts: UseSovereignEventsOptions = {},
): UseSovereignEventsResult {
  const { types, maxBuffer = 100, scope = "tenant", enabled = true } = opts;

  const [events, setEvents] = useState<SovereignEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  // Refs so the cleanup closure can reach the latest values.
  const sourceRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(1_000);
  const cancelledRef = useRef(false);

  // Track the filter list in a ref so changes don't trigger reconnect.
  const filterRef = useRef<Set<SovereignEventType> | null>(null);
  filterRef.current = types && types.length > 0 ? new Set(types) : null;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    cancelledRef.current = false;

    function connect() {
      if (cancelledRef.current) return;
      const url = scope === "*" ? "/api/events?scope=*" : "/api/events";
      setStatus((s) => (s === "idle" ? "connecting" : "reconnecting"));
      const es = new EventSource(url, { withCredentials: true });
      sourceRef.current = es;

      es.addEventListener("open", () => {
        if (cancelledRef.current) return;
        setStatus("open");
        backoffRef.current = 1_000;
        setLastError(null);
      });

      es.addEventListener("error", (e) => {
        if (cancelledRef.current) return;
        const isClosed = es.readyState === EventSource.CLOSED;
        setStatus(isClosed ? "reconnecting" : "error");
        setLastError(
          (e as Event & { message?: string }).message ?? "SSE connection lost",
        );
        try {
          es.close();
        } catch {
          /* noop */
        }
        sourceRef.current = null;
        // Exponential backoff with cap. Reset on next open.
        const delay = backoffRef.current;
        backoffRef.current = Math.min(MAX_BACKOFF_MS, backoffRef.current * 2);
        setTimeout(connect, delay);
      });

      // Generic 'message' handler — covers every named event the
      // server emits. The server uses `event: <type>` lines, so each
      // type can also be listened to individually. We use the generic
      // handler and dispatch from the parsed JSON's `type` field.
      const onAnyEvent = (e: MessageEvent) => {
        if (cancelledRef.current) return;
        try {
          const evt = JSON.parse(e.data) as SovereignEvent;
          if (filterRef.current && !filterRef.current.has(evt.type)) return;
          setEvents((prev) => {
            const next = [evt, ...prev];
            return next.length > maxBuffer ? next.slice(0, maxBuffer) : next;
          });
        } catch {
          // Malformed frame — server bug or a stray ping. Skip.
        }
      };

      // The browser routes named events via `addEventListener(<type>)`;
      // we register handlers for every known type.
      const KNOWN_TYPES: SovereignEventType[] = [
        "agent.run.sealed",
        "agent.token.issued",
        "agent.token.revoked",
        "anomaly.login.flagged",
        "budget.threshold.crossed",
        "guardian.verdict.block",
        "commerce.envelope.issued",
        "stream.open",
      ];
      for (const t of KNOWN_TYPES) {
        es.addEventListener(t, onAnyEvent as EventListener);
      }
    }

    connect();

    return () => {
      cancelledRef.current = true;
      if (sourceRef.current) {
        try {
          sourceRef.current.close();
        } catch {
          /* noop */
        }
        sourceRef.current = null;
      }
      setStatus("closed");
    };
  }, [enabled, scope, maxBuffer]);

  return { events, status, lastError };
}
