/**
 * INSTRUMENTATION — Next.js server startup hook
 *
 * Runs three jobs at boot:
 *   1. Initialize Sentry SDK on whichever runtime is booting
 *      (server config for Node, edge config for the Edge runtime).
 *      Sentry stays a no-op when SENTRY_DSN is unset (dev / preview).
 *   2. On Railway (persistent Node), start background intervals that
 *      ping the cron endpoints. On Vercel (serverless), this branch
 *      is a no-op — vercel.json crons handle scheduling.
 *   3. Export `onRequestError` so Next.js automatically pipes API
 *      route errors to Sentry without per-route try/catch.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }

  // Background loop: only on Railway (persistent server, not edge/serverless)
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL) return;
  if (!process.env.CRON_SECRET || !process.env.NEXT_PUBLIC_APP_URL) return;

  const ping = async (path: string, timeout = 25_000) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${path}`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        signal: AbortSignal.timeout(timeout),
      });
    } catch {
      // Silently swallow — failures are self-healing on next tick
    }
  };

  // Wait 10s for the server to fully boot before starting
  setTimeout(() => {
    // Job queue: every 30s
    ping("/api/cron/job-runner");
    setInterval(() => ping("/api/cron/job-runner"), 30_000);

    // Playbook scheduler: every 5 min
    ping("/api/cron/playbook-scheduler", 15_000);
    setInterval(() => ping("/api/cron/playbook-scheduler", 15_000), 5 * 60_000);
  }, 10_000);
}

/**
 * Pipes uncaught API-route errors into Sentry with full request context.
 * Required by @sentry/nextjs ≥ 8 to capture server-side errors.
 */
export const onRequestError = Sentry.captureRequestError;
