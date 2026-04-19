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
  return `${prefix} [${entry.module}] ${entry.message}${dataStr}`;
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
      extra: entry.data ?? {},
    });
  } catch {
    // Sentry optional — never break a request because error reporting failed.
  }
}

function log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    module,
    message,
    data,
    timestamp: new Date().toISOString(),
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
