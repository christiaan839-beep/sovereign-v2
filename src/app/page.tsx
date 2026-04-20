"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useState } from "react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { StackKiller } from "@/components/cinematic/StackKiller";
import { getMarketingPlaybooks } from "@/lib/playbooks";
import { LiveTerminalDemo } from "@/components/landing/LiveTerminalDemo";
import { LiveRunsPill } from "@/components/landing/LiveRunsPill";
import { KineticHeadline } from "@/components/landing/KineticHeadline";
import { BuiltOnStrip } from "@/components/landing/BuiltOnStrip";
import { FounderSeats } from "@/components/landing/FounderSeats";
import { PrimaryCTA } from "@/components/landing/PrimaryCTA";
import { CommandEgg } from "@/components/landing/CommandEgg";

/**
 * Landing page — 10 sections, editorial palette aligned with
 * /trust, /roi, /built-with-claude, /customers, /platform,
 * /benchmarks. Each section is a function below:
 *
 *   01 Hero  · 02 Three-step proof · 03 Trust strip ·
 *   04 Featured playbooks · 05 Stack Killer · 06 Claude critic ·
 *   07 Founder Network · 08 Ship record · 09 Final CTA · 10 Footer
 *
 * Palette: #030303 base, #B5532C copper accent, Instrument Serif
 * for display, Inter Tight for body, JetBrains Mono for labels.
 */

const HERO_CTA = "/signup";
const PLATFORM_HREF = "/platform";

/**
 * Landing page's featured playbooks are derived from the single
 * source of truth in src/lib/playbooks.ts (any playbook with
 * `marketing: true`). That keeps this file in sync automatically
 * when we add/remove featured playbooks — no more drift between
 * the hardcoded landing list and the actual registry.
 *
 * Outcome + time strings live here because they're positioning copy,
 * not playbook-runtime data (the engine doesn't need the sales version
 * of "50 qualified leads in 3 minutes").
 */
const PLAYBOOK_COPY: Record<string, { outcome: string; time: string }> = {
  "lead-blitz": {
    outcome: "5+ companies with contact angles guaranteed, or the run doesn't count.",
    time: "~3 min",
  },
  "competitor-takedown": {
    outcome: "Full report: weaknesses, market gaps, pricing arbitrage, counter-positioning.",
    time: "~4 min",
  },
  "content-machine": {
    outcome: "1,500+ word post, meta + keywords, plus platform-ready social snippets.",
    time: "~2 min",
  },
  "seo-domination": {
    outcome: "Content velocity score + ranked keyword gaps + topic sequence.",
    time: "~4 min",
  },
  "weekly-report": {
    outcome: "Executive-ready summary: wins, blockers, next steps. Scheduled every Monday.",
    time: "~2 min",
  },
};

// Build the featured array from the source-of-truth registry.
const FEATURED_PLAYBOOKS = getMarketingPlaybooks().map((pb) => {
  const copy = PLAYBOOK_COPY[pb.id] ?? {
    outcome: pb.guarantee ?? pb.description,
    time: pb.estimatedTime,
  };
  return {
    slug: pb.id,
    name: pb.name,
    tagline: pb.tagline,
    outcome: copy.outcome,
    time: copy.time,
  };
});

