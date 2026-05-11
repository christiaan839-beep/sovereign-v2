import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Rocket,
  GitBranch,
  Mail,
} from "lucide-react";

/**
 * /now — what I'm working on right now.
 *
 * The /now page convention (nownownow.com) — keeps a public log of
 * current focus + open-to. Recruiters and prospective collaborators
 * land here to see whether you're available and what you're building.
 *
 * Update this file weekly. Older entries roll into a /changelog.
 */

export const metadata: Metadata = {
  title: "Now — Christiaan de Wet | Sovereign Matrix",
  description:
    "What I'm working on right now, what I'm open to, and what I'm currently learning. Updated weekly.",
  alternates: { canonical: "https://sovereignmatrix.agency/now" },
  openGraph: {
    title: "What Christiaan is working on now",
    description:
      "Current focus + open-to + recent ships. The /now page convention.",
    url: "https://sovereignmatrix.agency/now",
  },
};

const LAST_UPDATED = "May 2026";

const NOW = {
  building: [
    "Sovereign Matrix v2 — multi-tenant AI agent platform. 137 agents, 8-provider unified router, plan-aware $/day budget caps. Public source: github.com/christiaan839-beep/sovereign-v2.",
    "@sovereign/ai-router — extracted as standalone npm package. Zero deps, MIT, 7 tests passing. Routes across Anthropic, OpenAI, Cerebras, NVIDIA NIM, Groq, DeepSeek, and local Ollama with one call.",
    "Agency-replacement positioning for SMBs in emerging markets — sovereignmatrix.agency leads with R349/mo (≈$19) and ZAR-first billing.",
  ],
  shipping: [
    "Real customer-wins layer at /case-studies (DB-backed, drops curated examples below real entries when any exist).",
    "Competitor library at /vs — 16 SEO-indexed comparison pages: lindy, apollo, jasper, autogpt, hubspot, clay, crewai, n8n, zapier, make, manus, sintra, relevance-ai, claude-agents, sovereign, bardeen.",
    "Anthropic partnership thesis at /anthropic — Constitutional-AI-aligned safety pipeline, three concrete asks, AI-pair-programming disclosure.",
  ],
  learning: [
    "Anthropic Constitutional AI paper (re-reading after rebuilding the safety pipeline around its principles).",
    "Stripe payment-intent + idempotent redemption patterns — used to close a credit-minting bypass on the platform.",
    "Postgres row-level security for true multi-tenant isolation — currently enforced via where-clause discipline, exploring RLS as a defense-in-depth move.",
  ],
  openTo: [
    {
      label: "Forward Deployed Engineer",
      desc: "Anthropic, Vercel, LangChain, Cognition, Replicate. Multi-tenant SaaS that customers consume — exactly the shape of work I've shipped.",
    },
    {
      label: "Applied AI Engineer",
      desc: "Anthropic, Mistral, Together, Cohere. Multi-provider routing, model-cost calculus, prompt engineering at scale.",
    },
    {
      label: "Solutions Engineer (AI tools)",
      desc: "Anthropic (EMEA), Vercel, Modal. Translating engineering into procurement decisions; comfortable with ZAR/EU billing realities.",
    },
    {
      label: "Full-stack contracts",
      desc: "Toptal-tier or direct. $50–$100/hr. AI agents, Stripe + Clerk + Drizzle, Next.js 16. Cape Town remote.",
    },
    {
      label: "Founding Engineer at AI agent startups",
      desc: "Pre-seed to Series A, willing to relocate for the right team.",
    },
  ],
  notOpenTo: [
    "Pure ML research roles requiring a PhD or publication record.",
    "Big-tech SDE pipelines that over-index on Leetcode + degree filter.",
    "Crypto / NFT / web3 projects.",
    "Anything that asks me to abandon the AI workflow disclosure (per Anthropic's candidate AI guidance, I disclose Claude pair-programming openly).",
  ],
  recentlyShipped: [
    {
      what: "Postgres-backed daily $ spend cap (replaces in-memory Map that silently reset on cold starts).",
      file: "src/lib/budget-controls.ts",
    },
    {
      what: "Stripe payment-intent verification with idempotent redemption — closed a credit-minting bypass.",
      file: "src/app/api/credits/route.ts",
    },
    {
      what: "Migration parity check in CI — verifies every declared pgTable exists in Neon before merging.",
      file: "scripts/check-migrations.mjs",
    },
    {
      what: "5 production runbooks (DB down · migration drift · Clerk JWKS · Stripe rotation · smoke red).",
      file: "docs/runbooks/",
    },
  ],
};

export default function NowPage() {
  return (
    <main className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <Link
          href="/anthropic"
          className="px-4 py-2 rounded-full border border-white/15 text-xs font-semibold hover:border-white/30 transition-colors"
        >
          For Anthropic →
        </Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-4">
          /now · updated {LAST_UPDATED}
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
          What I&apos;m working on{" "}
          <em className="not-italic" style={{ color: "#B5532C" }}>
            right now
          </em>
          .
        </h1>
        <p className="text-base text-neutral-400 leading-relaxed mb-12 max-w-xl">
          The{" "}
          <a
            href="https://nownownow.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/20 hover:decoration-white/60"
          >
            /now page
          </a>{" "}
          convention — current focus, open-to, and what&apos;s recently shipped.
          No marketing voice; just what is.
        </p>

        <Section icon={Rocket} title="Building">
          {NOW.building.map((item) => (
            <Bullet key={item}>{item}</Bullet>
          ))}
        </Section>

        <Section icon={GitBranch} title="Shipping right now">
          {NOW.shipping.map((item) => (
            <Bullet key={item}>{item}</Bullet>
          ))}
        </Section>

        <Section icon={Sparkles} title="Learning">
          {NOW.learning.map((item) => (
            <Bullet key={item}>{item}</Bullet>
          ))}
        </Section>

        <Section icon={Mail} title="Open to">
          <ul className="space-y-3">
            {NOW.openTo.map(({ label, desc }) => (
              <li
                key={label}
                className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]"
              >
                <ArrowRight className="w-4 h-4 text-[#B5532C] mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-white text-sm mb-1">
                    {label}
                  </p>
                  <p className="text-[13px] text-neutral-400 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Not open to">
          <ul className="space-y-1.5">
            {NOW.notOpenTo.map((item) => (
              <li
                key={item}
                className="text-[13px] text-neutral-500 leading-relaxed before:content-['—'] before:mr-2 before:text-neutral-700"
              >
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Recently shipped">
          <ul className="space-y-3">
            {NOW.recentlyShipped.map(({ what, file }) => (
              <li key={file} className="text-sm text-neutral-300">
                <p className="leading-relaxed">{what}</p>
                <p className="text-[11px] font-mono text-neutral-600 mt-1">
                  {file}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <div className="mt-16 pt-8 border-t border-white/[0.06]">
          <p className="text-sm text-neutral-400 mb-4">Best way to reach me:</p>
          <a
            href="mailto:christiaan@sovereignmatrix.agency"
            className="inline-flex items-center gap-2 text-base text-white hover:text-[#B5532C] transition-colors"
          >
            christiaan@sovereignmatrix.agency
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="mt-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-white uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" />
            Home
          </Link>
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-4 h-4 text-[#B5532C]" />}
        <h2 className="text-[11px] font-mono uppercase tracking-[0.25em] text-neutral-500">
          {title}
        </h2>
      </div>
      <div className="text-sm text-neutral-300">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p className="leading-relaxed mb-3 pl-4 border-l border-white/[0.08]">
      {children}
    </p>
  );
}
