/**
 * SAFE JSON PARSING — never throw, always return something usable.
 *
 * Why this exists:
 *   We have JSON-blob columns (settings.apiKeys, settings.config,
 *   subscriptions.metadata, etc.) that get parsed on every read.
 *   Direct JSON.parse() on those columns has two failure modes:
 *
 *     1. The column is null/undefined (new user, freshly migrated row)
 *        — JSON.parse(null) returns null which doesn't spread into
 *        the existing `{ ...oldKeys }` patterns.
 *     2. The column is a corrupt string (network truncation during
 *        an earlier write, a manual SQL fix gone wrong, an older
 *        version that wrote an invalid shape) — JSON.parse throws.
 *        The outer try/catch in the route catches it and returns 500,
 *        but the user gets stuck: every subsequent SAVE attempt also
 *        loads the corrupt row first and fails before it can overwrite.
 *
 * Both modes are now non-fatal: corrupt or missing data is treated as
 * an empty object, the next write overwrites the corruption, and the
 * user becomes unstuck.
 *
 * Anti-pattern this replaces:
 *
 *     const old = row.apiKeys ? JSON.parse(row.apiKeys) : {};
 *
 * Replace with:
 *
 *     const old = safeJsonParseObject(row.apiKeys);
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("safe-json");

/**
 * Parse a JSON string, returning a plain object on success or `{}` on
 * failure (null input, undefined input, malformed JSON, non-object
 * top-level value like `null` or `42`).
 *
 * The result is always a fresh, mutable plain object so callers can
 * spread/extend it without aliasing.
 *
 * On parse failure we log a warning (sample down — corrupt rows tend
 * to come in waves) so ops can investigate without spamming alerts.
 *
 * @param raw   JSON-encoded string from a DB column or external API.
 * @param ctx   Optional context tag for the warning log (e.g.,
 *              "settings.apiKeys") — makes it easy to find which row
 *              shape is corrupt.
 */
export function safeJsonParseObject<T extends Record<string, unknown> = Record<string, unknown>>(
  raw: string | null | undefined,
  ctx?: string,
): T {
  if (raw == null || raw === "") return {} as T;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
    // Top-level was a primitive or array — not the object we expected.
    log.warn("safeJsonParseObject: top-level value not an object", {
      ctx: ctx ?? "(unspecified)",
      kind: Array.isArray(parsed) ? "array" : typeof parsed,
    });
    return {} as T;
  } catch (err) {
    log.warn("safeJsonParseObject: parse failed — treating as empty", {
      ctx: ctx ?? "(unspecified)",
      error: (err as Error).message,
    });
    return {} as T;
  }
}

/**
 * Same idea but for arrays — parse a JSON string expected to encode
 * an array, return [] on any failure mode.
 */
export function safeJsonParseArray<T = unknown>(
  raw: string | null | undefined,
  ctx?: string,
): T[] {
  if (raw == null || raw === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as T[];
    log.warn("safeJsonParseArray: top-level value not an array", {
      ctx: ctx ?? "(unspecified)",
      kind: typeof parsed,
    });
    return [];
  } catch (err) {
    log.warn("safeJsonParseArray: parse failed — treating as empty", {
      ctx: ctx ?? "(unspecified)",
      error: (err as Error).message,
    });
    return [];
  }
}
