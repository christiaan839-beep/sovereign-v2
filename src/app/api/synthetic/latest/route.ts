/**
 * GET /api/synthetic/latest — public read of the most recent synthetic
 * probe run. Powers the live `/status` page and any third-party uptime
 * dashboard that wants to mirror our SLOs.
 *
 * Strategy: run the probe on demand with a 60-second in-memory cache.
 * The cache lives at module scope so consecutive requests within the
 * same serverless instance reuse the result (zero re-hit cost). Cold
 * starts re-run, which is acceptable — the probe itself completes in
 * well under a second when everything is healthy.
 *
 * No auth — the data is intentionally public. Probe results carry
 * only health metadata (status codes, latencies), no user data.
 */
import { NextResponse } from "next/server";

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

interface CachedRun {
  fetchedAt: number;
  overall: "ok" | "degraded" | "fail";
  summary: {
    total: number;
    passed: number;
    failed: number;
    budgetBreaches: number;
  };
  probes: ProbeResult[];
}

const CACHE_TTL_MS = 60_000;
let cached: CachedRun | null = null;

const PROBES: Array<{
  name: string;
  path: string;
  okStatuses: number[];
  timeoutMs: number;
  budgetMs: number;
}> = [
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
    name: "verify-public",
    path: "/api/verify",
    okStatuses: [400, 405],
    timeoutMs: 5_000,
    budgetMs: 800,
  },
];

// SSRF guard: probe target MUST be the platform's own deployment.
// Trust only env-injected origins (NEXT_PUBLIC_APP_URL or VERCEL_URL),
// never request headers — a spoofed Host: would make this endpoint
// probe arbitrary hosts and cache poisoned results into /status.
// Localhost fallback only when neither env is set (local dev).
function resolveBaseUrl(_req: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

async function runOne(
  baseUrl: string,
  spec: (typeof PROBES)[number],
): Promise<ProbeResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), spec.timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${spec.path}`, {
      method: "GET",
      headers: {
        "User-Agent": "sovereign-status-mirror/1.0",
        Accept: "*/*",
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    return {
      name: spec.name,
      path: spec.path,
      ok: spec.okStatuses.includes(res.status),
      status: res.status,
      durationMs: Date.now() - start,
      budgetMs: spec.budgetMs,
      budgetBreached: Date.now() - start > spec.budgetMs,
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
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const baseUrl = resolveBaseUrl(req);
  const results = await Promise.all(PROBES.map((p) => runOne(baseUrl, p)));
  const failed = results.filter((r) => !r.ok).length;
  const breaches = results.filter((r) => r.ok && r.budgetBreached).length;
  const overall: CachedRun["overall"] =
    failed > 0 ? "fail" : breaches > 0 ? "degraded" : "ok";

  cached = {
    fetchedAt: now,
    overall,
    summary: {
      total: results.length,
      passed: results.length - failed,
      failed,
      budgetBreaches: breaches,
    },
    probes: results,
  };

  return NextResponse.json(cached, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
