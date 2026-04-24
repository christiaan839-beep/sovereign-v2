/**
 * /marketplace/starter-packs — 5 curated industry bundles.
 *
 * First-party "recipes" that answer the buyer question "where do I start
 * with 223 agents?" — each bundle is a ready-made 4-agent combination
 * with a specific vertical use case + value narrative.
 *
 * Server component. Pulls from `src/lib/starter-bundles.ts` (code
 * catalog, no DB). Each bundle card shows:
 *   - Industry badge + accent-color glow
 *   - 4 agent sigils in a row
 *   - Name + tagline + description
 *   - Use case bullets
 *   - "Estimated monthly value" narrative
 *   - "Open in playground" CTA
 */

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { STARTER_BUNDLES, totalAddressableValueUsd } from "@/lib/starter-bundles";
import { AgentSigil } from "@/components/agent/AgentSigil";

export const metadata: Metadata = {
  title: "Starter packs — curated industry bundles · Sovereign Matrix",
  description:
    "5 first-party bundles for insurance, logistics, healthcare coding, construction, and agriculture. Each is a ready-made 4-agent recipe with a specific vertical use case. No setup — click to open in the playground.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/marketplace/starter-packs",
  },
  openGraph: {
    title: "Sovereign Matrix Starter Packs",
    description:
      "5 curated bundles — insurance, logistics, healthcare, construction, agriculture. Ready-made 4-agent recipes.",
    url: "https://sovereignmatrix.agency/marketplace/starter-packs",
    type: "website",
  },
};

const totalValue = totalAddressableValueUsd();

export default function StarterPacksPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <div className="flex items-center gap-5 text-[13px]">
          <Link href="/marketplace" className="text-neutral-400 hover:text-white transition-colors">
            Marketplace
          </Link>
          <Link href="/compare" className="text-neutral-400 hover:text-white transition-colors">
            Compare
          </Link>
          <Link href="/playground" className="text-neutral-400 hover:text-white transition-colors">
            Playground
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-4">
            Starter packs · 5 curated bundles
          </p>
          <h1 className="ed-display text-4xl md:text-6xl mb-5">
            Where to start<br />
            <span className="ed-display-italic text-[#B5532C]">with 223 agents.</span>
          </h1>
          <p className="text-neutral-400 text-base md:text-lg max-w-xl mx-auto leading-relaxed mb-6">
            Each pack is a 4-agent recipe built around one industry&apos;s
            core workflow. Click any to open the first agent in the playground
            — no signup, no card, run it in 30 seconds.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#B5532C]/20 bg-[#B5532C]/[0.06] text-[13px]">
            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-[0.2em]">
              Combined addressable value
            </span>
            <span className="text-white font-semibold">
              ${(totalValue / 1000).toFixed(0)}K / mo
            </span>
          </div>
        </div>
      </section>

      {/* Bundles grid */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
          {STARTER_BUNDLES.map((bundle) => (
            <BundleCard key={bundle.slug} bundle={bundle} />
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-6 border-t border-white/[0.04] text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="ed-display text-3xl md:text-4xl mb-4">
            Want a custom pack?<br />
            <span className="ed-display-italic text-[#B5532C]">Build one.</span>
          </h2>
          <p className="text-neutral-400 text-sm mb-6">
            Creators can publish their own bundles with 70/30 revenue share.
            Mix any 2-8 agents, set a bundle price, and the marketplace routes
            monthly earnings to your Stripe Connect account.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/creators/apply"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[4px] bg-[#B5532C] hover:bg-[#C96234] text-white text-sm font-semibold transition-colors"
            >
              Become a creator
            </Link>
            <Link
              href="/spec/agent-manifest"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[4px] border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
            >
              Read the SAM v1.0 spec
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function BundleCard({ bundle }: { bundle: (typeof STARTER_BUNDLES)[number] }) {
  const firstSlug = bundle.agents[0]?.slug;
  return (
    <div
      className="group relative rounded-[8px] border border-white/[0.06] bg-[#060606] p-6 md:p-7 hover:border-white/[0.14] transition-colors overflow-hidden"
    >
      {/* Accent corner glow — matches bundle's industry color */}
      <div
        aria-hidden="true"
        className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-[0.08] blur-2xl pointer-events-none"
        style={{ background: bundle.accentColor }}
      />

      {/* Header */}
      <div className="relative mb-4 flex items-center gap-3 flex-wrap">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[10px] font-mono uppercase tracking-[0.18em]"
          style={{
            background: `${bundle.accentColor}14`,
            color: bundle.accentColor,
          }}
        >
          {bundle.industry}
        </span>
        <span className="font-mono text-[10px] text-neutral-600">
          {bundle.agents.length} agents
        </span>
        <span className="font-mono text-[10px] text-neutral-600 ml-auto">
          ~${(bundle.estimatedMonthlyValueUsd / 1000).toFixed(1)}K/mo value
        </span>
      </div>

      {/* Sigil row */}
      <div className="relative mb-5 flex items-center gap-2">
        {bundle.agents.map((a) => (
          <span
            key={a.slug}
            className="rounded-[6px] overflow-hidden shadow-lg transition-transform group-hover:scale-[1.03]"
            title={a.displayName}
          >
            <AgentSigil
              slug={a.slug}
              category={a.category}
              size={56}
              detail="normal"
            />
          </span>
        ))}
      </div>

      {/* Title + tagline */}
      <h2 className="relative font-serif text-2xl md:text-3xl leading-tight mb-2 text-white">
        {bundle.name}
      </h2>
      <p className="relative text-[13px] text-neutral-400 mb-4 leading-relaxed">
        {bundle.tagline}
      </p>

      {/* Description */}
      <p className="relative text-[13px] text-neutral-500 mb-5 leading-relaxed">
        {bundle.description}
      </p>

      {/* Use cases */}
      <ul className="relative space-y-1.5 mb-5">
        {bundle.useCases.map((uc) => (
          <li
            key={uc}
            className="flex items-start gap-2 text-[12px] text-neutral-400 leading-snug"
          >
            <Check
              className="w-3 h-3 shrink-0 mt-0.5"
              style={{ color: bundle.accentColor }}
            />
            <span>{uc}</span>
          </li>
        ))}
      </ul>

      {/* CTAs */}
      <div className="relative flex items-center gap-3 flex-wrap pt-4 border-t border-white/[0.04]">
        {firstSlug && (
          <Link
            href={`/playground?agent=${firstSlug}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[4px] text-sm font-semibold transition-colors"
            style={{
              background: bundle.accentColor,
              color: "#030303",
            }}
          >
            Try in playground <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
        <Link
          href={`/agents/${firstSlug ?? ""}`}
          className="font-mono text-[11px] text-neutral-500 hover:text-white transition-colors"
        >
          Browse first agent →
        </Link>
      </div>
    </div>
  );
}
