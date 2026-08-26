/**
 * Cron scheduler — one Cloudflare Worker, ten schedules.
 *
 * Fires every minute, works out which jobs are due, and issues one
 * authenticated request per due job at the origin. It runs no business
 * logic itself: the jobs stay where they are, in the Next.js app, and
 * this only replaces the thing calling them.
 *
 * That matters for the migration. Every scheduled route accepts
 * `Authorization: Bearer $CRON_SECRET`, so moving the scheduler off
 * Vercel needs no application change. Getting there took two passes:
 * 0869b31 converted the two `_cron/*` routes, and a later sweep caught
 * `cron/audit-log-anchor`, which was still reading a raw `x-cron-secret`
 * header and would have 401'd against this Worker while the other nine
 * ran. That is the job anchoring the audit log to Bitcoin, so its
 * silent absence is the one nobody notices until an auditor asks.
 * `cron-auth-unified.test.ts` now enumerates vercel.json rather than a
 * hand-written list, so a fourth route cannot drift the same way.
 *
 * COST. Cloudflare bills Workers on CPU time, and explicitly does not
 * count time spent awaiting `fetch()`. This Worker parses ten cron
 * expressions and then waits on the network, so a tick costs well under
 * a millisecond of CPU even though it may stay open for seconds. It fits
 * the free plan's 10 ms/invocation budget with room to spare, and the
 * 15-minute wall-time limit for Cron Triggers dwarfs the per-job
 * timeouts in jobs.ts.
 *
 * FAILURE MODEL. A job that errors, times out, or returns non-2xx is
 * logged and skipped; the others still run. There is no retry — the next
 * matching tick is the retry, which for a once-a-minute job is a minute
 * away and for a weekly one is a week. If that is not acceptable for a
 * given job, the job needs its own durable queue, not a louder scheduler.
 * When EVERY due job fails the invocation throws, so Cloudflare's Cron
 * Trigger "Past Events" table shows red — see the scheduled handler.
 */

import { compileCron, matches, type CompiledCron } from "./cron.js";
import { JOBS, type Job } from "./jobs.js";

export interface Env {
  /** Origin base URL, no trailing slash, e.g. https://sovereignmatrix.agency */
  ORIGIN: string;
  /** Shared secret. Sent as `Authorization: Bearer <secret>`. */
  CRON_SECRET: string;
  /** Optional: set to "1" to log every tick, not just due jobs. */
  VERBOSE?: string;
}

/**
 * Compile once at module scope.
 *
 * Workers reuse an isolate across invocations, so this parse happens on
 * cold start rather than every minute. It also means a malformed
 * expression fails at deploy-time smoke-test rather than silently at
 * 03:00 on a Sunday.
 */
const COMPILED: ReadonlyArray<{ job: Job; cron: CompiledCron }> = JOBS.map((job) => ({
  job,
  cron: compileCron(job.schedule),
}));

/** Which jobs are due at this instant. */
export function dueAt(at: Date): Job[] {
  return COMPILED.filter(({ cron }) => matches(cron, at)).map(({ job }) => job);
}

interface JobResult {
  path: string;
  ok: boolean;
  status?: number;
  ms: number;
  error?: string;
}

/** Fire one job. Never throws — the verdict is the return value. */
async function runJob(job: Job, env: Env): Promise<JobResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), job.timeoutMs);

  try {
    const res = await fetch(`${env.ORIGIN}${job.path}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${env.CRON_SECRET}`,
        // Lets the origin tell scheduled traffic from a browser in logs.
        "user-agent": "sovereign-cron-scheduler/1 (+cloudflare-worker)",
      },
      signal: controller.signal,
      // These are fire-and-check calls; a cached response would mean a
      // job appearing to run without running.
      cache: "no-store",
    });
    return {
      path: job.path,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      path: job.path,
      ok: false,
      ms: Date.now() - started,
      error: aborted ? `timeout after ${job.timeoutMs}ms` : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run every due job concurrently.
 *
 * `allSettled`, not `all`: one rejected promise must not cancel the
 * others. `runJob` already returns rather than throws, so this is
 * belt-and-braces against a future edit that reintroduces a throw.
 */
export async function runDue(at: Date, env: Env): Promise<JobResult[]> {
  const due = dueAt(at);
  if (due.length === 0) return [];
  const settled = await Promise.allSettled(due.map((job) => runJob(job, env)));
  return settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : { path: due[i]!.path, ok: false, ms: 0, error: String(s.reason) },
  );
}

