/**
 * SOVEREIGN MATRIX — withTimeout + safeFetch (Wave 24).
 *
 * Uniform timeout / abort wrapper for external calls. Every raw
 * `fetch(...)` in the codebase that talks to an external API should
 * route through `safeFetch` so we get:
 *
 *   1. A bounded wall-clock deadline (default 10s; per-call override).
 *   2. An AbortController-backed cancellation that surfaces upstream.
 *   3. A typed Result envelope — `{ ok: true, value }` or
 *      `{ ok: false, error: "timeout" | "network" | "abort" }` —
 *      so call sites can dispatch on the failure mode without
 *      `instanceof DOMException` gymnastics.
 *   4. A structured log line on every failure for SRE triage.
 *
 * Pure module. No DB, no config. The default timeout is configurable
 * per-call via the `ms` option; the hard ceiling is 60 seconds so
 * a buggy call site can never hang the request indefinitely.
 *
 * Pairs with circuit-breaker.ts (provider-level breakers) and
 * retry.ts (idempotent retry wrapper) — those wrap the call,
 * withTimeout bounds it.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("with-timeout");

const HARD_CEILING_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 10_000;

export type TimeoutResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "timeout" | "aborted" | "error"; error?: unknown };

/**
 * Run `work` with a wall-clock deadline. Returns a tagged result; the
 * caller dispatches on `reason`. If `work` throws, the throw is caught
 * and surfaced as `{ ok: false, reason: "error", error }` — no
 * exceptions leak out.
 *
 * `signal` is optional — if the caller already holds an AbortController,
 * we forward aborts to the work function. The internal timeout signal
 * runs in parallel; whichever fires first wins.
 */
export async function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  opts: { ms?: number; signal?: AbortSignal; label?: string } = {},
): Promise<TimeoutResult<T>> {
  const ms = Math.max(
    1,
    Math.min(HARD_CEILING_MS, opts.ms ?? DEFAULT_TIMEOUT_MS),
  );
  const ctl = new AbortController();
  const t = setTimeout(
    () => ctl.abort(new Error("withTimeout: deadline exceeded")),
    ms,
  );

  // Forward caller-provided abort to our internal controller so the
  // work function sees a single, unified signal.
  if (opts.signal) {
    if (opts.signal.aborted) ctl.abort();
    else
      opts.signal.addEventListener("abort", () => ctl.abort(), { once: true });
  }

  try {
    const value = await work(ctl.signal);
    return { ok: true, value };
  } catch (err) {
    if (ctl.signal.aborted) {
      // Disambiguate: caller-aborted vs deadline-aborted.
      const reason: "timeout" | "aborted" = opts.signal?.aborted
        ? "aborted"
        : "timeout";
      log.warn("withTimeout fired", {
        label: opts.label ?? "anonymous",
        reason,
        ms,
      });
      return { ok: false, reason, error: err };
    }
    log.warn("withTimeout work threw", {
      label: opts.label ?? "anonymous",
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "error", error: err };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Bounded fetch helper. Returns a `TimeoutResult<Response>` — the
 * caller still needs to inspect `value.ok` for non-2xx responses,
 * but timeouts and network errors land in the tagged failure path.
 *
 * Usage:
 *   const r = await safeFetch("https://api.x/y", { ms: 5000 });
 *   if (!r.ok) return ...;            // timeout / abort / network
 *   if (!r.value.ok) return ...;      // HTTP error
 *   const body = await r.value.json();
 */
export async function safeFetch(
  url: string,
  init: RequestInit & { ms?: number; label?: string } = {},
): Promise<TimeoutResult<Response>> {
  const { ms, label, signal: _ignored, ...rest } = init;
  void _ignored;
  return withTimeout((signal) => fetch(url, { ...rest, signal }), {
    ms,
    signal: init.signal ?? undefined,
    label: label ?? url,
  });
}
