import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Production benchmarks · Sovereign Matrix",
  description:
    "Live aggregate data showing which AI providers get real production traffic on Sovereign Matrix, with per-run costs and token averages. Updated hourly.",
  alternates: { canonical: "https://sovereignmatrix.agency/benchmarks" },
  openGraph: {
    title: "Sovereign Matrix — Production Benchmarks",
    description:
      "Live provider leaderboard. Real traffic, real costs, updated hourly.",
    url: "https://sovereignmatrix.agency/benchmarks",
    type: "website",
  },
};

/**
 * /benchmarks — public provider leaderboard.
 *
 * The third competitive moat from the sovereign-optimizer audit,
 * shipped. Most AI-platform benchmark pages are static PDFs with
 * last-year's numbers. This one reads from the cost ledger we just
 * built (migration 0012) and re-aggregates hourly.
 *
 * Why this matters:
 *   - Technical buyers want to see actual usage patterns, not
 *     marketing claims about "40+ models supported"
 *   - Publishing the data answers "do you actually use Claude,
 *     or just list it?" directly
 *   - Competitors can't easily match this without admitting their
 *     own cost-per-run numbers publicly
 */

export const revalidate = 3600;

interface ProviderRow {
  provider: string;
  runs: number;
  totalCostCents: number;
  avgCostCents: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  displayName: string;
  inputCentsPerMTok: number;
  outputCentsPerMTok: number;
}

interface BenchmarkResponse {
  generatedAt: string;
  window: string;
  rateCardVersion: string;
  methodology: {
    source: string;
    aggregation: string;
    pricing: string;
    scope: string;
  };
  leaderboard: ProviderRow[];
  claudeShare: {
    runs: number;
    percentOfAll: number;
    primaryRole?: string;
    note?: string;
  };
  nextUpdate: string;
  note?: string;
}

async function fetchBenchmarks(): Promise<BenchmarkResponse | null> {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res = await fetch(`${base}/api/_misc/benchmarks`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as BenchmarkResponse;
  } catch {
    return null;
  }
}

function formatUsd(cents: number): string {
  if (cents === 0) return "$0.00";
  const dollars = cents / 100;
  return dollars < 0.01 ? "<$0.01" : `$${dollars.toFixed(2)}`;
}

function formatNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export default async function BenchmarksPage() {
  const data = await fetchBenchmarks();
  const total = data?.leaderboard.reduce((s, r) => s + r.runs, 0) ?? 0;

  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      {/* ─── Editorial header ─── */}
      <div className="max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Public · Benchmarks · Updated hourly
        </p>
        <h1 className="font-serif text-5xl lg:text-7xl leading-[1.05] tracking-tight mb-6">
          Which models <em className="text-[#B5532C] not-italic">actually run</em>
          <br />
          in production.
        </h1>
        <p className="text-lg text-[#5C544A] leading-relaxed max-w-2xl">
          Most platforms say &ldquo;we support 40+ models.&rdquo; We
          publish which ones customers actually route to, what they
          cost on average, and how Claude participates as the consensus
          critic. Every row comes from the live cost ledger; no
          marketing numbers.
        </p>
      </div>

      {/* ─── Leaderboard ─── */}
      <section className="mt-20 border-t border-[#D8CDB7] pt-12">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-6">
          {data?.window ?? "last 30 days"}
          {data?.generatedAt && (
            <span className="ml-4 text-[#B5532C]">
              · refreshed {new Date(data.generatedAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })} UTC
            </span>
          )}
        </p>

        {!data?.leaderboard.length ? (
          <EmptyLeaderboard note={data?.note} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#C7B9A1] text-[10px] font-mono uppercase tracking-[0.14em] text-[#8F8576]">
                  <th className="text-left py-3 pr-4">Provider</th>
                  <th className="text-right py-3 pr-4">Runs (30d)</th>
                  <th className="text-right py-3 pr-4">Share</th>
                  <th className="text-right py-3 pr-4">Avg cost/run</th>
                  <th className="text-right py-3 pr-4">Avg in tokens</th>
                  <th className="text-right py-3">Avg out tokens</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((row) => {
                  const share = total > 0 ? Math.round((row.runs / total) * 100) : 0;
                  const isClaude = row.provider === "anthropic";
                  return (
                    <tr
                      key={row.provider}
                      className={`border-b border-[#E4DCCA] ${isClaude ? "bg-[#B5532C]/[0.05]" : ""}`}
                    >
                      <td className="py-4 pr-4">
                        <p className="font-serif text-lg text-[#1A1712]">{row.displayName}</p>
                        <p className="text-[11px] font-mono text-[#8F8576]">{row.provider}</p>
                      </td>
                      <td className="text-right py-4 pr-4 font-mono tabular-nums text-[#1A1712]">
                        {formatNum(row.runs)}
                      </td>
                      <td className="text-right py-4 pr-4 font-mono tabular-nums text-[#5C544A]">
                        {share}%
                      </td>
                      <td className="text-right py-4 pr-4 font-mono tabular-nums text-[#1A1712]">
                        {formatUsd(row.avgCostCents)}
                      </td>
                      <td className="text-right py-4 pr-4 font-mono tabular-nums text-[#5C544A]">
                        {formatNum(row.avgInputTokens)}
                      </td>
                      <td className="text-right py-4 font-mono tabular-nums text-[#5C544A]">
                        {formatNum(row.avgOutputTokens)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Claude callout ─── */}
      {data?.claudeShare && data.claudeShare.runs > 0 && (
        <section className="mt-16 border-t border-[#D8CDB7] pt-12 max-w-4xl">
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
            Chapter II · Claude, in production
          </p>
          <h2 className="font-serif text-3xl lg:text-4xl leading-tight mb-6">
            Claude participated in{" "}
            <em className="text-[#B5532C] not-italic">{data.claudeShare.percentOfAll}%</em>{" "}
            of runs this window.
          </h2>
          <p className="text-[15px] text-[#5C544A] leading-relaxed max-w-2xl">
            {data.claudeShare.primaryRole}. The cheaper models do
            bulk generation; Claude reviews the output before it reaches
            the customer. See{" "}
            <a href="/trust/anthropic" className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]">
              /trust/anthropic
            </a>{" "}
            for the full pipeline metrics.
          </p>
        </section>
      )}

      {/* ─── Methodology ─── */}
      {data?.methodology && (
        <section className="mt-16 border-t border-[#D8CDB7] pt-12 max-w-4xl">
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
            Chapter III · Methodology
          </p>
          <dl className="space-y-4 text-[15px] text-[#5C544A]">
            <div>
              <dt className="font-semibold text-[#1A1712] mb-1">Source</dt>
              <dd>{data.methodology.source}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#1A1712] mb-1">Aggregation</dt>
              <dd>{data.methodology.aggregation}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#1A1712] mb-1">Pricing</dt>
              <dd>
                {data.methodology.pricing}. Current rate card:{" "}
                <code className="font-mono text-[13px] text-[#1A1712]">
                  {data.rateCardVersion}
                </code>
                .
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[#1A1712] mb-1">Scope</dt>
              <dd>{data.methodology.scope}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* ─── Colophon ─── */}
      <footer className="mt-24 pt-12 border-t border-[#D8CDB7] max-w-4xl text-[11px] font-mono text-[#8F8576] leading-loose">
        <p>
          Raw JSON:{" "}
          <a
            href="/api/_misc/benchmarks"
            className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]"
          >
            /api/_misc/benchmarks
          </a>
          . Data lives in the <code>usage</code> cost ledger (migration
          0012). Cached 1hr at Vercel edge.
        </p>
      </footer>
    </main>
  );
}

function EmptyLeaderboard({ note }: { note?: string }) {
  return (
    <div className="py-12 text-center text-[#8F8576] text-sm max-w-xl">
      <p className="mb-2">No benchmark data yet.</p>
      <p className="text-[13px] leading-relaxed">
        {note ??
          "Benchmark data populates from the cost ledger after the first post-0012 agent run. Check back in a few hours."}
      </p>
    </div>
  );
}
