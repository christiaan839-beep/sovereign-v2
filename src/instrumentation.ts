/**
 * INSTRUMENTATION — Next.js server startup hook
 *
 * On Railway (persistent Node.js server): starts a 30-second interval
 * that pings /api/cron/job-runner to process the async job queue.
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

  const runJobs = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/job-runner`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      // Silently swallow — job runner failures are self-healing on next tick
    }
  };

  // Wait 10s for the server to fully boot before starting
  setTimeout(() => {
    runJobs();
    setInterval(runJobs, 30_000);
  }, 10_000);
}