/** Refuse to run misconfigured rather than firing unauthenticated requests. */
function assertConfigured(env: Env): string | null {
  if (!env.ORIGIN) return "ORIGIN is not set";
  if (!/^https:\/\//.test(env.ORIGIN)) return "ORIGIN must be an https:// URL";
  if (env.ORIGIN.endsWith("/")) return "ORIGIN must not have a trailing slash";
  // Without this the Worker would send `Bearer undefined` — the exact
  // bypass string requireCronAuth on the origin exists to reject.
  if (!env.CRON_SECRET) return "CRON_SECRET is not set";
  return null;
}

export default {
  /**
   * Cron Trigger entry point. Configured as `* * * * *` in wrangler.jsonc.
   *
   * This `await`s rather than using `ctx.waitUntil`. The runtime already
   * waits for the promise the handler returns (up to the 15-minute cron
   * limit), and awaiting is what makes the throw below meaningful:
   * Cloudflare records an invocation in the Cron Trigger "Past Events"
   * table as a success unless it fails. A handler that catches
   * everything and never rejects shows green forever — including while
   * every job is 401ing, which for this scheduler is precisely the state
   * that must not look healthy.
   */
  async scheduled(event: { scheduledTime: number }, env: Env) {
    const problem = assertConfigured(env);
    if (problem) {
      // Throw, don't return: a misconfigured scheduler that reports
      // success is worse than one that reports nothing.
      throw new Error(`scheduler misconfigured: ${problem}`);
    }

    const at = new Date(event.scheduledTime);
    const results = await runDue(at, env);

    if (results.length === 0) {
      if (env.VERBOSE === "1") {
        console.log(JSON.stringify({ level: "debug", at: at.toISOString(), due: 0 }));
      }
      return;
    }

    for (const r of results) {
      console.log(
        JSON.stringify({
          level: r.ok ? "info" : "error",
          at: at.toISOString(),
          path: r.path,
          status: r.status,
          ms: r.ms,
          ...(r.error ? { error: r.error } : {}),
        }),
      );
    }

    // Fail the invocation only when EVERY due job failed. That is the
    // systemic signature — wrong CRON_SECRET, wrong ORIGIN, origin down —
    // and it belongs in the dashboard. A single job failing among several
    // is logged above and visible in `wrangler tail`; marking the whole
    // tick red for it would leave the table permanently red, since
    // job-runner alone fires 1,440 times a day.
    const failed = results.filter((r) => !r.ok);
    if (failed.length === results.length) {
      throw new Error(
        `all ${results.length} due job(s) failed: ` +
          failed.map((f) => `${f.path} ${f.status ?? f.error}`).join("; "),
      );
    }
  },

  /**
   * HTTP entry point — health and dry-run only.
   *
   * `GET /` reports what would fire now. It deliberately cannot trigger
   * a job: a scheduler reachable over the internet that runs jobs on
   * request is an unauthenticated way to hammer the origin.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const at = url.searchParams.get("at");
    const when = at ? new Date(at) : new Date();
    if (Number.isNaN(when.getTime())) {
      return Response.json({ error: "invalid ?at= timestamp" }, { status: 400 });
    }
    return Response.json({
      ok: assertConfigured(env) === null,
      configured: assertConfigured(env) ?? "ok",
      now: when.toISOString(),
      jobs: JOBS.length,
      dueNow: dueAt(when).map((j) => j.path),
      note: "This endpoint reports only. Jobs fire on the cron trigger.",
    });
  },
};
