/**
 * INSTRUMENTATION — Next.js server startup hook
 *
 * On Railway (persistent Node.js server): starts background intervals that ping
 * the cron endpoints to process the async job queue and fire scheduled playbooks.
 *
 * On Vercel (serverless): register() is still called but setInterval
 * is a no-op — Vercel crons in vercel.json handle scheduling instead.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
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
