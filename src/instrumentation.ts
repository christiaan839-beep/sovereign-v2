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
  // ── ALS-backed stores (Node only) ──
  // Installs the AsyncLocalStorage-backed implementations of:
  //   - request-context (per-request correlation IDs, used by logger)
  //   - model-attribution (which models touched each request)
  // on globalThis so the shared modules pick them up. Both shared
  // modules are Edge/Browser-safe (no `node:async_hooks` import);
  // these Node-only files are the ONLY places we touch async_hooks.
  // See request-context.ts and model-attribution.ts for the full
  // runtime-compat rationale.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/request-context-node");
    await import("@/lib/model-attribution-node");
    // R28 — A2E recursion depth tracker (ALS-backed). Edge runtime
    // falls back to a per-instance counter (see a2e-depth.ts).
    await import("@/lib/a2e-depth-node");
  }

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
  //
  // Only run the background loop on Railway (persistent server, not
  // edge/serverless). Vercel uses vercel.json crons which are
  // already mutually exclusive at the platform level.
  //
  // Round 26 — every tick is wrapped in `withAdvisoryLock` so two
  // Railway instances (rolling deploy, horizontal scale, warm-after-
  // cold transition) don't BOTH fire the same cron. Without the
  // lock, scheduled playbooks could fire twice and users see
  // duplicate runs. With it: only the instance that wins the
  // Postgres advisory lock pings; the others skip silently.
  //
  // The lock keys are stable strings derived per workload — same
  // string hashes to the same int64 on every instance, so they
  // contend on the same Postgres advisory-lock slot.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL) return;
  if (!process.env.CRON_SECRET || !process.env.NEXT_PUBLIC_APP_URL) return;

  const { withAdvisoryLock } = await import("@/lib/advisory-lock");

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

  // Wait 10s for the server to fully boot before starting.
  setTimeout(() => {
    // Job queue: every 30s. Lock-gated so duplicate Railway
    // instances don't double-fire. The job-runner endpoint also
    // uses atomic UPDATE-WHERE-pending claim semantics, so even
    // without the lock duplication is mostly OK there — but the
    // lock cuts pre-flight work too.
    void withAdvisoryLock("railway-job-runner-tick", () => ping("/api/cron/job-runner"));
    setInterval(() => {
      void withAdvisoryLock("railway-job-runner-tick", () => ping("/api/cron/job-runner"));
    }, 30_000);

    // Playbook scheduler: every 5 min. CRITICAL that this is
    // lock-gated — the scheduler doesn't have an atomic claim like
    // job-runner does, so duplicate ticks DO produce duplicate
    // playbook runs without the lock.
    void withAdvisoryLock("railway-playbook-scheduler-tick", () =>
      ping("/api/cron/playbook-scheduler", 15_000),
    );
    setInterval(() => {
      void withAdvisoryLock("railway-playbook-scheduler-tick", () =>
        ping("/api/cron/playbook-scheduler", 15_000),
      );
    }, 5 * 60_000);
  }, 10_000);
}
