"use client";

import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { getMarketingPlaybooks } from "@/lib/playbooks";
import { PrimaryCTA } from "@/components/landing/PrimaryCTA";
import { StatusIndicator } from "@/components/landing/StatusIndicator";
import { trackCtaClick } from "@/lib/cta-track";
import { TiltCard } from "@/components/ui/EliteEffects";

// Above-the-fold — static-imported so they ship in the initial chunk.
import { LiveProofStrip } from "@/components/landing/LiveProofStrip";
import { LivePlatformMetrics } from "@/components/landing/LivePlatformMetrics";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { ThreeMoatsGrid } from "@/components/landing/ThreeMoatsGrid";
import { A2EEconomySection } from "@/components/landing/A2EEconomySection";
import { ModelRouterSection } from "@/components/landing/ModelRouterSection";
import { VerificationPipeline } from "@/components/landing/VerificationPipeline";

// Below-the-fold / decorative / network-dependent — code-split via
// next/dynamic. The browser fetches each chunk only when React
// commits the node, cutting the initial JS payload significantly
// (3 live demos + ConstellationField + RecentRunsTicker = ~1,500 LOC
// moved out of the first-paint budget).
//
// `ssr: false` is deliberate for components that:
//   - rely on browser APIs (canvas, IntersectionObserver)
//   - fetch at mount (wastes SSR cycles)
//   - are decorative / don't impact SEO
const ConstellationField = dynamic(
  () =>
    import("@/components/landing/ConstellationField").then((m) => ({
      default: m.ConstellationField,
    })),
  { ssr: false, loading: () => null },
);
const RecentRunsTicker = dynamic(
  () =>
    import("@/components/landing/RecentRunsTicker").then((m) => ({
      default: m.RecentRunsTicker,
    })),
  { ssr: false, loading: () => null },
);
const AgentBuilderLiveDemo = dynamic(
  () =>
    import("@/components/landing/AgentBuilderLiveDemo").then((m) => ({
      default: m.AgentBuilderLiveDemo,
    })),
  { ssr: false, loading: () => null },
);
const PlaybookBuilderLiveDemo = dynamic(
  () =>
    import("@/components/landing/PlaybookBuilderLiveDemo").then((m) => ({
      default: m.PlaybookBuilderLiveDemo,
    })),
  { ssr: false, loading: () => null },
);
const CostOptimizerLiveDemo = dynamic(
  () =>
    import("@/components/landing/CostOptimizerLiveDemo").then((m) => ({
      default: m.CostOptimizerLiveDemo,
    })),
  { ssr: false, loading: () => null },
);
const FounderSeats = dynamic(
  () =>
    import("@/components/landing/FounderSeats").then((m) => ({
      default: m.FounderSeats,
    })),
  { ssr: false, loading: () => null },
);
const CommandEgg = dynamic(
  () =>
    import("@/components/landing/CommandEgg").then((m) => ({
      default: m.CommandEgg,
    })),
  { ssr: false, loading: () => null },
);

/**
 * Landing page — Agent Infrastructure Stack narrative.
 * Palette: #030303 base · #B5532C copper · Instrument Serif · Inter Tight · JetBrains Mono
 *
 * Section map (as of the landing-redesign in docs/superpowers/specs/
 * 2026-04-21-landing-redesign-design.md — 10 sections consolidated to 7):
 *
 *   Nav · 01 Hero · LiveProofStrip · RecentRunsTicker ·
 *   02 ThreeMoats · 03 A2EEconomy · 04 MemoryMoat ·
 *   05 ModelRouter · 06 VerificationPipeline · 07 FeaturedPlaybooks ·
 *   08 ProofStrip (merged: scale + industries + stack-kill) ·
 *   10 PricingStrip · FounderSeats · FinalCTA · Footer · CommandEgg
 */

