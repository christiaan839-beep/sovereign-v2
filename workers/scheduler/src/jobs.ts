/**
 * The schedule.
 *
 * These expressions are copied verbatim from `vercel.json` and carry the
 * same standard-cron meaning (0 = Sunday). `__tests__/jobs.test.ts`
 * asserts this list still matches `vercel.json` exactly, so the two
 * cannot drift while both exist. When Vercel is gone, delete that test
 * along with `vercel.json` and this becomes the sole source of truth.
 *
 * Six of these are illegal on Vercel's Hobby plan, which caps scheduled
 * jobs at once per day — including `_cron/audit-bundles` and
 * `_cron/soc2-indicators`, the two that generate compliance evidence.
 * That is the reason this Worker exists: Cloudflare Cron Triggers accept
 * `* * * * *` without argument.
 */

export interface Job {
  /** Standard five-field cron, UTC, 0 = Sunday. */
  readonly schedule: string;
  /** Path on the origin, including the leading slash. */
  readonly path: string;
  /**
   * How long to give the origin before giving up on this tick.
   *
   * A slow job must not delay the others, and must not hold the Worker
   * open: the request is abandoned and retried on the next matching
   * tick rather than waited on.
   */
  readonly timeoutMs: number;
}

export const JOBS: readonly Job[] = [
  { schedule: "* * * * *", path: "/api/cron/job-runner", timeoutMs: 25_000 },
  { schedule: "*/5 * * * *", path: "/api/cron/playbook-scheduler", timeoutMs: 25_000 },
  { schedule: "0 8 * * 1", path: "/api/cron/weekly-report", timeoutMs: 25_000 },
  { schedule: "0 7 * * *", path: "/api/cron/daily-digest", timeoutMs: 25_000 },
  { schedule: "0 3 * * 0", path: "/api/cron/cleanup", timeoutMs: 25_000 },
  { schedule: "*/4 * * * *", path: "/api/health/ping", timeoutMs: 10_000 },
  { schedule: "*/5 * * * *", path: "/api/cron/synthetic-probe", timeoutMs: 25_000 },
  { schedule: "0 * * * *", path: "/api/_cron/audit-bundles", timeoutMs: 25_000 },
  { schedule: "*/15 * * * *", path: "/api/_cron/soc2-indicators", timeoutMs: 25_000 },
  { schedule: "30 2 * * *", path: "/api/cron/audit-log-anchor", timeoutMs: 25_000 },
];
