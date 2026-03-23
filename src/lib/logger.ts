/**
 * SOVEREIGN MATRIX — Structured Logger
 *
 * Replaces raw console.log/error/warn across the codebase.
 * - Production: JSON structured output for log aggregation
 * - Development: Human-readable colored output
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