export default function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#030303] text-white antialiased">
      {/* ═══ NAVIGATION ═══ */}
      <Nav mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} />

      <main id="main-content" className="pt-16">
        {/* ═══ 01 · HERO (with live terminal, runs pill, kinetic headline) ═══ */}
        <Hero />

        {/* ═══ 02 · BUILT-ON TRUST STRIP ═══ */}
        <BuiltOnStrip />

        {/* ═══ 03 · 3-STEP PROOF ═══ */}
        <ThreeStepProof />

        {/* ═══ 04 · TRUST STRIP (sourced stats) ═══ */}
        <TrustStrip />

        {/* ═══ 05 · 5 FEATURED PLAYBOOKS ═══ */}
        <FeaturedPlaybooksSection />

        {/* ═══ 06 · STACK KILLER ═══ */}
        <StackKiller />

        {/* ═══ 07 · CLAUDE CRITIC NARRATIVE ═══ */}
        <ClaudeNarrative />

        {/* ═══ 08 · FOUNDER NETWORK — spatial seats visualization ═══ */}
        <FounderSeats />

        {/* ═══ 09 · SHIP RECORD ═══ */}
        <ShipRecord />

        {/* ═══ 10 · FINAL CTA ═══ */}
        <FinalCTA />
      </main>

      {/* ═══ FOOTER ═══ */}
      <Footer />

      {/* ═══ EASTER EGG · keyboard-triggered command palette ═══ */}
      <CommandEgg />
    </div>
  );
}

/* ─── Nav ───────────────────────────────────────────────────────── */

