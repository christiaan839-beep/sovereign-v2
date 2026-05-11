import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, X, Minus, ArrowRight, ArrowLeft } from "lucide-react";
import {
  getCompetitor,
  COMPETITORS,
  HAND_CODED_VS_SLUGS,
} from "@/lib/competitor-registry";
import { JsonLd } from "@/components/seo/JsonLd";

/**
 * /vs/[slug] — registry-driven competitor comparison page.
 *
 * Hand-coded /vs/<slug>/page.tsx routes (lindy, clay, etc.) take
 * precedence in Next.js static-vs-dynamic routing. This catch-all
 * serves any competitor declared in src/lib/competitor-registry.ts.
 *
 * Every page is fully server-rendered with rich metadata + JSON-LD
 * comparison schema. The structure mirrors the hand-coded pages so the
 * site reads as one coherent comparison library, not a Frankenstein.
 */

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = true;
export const revalidate = 3600; // 1 hour — registry rarely changes

export async function generateStaticParams() {
  // Pre-render every registry entry at build time so /vs/<x> is static
  // (fast + great for SEO). Hand-coded pages already exist as their own
  // segments, so we exclude them.
  return COMPETITORS.filter((c) => !HAND_CODED_VS_SLUGS.has(c.slug)).map(
    (c) => ({ slug: c.slug }),
  );
}

export async function generateMetadata({
  params,
}: RouteContext): Promise<Metadata> {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) {
    return { title: "Comparison Not Found | Sovereign Matrix" };
  }
  const title = `Sovereign Matrix vs ${competitor.name} | Honest Comparison`;
  const description = competitor.honestSummary.slice(0, 158);
  const url = `https://sovereignmatrix.agency/vs/${competitor.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function CellIcon({ value }: { value: boolean | "partial" }) {
  if (value === true)
    return <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (value === false)
    return <X className="w-4 h-4 text-neutral-700 mx-auto" />;
  return <Minus className="w-4 h-4 text-amber-400/60 mx-auto" />;
}

export default async function VsCompetitorPage({ params }: RouteContext) {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) notFound();

  const compareSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `Sovereign Matrix vs ${competitor.name}`,
    description: competitor.honestSummary,
    about: { "@type": "SoftwareApplication", name: competitor.name },
  };

  return (
    <main className="min-h-screen bg-[#010101] text-white">
      <JsonLd data={compareSchema} />

      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <Link
          href="/signup"
          className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors"
        >
          Try Free
        </Link>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">
          Honest Comparison
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
          Sovereign Matrix
          <br />
          <span className="text-neutral-500">vs {competitor.name}</span>
        </h1>
        <p className="text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          {competitor.honestSummary}
        </p>
        {competitor.audience && (
          <p className="text-[11px] text-neutral-600 mt-4 uppercase tracking-widest">
            For: {competitor.audience}
          </p>
        )}
      </section>

      {/* Pricing callout */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-[#080808] text-center">
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">
              {competitor.name}
            </p>
            <p className="text-3xl font-black text-white">
              {competitor.theirPricing}
            </p>
            <p className="text-[11px] text-neutral-500 mt-2">
              {competitor.theirTagline}
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] text-center">
            <p className="text-[10px] text-emerald-400 uppercase tracking-widest mb-2">
              Sovereign Matrix
            </p>
            <p className="text-3xl font-black text-white">
              {competitor.ourPricing}
            </p>
            <p className="text-[11px] text-emerald-400/80 mt-2">
              130+ agents · Whitelabel · ZAR / USD billing
            </p>
          </div>
        </div>
      </section>

      {/* Comparison matrix */}
      {competitor.comparison.length > 0 && (
        <section className="px-6 pb-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-black mb-8 text-center">
              Feature-by-feature
            </h2>
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/[0.06]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      Feature
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-400 w-32 text-center">
                      Sovereign
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 w-32 text-center">
                      {competitor.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {competitor.comparison.map((row) => (
                    <tr
                      key={row.feature}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-neutral-200">
                        <div>{row.feature}</div>
                        {row.note && (
                          <div className="text-[11px] text-neutral-500 mt-1">
                            {row.note}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CellIcon value={row.sovereign} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CellIcon value={row.competitor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Positioning narrative */}
      {competitor.positioning.length > 0 && (
        <section className="px-6 pb-20">
          <div className="max-w-3xl mx-auto space-y-5">
            <h2 className="text-2xl font-black mb-6">When to pick which</h2>
            {competitor.positioning.map((paragraph, i) => (
              <p key={i} className="text-base text-neutral-300 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="px-6 pb-24">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/[0.08] bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-10 text-center">
          <h3 className="text-2xl font-black mb-3">
            Try the {competitor.name} alternative free
          </h3>
          <p className="text-sm text-neutral-400 mb-6 max-w-md mx-auto">
            50 agent runs/month on the Free tier. No credit card. Cancel with
            one click — never per-seat.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 transition-colors"
            >
              Start Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/case-studies"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/15 text-sm font-semibold hover:border-white/30 transition-colors"
            >
              See real customer wins
            </Link>
          </div>
          {competitor.url && (
            <p className="text-[11px] text-neutral-600 mt-6">
              <a
                href={competitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neutral-400"
              >
                Or visit {competitor.name}&apos;s site →
              </a>
            </p>
          )}
        </div>
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-white uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
