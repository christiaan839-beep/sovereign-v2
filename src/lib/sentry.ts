/**
 * Sentry wrapper — typed helpers for capturing exceptions with
 * structured context.
 *
 * Why a wrapper instead of `import * as Sentry from "@sentry/nextjs"`
 * everywhere:
 *
 *   1. Force the call sites to pass structured context (agent name,
 *      user id, request id) instead of raw error objects. Without
 *      structure, Sentry pages are unsearchable noise.
 *   2. No-op gracefully when `SENTRY_DSN` is unset — `Sentry.init`
 *      bails out in that case, but every `Sentry.captureException`
 *      still runs. The wrapper short-circuits to a single warn-level
 *      log line so dev environments don't spam the console.
 *   3. One place to swap if we ever migrate away from Sentry
 *      (Datadog, Grafana, OpenTelemetry, etc).
 *
 * Sentry init lives in `sentry.{client,server,edge}.config.ts` at
 * the project root — those run automatically; this file is the
 * runtime API.
 */

import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";

const log = createLogger("sentry");

export interface ErrorContext {
  /** Agent slug, route name, cron name — the immediate caller. */
  module: string;
  /** Free-form action verb (e.g. "execute-agent", "verify-webhook"). */
  action?: string;
  /** Authenticated user id, when available. */
  userId?: string;
  /** Tenant id from the multi-tenant resolver, when available. */
  tenantId?: string;
  /** Request id from the route, for cross-referencing logs. */
  requestId?: string;
  /** Anything else worth indexing. Kept compact — fewer than 10 keys. */
  extra?: Record<string, unknown>;
  /** Override the default error severity. */
  severity?: "fatal" | "error" | "warning" | "info";
}

const dsnConfigured = !!process.env.SENTRY_DSN;

/**
 * Capture an exception with structured context. Always logs locally
 * via the project logger so dev sessions and Vercel logs preserve
 * the same trail Sentry sees.
 *
 *   try {
 *     await stripe.subscriptions.update(id, { ... });
 *   } catch (err) {
 *     captureException(err, {
 *       module: "paypal-webhook",
 *       action: "activate-subscription",
 *       userId,
 *       extra: { subscriptionId: id, planId },
 *     });
 *     return NextResponse.json({ error: "..." }, { status: 500 });
 *   }
 */
export function captureException(err: unknown, context: ErrorContext): void {
  const message =
    err instanceof Error ? err.message : String(err ?? "unknown error");
  const stack = err instanceof Error ? err.stack : undefined;

  // Local log first — survives even if Sentry is misconfigured.
  log.error(`[${context.module}] ${context.action ?? ""}: ${message}`, {
    userId: context.userId,
    tenantId: context.tenantId,
    requestId: context.requestId,
    stack: stack?.split("\n").slice(0, 3).join("\n"),
    ...context.extra,
  });

  if (!dsnConfigured) return;

  try {
    Sentry.withScope((scope) => {
      scope.setTag("module", context.module);
      if (context.action) scope.setTag("action", context.action);
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.tenantId) scope.setTag("tenant_id", context.tenantId);
      if (context.requestId) scope.setTag("request_id", context.requestId);
      if (context.extra) {
        for (const [k, v] of Object.entries(context.extra)) {
          scope.setExtra(k, v);
        }
      }
      if (context.severity) scope.setLevel(context.severity);
      Sentry.captureException(err);
    });
  } catch {
    // Never let Sentry's own failure shadow the original error.
  }
}

/**
 * Capture a non-error message (e.g. unusual but recoverable state).
 * Use sparingly — Sentry's free tier has a 5k events/month cap.
 */
export function captureMessage(message: string, context: ErrorContext): void {
  log.warn(`[${context.module}] ${context.action ?? ""}: ${message}`, {
    userId: context.userId,
    tenantId: context.tenantId,
    requestId: context.requestId,
    ...context.extra,
  });

  if (!dsnConfigured) return;

  try {
    Sentry.withScope((scope) => {
      scope.setTag("module", context.module);
      if (context.action) scope.setTag("action", context.action);
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.tenantId) scope.setTag("tenant_id", context.tenantId);
      if (context.extra) {
        for (const [k, v] of Object.entries(context.extra)) {
          scope.setExtra(k, v);
        }
      }
      scope.setLevel(context.severity ?? "warning");
      Sentry.captureMessage(message);
    });
  } catch {
    /* ignore */
  }
}

/** True iff `SENTRY_DSN` is configured at startup. UI surfaces use it. */
export function isSentryConfigured(): boolean {
  return dsnConfigured;
}