function Nav({
  mobileNavOpen,
  setMobileNavOpen,
}: {
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
}) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed top-0 inset-x-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between bg-[#030303]/80 backdrop-blur-md border-b border-white/[0.04]">
        <Link href="/" className="flex items-center gap-2.5">
          <SovereignLogo size="sm" />
          <span className="hidden sm:block font-serif text-lg text-white">Sovereign Matrix</span>
        </Link>

        <div className="hidden md:flex items-center gap-7 text-sm">
          <NavLink href="/customers">Customers</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
          <NavLink href="/trust">Trust</NavLink>
          <NavLink href="/platform" subtle>
            For developers →
          </NavLink>
          <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
            <button className="text-neutral-500 hover:text-white transition-colors">
              Log in
            </button>
          </SignInButton>
          <Link
            href={HERO_CTA}
            className="px-4 py-1.5 bg-[#B5532C] text-white font-mono text-xs tracking-wide hover:bg-[#A04527] transition-colors"
          >
            Get Started
          </Link>
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          aria-label="Toggle menu"
        >
          <div className="space-y-1.5">
            <span
              className={`block w-5 h-[1.5px] bg-white transition-transform ${
                mobileNavOpen ? "rotate-45 translate-y-[7px]" : ""
              }`}
            />
            <span
              className={`block w-5 h-[1.5px] bg-white transition-opacity ${
                mobileNavOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-5 h-[1.5px] bg-white transition-transform ${
                mobileNavOpen ? "-rotate-45 -translate-y-[7px]" : ""
              }`}
            />
          </div>
        </button>
      </div>

      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 left-4 right-4 p-5 rounded-2xl md:hidden bg-[#080808]/95 backdrop-blur-2xl border border-white/[0.06] flex flex-col gap-3 shadow-2xl"
          >
            <MobileLink href="/customers" onClick={() => setMobileNavOpen(false)}>
              Customers
            </MobileLink>
            <MobileLink href="/pricing" onClick={() => setMobileNavOpen(false)}>
              Pricing
            </MobileLink>
            <MobileLink href="/trust" onClick={() => setMobileNavOpen(false)}>
              Trust
            </MobileLink>
            <MobileLink href="/platform" onClick={() => setMobileNavOpen(false)}>
              For developers
            </MobileLink>
            <Link
              href={HERO_CTA}
              className="mt-2 px-5 py-2.5 bg-[#B5532C] text-white text-sm text-center font-mono tracking-wide"
              onClick={() => setMobileNavOpen(false)}
            >
              Get Started
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

function NavLink({
  href,
  children,
  subtle,
}: {
  href: string;
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`transition-colors ${
        subtle ? "text-neutral-500 hover:text-[#B5532C]" : "text-neutral-400 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

function MobileLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-neutral-300 hover:text-white py-1"
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

/* ─── 01 · Hero ─────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative px-6 py-24 md:py-32 overflow-hidden">
      {/* Subtle copper radial glow behind the headline */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(181,83,44,0.35) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="mb-6 flex items-center gap-3 flex-wrap"
        >
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C]">
            No Pilot Purgatory · For operators
          </p>
          <span className="hidden md:inline text-neutral-800">·</span>
          <LiveRunsPill />
        </motion.div>

        <KineticHeadline />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.7 }}
          className="max-w-2xl text-lg sm:text-xl text-neutral-400 leading-relaxed mb-10"
        >
          Five pre-built playbooks. Real output in three minutes. Claude as the
          quality critic on every run. No 6-month integration project. No
          developer needed.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex flex-wrap items-center gap-3"
        >
          <PrimaryCTA href={HERO_CTA} variant="hero">
            Run your first playbook
          </PrimaryCTA>
          <Link
            href="/customers"
            className="inline-flex items-center px-6 py-3 border border-white/[0.1] text-neutral-300 font-mono text-sm tracking-wide hover:bg-white/[0.04] hover:text-white transition-colors"
          >
            See customer outcomes →
          </Link>
        </motion.div>

        {/*
          Stat source is cited once in the TrustStrip below; we don't
          repeat it under the hero — the slop agent flagged it as
          citation inflation. Keep the hero clean; TrustStrip does
          the sourcing.
        */}

        <LiveTerminalDemo />
      </div>
    </section>
  );
}

/* ─── 02 · 3-step proof ─────────────────────────────────────────── */

function ThreeStepProof() {
  const steps = [
    {
      time: "0:00",
      title: "Sign up",
      desc: "Email + password. No credit card on free tier. 60 seconds to dashboard.",
    },
    {
      time: "1:00",
      title: "Pick a playbook",
      desc: "Five pre-built workflows: Lead Blitz, Competitor Takedown, Content Machine, SEO Domination, Weekly Report.",
    },
    {
      time: "3:00",
      title: "Get real output",
      desc: "50 enriched leads, a published blog post, or a competitive analysis — not a demo, real deliverables.",
    },
  ];

  return (
    <section className="px-6 py-20 md:py-28 border-t border-white/[0.04]">
      <div className="max-w-5xl mx-auto">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          The proof
        </p>
        <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-16 max-w-3xl">
          Sign up at <em className="not-italic text-[#B5532C]">0:00</em>.
          <br />
          See output at <em className="not-italic text-[#B5532C]">3:00</em>.
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((step) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-[#B5532C]/30 transition-colors"
            >
              <div className="text-2xl font-mono font-semibold tabular-nums text-[#B5532C] mb-3">
                {step.time}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5 tracking-tight">
                {step.title}
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 03 · Trust strip ──────────────────────────────────────────── */

function TrustStrip() {
  const stats = [
    {
      stat: "86%",
      desc: "of AI pilots never reach production",
      sub: "Sovereign: 5-layer pipeline + signed snapshot export",
      source: "RAND AI adoption survey, 2025",
    },
    {
      stat: "80%",
      desc: "of enterprises can't trace what an agent actually did",
      sub: "Sovereign: every run is a checksummed, exportable snapshot",
      source: "Gartner AI observability report, 2026",
    },
    {
      stat: "46%",
      desc: "cite fragmented integrations as the top scaling barrier",
      sub: "Sovereign: 25+ native integrations, MCP-first distribution",
      source: "McKinsey State of AI 2025",
    },
  ];

  return (
    <section className="py-14 px-6 border-y border-[#B5532C]/20 bg-[#0A0807]">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        {stats.map((item) => (
          <motion.div
            key={item.stat}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-3xl font-mono font-semibold tabular-nums text-white mb-2">
              {item.stat}
            </div>
            <p className="text-[12px] text-neutral-400 mb-2 leading-relaxed max-w-xs mx-auto">
              {item.desc}
            </p>
            <p className="text-[10px] text-emerald-400/70 mb-1">{item.sub}</p>
            <p className="text-[9px] text-neutral-600 font-mono italic">
              {item.source}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ─── 04 · Featured playbooks ───────────────────────────────────── */

function FeaturedPlaybooksSection() {
  return (
    <section className="px-6 py-24 md:py-32 border-t border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Five playbooks
        </p>
        <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-4 max-w-3xl">
          Each one guarantees an output
          <br />
          <em className="not-italic text-[#B5532C]">or the run doesn&apos;t count.</em>
        </h2>
        <p className="text-neutral-400 max-w-xl leading-relaxed mb-16">
          Twenty more live inside the dashboard. These five are where most
          customers ship their first measurable win.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURED_PLAYBOOKS.map((pb) => (
            <Link
              key={pb.slug}
              href={`/dashboard/playbooks?auto=${pb.slug}`}
              className="group block p-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-[#B5532C]/50 hover:bg-[#B5532C]/[0.04] transition-colors"
            >
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#B5532C] mb-3">
                {pb.time}
              </p>
              <h3 className="font-serif text-2xl text-white mb-2 leading-tight">
                {pb.name}
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed mb-4">
                {pb.tagline}
              </p>
              <p className="text-[11px] text-neutral-500 font-mono italic mb-4 leading-relaxed">
                {pb.outcome}
              </p>
              <span className="text-[11px] font-mono tracking-wide text-[#B5532C] group-hover:text-white transition-colors">
                Run this →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 06 · Claude critic narrative ──────────────────────────────── */

function ClaudeNarrative() {
  return (
    <section className="px-6 py-24 md:py-32 border-t border-white/[0.04] bg-[#0A0807]">
      <div className="max-w-4xl mx-auto">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Claude as critic
        </p>
        <h2 className="font-serif text-3xl md:text-5xl leading-[1.1] mb-8">
          Cheaper models generate.
          <br />
          <em className="not-italic text-[#B5532C]">Claude checks.</em>
        </h2>
        <p className="text-lg text-neutral-300 leading-relaxed mb-6 max-w-3xl">
          Running Claude on every step of every agent is uneconomical. Running
          it on none of them means you ship hallucinations. Running Claude only
          on the quality-verification gate is how we charge $49 instead of
          $200 — and why your output is still trustworthy.
        </p>
        <p className="text-sm text-neutral-500 leading-relaxed max-w-3xl mb-10">
          Every agent response surfaces{" "}
          <code className="font-mono text-[13px] text-[#B5532C] bg-white/[0.03] px-1.5 py-0.5 rounded">
            modelsConsulted
          </code>{" "}
          and{" "}
          <code className="font-mono text-[13px] text-[#B5532C] bg-white/[0.03] px-1.5 py-0.5 rounded">
            providersConsulted
          </code>
          . Every run is exportable as a cryptographically checksummed snapshot.
          Live production pipeline metrics are at{" "}
          <Link href="/trust/anthropic" className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C] text-white">
            /trust/anthropic
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/trust/anthropic"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#B5532C]/50 text-white font-mono text-sm tracking-wide hover:bg-[#B5532C]/10 transition-colors"
          >
            See production safety metrics →
          </Link>
          <Link
            href="/benchmarks"
            className="inline-flex items-center px-5 py-2.5 border border-white/[0.1] text-neutral-400 font-mono text-sm tracking-wide hover:border-white/30 hover:text-white transition-colors"
          >
            Public benchmark leaderboard →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── 09 · Ship record ──────────────────────────────────────────── */

function ShipRecord() {
  return (
    <section className="px-6 py-20 border-t border-white/[0.04] bg-[#0A0807]">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-8">
        <div className="flex-1">
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-3">
            Ship record
          </p>
          <h2 className="font-serif text-2xl md:text-3xl leading-snug mb-3 max-w-xl">
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/commits/main"
              target="_blank"
              rel="noopener"
              className="text-white hover:text-[#B5532C] transition-colors"
            >
              80+ commits. 12 migrations. 1,165 tests passing.
            </a>
            <br />
            <em className="not-italic text-[#B5532C]">Published weekly.</em>
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed max-w-xl">
            We write session logs, not marketing copy. The{" "}
            <Link
              href="/changelog"
              className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C] text-white"
            >
              /changelog
            </Link>{" "}
            reads the latest SESSION_LOG.md at request time. No CMS, no edits
            after the fact. Engineering transparency as a moat.
          </p>
        </div>
        <Link
          href="/changelog"
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#B5532C]/40 text-[#B5532C] font-mono text-sm tracking-wide hover:bg-[#B5532C] hover:text-white transition-colors whitespace-nowrap"
        >
          Read the ship record →
        </Link>
      </div>
    </section>
  );
}

/* ─── 09 · Final CTA ────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="px-6 py-32 md:py-40 border-t border-white/[0.04]">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-4">
          Get started
        </p>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] mb-8">
          Three minutes.
          <br />
          <em className="not-italic text-[#B5532C]">One playbook.</em>
          <br />
          Real output.
        </h2>
        <p className="text-lg text-neutral-400 mb-10 max-w-xl mx-auto leading-relaxed">
          No credit card. No developer. No 6-month integration. Your first 50
          runs are free; the next tier is $49/mo, $24.50 if you grab a Founder
          Network slot.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <PrimaryCTA href={HERO_CTA} variant="final">
            Run your first playbook
          </PrimaryCTA>
          <a
            href="mailto:christiaan@sovereignmatrix.agency"
            className="inline-flex items-center px-7 py-3.5 border border-white/[0.1] text-neutral-400 font-mono text-sm tracking-wide hover:text-white hover:border-white/30 transition-colors"
          >
            Email the founder
          </a>
        </div>

        <p className="mt-10 text-[11px] font-mono text-neutral-600">
          Questions, partnerships, or a case-study proposal: christiaan@sovereignmatrix.agency
        </p>
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="px-6 py-16 border-t border-white/[0.04] bg-[#020202]">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <FooterCol
            title="Product"
            links={[
              { href: "/customers", label: "Customers" },
              { href: "/pricing", label: "Pricing" },
              { href: "/benchmarks", label: "Benchmarks" },
              { href: "/changelog", label: "Changelog" },
            ]}
          />
          <FooterCol
            title="Trust"
            links={[
              { href: "/trust", label: "Overview" },
              { href: "/trust/anthropic", label: "Claude in production" },
              { href: "/trust/defenders", label: "Defender's ledger" },
              { href: "/.well-known/security.txt", label: "Security contact" },
            ]}
          />
          <FooterCol
            title="For developers"
            links={[
              { href: PLATFORM_HREF, label: "Platform" },
              { href: "/developers/docs", label: "API docs" },
              { href: "https://www.npmjs.com/package/@sovereignmatrix/mcp", label: "@sovereignmatrix/mcp", external: true },
              { href: "https://github.com/christiaan839-beep/sovereign-v2", label: "GitHub", external: true },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { href: "/built-with-claude", label: "Built with Claude" },
              { href: "/roi", label: "ROI calculator" },
              { href: "/terms", label: "Terms" },
              { href: "/privacy", label: "Privacy" },
            ]}
          />
        </div>

        <div className="pt-8 border-t border-white/[0.04] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <SovereignLogo size="sm" />
            <span className="font-serif text-sm text-neutral-400">
              Sovereign Matrix
            </span>
            <span className="text-[10px] font-mono text-neutral-700 ml-4">
              © 2026 · Operates independently · Not formally affiliated with Anthropic
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-600">
            <Link href="/" className="text-[#B5532C]">
              Operators
            </Link>
            <span className="text-neutral-800">·</span>
            <Link href={PLATFORM_HREF} className="hover:text-white transition-colors">
              Developers
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string; external?: boolean }>;
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-500 mb-4">
        {title}
      </p>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener"
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
