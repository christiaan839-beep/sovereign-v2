/**
 * GET /api/cron/synthetic-probe
 *
 * Self-hits the revenue-critical surface every 5 minutes and reports
 * latency + HTTP status per probe. The output goes to:
 *   - the JSON response (for cron-job.org / Vercel cron logs)
 *   - createLogger("cron:synthetic-probe") at info / warn level
 *   - Sentry as a captureMessage when any probe breaches its budget
 *     (so SLO alerts fire automatically without extra wiring)
 *
 * "Critical" means: anything between a paying customer and the cash
 * register or audit trail. We deliberately keep the list short — wide
 * synthetics drive false positives more than they catch real outages.
 *
 * Per-probe timeouts:
 *   - 5s  for static / health-grade routes
 *   - 8s  for routes that read the DB but no LLM
 *   - 15s for routes that the user expects "felt fast" (dashboard, /r)
 *
 * Routes that need an authenticated user (eg /dashboard) are checked
 * via their server response code instead of full-page render — a
 * 200/302/307 means the route is alive; we don't try to log in.
 *
 * Protected by CRON_SECRET via requireCronAuth().
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:synthetic-probe");

interface ProbeSpec {
  name: string;
  /** path relative to the deployment root */
  path: string;
  /** acceptable HTTP status codes */
  okStatuses: number[];
  /** abort threshold in ms */
  timeoutMs: number;
  /** p95 latency budget — exceeding this fires a warning (not failure) */
  budgetMs: number;
}

const PROBES: ProbeSpec[] = [
  {
    name: "marketing-home",
    path: "/",
    okStatuses: [200, 304],
    timeoutMs: 5_000,
    budgetMs: 1_500,
  },
  {
    name: "health-readiness",
    path: "/api/health/ready",
    okStatuses: [200, 503],
    timeoutMs: 5_000,
    budgetMs: 800,
  },
  {
    name: "health-deep",
    path: "/api/health",
    okStatuses: [200],
    timeoutMs: 8_000,
    budgetMs: 1_200,
  },
  {
    name: "marketplace",
    path: "/marketplace",
    okStatuses: [200],
    timeoutMs: 8_000,
    budgetMs: 2_000,
  },
  {
    name: "pricing",
    path: "/pricing",
    okStatuses: [200],
    timeoutMs: 8_000,
    budgetMs: 2_000,
  },
  {
    name: "stripe-checkout-stub",
    // GET on the checkout endpoint should reject (405 / 401 / 400)
    // quickly — proves the route exists and isn't 5xxing.
    path: "/api/payments/stripe/checkout",
    okStatuses: [400, 401, 405],
    timeoutMs: 5_000,
    budgetMs: 1_000,
  },
  {
    name: "verify-public",
    path: "/api/verify",
    okStatuses: [400, 405],
    timeoutMs: 5_000,
    budgetMs: 800,
  },
];

interface ProbeResult {
  name: string;
  path: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  budgetMs: number;
  budgetBreached: boolean;
  error?: string;
}

function resolveBaseUrl(req: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

async function runProbe(
  baseUrl: string,
  spec: ProbeSpec,
): Promise<ProbeResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), spec.timeoutMs);
  const start = Date.now();
  try {
    // Wave 116 carve-out: same as synthetic/latest — internal probe
    // of own deployment from an operator-allowlisted spec.path. Tests
    // mock fetch to assert the probe sequence.
    // eslint-disable-next-line no-restricted-syntax
    const res = await fetch(`${baseUrl}${spec.path}`, {
      method: "GET",
      headers: {
        "User-Agent": "sovereign-synthetic/1.0",
        // Bypass any logged-in-user redirect by treating us as a fresh agent.
        Accept: "*/*",
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    const durationMs = Date.now() - start;
    const ok = spec.okStatuses.includes(res.status);
    return {
      name: spec.name,
      path: spec.path,
      ok,
      status: res.status,
      durationMs,
      budgetMs: spec.budgetMs,
      budgetBreached: durationMs > spec.budgetMs,
    };
  } catch (err) {
    return {
      name: spec.name,
      path: spec.path,
      ok: false,
      status: null,
      durationMs: Date.now() - start,
      budgetMs: spec.budgetMs,
      budgetBreached: true,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  const authErr = requireCronAuth(req);
  if (authErr) return authErr;

  const baseUrl = resolveBaseUrl(req);

  const results = await Promise.all(
    PROBES.map((spec) => runProbe(baseUrl, spec)),
  );

  const failed = results.filter((r) => !r.ok);
  const breaches = results.filter((r) => r.ok && r.budgetBreached);

  // Log everything at info; failures and budget breaches escalate.
  for (const r of results) {
    if (!r.ok) {
      log.error("synthetic probe failed", { ...r });
      Sentry.captureMessage(
        `Synthetic probe failed: ${r.name} (status=${r.status ?? "ERR"}, ${r.durationMs}ms)`,
        { level: "error", tags: { probe: r.name } },
      );
    } else if (r.budgetBreached) {
      log.warn("synthetic probe over budget", { ...r });
      Sentry.captureMessage(
        `Synthetic probe over budget: ${r.name} (${r.durationMs}ms > ${r.budgetMs}ms)`,
        { level: "warning", tags: { probe: r.name } },
      );
    }
  }

  const overall =
    failed.length > 0 ? "fail" : breaches.length > 0 ? "degraded" : "ok";

  return NextResponse.json(
    {
      overall,
      timestamp: new Date().toISOString(),
      baseUrl,
      summary: {
        total: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
        budgetBreaches: breaches.length,
      },
      probes: results,
    },
    {
      status: overall === "fail" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
