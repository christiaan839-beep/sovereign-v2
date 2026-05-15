/**
 * SOVEREIGN MATRIX — Idempotency middleware (Cook 103).
 *
 * Wraps any handler with replay-protection keyed on a caller-supplied
 * `Idempotency-Key` header (RFC-style). Composes with the existing
 * Cook 47 `alreadyProcessed` primitive — this module is the
 * route-layer adapter that callers wrap around `/api/credits`,
 * `/api/marketplace/listings`, and every webhook handler.
 *
 * Behaviour:
 *
 *   1. Caller passes `Idempotency-Key: <random-uuid>` on every write.
 *   2. Server fingerprints (route + key + bodyDigest).
 *   3. First call runs the handler + caches the response (status+body).
 *   4. Subsequent calls with the SAME fingerprint return the cached
 *      response — never re-runs the handler.
 *   5. If the same key is reused with a DIFFERENT body, we return 409.
 *
 * In-memory store; swap to KV / Redis when scale demands.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface CachedResponse {
  status: number;
  body: string;
  /** Content-type the caller emitted. */
  contentType: string;
  /** Hex SHA-256 of the request body that produced this response. */
  bodyDigest: string;
  createdAt: number;
}

export type IdempotencyOutcome =
  | { kind: "new"; fingerprint: string }
  | { kind: "replay"; cached: CachedResponse }
  | { kind: "conflict"; reason: string };

// ── Store ─────────────────────────────────────────────────────────────────

const STORE = new Map<string, CachedResponse>();

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function _resetForTests(): void {
  STORE.clear();
}

// ── Helpers ───────────────────────────────────────────────────────────────

function digest(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

function fingerprint(route: string, key: string): string {
  return createHash("sha256").update(`${route}|${key}`).digest("hex");
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Pre-call check. Returns:
 *   - `new` when no record exists for (route, key) — caller should
 *     proceed to run the handler and then call `recordResponse`.
 *   - `replay` when an identical body has been seen — caller returns
 *     the cached response verbatim.
 *   - `conflict` when the same key was reused with a different body —
 *     caller returns 409.
 *
 * Empty / missing keys count as "no idempotency" and always return
 * `new` — opt-in at the call site.
 */
export function check(
  route: string,
  idempotencyKey: string | null | undefined,
  body: string,
  now: number = Date.now(),
): IdempotencyOutcome {
  if (!idempotencyKey) return { kind: "new", fingerprint: "" };
  const fp = fingerprint(route, idempotencyKey);
  const cached = STORE.get(fp);
  if (!cached) return { kind: "new", fingerprint: fp };
  if (cached.createdAt + DEFAULT_TTL_MS < now) {
    STORE.delete(fp);
    return { kind: "new", fingerprint: fp };
  }
  if (cached.bodyDigest !== digest(body)) {
    return {
      kind: "conflict",
      reason: `Idempotency-Key reused with a different body`,
    };
  }
  return { kind: "replay", cached };
}

/**
 * Cache a handler response under the supplied fingerprint. Caller
 * passes the `fingerprint` from the previous `check()` call.
 */
export function recordResponse(
  fingerprint: string,
  body: string,
  response: { status: number; body: string; contentType: string },
  now: number = Date.now(),
): void {
  if (!fingerprint) return; // opt-out path
  STORE.set(fingerprint, {
    status: response.status,
    body: response.body,
    contentType: response.contentType,
    bodyDigest: digest(body),
    createdAt: now,
  });
}

/**
 * Tiny wrapper that ties check + recordResponse around an async
 * handler. Used by routes for a one-line opt-in.
 */
export async function withIdempotency(
  route: string,
  req: Request,
  handler: (
    body: string,
  ) => Promise<{ status: number; body: string; contentType?: string }>,
): Promise<Response> {
  const idem = req.headers.get("Idempotency-Key");
  const bodyText = await req.text();
  const outcome = check(route, idem, bodyText);
  if (outcome.kind === "replay") {
    return new Response(outcome.cached.body, {
      status: outcome.cached.status,
      headers: {
        "Content-Type": outcome.cached.contentType,
        "X-Sovereign-Replay": "true",
      },
    });
  }
  if (outcome.kind === "conflict") {
    return new Response(JSON.stringify({ error: outcome.reason }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }
  const result = await handler(bodyText);
  const contentType = result.contentType ?? "application/json";
  recordResponse(outcome.fingerprint, bodyText, {
    status: result.status,
    body: result.body,
    contentType,
  });
  return new Response(result.body, {
    status: result.status,
    headers: { "Content-Type": contentType },
  });
}
