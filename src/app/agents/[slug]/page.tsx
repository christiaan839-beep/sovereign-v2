/**
 * /agents/[slug] — public SEO page for a single agent.
 *
 * Server component. Uses getAgentPublic() directly (no HTTP hop to
 * /api/catalog/[slug]) so the first paint doesn't wait on a round-trip.
 * Next.js edge-caches this route automatically.
 *
 * SEO surfaces generated here:
 *   - <title>, <meta description> via generateMetadata()
 *   - Open Graph + Twitter card tags
 *   - Article JSON-LD (via layout.tsx)
 *   - Canonical <link>
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAgentPublic, listCatalog } from "@/lib/agent-catalog";
import { InstallButton } from "./InstallButton";
import { AgentCard } from "@/components/world/AgentCard";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const agent = await getAgentPublic(slug);
  if (!agent) {
    return { title: "Agent not found — Sovereign Matrix" };
  }

  const title = `${agent.displayName} — Sovereign Matrix`;
  const description =
    agent.tagline ??
    agent.description ??
    `${agent.displayName} is one of 137 specialized agents on the Sovereign Matrix platform.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://sovereignmatrix.agency/agents/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://sovereignmatrix.agency/agents/${slug}`,
      siteName: "Sovereign Matrix",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function AgentPage({ params }: Props) {
  const { slug } = await params;
  const agent = await getAgentPublic(slug);
  if (!agent) notFound();

  // Related — same category, excluding current. Capped at 4.
  const related = (await listCatalog({ category: agent.category, limit: 10 }))
    .filter((a) => a.slug !== agent.slug)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-[#030303] text-white antialiased">
      <header className="border-b border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-[13px] font-serif text-white hover:text-[#E8DDD0] transition-colors tracking-tight"
          >
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-5 text-[12px] font-mono text-neutral-500 tracking-tight">
            <Link href="/world" className="hover:text-white transition-colors">
              World
            </Link>
            <Link href="/marketplace" className="hover:text-white transition-colors">
              Marketplace
            </Link>
            <Link
              href="/leaderboard"
              className="hover:text-[#B5532C] transition-colors"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </header>

      <main className="px-6 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 text-[11px] font-mono text-neutral-600 tracking-wide">
            <Link href="/world" className="hover:text-neutral-400">World</Link>
            <span aria-hidden="true" className="mx-1.5">/</span>
            <Link href={`/world?cat=${agent.category}`} className="hover:text-neutral-400 capitalize">
              {agent.category}
            </Link>
            <span aria-hidden="true" className="mx-1.5">/</span>
            <span className="text-neutral-400">{agent.slug}</span>
          </nav>

          {/* Hero */}
          <div className="flex items-start gap-4 mb-8">
            <div
              className="flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center"
              style={{
                background: `${agent.heroColor ?? "#B5532C"}20`,
                borderColor: `${agent.heroColor ?? "#B5532C"}55`,
              }}
              aria-hidden="true"
            >
              <span className="font-mono text-[14px] text-[#B5532C]">
                {agent.displayName.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-neutral-600 tracking-[0.2em] uppercase">
                  {agent.category}
                </span>
                {agent.verified && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-mono text-emerald-400 uppercase tracking-wide">
                    Verified
                  </span>
                )}
                {agent.featured && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-[#B5532C]/30 bg-[#B5532C]/10 text-[9px] font-mono text-[#B5532C] uppercase tracking-wide">
                    Featured
                  </span>
                )}
              </div>
              <h1 className="font-serif text-3xl md:text-5xl leading-tight tracking-[-0.02em]">
                {agent.displayName}
              </h1>
              {agent.tagline && (
                <p className="mt-2 text-[15px] text-neutral-400 leading-snug max-w-xl">
                  {agent.tagline}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          {agent.description && (
            <p className="text-[15px] text-neutral-300 leading-[1.7] max-w-2xl mb-8">
              {agent.description}
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatBox label="Runs (30d)" value={formatRuns(agent.runs30d)} />
            <StatBox label="Success" value={`${Math.round(agent.successRate * 100)}%`} />
            <StatBox label="Avg time" value={formatDuration(agent.avgDurationMs)} />
            <StatBox
              label="Rating"
              value={agent.avgRating != null ? agent.avgRating.toFixed(1) : "—"}
              sub={agent.reviewCount > 0 ? `${agent.reviewCount} reviews` : undefined}
            />
          </div>

          {/* Install + pricing */}
          <div className="mb-12 p-5 rounded-[6px] border border-white/[0.08] bg-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-500 mb-1">
                  {agent.pricingCents === 0 ? "Free" : "Per run"}
                </p>
                <p className="font-serif text-2xl text-white tabular-nums">
                  {agent.pricingCents === 0 ? "$0" : `$${(agent.pricingCents / 100).toFixed(2)}`}
                </p>
                {agent.creatorHandle && (
                  <p className="mt-1 text-[11px] font-mono text-neutral-500">
                    by <span className="text-neutral-400">{agent.creatorHandle}</span>
                  </p>
                )}
              </div>
              <InstallButton
                slug={agent.slug}
                pricingCents={agent.pricingCents}
              />
            </div>
          </div>

          {/* Tags */}
          {agent.tags.length > 0 && (
            <div className="mb-12">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-500 mb-3">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {agent.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-[3px] border border-white/[0.08] text-[11px] font-mono text-neutral-500 tracking-tight"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-16 pt-10 border-t border-white/[0.05]">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-500 mb-5">
                More in <span className="text-[#B5532C] capitalize">{agent.category}</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {related.map((r, i) => (
                  <AgentCard key={r.slug} agent={r} index={i} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="border-t border-white/[0.05] px-6 py-8 mt-12">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-neutral-600">
          <p>
            © 2026 Sovereign Matrix ·{" "}
            <Link href="/world" className="hover:text-neutral-400">Back to World</Link>
          </p>
          <div className="flex items-center gap-4">
            <Link href="/leaderboard" className="hover:text-[#B5532C] transition-colors">
              Leaderboard
            </Link>
            <Link href="/pricing" className="hover:text-neutral-400 transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="p-3 rounded-[4px] border border-white/[0.06] bg-white/[0.015]">
      <p className="font-serif text-xl text-white tabular-nums leading-tight">{value}</p>
      <p className="mt-0.5 text-[9px] font-mono text-neutral-500 tracking-[0.15em] uppercase">
        {label}
      </p>
      {sub && <p className="text-[9px] font-mono text-neutral-600">{sub}</p>}
    </div>
  );
}

function formatRuns(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}
