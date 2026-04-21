/**
 * INSTRUMENTATION — Next.js server startup hook
 *
 * Responsibilities:
 *   1. Wire up Sentry per runtime (nodejs / edge). The config files at the
 *      project root do nothing until imported here — Next.js 16 moved from
 *      auto-loading sentry.*.config.ts to requiring an explicit register() call.
 *   2. On Railway (persistent Node.js server): start background intervals
 *      that ping cron endpoints to process the async job queue.
 *   3. On Vercel (serverless): register() is called but setInterval is a
 *      no-op — Vercel crons in vercel.json handle scheduling instead.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // ── Env validation — runs before anything else so misconfigured boots
  // fail loud with a readable error, not mid-request with mystery undefined.
  // In dev it warns; in prod it throws and prevents the server from serving.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnv } = await import("@/lib/env");
    assertEnv();
  }

  // ── Sentry wiring (runs on every runtime; each config no-ops if DSN missing) ──
  // Dynamic imports keep the edge bundle from pulling in Node-only sentry code.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }

  // ── Background loop — Railway only ──
  // Only run the background loop on Railway (persistent server, not edge/serverless)
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