const HERO_CTA = "/signup";
const PLATFORM_HREF = "/platform";

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
      <Nav mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} />

      <main id="main-content">
        {/* 01 · Hero */}
        <Hero />

        {/* Live stats strip */}
        <LiveProofStrip />

        {/*
         * Rolling ticker of the last few real playbook completions.
         * Hidden entirely when there's no run data — no fake activity
         * on a fresh deploy. See src/components/landing/RecentRunsTicker.tsx.
         */}
        <RecentRunsTicker />

        {/* 02 · Three Moats */}
        <ThreeMoatsGrid />

        {/* 03 · A2E Economy */}
        <A2EEconomySection />

        {/* 04 · Memory Moat */}
        <MemoryMoat />

        {/* 05 · Model Router */}
        <ModelRouterSection />

        {/* 06 · Verification Pipeline */}
        <VerificationPipeline />

        {/* 06a · Live platform metrics — honest uptime + P95 + cache */}
        <LivePlatformMetrics />

        {/* 07 · Featured Playbooks */}
        <FeaturedPlaybooksSection />

        {/* 08 · Proof Strip — consolidates scale + industries + stack-kill */}
        <ProofStrip />

        {/* 09 · Agent Builder live demo — type agent, watch it built */}
        <AgentBuilderLiveDemo />

        {/* 10 · Playbook Builder live demo — type goal, watch it orchestrated */}
        <PlaybookBuilderLiveDemo />

        {/* 11 · Cost Optimizer live demo — see how we route cheap when we can */}
        <CostOptimizerLiveDemo />

        {/* 12 · Pricing Strip */}
        <PricingStrip />

        {/* Founder network seats */}
        <FounderSeats />

        {/* Final CTA */}
        <FinalCTA />
      </main>

      <Footer />
      <CommandEgg />
    </div>
  );
}

