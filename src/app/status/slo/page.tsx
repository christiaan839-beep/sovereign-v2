/**
 * /status/slo — SLO-backed public status page.
 *
 * The existing /status page is deliberately conservative: it shows
 * per-service health only (no uptime numbers) because we wouldn't
 * fabricate SLA claims before we had real measurement.
 *
 * Now that src/lib/slo-tracker.ts lands on every agent request, we
 * have real numbers. This page renders them as HTML.
 *
 * FRESHNESS
 * ─────────
 * Server component, `revalidate = 30` matches /api/_health/slo's edge cache.
 *
 * KNOWN GAP (acknowledged on-page, not hidden)
 * ────────────────────────────────────────────
 * SLO tracker is per-instance. Numbers shown are from whichever Vercel
 * lambda handled the render. Cross-instance aggregation is Q2 work.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { getPlatformSlo, getPlatformSloFromDb } from "@/lib/slo-tracker";
import { getAiCacheStats } from "@/lib/ai-cache";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "SLO — Sovereign Matrix",
  description:
    "Rolling 24h uptime, P95 latency, cache hit rate, per-endpoint breakdown. Sourced from the in-memory SLO tracker.",
  alternates: { canonical: "https://sovereignmatrix.agency/status/slo" },
};

function statusBucket(successRatePct: number) {
  if (successRatePct === 100) return { label: "All systems go", color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400" };
  if (successRatePct >= 99.9) return { label: "Operational", color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400" };
  if (successRatePct >= 99) return { label: "Degraded", color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-400" };
  return { label: "Incident", color: "text-rose-400", bg: "bg-rose-500/10", dot: "bg-rose-400" };
}

export default async function SloStatusPage() {
  // Prefer cross-instance aggregation from Postgres. Fall back to
  // per-instance in-memory buffer when DB is unavailable — ensures
  // the page always renders SOMETHING instead of breaking.
  const dbSlo = await getPlatformSloFromDb({ windowMs: 24 * 60 * 60 * 1000 });
  const slo = dbSlo ?? getPlatformSlo({ windowMs: 24 * 60 * 60 * 1000 });
  const source: "postgres" | "in-memory" = dbSlo ? "postgres" : "in-memory";
  const cache = getAiCacheStats();
  const hasTraffic = slo.overall.totalRequests > 0;
  const status = hasTraffic
    ? statusBucket(slo.overall.successRatePct)
    : { label: "Awaiting first request", color: "text-neutral-400", bg: "bg-white/[0.04]", dot: "bg-neutral-600" };

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <div className="flex items-center gap-5 text-[13px]">
          <Link href="/status" className="text-neutral-400 hover:text-white transition-colors">
            Service status
          </Link>
          <Link href="/compare" className="text-neutral-400 hover:text-white transition-colors">
            Compare
          </Link>
        </div>
      </nav>

      <section className="pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-4">
            Rolling 24-hour SLO · Live
          </p>
          <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full ${status.bg}`}>
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            <span className={`text-sm font-semibold ${status.color}`}>{status.label}</span>
          </div>

          <h1 className="ed-display text-5xl md:text-7xl mt-8 mb-4">
            {hasTraffic ? `${slo.overall.successRatePct.toFixed(2)}%` : "—"}
          </h1>
          <p className="text-neutral-400 text-sm">
            Across{" "}
            <span className="text-white">{slo.overall.totalRequests.toLocaleString()}</span> tracked
            requests on{" "}
            <span className="text-white">{slo.overall.observedEndpoints}</span> endpoints.
          </p>
        </div>
      </section>

      <section className="pb-16 px-6 border-y border-white/[0.04] bg-[#030303]">
        <div className="max-w-4xl mx-auto py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <BigStat
              label="P95 latency"
              value={hasTraffic ? `${slo.overall.p95Ms}ms` : "—"}
              sub="95% of requests complete in"
            />
            <BigStat
              label="Requests (24h)"
              value={slo.overall.totalRequests.toLocaleString()}
              sub="tracked in SLO ring buffer"
            />
            <BigStat
              label="Cache hit rate"
              value={`${cache.hitRatePct}%`}
              sub={`${cache.hits} hits · ${cache.stampedeSaves} stampede saves`}
            />
            <BigStat
              label="Endpoints"
              value={String(slo.overall.observedEndpoints)}
              sub="observed this window"
            />
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-6">
            Per-endpoint breakdown
          </p>
          {slo.endpoints.length === 0 ? (
            <div className="py-10 text-center border border-white/[0.06] rounded-xl bg-[#060606]">
              <p className="text-neutral-500 text-sm mb-2">No traffic in the current window.</p>
              <p className="text-neutral-600 text-xs">
                Numbers populate as soon as the first agent request lands.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#060606]">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="bg-[#080808] text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    <th className="text-left py-3 px-4 font-semibold">Endpoint</th>
                    <th className="text-right py-3 px-4 font-semibold">Requests</th>
                    <th className="text-right py-3 px-4 font-semibold">Success</th>
                    <th className="text-right py-3 px-4 font-semibold">P50</th>
                    <th className="text-right py-3 px-4 font-semibold">P95</th>
                    <th className="text-right py-3 px-4 font-semibold">P99</th>
                  </tr>
                </thead>
                <tbody>
                  {slo.endpoints.slice(0, 30).map((e, i) => (
                    <tr key={e.endpoint} className={i % 2 === 0 ? "bg-[#060606]" : "bg-[#080808]"}>
                      <td className="py-3 px-4 font-mono text-neutral-300 truncate max-w-[280px]">
                        {e.endpoint}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-400">
                        {e.totalRequests.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span
                          className={
                            e.successRatePct === 100
                              ? "text-emerald-400"
                              : e.successRatePct >= 99
                                ? "text-amber-400"
                                : "text-rose-400"
                          }
                        >
                          {e.successRatePct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-400">{e.p50Ms}ms</td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-300">{e.p95Ms}ms</td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-400">{e.p99Ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="py-16 px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-4">
            Methodology + honest gaps
          </p>
          <ul className="space-y-3 text-sm text-neutral-400 leading-relaxed">
            <li className="flex gap-3">
              <span className="text-[#B5532C] shrink-0">·</span>
              <span>
                Numbers come from an in-memory ring buffer populated by every agent invocation.
                Raw JSON:{" "}
                <Link href="/api/_health/slo" className="underline hover:text-white">
                  /api/_health/slo
                </Link>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#B5532C] shrink-0">·</span>
              <span>Window: rolling 24 hours. Buffer holds up to 10,000 events per endpoint.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#B5532C] shrink-0">·</span>
              <span>
                <span className="text-emerald-400">Cross-instance survival:</span> Every event
                writes to the <code className="font-mono text-xs">slo_events</code> Postgres
                table (migration 0032) via <code className="font-mono text-xs">queueMicrotask</code>.
                Numbers survive cold-starts + aggregate across Vercel lambdas.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#B5532C] shrink-0">·</span>
              <span>
                <span className="text-emerald-400">Current render source:</span>{" "}
                <code className="font-mono text-xs">{source}</code>
                {source === "postgres" ? (
                  <> — cross-instance aggregate via Postgres <code className="font-mono text-xs">percentile_disc</code>.</>
                ) : (
                  <> — DB unavailable, falling back to the in-memory ring buffer on this lambda.</>
                )}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#B5532C] shrink-0">·</span>
              <span>
                Want notifications when something degrades? Subscribe a webhook via{" "}
                <Link href="/dashboard/webhooks" className="underline hover:text-white">
                  /dashboard/webhooks
                </Link>
                .
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-3">
        {label}
      </p>
      <p className="ed-display text-3xl md:text-4xl leading-none mb-2 text-white">{value}</p>
      <p className="text-[11px] text-neutral-500">{sub}</p>
    </div>
  );
}
