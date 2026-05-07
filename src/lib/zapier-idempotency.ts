/**
 * Zapier idempotency key derivation.
 *
 * Extracted from `src/app/api/_webhooks/zapier/route.ts` so the
 * derivation logic is unit-testable without spinning up a real
 * Request. The route imports this helper and uses the returned
 * key as the `eventId` arg to `alreadyProcessed()`.
 *
 * Two-tier strategy:
 *
 *   1. PREFERRED — `Idempotency-Key` request header. Standard REST
 *      idempotency convention. We document it in the Zapier app
 *      manifest so the trigger sets it from the Zap step id.
 *
 *   2. FALLBACK — SHA-256 of `userId:rawBody`. Catches retries
 *      that replay the same payload from the same authenticated
 *      key within the dedup TTL. The userId scope prevents two
 *      separate customers with structurally identical payloads
 *      from colliding (false-positive duplicate).
 *
 *   3. NULL — when neither path produces a key (anonymous request
 *      or pathological empty body). Caller skips dedup.
 */

import crypto from "crypto";

export interface ZapierIdemKeyArgs {
  /** Header bag from the inbound Request. Pass `req.headers.get`. */
  getHeader: (name: string) => string | null;
  /** Raw request body — must be the same buffer we'll JSON.parse. */
  rawBody: string;
  /** Authenticated userId from the API key lookup. Optional. */
  userId: string | undefined;
}

/** Truncate header keys to a sane max so a 4 KB attacker-supplied
 *  Idempotency-Key can't blow up the cache layer's key size. */
const MAX_HEADER_KEY_LEN = 200;

export function computeZapierIdemKey(args: ZapierIdemKeyArgs): string | null {
  const headerKey = args.getHeader("idempotency-key");
  if (headerKey && headerKey.trim().length > 0) {
    return headerKey.trim().slice(0, MAX_HEADER_KEY_LEN);
  }
  if (!args.userId) return null;
  // Body hash — the userId scope prevents structurally-identical
  // payloads from two different tenants from colliding.
  return crypto
    .createHash("sha256")
    .update(`${args.userId}:${args.rawBody}`)
    .digest("hex");
}
