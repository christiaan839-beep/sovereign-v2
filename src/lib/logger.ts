/**
 * SOVEREIGN MATRIX — Structured Logger
 *
 * Replaces raw console.log/error/warn across the codebase.
 * - Production: JSON structured output for log aggregation
 * - Development: Human-readable colored output
 * - Errors at `error` level are also forwarded to Sentry (when SENTRY_DSN
 *   is configured) so production issues surface in the dashboard.
 *
 * Usage:
 *   const log = createLogger("my-module");
 *   log.info("Started", { userId });
 *   log.warn("Retrying", { attempt: 2 });
 *   log.error("Payment failed", { error: err.message });  // → Sentry
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  /** Per-request correlation ID, injected automatically when the call
   *  is inside a runWithRequestContext() scope. */
  requestId?: string;
}

const isProd = process.env.NODE_ENV === "production";
const sentryEnabled = typeof process !== "undefined" && Boolean(process.env.SENTRY_DSN);

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
  // Request ID appears in [brackets] after module — stays out of the
  // way in dev but makes it trivial to grep `grep rId=abc123` when
  // a customer reports an issue.
  const rId = entry.requestId ? ` [rId=${entry.requestId}]` : "";
  return `${prefix} [${entry.module}]${rId} ${entry.message}${dataStr}`;
}

/**
 * Scrub obvious secret-shaped keys from a log data payload before it
 * leaves the server. Complements sentry.server.config.ts's beforeSend
 * (which scrubs request headers + query strings) — this catches
 * application-level log data that a developer might have included
 * without realizing it would reach Sentry.
 */
const SECRET_KEY_PATTERN = /authori[sz]ation|api.?key|secret|token|password|bearer|dsn|signing.?key|webhook.?secret/i;
function scrubSecrets(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (SECRET_KEY_PATTERN.test(k)) {
      out[k] = "<redacted>";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      // One level deep; we don't recurse further to avoid pathological logs.
      out[k] = scrubSecrets(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Forward error-level logs to Sentry when configured. We use dynamic
 * import to keep `@sentry/nextjs` out of bundles that never hit this path
 * and to avoid touching Sentry in environments without the DSN.
 */
async function reportToSentry(entry: LogEntry) {
  if (!sentryEnabled || entry.level !== "error") return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage(entry.message, {
      level: "error",
      tags: { module: entry.module },
      extra: entry.data ? scrubSecrets(entry.data) : {},
    });
  } catch {
    // Sentry optional — never break a request because error reporting failed.
  }
}

function log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>) {
  // Inject the current request ID (if we're inside a request context)
  // so every log line emitted during an agent run can be correlated
  // without the caller threading it through manually. Lazy-import to
  // avoid a circular dep (request-context imports nothing from logger).
  let requestId: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getRequestId } = require("./request-context") as typeof import("./request-context");
    requestId = getRequestId() ?? undefined;
  } catch {
    // request-context is newer than some call sites; never break a log.
  }

  const entry: LogEntry = {
    level,
    module,
    message,
    data,
    timestamp: new Date().toISOString(),
    ...(requestId ? { requestId } : {}),
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case "error":
      console.error(formatted);
      // Fire-and-forget — don't block the caller on Sentry ingestion.
      void reportToSentry(entry);
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
    info: (message: string, data?: Record<string, unknown>) => log("info", module, message, data),
    warn: (message: string, data?: Record<string, unknown>) => log("warn", module, message, data),
    error: (message: string, data?: Record<string, unknown>) => log("error", module, message, data),
    debug: (message: string, data?: Record<string, unknown>) => log("debug", module, message, data),
  };
}

/** Default logger for quick use */
export const logger = createLogger("sovereign");
