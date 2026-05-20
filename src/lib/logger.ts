/**
 * SOVEREIGN MATRIX — Structured Logger
 *
 * Replaces raw console.log/error/warn across the codebase.
 * - Production: JSON structured output for log aggregation
 * - Development: Human-readable colored output
 *
 * Wave-107 PII REDACTION:
 *   The `data` object passed to log() is recursively scrubbed before
 *   emission. Sensitive keys (email/password/token/secret/api_key/
 *   authorization/cookie/etc.) are replaced with a `[REDACTED]` marker.
 *   String VALUES that look like emails or API keys are also masked
 *   regardless of key name — defends against developer mistakes where
 *   a raw user object is logged under a benign-looking key.
 *   The audit found logger calls passing raw email/key payloads from
 *   `byok/route.ts`, `data-export/route.ts`, `webhooks/clerk/route.ts`,
 *   and `_email/unsubscribe/route.ts`. All flow through this redactor.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

const isProd = process.env.NODE_ENV === "production";

// ── Wave-107 PII REDACTION ────────────────────────────────────────────────────

/**
 * Keys whose VALUES are always sensitive — replaced wholesale with
 * `[REDACTED]`. Two tiers of matching:
 *
 *  - SUBSTRING tier: terms that are uniquely sensitive in any field
 *    name containing them. `password` / `secret` / `token` / etc.
 *  - EXACT tier: terms that are sensitive when they ARE the field
 *    name (with common variants) but get over-redacted by substring
 *    match. e.g. `email` is sensitive, but `email_template_name`,
 *    `email_open_count`, `welcome_email_sent_at` are business
 *    telemetry that the content-machine + sequence engine need in
 *    logs for debugging.
 *
 * Wave-107.1 fix: prevent operators from setting LOG_LEVEL=debug to
 * work around over-redaction (which would defeat the entire layer).
 * The fail-closed bias is preserved — anything ambiguous redacts;
 * the exact-tier just enumerates known business variants.
 */
const REDACT_KEY_SUBSTRINGS: readonly string[] = [
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "session",
  "private_key",
  "privatekey",
  "client_secret",
  "webhook_secret",
  "bearer",
  "stripe_signature",
  "svix",
  "ssn",
  "national_id",
  "card_number",
  "cardnumber",
  "cvv",
];

/**
 * Exact-match (case-insensitive) sensitive field names. Enumerates the
 * known variants used in BYOK callers, Clerk webhook payloads, audit
 * findings, and DSAR/export flows.
 */
const REDACT_KEY_EXACT: ReadonlySet<string> = new Set([
  "email",
  "user_email",
  "useremail",
  "to_email",
  "from_email",
  "email_address",
  "emailaddress",
  "email_addresses",
  "emailaddresses",
  "phone",
  "phone_number",
  "phonenumber",
  "phone_numbers",
  "phonenumbers",
  "ip",
  "ip_address",
  "ipaddress",
  "remote_addr",
  "remoteaddr",
]);

/** Regex patterns over string VALUES (independent of key name). */
const VALUE_REDACTORS: ReadonlyArray<{ pattern: RegExp; replace: string }> = [
  // Email — coarse but covers the common case
  {
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    replace: "[email]",
  },
  // sk_ / pk_ / Bearer-style API tokens (Stripe, Clerk, OpenAI, etc.)
  {
    pattern:
      /\b(?:sk|pk|whsec|rk|cs|sb|nvapi|tvly|gh[oprsu])_[A-Za-z0-9_]{16,}/g,
    replace: "[token]",
  },
  // JWT-shape token (three dot-separated base64url segments)
  {
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replace: "[jwt]",
  },
  // Long opaque hex/base64 secret-looking strings. Wave-107.1: bumped
  // from 48 → 64 chars to reduce false positives on signed S3 URLs,
  // base64 image previews, request IDs, and audit-log hashes. True
  // secrets (Anthropic/Google API keys, long JWTs) are well above 64.
  // The earlier `sk_/pk_/whsec_/eyJ` matchers run FIRST so this is
  // just the safety net for unknown-prefix tokens.
  {
    pattern: /\b[A-Za-z0-9_+/=-]{64,}\b/g,
    replace: "[opaque]",
  },
];

function keyIsSensitive(key: string): boolean {
  const lower = key.toLowerCase();
  if (REDACT_KEY_EXACT.has(lower)) return true;
  for (const p of REDACT_KEY_SUBSTRINGS) {
    if (lower.includes(p)) return true;
  }
  return false;
}

function redactString(s: string): string {
  let out = s;
  for (const r of VALUE_REDACTORS) {
    out = out.replace(r.pattern, r.replace);
  }
  return out;
}

/**
 * Recursive redactor with cycle protection. Exported for tests so the
 * exact contract (key matching + value matching + depth) is pinned.
 *
 * Visited-set guards against circular references in `data` — without
 * it, a self-referencing object would stack-overflow the logger.
 */
export function redactPii(
  value: unknown,
  depth = 0,
  visited: WeakSet<object> = new WeakSet(),
): unknown {
  if (depth > 12) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactPii(v, depth + 1, visited));
  }
  if (typeof value === "object") {
    if (visited.has(value)) return "[circular]";
    visited.add(value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = keyIsSensitive(k)
        ? "[REDACTED]"
        : redactPii(v, depth + 1, visited);
    }
    return out;
  }
  // Functions, symbols, etc. — drop to safe placeholder
  return `[${typeof value}]`;
}

function formatEntry(entry: LogEntry): string {
  if (isProd) {
    return JSON.stringify(entry);
  }
  const prefix = {
    info: "[INFO]",
    warn: "[WARN]",
    error: "[ERROR]",
    debug: "[DEBUG]",
  }[entry.level];
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
  return `${prefix} [${entry.module}] ${entry.message}${dataStr}`;
}

function log(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>,
) {
  // Wave-107: scrub PII before the entry is serialised. Also scrub the
  // message itself (e.g. `logger.info("processing user@example.com")`
  // would otherwise leak the email even if the data object was clean).
  const redactedData = data
    ? (redactPii(data) as Record<string, unknown>)
    : undefined;
  const entry: LogEntry = {
    level,
    module,
    message: redactString(message),
    data: redactedData,
    timestamp: new Date().toISOString(),
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "debug":
      if (!isProd) console.debug(formatted);
      break;
    default:
      if (!isProd) console.log(formatted);
      break;
  }
}

/** Create a logger scoped to a module */
export function createLogger(module: string) {
  return {
    info: (message: string, data?: Record<string, unknown>) =>
      log("info", module, message, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      log("warn", module, message, data),
    error: (message: string, data?: Record<string, unknown>) =>
      log("error", module, message, data),
    debug: (message: string, data?: Record<string, unknown>) =>
      log("debug", module, message, data),
  };
}

/** Default logger for quick use */
export const logger = createLogger("sovereign");