/* ─── SectionHead ───────────────────────────────────────────────── */
function SectionHead({ n, label }: { n: string; label: string }) {
  return (
    <div className="mb-8 flex items-center gap-4 flex-wrap">
      <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">{n} / 10</span>
      <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
      <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">{label}</p>
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
  // Nav is now always pinned — useHideyNav removed in commit 3/7 of
  // the landing redesign. A scrolled state still toggles the backdrop
  // blur so the nav reads cleanly on both dark and content sections.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50"
      aria-label="Primary"
    >
      <div
        className={`relative transition-[background] duration-300 ${
          scrolled || mobileNavOpen
            ? "bg-[#030303]/90 backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div
          className={`absolute inset-x-0 bottom-0 h-px transition-opacity duration-500 pointer-events-none ${scrolled ? "opacity-100" : "opacity-0"}`}
          style={{
            background: "linear-gradient(to right, transparent 0%, rgba(181,83,44,0.45) 50%, transparent 100%)",
          }}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-6 md:px-10 h-[60px] flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5 flex-shrink-0" aria-label="Sovereign Matrix — Home">
            <SovereignLogo size="sm" />
            <span className="hidden sm:block font-serif text-[17px] tracking-tight text-white group-hover:text-[#E8DDD0] transition-colors">
              Sovereign Matrix
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-0 text-[13px]">
            <div className="flex items-center gap-6 mr-6">
              <NavLink href={PLATFORM_HREF}>Platform</NavLink>
              <NavLink href="/agents">Directory</NavLink>
              <NavLink href="/marketplace">Marketplace</NavLink>
              <NavLink href="/compare">Compare</NavLink>
              <NavLink href="/trust">Trust</NavLink>
              <NavLink href="/pricing">Pricing</NavLink>
              <NavLink href="/developers/docs">Docs</NavLink>
            </div>

            <span aria-hidden="true" className="h-4 w-px bg-white/[0.07] mr-6" />

            <div
              className="group hidden xl:flex items-center gap-1.5 text-neutral-700 hover:text-neutral-500 text-[11px] font-mono select-none cursor-default transition-colors mr-6"
              title="Press / to open the command palette"
            >
              <kbd className="rounded-[3px] border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 text-[10px] text-neutral-600 group-hover:text-neutral-400 group-hover:border-white/[0.12] transition-colors">
                /
              </kbd>
            </div>

            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
              <button className="text-neutral-500 hover:text-white transition-colors text-[13px] tracking-tight mr-4">
                Log in
              </button>
            </SignInButton>

            <Link
              href={HERO_CTA}
              className="group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#B5532C] text-white font-medium text-[12.5px] tracking-tight rounded-[3px] hover:bg-[#C96234] transition-colors"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ boxShadow: "0 0 0 1px rgba(181,83,44,0.6), 0 0 16px rgba(181,83,44,0.3)" }}
              />
              Run Free Agent
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>

          <div className="md:hidden flex items-center gap-3">
            <button
              className="p-2 -mr-2 text-neutral-400 hover:text-white transition-colors"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
            >
              <div className="space-y-1.5">
                <span className={`block w-5 h-[1.5px] bg-current transition-transform ${mobileNavOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
                <span className={`block w-5 h-[1.5px] bg-current transition-opacity ${mobileNavOpen ? "opacity-0" : ""}`} />
                <span className={`block w-5 h-[1.5px] bg-current transition-transform ${mobileNavOpen ? "-rotate-45 -translate-y-[7px]" : ""}`} />
              </div>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-[60px] left-4 right-4 p-5 rounded-[6px] md:hidden bg-[#0A0807]/97 backdrop-blur-2xl border border-white/[0.07] flex flex-col gap-1 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)]"
          >
            {[
              { href: PLATFORM_HREF, label: "Platform" },
              { href: "/agents", label: "Directory — 218 agents" },
              { href: "/marketplace", label: "Marketplace" },
              { href: "/compare", label: "Compare vs. others" },
              { href: "/trust", label: "Trust" },
              { href: "/pricing", label: "Pricing" },
              { href: "/developers/docs", label: "Docs" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[15px] text-neutral-200 hover:text-white py-1.5 tracking-tight"
                onClick={() => setMobileNavOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            <Link
              href={HERO_CTA}
              className="mt-2 px-5 py-2.5 bg-[#B5532C] text-white text-sm text-center font-medium rounded-[3px] hover:bg-[#C96234] transition-colors"
              onClick={() => setMobileNavOpen(false)}
            >
              Run Free Agent →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative text-neutral-400 hover:text-white transition-colors tracking-tight"
    >
      {children}
      <span
        aria-hidden="true"
        className="absolute -bottom-0.5 left-0 right-0 h-px scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left"
        style={{ background: "rgba(181,83,44,0.6)" }}
      />
    </Link>
  );
}

/* ─── 01 · Hero ─────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 pb-16 overflow-hidden">
      {/*
       * ConstellationField — 75-node copper particle mesh with proximity lines.
       * Wrapped in a 22%-opacity div (was ~45% inline on ConstellationField
       * itself + 45% A2EGraph overlay previously — the combined backdrop was
       * too busy for a calm hero). Drops to 22% as one clean layer.
       */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ opacity: 0.22 }}>
        <ConstellationField className="absolute inset-0 w-full h-full" />
      </div>

      {/* Copper radial glow — warm centre bloom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 65% 55% at 50% 38%, rgba(181,83,44,0.07) 0%, transparent 60%)",
        }}
        aria-hidden="true"
      />

      {/* Subtle vignette — edges dark, focus on centre */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 110% 100% at 50% 50%, transparent 40%, rgba(3,3,3,0.55) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Bottom fade for smooth section transition */}
      <div
        className="absolute bottom-0 inset-x-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent 0%, #030303 100%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto w-full text-center">
        {/* Pre-badge: live indicator */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
          className="flex items-center justify-center gap-3 mb-8 flex-wrap"
        >
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">01 / 10</span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-500">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#B5532C] opacity-70 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#B5532C]" />
            </span>
            <span>218 agents</span>
            <span className="text-neutral-700">·</span>
            <span>39 models</span>
            <span className="text-neutral-700">·</span>
            <span className="text-[#B5532C]">LIVE</span>
          </div>
        </motion.div>

        {/* Headline — one step smaller across breakpoints for a calmer hero */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="ed-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-[-0.01em] mb-6"
          style={{ fontFamily: "'Instrument Serif', 'GT Sectra', 'Cormorant Garamond', Georgia, serif" }}
        >
          <span className="block text-white">The Agent</span>
          <span className="block ed-display-italic" style={{ color: "#B5532C", fontStyle: "italic" }}>Infrastructure</span>
          <span className="block" style={{ color: "#B5532C" }}>Stack.</span>
        </motion.h1>

        {/* Sub-headline — condensed to one line for faster scan */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="text-[15px] md:text-[17px] text-neutral-400 leading-[1.55] mb-10 max-w-2xl mx-auto"
        >
          203 verified agents. 39 models. 5-layer safety pipeline. 70/30 creator earnings with SLA-triggered refunds.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
        >
          <PrimaryCTA href={HERO_CTA} variant="hero">
            Run a Free Playbook
          </PrimaryCTA>
          <Link
            href="/marketplace"
            className="group inline-flex items-center gap-1.5 px-6 py-3.5 border border-white/[0.12] text-neutral-400 hover:text-white hover:border-white/25 font-mono text-[13px] tracking-tight transition-colors rounded-[3px]"
          >
            Explore the Marketplace
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </motion.div>

        {/* Pricing micro-line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-[11px] font-mono text-neutral-600 tracking-wide mb-12"
        >
          Free · $49/mo · $499/mo ·{" "}
          <Link href="/pricing" className="hover:text-neutral-400 transition-colors underline decoration-white/10 hover:decoration-white/30">
            no card on free tier
          </Link>
        </motion.p>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="flex justify-center"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          >
            <svg width="14" height="20" viewBox="0 0 14 20" fill="none" className="text-neutral-700">
              <path d="M7 2v10M3.5 8.5L7 12l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── 04 · Memory Moat ──────────────────────────────────────────── */
function MemoryMoat() {
  const timeline = [
    {
      label: "Day 1",
      desc: "Run a Lead Blitz for SaaS companies in London. Agents find 8 prospects.",
    },
    {
      label: "Week 2",
      desc: "Run a Competitor Takedown. Agents remember the London SaaS context — no re-briefing.",
    },
    {
      label: "Month 2",
      desc: "A new Lead run auto-recalls past niches, past angles, past conversion signals.",
    },
    {
      label: "Month 6",
      desc: "Your agents know your ICP, your tone, your past campaigns, and your live competitor set. New runs start from six months of context, not a blank prompt.",
    },
  ];

  const nodeOpacity = [0.35, 0.55, 0.75, 1.0];

  return (
    <section className="relative px-6 py-28 md:py-40 bg-[#040303] overflow-hidden">
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 h-[600px] w-[500px] opacity-[0.07] blur-[140px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(181,83,44,1) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto">
        <SectionHead n="04" label="the compounding moat" />

        <div className="grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="font-serif text-3xl md:text-5xl lg:text-[48px] leading-[1.08] mb-6 tracking-[-0.02em]">
              Agents that get
              <br />
              <em className="not-italic text-[#B5532C]">smarter every run.</em>
            </h2>
            <p className="text-[16px] text-neutral-400 leading-[1.65] mb-6 max-w-md">
              Every execution is embedded in semantic memory — 1024-dimensional
              vectors that capture what you worked on, what worked, and
              what your business is about. Future agents retrieve relevant
              context automatically. No re-briefing. No lost context.
            </p>
            <p className="text-[14px] text-neutral-500 leading-[1.7] max-w-md mb-8 font-serif italic">
              After six months of use, your Sovereign agents know your niche,
              your tone, your past campaigns, your competitors, and your
              customers. That institutional knowledge is yours — and it
              compounds with every run.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-[13px] font-mono text-[#B5532C] hover:text-white transition-colors tracking-tight"
            >
              Start building your memory →
            </Link>
          </div>

          <div className="relative">
            <div
              className="absolute left-5 top-6 bottom-6 w-px -translate-x-1/2"
              style={{ background: "linear-gradient(to bottom, rgba(181,83,44,0.25) 0%, rgba(181,83,44,0.9) 100%)" }}
              aria-hidden="true"
            />

            <div className="space-y-8">
              {timeline.map((item, i) => (
                <div
                  key={item.label}
                  className="relative flex gap-5"
                >
                  <div
                    className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center"
                    style={{
                      background: `rgba(181,83,44,${0.04 + nodeOpacity[i] * 0.06})`,
                      borderColor: `rgba(181,83,44,${0.2 + nodeOpacity[i] * 0.4})`,
                    }}
                  >
                    <span className="font-mono text-[9px] text-neutral-400 tracking-wide">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="pt-1.5">
                    <p
                      className="font-mono text-[10px] tracking-[0.18em] uppercase mb-1.5"
                      style={{ color: `rgba(181,83,44,${0.6 + nodeOpacity[i] * 0.4})` }}
                    >
                      {item.label}
                    </p>
                    <p className="text-[14px] text-neutral-300 leading-[1.6]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-10 text-[10px] font-mono text-neutral-700 leading-relaxed pl-[60px]">
              Powered by NVIDIA NIM embeddings (nvidia/nv-embedqa-e5-v5, 1024-dim) ·
              Stored in your private tenant namespace · Never shared across users
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 07 · Featured Playbooks ───────────────────────────────────── */
function FeaturedPlaybooksSection() {
  return (
    <section className="px-6 py-28 md:py-36 bg-[#040303]">
      <div className="max-w-6xl mx-auto">
        <SectionHead n="07" label="five playbooks" />
        <h2 className="font-serif text-3xl md:text-5xl lg:text-[58px] leading-[1.06] mb-5 max-w-3xl tracking-[-0.02em]">
          Each one guarantees an output
          <br />
          <em className="not-italic text-[#B5532C]">or the run doesn&apos;t count.</em>
        </h2>
        <p className="text-neutral-400 max-w-xl leading-relaxed mb-16 text-[15px]">
          Twenty more live inside the dashboard. These five are where most
          customers ship their first measurable win.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURED_PLAYBOOKS.map((pb) => (
            <TiltCard key={pb.slug} tiltStrength={6} className="h-full">
              <Link
                href={`/dashboard/playbooks?auto=${pb.slug}`}
                onClick={() => trackCtaClick("playbook-card")}
                className="group relative block h-full p-6 rounded-[6px] border border-white/[0.06] bg-white/[0.025] hover:border-[#B5532C]/35 hover:bg-[#B5532C]/[0.04] transition-all duration-300 overflow-hidden"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 0 rgba(0,0,0,0.5)" }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: "radial-gradient(circle at 30% 0%, rgba(181,83,44,0.18) 0%, transparent 45%)",
                  }}
                />
                <p className="relative text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-500 mb-3">
                  {pb.time}
                </p>
                <h3 className="relative font-serif text-2xl text-white mb-2 leading-tight tracking-tight">
                  {pb.name}
                </h3>
                <p className="relative text-sm text-neutral-400 leading-relaxed mb-4">{pb.tagline}</p>
                <p className="relative text-[11px] text-neutral-500 font-mono italic mb-4 leading-relaxed">
                  {pb.outcome}
                </p>
                <span className="relative text-[11px] font-mono tracking-wide text-neutral-500 group-hover:text-[#B5532C] transition-colors">
                  Run this →
                </span>
              </Link>
            </TiltCard>
          ))}

          <Link
            href="/dashboard/playbooks"
            className="group relative flex flex-col justify-between h-full p-6 rounded-[6px] border border-dashed border-white/[0.07] hover:border-[#B5532C]/30 transition-all duration-300"
          >
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-600 mb-3">
                25+ playbooks
              </p>
              <h3 className="font-serif text-2xl text-neutral-500 group-hover:text-white transition-colors leading-tight tracking-tight mb-2">
                View all playbooks
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Lead gen, content, research, competitive intel, reporting, and more — all with the same 5-layer guarantee.
              </p>
            </div>
            <span className="mt-6 text-[11px] font-mono tracking-wide text-neutral-600 group-hover:text-[#B5532C] transition-colors">
              Browse library →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── 12 · Pricing Strip ────────────────────────────────────────── */
function PricingStrip() {
  const tiers = [
    { name: "Free",       price: null,   popular: false },
    { name: "Starter",    price: "$19",  popular: false },
    { name: "Growth",     price: "$49",  popular: true  },
    { name: "Node",       price: "$199", popular: false },
    { name: "Enterprise", price: "$499", popular: false },
  ];

  return (
    <section className="editorial-dark px-6 py-24 md:py-32"
             style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-4xl mx-auto">
        <p className="ed-label mb-8" style={{ color: "var(--ed-copper)" }}>
          Section 12 · Pricing
        </p>

        <h2 className="ed-display text-4xl md:text-6xl leading-[0.95] mb-10 max-w-3xl"
            style={{ color: "var(--ed-ink)" }}>
          Start free.{" "}
          <span className="ed-display-italic" style={{ color: "var(--ed-ink-soft)" }}>
            Scale when it clicks.
          </span>
        </h2>

        <div className="flex flex-wrap gap-3 mb-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="relative flex items-baseline gap-2 px-3.5 py-2 transition-colors"
              style={{
                border: `1px solid ${tier.popular ? "var(--ed-copper)" : "var(--ed-rule)"}`,
                background: tier.popular ? "var(--ed-copper-wash)" : "var(--ed-bg-raised)",
                borderRadius: "2px",
              }}
            >
              <span className="ed-mono text-[12px]" style={{ color: "var(--ed-ink)" }}>
                {tier.name}
              </span>
              {tier.price && (
                <span className="ed-mono text-[12px]" style={{ color: "var(--ed-copper)" }}>
                  {tier.price}/mo
                </span>
              )}
              {tier.popular && (
                <span
                  className="ed-label absolute -top-2 -right-1 px-1.5 py-0.5 border"
                  style={{
                    color: "var(--ed-copper)",
                    borderColor: "var(--ed-copper)",
                    background: "var(--ed-bg)",
                  }}
                >
                  Popular
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="ed-caption">
          Free tier — 50 agent runs per month — no card — cancel anytime.{" "}
          <Link
            href="/pricing"
            className="transition-colors hover:opacity-80"
            style={{ color: "var(--ed-copper)" }}
          >
            Full pricing →
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ─── Final CTA ─────────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="editorial-dark px-6 py-28 md:py-36 mx-6 mb-12 md:mx-12 lg:mx-20 overflow-hidden relative"
      style={{
        background: "var(--ed-copper-wash)",
        border: "1px solid var(--ed-copper)",
        borderRadius: "3px",
      }}
    >
      {/* Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(181,83,44,0.08) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-2xl mx-auto text-center">
        <p className="ed-label mb-8" style={{ color: "var(--ed-copper)" }}>
          — Start here —
        </p>

        <h2 className="ed-display text-4xl md:text-6xl leading-[0.95] mb-6"
            style={{ color: "var(--ed-ink)" }}>
          Your AI Workforce{" "}
          <span className="ed-display-italic" style={{ color: "var(--ed-copper)" }}>Starts Free.</span>
        </h2>

        <p className="ed-body text-[15px] md:text-[16px] mb-12 leading-relaxed max-w-lg mx-auto"
           style={{ color: "var(--ed-ink-soft)" }}>
          No credit card. 218 agents in 60 seconds. 50 runs reset every month.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <Link
            href={HERO_CTA}
            onClick={() => trackCtaClick("final-cta")}
            className="group relative inline-flex items-center gap-2 px-8 py-4 bg-white text-[#030303] font-semibold text-[15px] tracking-tight rounded-[4px] hover:bg-[#F4EFE6] transition-colors"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[4px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ boxShadow: "0 0 0 1px rgba(181,83,44,0.5), 0 0 24px rgba(181,83,44,0.2)" }}
            />
            Run Your First Agent Free
            <span aria-hidden="true" className="text-[#B5532C] transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <a
            href="mailto:christiaan@sovereignmatrix.agency"
            onClick={() => trackCtaClick("email-founder")}
            className="inline-flex items-center px-6 py-4 border border-white/[0.12] text-neutral-400 font-mono text-[13px] tracking-wide hover:text-white hover:border-white/30 transition-colors rounded-[4px]"
          >
            Email the founder
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono text-neutral-600">
          {["Claude critic on every run", "Full audit trail", "Cancel anytime"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="text-[#B5532C]/60">✓</span> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="px-6 pt-24 pb-12 border-t border-white/[0.04] bg-[#020202]">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-[1fr_auto] gap-x-16 gap-y-8 items-end mb-20 pb-16 border-b border-white/[0.04]">
          <div className="max-w-2xl">
            <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-5">Colophon</p>
            <p className="font-serif text-[22px] md:text-[28px] leading-[1.35] text-white tracking-tight">
              Sovereign Matrix is an independent studio building
              agent infrastructure for operators — one playbook,{" "}
              <em className="not-italic text-[#B5532C]">one guarantee</em>,
              one audit trail at a time.
            </p>
            <p className="mt-6 text-[14px] text-neutral-400 leading-relaxed max-w-xl">
              Hand-written in Cape Town. Claude is the critic on every
              run. We&apos;re not Anthropic — we just build on their
              model and publish the receipts.
            </p>
          </div>

          <Link
            href={HERO_CTA}
            className="group inline-flex items-center gap-3 text-[13px] font-mono tracking-tight text-neutral-400 hover:text-white transition-colors whitespace-nowrap"
          >
            <span className="font-serif italic text-lg text-[#B5532C] not-italic">→</span>
            <span className="border-b border-white/[0.1] group-hover:border-[#B5532C] pb-0.5 transition-colors">
              Run your first playbook
            </span>
          </Link>
        </div>

        {/* Link grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-8 mb-16">
          <FooterCol
            title="Product"
            links={[
              { href: "/agents", label: "Staff Directory" },
              { href: "/platform", label: "Platform Overview" },
              { href: "/dashboard/playbooks", label: "Playbooks" },
              { href: "/dashboard", label: "Dashboard" },
              { href: "/marketplace", label: "Marketplace" },
              { href: "/trust", label: "Trust" },
            ]}
          />
          <FooterCol
            title="Industries"
            links={[
              { href: "/for-insurance", label: "Insurance" },
              { href: "/for-logistics", label: "Logistics" },
              { href: "/for-healthcare", label: "Healthcare" },
              { href: "/for-agriculture", label: "Agriculture" },
              { href: "/for-construction", label: "Construction" },
              { href: "/for-legal", label: "Legal" },
              { href: "/for-realestate", label: "Real Estate" },
              { href: "/for-cybersecurity", label: "Security" },
            ]}
          />
          <FooterCol
            title="Developers"
            links={[
              { href: "/developers/docs", label: "API Docs" },
              { href: "/docs/errors", label: "Error codes" },
              { href: "/docs/webhooks/verify", label: "Webhook HMAC" },
              { href: "/status/slo", label: "SLO" },
              { href: "/integrations", label: "Integrations" },
              { href: "https://www.npmjs.com/package/@sovereignmatrix/mcp", label: "MCP Server", external: true },
              { href: "/changelog", label: "Changelog" },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { href: "/trust", label: "About" },
              { href: "/pricing", label: "Pricing" },
              { href: "/contact", label: "Contact" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
            ]}
          />
        </div>

        {/* Baseline */}
        <div className="pt-8 border-t border-white/[0.04] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <SovereignLogo size="sm" />
            <div className="flex flex-col md:flex-row md:items-baseline gap-x-3 gap-y-0.5">
              <span className="font-serif text-[15px] text-white">Sovereign Matrix</span>
              <span className="text-[10px] font-mono text-neutral-600 tracking-tight">
                © 2026 · Operates independently · Not formally affiliated with Anthropic
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <Link
              href="/built-with-claude"
              className="inline-flex items-center gap-1.5 text-[10px] font-mono text-neutral-600 hover:text-[#B5532C] transition-colors tracking-tight group"
            >
              <span className="text-[#B5532C]/50 group-hover:text-[#B5532C] transition-colors">◆</span>
              Built with Claude
            </Link>

            <span aria-hidden="true" className="h-4 w-px bg-white/[0.06]" />

            <StatusIndicator />

            <span aria-hidden="true" className="h-4 w-px bg-white/[0.06]" />

            <div className="flex items-center gap-3 text-[11px] font-mono tracking-tight">
              <Link href="/" className="text-[#B5532C]">Operators</Link>
              <span aria-hidden="true" className="text-neutral-800">·</span>
              <Link href={PLATFORM_HREF} className="text-neutral-500 hover:text-white transition-colors">Developers</Link>
            </div>
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
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-500 mb-5">{title}</p>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener"
                className="text-[13px] text-neutral-400 hover:text-white transition-colors tracking-tight"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-[13px] text-neutral-400 hover:text-white transition-colors tracking-tight"
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
