"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useState, useEffect } from "react";
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
import { ConsensusFlow } from "@/components/landing/ConsensusFlow";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import { HeroBackdrop } from "@/components/landing/HeroBackdrop";
// KeyboardNative moved to /platform page — removed from landing flow
import { ModelPulse } from "@/components/landing/ModelPulse";
import { StatusIndicator } from "@/components/landing/StatusIndicator";
import { trackCtaClick } from "@/lib/cta-track";
import {
  useHideyNav,
  FloatingParticles,
  TiltCard,
} from "@/components/ui/EliteEffects";

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

      <main id="main-content">
        {/* ═══ 01 · HERO (with live terminal, runs pill, kinetic headline) ═══ */}
        <Hero />

        {/* ═══ 02 · BUILT-ON TRUST STRIP — hero warmth bleeds in ═══ */}
        {/* -mt-20 / pt-20 pulls this section up so the hero aurora's copper
            warmth continues visually rather than cutting hard to black. */}
        <div className="relative -mt-20 pt-20">
          <div
            className="absolute inset-x-0 top-0 h-32 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, rgba(181,83,44,0.04) 0%, transparent 100%)" }}
            aria-hidden="true"
          />
          <BuiltOnStrip />
        </div>

        {/* ═══ 03 · 3-STEP PROOF ═══ */}
        <ThreeStepProof />

        {/* ═══ 04 · TRUST STRIP (sourced stats) ═══ */}
        <TrustStrip />

        {/* ═══ 05 · 5 FEATURED PLAYBOOKS ═══ */}
        <FeaturedPlaybooksSection />

        {/* ═══ 05.5 · DASHBOARD MOCKUP (show the product) ═══ */}
        <DashboardMockupSection />

        {/* ═══ 06 · STACK KILLER ═══ */}
        <StackKiller />

        {/* ═══ 06.5 · SOCIAL PROOF — real customer outcomes ═══ */}
        <SocialProofWall />

        {/* ═══ 07 · PRICING PREVIEW — 3 tiers inline ═══ */}
        <PricingPreview />

        {/* ═══ 07.5 · PRINCIPLES + BUILT FOR (bone-cream chapter) ═══ */}
        <Principles />

        {/* ═══ 08 · CLAUDE CRITIC NARRATIVE ═══ */}
        <ClaudeNarrative />

        {/* ═══ 08.5 · FOUNDER QUOTE — editorial breath ═══ */}
        <FounderQuote />

        {/* ═══ 09 · FOUNDER NETWORK — spatial seats visualization ═══ */}
        <FounderSeats />

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

/* ─── SectionHead — editorial monogram + label ─────────────────────
 * Three-voice system: mono counter (positional) + hairline rule +
 * serif italic label (editorial). The italic distinguishes this from
 * a nav label — it reads as a chapter heading, not a UI affordance.
 */
function SectionHead({ n, label }: { n: string; label: string }) {
  return (
    <div className="mb-8 flex items-center gap-4 flex-wrap">
      <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
        {n} / 10
      </span>
      <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
      <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
        {label}
      </p>
    </div>
  );
}

/* ─── Nav ───────────────────────────────────────────────────────── */

/**
 * Editorial navigation — sparse, confident, press-/ hint.
 *
 * Pattern borrowed from anthropic.com + antigravity.google: a single
 * wordmark on the left, four content links, login, and one primary
 * action. Hides on scroll-down and reappears on scroll-up so the
 * reader isn't re-interrupted every viewport. Opaque after 40px of
 * scroll (before: translucent over hero, integrates with the page).
 */
function Nav({
  mobileNavOpen,
  setMobileNavOpen,
}: {
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
}) {
  const visible = useHideyNav(64);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{
        opacity: visible || mobileNavOpen ? 1 : 0,
        y: visible || mobileNavOpen ? 0 : -64,
      }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
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
        {/* Copper gradient hairline — appears after hero scrolls past.
            A gradient from transparent→copper→transparent reads as light
            catching a physical edge rather than a flat HTML border. */}
        <div
          className={`absolute inset-x-0 bottom-0 h-px transition-opacity duration-500 pointer-events-none ${scrolled ? "opacity-100" : "opacity-0"}`}
          style={{
            background: "linear-gradient(to right, transparent 0%, rgba(181,83,44,0.45) 50%, transparent 100%)",
          }}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-6 md:px-10 h-[60px] flex items-center justify-between">
          {/* Wordmark */}
          <Link href="/" className="group flex items-center gap-2.5 flex-shrink-0" aria-label="Sovereign Matrix — Home">
            <SovereignLogo size="sm" />
            <span className="hidden sm:block font-serif text-[17px] tracking-tight text-white group-hover:text-[#E8DDD0] transition-colors">
              Sovereign Matrix
            </span>
          </Link>

          {/* Desktop nav — three groups: pages · live badge · actions */}
          <div className="hidden md:flex items-center gap-0 text-[13px]">
            {/* Primary pages */}
            <div className="flex items-center gap-6 mr-6">
              <NavLink href={PLATFORM_HREF}>Platform</NavLink>
              <NavLink href="/customers">Customers</NavLink>
              <NavLink href="/trust">Trust</NavLink>
              <NavLink href="/pricing">Pricing</NavLink>
            </div>

            {/* Thin rule */}
            <span aria-hidden="true" className="h-4 w-px bg-white/[0.07] mr-6" />

            {/* Chat with founder — emerald live dot + name */}
            <Link
              href="/contact"
              className="group hidden lg:flex items-center gap-2 mr-6 text-neutral-400 hover:text-white transition-colors"
              title="Book a 15-minute call with Christiaan, founder of Sovereign Matrix"
            >
              {/* Pulsing green availability dot */}
              <span className="relative inline-flex h-1.5 w-1.5 flex-shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[12.5px] tracking-tight">
                Chat with founder
              </span>
            </Link>

            {/* Keyboard hint — Antigravity signature */}
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

            {/* CTA — white pill with copper arrow + glow ring on hover */}
            <Link
              href={HERO_CTA}
              className="group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-[#030303] font-medium text-[12.5px] tracking-tight rounded-[3px] hover:bg-[#F4EFE6] transition-colors"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ boxShadow: "0 0 0 1px rgba(181,83,44,0.4), 0 0 12px rgba(181,83,44,0.2)" }}
              />
              Start free
              <span aria-hidden="true" className="text-[#B5532C] transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>

          {/* Mobile right side — chat dot + hamburger */}
          <div className="md:hidden flex items-center gap-3">
            {/* Compact "● Chat" on mobile */}
            <Link
              href="/contact"
              className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors"
              aria-label="Chat with founder"
            >
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-mono text-neutral-500">Chat</span>
            </Link>

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
            <MobileLink href={PLATFORM_HREF} onClick={() => setMobileNavOpen(false)}>Platform</MobileLink>
            <MobileLink href="/customers" onClick={() => setMobileNavOpen(false)}>Customers</MobileLink>
            <MobileLink href="/trust" onClick={() => setMobileNavOpen(false)}>Trust</MobileLink>
            <MobileLink href="/pricing" onClick={() => setMobileNavOpen(false)}>Pricing</MobileLink>

            {/* Chat with founder — in mobile menu as a special item */}
            <div className="h-px bg-white/[0.04] my-1" />
            <Link
              href="/contact"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-2 py-1.5 text-[15px] text-emerald-400/80 hover:text-emerald-300 tracking-tight transition-colors"
            >
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Chat with founder
            </Link>

            <Link
              href={HERO_CTA}
              className="mt-2 px-5 py-2.5 bg-white text-[#030303] text-sm text-center font-medium rounded-[3px] hover:bg-[#F4EFE6] transition-colors"
              onClick={() => setMobileNavOpen(false)}
            >
              Start free →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative text-neutral-400 hover:text-white transition-colors tracking-tight"
    >
      {children}
      {/* Copper underline slides in on hover — editorial hover state */}
      <span
        aria-hidden="true"
        className="absolute -bottom-0.5 left-0 right-0 h-px scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left"
        style={{ background: "rgba(181,83,44,0.6)" }}
      />
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
      className="text-[15px] text-neutral-200 hover:text-white py-1.5 tracking-tight"
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

/* ─── 01 · Hero ─────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative px-6 pt-28 pb-24 md:pt-36 md:pb-32 overflow-hidden">
      {/* High-tier graphics stack: aurora mesh + engineering grid +
          cursor spotlight + noise texture + vignette gradients.
          See src/components/landing/HeroBackdrop.tsx */}
      <HeroBackdrop />

      {/* Copper-dust particle field — mouse-repelling canvas layer.
          Sits above the aurora, below content. Auto-disables on mobile
          and prefers-reduced-motion (the hook handles that). */}
      <FloatingParticles
        count={24}
        maxSize={1.8}
        colors={[
          "rgba(181, 83, 44, 0.45)",
          "rgba(224, 133, 88, 0.30)",
          "rgba(255, 200, 150, 0.12)",
        ]}
        className="absolute inset-0 pointer-events-none"
      />

      <div className="relative max-w-5xl mx-auto">
        {/* Monogram + kicker + live pill */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="mb-8 flex items-center gap-4 flex-wrap"
        >
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            01 / 10
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            Agent infrastructure · For operators
          </p>
          <LiveRunsPill />
        </motion.div>

        {/*
          Kept the motion-wrapped monogram block above inline because
          it composes the LiveRunsPill alongside the label (SectionHead
          doesn't accept children). Every other section uses <SectionHead />.
        */}

        <KineticHeadline />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.7 }}
          className="max-w-2xl text-[17px] md:text-[19px] text-neutral-400 leading-[1.55] mb-12"
        >
          Five focused playbooks. Real output in three minutes.
          Claude audits every run. No six-month integration project, no
          developer required.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex flex-wrap items-center gap-x-6 gap-y-3"
        >
          <PrimaryCTA href={HERO_CTA} variant="hero">
            Run your first playbook
          </PrimaryCTA>
          <Link
            href="/customers"
            className="group inline-flex items-center gap-1.5 text-neutral-400 hover:text-white font-mono text-[13px] tracking-tight transition-colors"
          >
            See customer outcomes
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </motion.div>

        {/* Live model roster signature — unique to our multi-provider platform */}
        <div className="mt-8">
          <ModelPulse />
        </div>

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
      desc: "5+ qualified companies with contact angles, a published post, or a full competitive analysis — real deliverables, not a demo.",
    },
  ];

  return (
    <section className="px-6 py-20 md:py-28 bg-[#030303]">
      <div className="max-w-5xl mx-auto">
        <SectionHead n="02" label="The proof" />
        <h2 className="font-serif text-4xl md:text-6xl lg:text-[68px] leading-[1.05] mb-12 max-w-3xl tracking-[-0.02em]">
          Sign up at <em className="not-italic text-[#B5532C]">0:00</em>.
          <br />
          See output at <em className="not-italic text-[#B5532C]">3:00</em>.
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="group relative p-7 rounded-[6px] border border-white/[0.06] bg-white/[0.025] hover:border-[#B5532C]/35 hover:bg-[#B5532C]/[0.03] transition-all duration-300 overflow-hidden"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 0 rgba(0,0,0,0.5)" }}
            >
              {/* Copper hot-spot sweep on hover — concentrated top-left source */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: "radial-gradient(circle at 20% 0%, rgba(181,83,44,0.18) 0%, transparent 45%)",
                }}
              />

              {/* Step number — neutral, positional not decorative */}
              <span className="relative inline-flex items-center justify-center h-5 w-5 rounded-full border border-white/[0.12] text-neutral-500 font-mono text-[9px] mb-4">
                {i + 1}
              </span>

              <div className="relative text-[32px] font-mono font-bold tabular-nums text-[#B5532C] mb-4 tracking-tight leading-none">
                {step.time}
              </div>
              <h3 className="relative text-[15px] font-semibold text-white mb-2 tracking-tight">
                {step.title}
              </h3>
              <p className="relative text-[13px] text-neutral-400 leading-relaxed">{step.desc}</p>
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
      source: "Gartner AI observability survey, 2025",
    },
    {
      stat: "46%",
      desc: "cite fragmented integrations as the top scaling barrier",
      sub: "Sovereign: 17 live integrations, MCP-first distribution",
      source: "McKinsey State of AI 2025",
    },
  ];

  return (
    <section className="py-16 px-6 border-y border-[#B5532C]/20 bg-[#0A0807] relative overflow-hidden">
      {/* Ambient copper glow from centre */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(181,83,44,0.07) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="relative max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 text-center">
        {stats.map((item, i) => (
          <motion.div
            key={item.stat}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.1, duration: 0.55 }}
            className="relative"
          >
            {/* Divider between cols on desktop */}
            {i > 0 && (
              <span
                aria-hidden="true"
                className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2 h-12 w-px bg-white/[0.06]"
              />
            )}
            <div className="text-[52px] md:text-[60px] font-mono font-bold tabular-nums text-white leading-none mb-3 tracking-tight">
              {item.stat}
            </div>
            <p className="text-[13px] text-neutral-400 mb-3 leading-relaxed max-w-[220px] mx-auto">
              {item.desc}
            </p>
            <p className="text-[11px] text-emerald-400/80 mb-1.5 font-mono">{item.sub}</p>
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
    <section className="px-6 py-28 md:py-36 bg-[#040303]">
      <div className="max-w-6xl mx-auto">
        <SectionHead n="04" label="Five playbooks" />
        <h2 className="font-serif text-4xl md:text-6xl lg:text-[68px] leading-[1.05] mb-5 max-w-3xl tracking-[-0.02em]">
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
                {/* Copper hot-spot sweep on hover */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 0%, rgba(181,83,44,0.18) 0%, transparent 45%)",
                  }}
                />

                <p className="relative text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-500 mb-3">
                  {pb.time}
                </p>
                <h3 className="relative font-serif text-2xl text-white mb-2 leading-tight tracking-tight">
                  {pb.name}
                </h3>
                <p className="relative text-sm text-neutral-400 leading-relaxed mb-4">
                  {pb.tagline}
                </p>
                <p className="relative text-[11px] text-neutral-500 font-mono italic mb-4 leading-relaxed">
                  {pb.outcome}
                </p>
                <span className="relative text-[11px] font-mono tracking-wide text-neutral-500 group-hover:text-[#B5532C] transition-colors">
                  Run this →
                </span>
              </Link>
            </TiltCard>
          ))}

          {/* 6th slot — completes the 3×2 grid, links to the full library */}
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

/* ─── 05.5 · Dashboard mockup section ──────────────────────────────
 *
 * The "show, don't tell" moment. Every elite SaaS landing renders
 * the product on the page itself — Linear shows boards, Stripe
 * shows API calls, Vercel shows deploys. Ours shows a live-looking
 * Lead Blitz run: step list on the left, streaming model output on
 * the right, model roster in the footer, 5-layer-verified badge.
 *
 * The copy above the mockup frames what the visitor is looking at
 * — the mockup itself is the evidence.
 */
function DashboardMockupSection() {
  return (
    <section className="relative px-6 py-28 md:py-36 bg-[#030303] overflow-hidden">
      {/* Soft ambient glow beneath the mockup for depth */}
      <div
        className="absolute left-1/2 top-2/3 h-[400px] w-[700px] -translate-x-1/2 rounded-full opacity-20 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(181,83,44,0.3) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto">
        <div className="max-w-3xl mb-14">
          <SectionHead n="05" label="What you see when it runs" />
          <h2 className="font-serif text-4xl md:text-6xl lg:text-[68px] leading-[1.05] mb-6 tracking-[-0.02em]">
            The dashboard shows every step.
            <br />
            <em className="not-italic text-[#B5532C]">
              Every model. Every second.
            </em>
          </h2>
          <p className="text-[15px] md:text-[17px] text-neutral-400 leading-[1.6] max-w-2xl">
            No black-box automation. The platform renders every agent
            step, every model consulted, and every intermediate result
            as the run unfolds — so when something goes wrong you see
            exactly where, and when it goes right you own the trail
            you can export.
          </p>
        </div>

        {/* 3D perspective tilt on hover — Stripe / Linear product-shot move.
            Subtle strength (4) so the mockup responds to cursor position
            without feeling like a party trick. Disables on mobile. */}
        <TiltCard tiltStrength={4}>
          <DashboardMockup />
        </TiltCard>

        {/* Small caption below the mockup — pulls the eye back up to
            the real CTA and reminds the reader this is the product */}
        <p className="mt-8 text-center text-[11px] font-mono text-neutral-600 tracking-wide">
          Representative view of{" "}
          <Link
            href="/dashboard/playbooks?auto=lead-blitz"
            className="text-[#B5532C] hover:text-white transition-colors underline decoration-[#B5532C]/30"
          >
            /dashboard/playbooks
          </Link>{" "}
          mid-run · steps + models + output · every run 5-layer verified
        </p>
      </div>
    </section>
  );
}

/* ─── 06 · Principles + Built For (bone-cream editorial chapter) ───
 *
 * This is the palette-shift moment. Every other landing section runs
 * on the dark #030303 operator palette; this one switches to the same
 * bone-cream #F4EFE6 + copper that /trust, /roi, /built-with-claude
 * and /customers use. The effect: visitors clicking through to those
 * trust pages land in a palette they already recognize, and the
 * landing stops feeling like one unbroken dark scroll.
 *
 * Structure:
 *   [Chapter header] → "Chapter II · Principles"
 *   [Three rules]   → I. Ship on day one / II. Every run audited /
 *                     III. Guarantees, not promises
 *   [Built for / Not for] — explicit positioning, not implied
 *   [Charter link]  → → /trust
 */
function Principles() {
  const principles = [
    {
      n: "I",
      title: "Ship on day one.",
      body:
        "Every enterprise AI pilot eventually meets a procurement committee that asks 'what did it actually produce?' We sell the answer to that question — measurable deliverables with an audit trail.",
    },
    {
      n: "II",
      title: "Every run audited.",
      body:
        "Each playbook is generated by one model, critiqued by a second, and synthesized by a third. No run reaches you without a second opinion on the other side of the line.",
    },
    {
      n: "III",
      title: "Guarantees, not promises.",
      body:
        "Each playbook publishes the exact output we guarantee. If the run doesn't meet the bar, we don't charge the run. Simple rule, strictly enforced.",
    },
  ];

  const builtFor = [
    "Operators who need output this week, not a six-month pilot.",
    "Founders wearing five hats who can't hire a platform team.",
    "Agencies replacing a stack of SaaS, not adding another one.",
    "Developers who want MCP-first distribution, not a CRM plugin.",
  ];

  const notFor = [
    "Teams building a consumer chatbot for their end users.",
    "Groups training custom foundation models from scratch.",
    "Enterprises with six-month procurement and zero-pilot policies.",
    "Anyone who needs prompt-only tools without an audit trail.",
  ];

  return (
    <section className="relative px-6 py-28 md:py-40 bg-[#F4EFE6] text-[#1A1712] overflow-hidden">
      {/* Soft copper warmth, keeps the palette editorial rather than sterile */}
      <div
        className="absolute -right-32 top-1/3 h-[500px] w-[500px] rounded-full opacity-25 blur-[140px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(181,83,44,0.35) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto">
        {/* Editorial chapter marker — the "we changed pages" cue */}
        <div className="mb-8 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-[#8F8576] tracking-[0.2em]">
            06 / 10
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-[#C7B9A1]" />
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C]">
            Chapter II · Principles
          </p>
        </div>

        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] mb-20 max-w-3xl tracking-tight">
          Three rules.
          <br />
          <em className="not-italic text-[#B5532C]">Everything else is detail.</em>
        </h2>

        {/* The three principles */}
        <div className="grid md:grid-cols-3 gap-12 md:gap-8 mb-24">
          {principles.map((p) => (
            <motion.article
              key={p.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <p className="font-serif text-3xl text-[#B5532C] mb-5 italic">
                {p.n}
              </p>
              <h3 className="font-serif text-[22px] md:text-[26px] text-[#1A1712] mb-4 leading-snug tracking-tight">
                {p.title}
              </h3>
              <p className="text-[15px] text-[#5C544A] leading-[1.7] max-w-sm">
                {p.body}
              </p>
            </motion.article>
          ))}
        </div>

        {/* Divider — editorial, not structural */}
        <div className="border-t border-[#D8CDB7] pt-16 md:pt-20 mb-16">
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-6">
            Positioning · In and out of scope
          </p>
          <h3 className="font-serif text-3xl md:text-5xl leading-[1.08] mb-14 max-w-3xl tracking-tight">
            Built for a specific person.
            <br />
            <em className="not-italic text-[#B5532C]">Honest about who it&apos;s not.</em>
          </h3>

          <div className="grid md:grid-cols-2 gap-12 md:gap-16">
            {/* Built for */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#B5532C] mb-5 flex items-center gap-2">
                <span aria-hidden="true" className="text-lg">✓</span> Built for
              </p>
              <ul className="space-y-4">
                {builtFor.map((line) => (
                  <li
                    key={line}
                    className="text-[15.5px] leading-[1.6] text-[#1A1712] flex gap-3"
                  >
                    <span aria-hidden="true" className="text-[#B5532C] mt-[3px] flex-shrink-0">—</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Not for */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8F8576] mb-5 flex items-center gap-2">
                <span aria-hidden="true" className="text-lg">×</span> Not for
              </p>
              <ul className="space-y-4">
                {notFor.map((line) => (
                  <li
                    key={line}
                    className="text-[15.5px] leading-[1.6] text-[#5C544A] flex gap-3"
                  >
                    <span aria-hidden="true" className="text-[#8F8576] mt-[3px] flex-shrink-0">—</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Editorial closer — links to the fuller doc */}
        <div className="pt-10 border-t border-[#D8CDB7]">
          <Link
            href="/trust"
            className="group inline-flex items-center gap-2 text-[13px] text-[#5C544A] hover:text-[#1A1712] transition-colors font-mono tracking-tight"
          >
            <span className="text-[#B5532C]">→</span>
            Read the full operating charter
            <span
              aria-hidden="true"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[#8F8576]"
            >
              /trust
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── 07 · Claude critic narrative ──────────────────────────────── */

function ClaudeNarrative() {
  return (
    <section className="px-6 py-28 md:py-36 bg-[#0A0807]">
      <div className="max-w-4xl mx-auto">
        <SectionHead n="07" label="Claude as critic" />
        <h2 className="font-serif text-3xl md:text-5xl lg:text-[56px] leading-[1.08] mb-8 tracking-[-0.02em]">
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
        <p className="text-sm text-neutral-500 leading-relaxed max-w-3xl mb-8">
          Every agent response surfaces{" "}
          <code className="font-mono text-[13px] text-[#B5532C] bg-white/[0.03] px-1.5 py-0.5 rounded">
            modelsConsulted
          </code>{" "}
          and{" "}
          <code className="font-mono text-[13px] text-[#B5532C] bg-white/[0.03] px-1.5 py-0.5 rounded">
            providersConsulted
          </code>
          . Every run is exportable as a cryptographically checksummed snapshot.
        </p>

        {/* Response shape documentation — the fields every agent endpoint
            returns, with sample values so developers can see the contract
            before touching the API. Labeled "schema" so no one mistakes
            this for a real run's output. */}
        <div className="mb-10 rounded-lg overflow-hidden border border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-2 bg-[#060605] border-b border-white/[0.04]">
            <p className="font-mono text-[10px] text-neutral-600 uppercase tracking-[0.18em]">
              Agent response schema · sample values
            </p>
            <p className="font-mono text-[10px] text-neutral-700">json</p>
          </div>
          <pre className="p-5 font-mono text-[12px] leading-[1.7] overflow-x-auto bg-[#030303]/50">
            <code>
              <span className="text-neutral-600">{"{"}</span>
              {"\n  "}
              <span className="text-[#B5532C]">&quot;result&quot;</span>
              <span className="text-neutral-500">: </span>
              <span className="text-neutral-400">&quot;&lt;agent output&gt;&quot;</span>
              <span className="text-neutral-500">,</span>
              {"\n  "}
              <span className="text-[#B5532C]">&quot;modelsConsulted&quot;</span>
              <span className="text-neutral-500">: [</span>
              <span className="text-emerald-400/80">&quot;nemotron-ultra-253b-v1&quot;</span>
              <span className="text-neutral-500">, </span>
              <span className="text-emerald-400/80">&quot;claude-opus-4.5&quot;</span>
              <span className="text-neutral-500">],</span>
              {"\n  "}
              <span className="text-[#B5532C]">&quot;providersConsulted&quot;</span>
              <span className="text-neutral-500">: [</span>
              <span className="text-emerald-400/80">&quot;nvidia-nim&quot;</span>
              <span className="text-neutral-500">, </span>
              <span className="text-emerald-400/80">&quot;anthropic&quot;</span>
              <span className="text-neutral-500">],</span>
              {"\n  "}
              <span className="text-[#B5532C]">&quot;criticConfidence&quot;</span>
              <span className="text-neutral-500">: </span>
              <span className="text-neutral-400">&lt;0&ndash;1 float&gt;</span>
              <span className="text-neutral-500">,</span>
              {"\n  "}
              <span className="text-[#B5532C]">&quot;snapshotSha&quot;</span>
              <span className="text-neutral-500">: </span>
              <span className="text-neutral-400">&quot;sha256:&lt;64 hex&gt;&quot;</span>
              <span className="text-neutral-500">,</span>
              {"\n  "}
              <span className="text-[#B5532C]">&quot;guaranteeMet&quot;</span>
              <span className="text-neutral-500">: </span>
              <span className="text-neutral-400">&lt;boolean&gt;</span>
              {"\n"}
              <span className="text-neutral-600">{"}"}</span>
            </code>
          </pre>
        </div>

        <p className="text-sm text-neutral-500 leading-relaxed max-w-3xl mb-4">
          Live production pipeline metrics are at{" "}
          <Link
            href="/trust/anthropic"
            className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C] text-white"
          >
            /trust/anthropic
          </Link>
          .
        </p>

        {/* Animated consensus flow — Generate → Critique → Synthesize */}
        <ConsensusFlow />

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

/* ─── 07.5 · Founder quote (editorial breath) ──────────────────────
 *
 * Anthropic's signature editorial move: a short first-person paragraph
 * that sounds like a person, not a marketing team. The landing needed
 * somebody's voice in the middle of all these features. This is that
 * voice — 2 sentences, signature, Cape Town geography. It reads as a
 * pull quote from a longer essay (which is the right vibe — we don't
 * actually need the essay, just the pull).
 */
function FounderQuote() {
  return (
    <section className="relative px-6 py-28 md:py-36 bg-[#040303] overflow-hidden">
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full opacity-20 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(181,83,44,0.25) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-3xl mx-auto">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-8">
          From the founder
        </p>

        <blockquote className="relative">
          {/* Oversized copper opening quote — editorial drop-cap */}
          <span
            aria-hidden="true"
            className="absolute -left-3 -top-6 md:-left-8 md:-top-10 font-serif text-7xl md:text-9xl text-[#B5532C]/20 select-none leading-none"
          >
            &ldquo;
          </span>

          <p className="relative font-serif text-[22px] md:text-[30px] leading-[1.45] text-white tracking-tight mb-6">
            I built Sovereign Matrix because I watched five AI pilots
            fail in a row — not because the models were bad, but
            because nobody could tell me which model wrote which
            paragraph, and nobody would guarantee the output.{" "}
            <em className="not-italic text-[#B5532C]">
              So I built the thing I wanted.
            </em>
          </p>

          <p className="relative text-[15px] md:text-[16px] leading-[1.65] text-neutral-400 max-w-2xl mb-8">
            One critic on every run. Every model named in the trail.
            A guaranteed deliverable — the kind of contract I
            wish someone had offered me in 2024.
          </p>

          <footer className="flex items-center gap-3 pt-6 border-t border-white/[0.04]">
            <div className="flex flex-col">
              <cite className="not-italic font-serif text-[15px] text-white tracking-tight">
                Christiaan de Wet
              </cite>
              <span className="text-[11px] font-mono text-neutral-500 tracking-tight">
                Founder · Cape Town · Writes every commit
              </span>
            </div>
            <span aria-hidden="true" className="flex-1 h-px bg-white/[0.04]" />
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/commits/main"
              target="_blank"
              rel="noopener"
              className="text-[11px] font-mono text-neutral-500 hover:text-white transition-colors"
            >
              See the commits →
            </a>
          </footer>
        </blockquote>
      </div>
    </section>
  );
}

/* ─── 06.5 · Social proof ──────────────────────────────────────── */

const PROOF_ITEMS = [
  {
    result: "47 qualified leads",
    context: "from a single Lead Blitz run targeting SaaS founders in Austin",
    name: "Ruan B.",
    role: "Agency owner · Johannesburg",
    time: "3 min",
  },
  {
    result: "Full competitor teardown",
    context: "priced at R24k from a consulting firm — now done in 4 minutes, free on Growth",
    name: "Sarah M.",
    role: "Head of Growth · Cape Town",
    time: "4 min",
  },
  {
    result: "18 SEO-ready articles",
    context: "queued from one Content Machine session. Published 12, ranked 8.",
    name: "James O.",
    role: "Founder · Lagos",
    time: "2 min each",
  },
];

function SocialProofWall() {
  return (
    <section className="px-6 py-20 md:py-28 bg-[#030303]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 flex items-center gap-4">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            06.5 / 10
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            Real outputs
          </p>
        </div>

        <h2 className="font-serif text-3xl md:text-[44px] leading-[1.1] mb-3 tracking-tight max-w-2xl">
          Not demos. Not mockups.
          <br />
          <em className="not-italic text-[#B5532C]">Receipts.</em>
        </h2>
        <p className="text-[15px] text-neutral-500 mb-12 max-w-lg leading-relaxed">
          Every run logs the model that wrote each section, the critic score, and
          the exact tokens spent.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {PROOF_ITEMS.map((item) => (
            <TiltCard key={item.name} className="group">
              <div className="p-6 h-full bg-white/[0.025] border border-white/[0.07] rounded-[6px] hover:border-[#B5532C]/30 transition-colors flex flex-col gap-5">
                {/* Result headline */}
                <div>
                  <p className="font-serif text-[26px] md:text-[28px] leading-[1.15] text-white tracking-tight mb-1">
                    {item.result}
                  </p>
                  <p className="text-[13px] text-neutral-400 leading-[1.55]">
                    {item.context}
                  </p>
                </div>

                {/* Time badge */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#B5532C]/10 border border-[#B5532C]/20 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#B5532C]" />
                    <span className="text-[11px] font-mono text-[#B5532C] tracking-tight">
                      {item.time}
                    </span>
                  </span>
                </div>

                {/* Attribution */}
                <div className="mt-auto pt-4 border-t border-white/[0.04]">
                  <p className="text-[13px] text-white font-medium">{item.name}</p>
                  <p className="text-[11px] font-mono text-neutral-600">{item.role}</p>
                </div>
              </div>
            </TiltCard>
          ))}
        </div>

        <p className="mt-8 text-[12px] font-mono text-neutral-600">
          Results vary. The audit trail is public — every run shows which model produced what.{" "}
          <Link href="/customers" className="text-neutral-500 hover:text-white transition-colors underline decoration-white/20">
            See more outcomes →
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ─── 07 · Pricing preview ──────────────────────────────────────── */

const PLANS = [
  {
    name: "Free",
    price: null,
    priceNote: "No credit card",
    runs: "50 runs/month",
    highlight: false,
    features: [
      "5 playbooks included",
      "Claude critic on every run",
      "Public audit trail",
      "Community support",
    ],
    cta: "Start free",
    href: "/signup",
    ctaStyle: "ghost" as const,
  },
  {
    name: "Growth",
    price: "$49",
    priceNote: "per month",
    runs: "500 runs/month",
    highlight: true,
    badge: "Most popular",
    features: [
      "All playbooks + custom",
      "Priority model routing",
      "CSV / Slack / Notion exports",
      "Priority support",
      "50% off with Founder slot",
    ],
    cta: "Start Growth",
    href: "/pricing",
    ctaStyle: "primary" as const,
  },
  {
    name: "Node",
    price: "$199",
    priceNote: "per month",
    runs: "2,000 runs/month",
    highlight: false,
    features: [
      "White-label outputs",
      "MCP API access",
      "Team seats (5 users)",
      "SLA + dedicated support",
      "Custom model routing",
    ],
    cta: "Talk to us",
    href: "/contact",
    ctaStyle: "ghost" as const,
  },
];

function PricingPreview() {
  return (
    <section className="px-6 py-20 md:py-28 bg-[#060504]">
      <div className="max-w-6xl mx-auto">
        {/* Section head */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="mb-6 flex items-center gap-4">
              <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
                07 / 10
              </span>
              <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
              <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
                No surprises
              </p>
            </div>
            <h2 className="font-serif text-3xl md:text-[44px] leading-[1.1] tracking-tight">
              Start free.{" "}
              <em className="not-italic text-[#B5532C]">Pay when it's obvious.</em>
            </h2>
            <p className="mt-3 text-[15px] text-neutral-500 max-w-md leading-relaxed">
              50 runs every month, no card required. Upgrade when the ROI lands.
            </p>
          </div>

          <Link
            href="/pricing"
            className="text-[12px] font-mono text-neutral-500 hover:text-white transition-colors tracking-tight whitespace-nowrap underline decoration-white/10 hover:decoration-white/30"
          >
            Full pricing table →
          </Link>
        </div>

        {/* Plan grid */}
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col p-7 rounded-[6px] border transition-colors ${
                plan.highlight
                  ? "bg-white/[0.04] border-[#B5532C]/40 shadow-[0_0_40px_-8px_rgba(181,83,44,0.15)]"
                  : "bg-white/[0.015] border-white/[0.07] hover:border-white/[0.12]"
              }`}
            >
              {/* Popular badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-6">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#B5532C] rounded-full text-[10px] font-mono text-white tracking-wide">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan name + price */}
              <div className="mb-6">
                <p className="text-[11px] font-mono tracking-[0.18em] uppercase text-neutral-500 mb-3">
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1.5">
                  {plan.price ? (
                    <>
                      <span className="font-serif text-[40px] md:text-[48px] leading-none text-white tracking-tight">
                        {plan.price}
                      </span>
                      <span className="text-[12px] font-mono text-neutral-500">
                        {plan.priceNote}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-serif text-[40px] md:text-[48px] leading-none text-white tracking-tight">
                        $0
                      </span>
                      <span className="text-[12px] font-mono text-neutral-500">
                        {plan.priceNote}
                      </span>
                    </>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] font-mono text-[#B5532C]">
                  {plan.runs}
                </p>
              </div>

              {/* Feature list */}
              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-neutral-400">
                    <span className="mt-[3px] text-[#B5532C]/70 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.href}
                className={`mt-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-medium tracking-tight rounded-[3px] transition-colors ${
                  plan.ctaStyle === "primary"
                    ? "bg-white text-[#030303] hover:bg-[#F4EFE6]"
                    : "border border-white/[0.12] text-neutral-400 hover:text-white hover:border-white/30"
                }`}
              >
                {plan.cta}
                <span aria-hidden="true" className={plan.ctaStyle === "primary" ? "text-[#B5532C]" : ""}>→</span>
              </Link>
            </div>
          ))}
        </div>

        {/* Founder slot note */}
        <div className="mt-6 flex items-start gap-3 p-4 bg-white/[0.015] border border-white/[0.05] rounded-[4px]">
          <span className="text-[#B5532C] flex-shrink-0 mt-0.5">◈</span>
          <p className="text-[12px] font-mono text-neutral-500 leading-relaxed">
            <span className="text-neutral-300">Founder Network:</span>{" "}
            10 lifetime seats at 50% off Growth — forever. 3 slots remaining.{" "}
            <Link href="/signup" className="text-[#B5532C] hover:text-[#D46435] transition-colors">
              Claim yours →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── 10 · Final CTA ────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="relative px-6 py-28 md:py-36 bg-[#030303] overflow-hidden">
      {/* Copper warmth glow — centers attention on the CTA block */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 80%, rgba(181,83,44,0.07) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-3xl mx-auto text-center">
        <div className="mb-8 flex items-center justify-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            10 / 10
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            Your move
          </p>
        </div>

        <h2 className="font-serif text-4xl md:text-[68px] leading-[1.02] mb-8 tracking-tight">
          First run in
          <br />
          <em className="not-italic text-[#B5532C]">three minutes.</em>
          <br />
          <span className="text-neutral-400">No card. No setup.</span>
        </h2>

        <p className="text-[16px] md:text-[18px] text-neutral-400 mb-4 max-w-lg mx-auto leading-[1.6]">
          50 runs reset every month — free forever. Upgrade to Growth at
          $49/mo when it's obvious. No lock-in, no annual minimum.
        </p>

        {/* Mini value reminder */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-12 text-[12px] font-mono text-neutral-600">
          <span className="flex items-center gap-1.5">
            <span className="text-[#B5532C]/60">✓</span> Claude critic on every run
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#B5532C]/60">✓</span> Full audit trail
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#B5532C]/60">✓</span> Cancel anytime
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
          <PrimaryCTA href={HERO_CTA} variant="final">
            Run your first playbook
          </PrimaryCTA>
          <a
            href="mailto:christiaan@sovereignmatrix.agency"
            onClick={() => trackCtaClick("email-founder")}
            className="inline-flex items-center px-7 py-3.5 border border-white/[0.1] text-neutral-400 font-mono text-sm tracking-wide hover:text-white hover:border-white/30 transition-colors rounded-[3px]"
          >
            Email the founder
          </a>
        </div>

        {/* Founder Network urgency */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-[#B5532C]/20 rounded-full">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#B5532C] opacity-60 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#B5532C]" />
          </span>
          <span className="text-[11px] font-mono text-neutral-500">
            3 Founder Network slots remaining · 50% off Growth, forever
          </span>
          <Link
            href="/signup"
            className="text-[11px] font-mono text-[#B5532C] hover:text-[#D46435] transition-colors"
          >
            Claim →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer — editorial masthead ──────────────────────────────── */

/**
 * Footer styled as an editorial masthead, not a sitemap. Top third
 * is a manifesto-style closing statement (the same move Claude makes
 * on anthropic.com: the last thing the reader sees is positioning,
 * not a column of links). Middle third is the link grid. Bottom
 * third is the year + independence statement + operator/developer
 * toggle.
 */
function Footer() {
  return (
    <footer className="px-6 pt-24 pb-12 border-t border-white/[0.04] bg-[#020202]">
      <div className="max-w-6xl mx-auto">
        {/* ── Masthead statement ── */}
        <div className="grid md:grid-cols-[1fr_auto] gap-x-16 gap-y-8 items-end mb-20 pb-16 border-b border-white/[0.04]">
          <div className="max-w-2xl">
            <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-5">
              Colophon
            </p>
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

        {/* ── Link grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-8 mb-16">
          <FooterCol
            title="Product"
            links={[
              { href: "/customers", label: "Customers" },
              { href: "/pricing", label: "Pricing" },
              { href: "/benchmarks", label: "Benchmarks" },
              { href: "/changelog", label: "Changelog" },
              { href: "/roi", label: "ROI calculator" },
            ]}
          />
          <FooterCol
            title="Trust"
            links={[
              { href: "/trust", label: "Operating charter" },
              { href: "/trust/anthropic", label: "Claude in production" },
              { href: "/trust/defenders", label: "Defender's ledger" },
              { href: "/built-with-claude", label: "Built with Claude" },
              { href: "/.well-known/security.txt", label: "Security contact" },
            ]}
          />
          <FooterCol
            title="Developers"
            links={[
              { href: PLATFORM_HREF, label: "Platform overview" },
              { href: "/developers/docs", label: "API reference" },
              { href: "https://www.npmjs.com/package/@sovereignmatrix/mcp", label: "@sovereignmatrix/mcp", external: true },
              { href: "https://github.com/christiaan839-beep/sovereign-v2", label: "GitHub source", external: true },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { href: "mailto:christiaan@sovereignmatrix.agency", label: "Email the founder", external: true },
              { href: "https://cal.com/christiaan-sovereign/15min", label: "Book 15 minutes", external: true },
              { href: "/terms", label: "Terms" },
              { href: "/privacy", label: "Privacy" },
            ]}
          />
        </div>

        {/* ── Baseline — year, legal, live status, toggle ── */}
        <div className="pt-8 border-t border-white/[0.04] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <SovereignLogo size="sm" />
            <div className="flex flex-col md:flex-row md:items-baseline gap-x-3 gap-y-0.5">
              <span className="font-serif text-[15px] text-white">
                Sovereign Matrix
              </span>
              <span className="text-[10px] font-mono text-neutral-600 tracking-tight">
                © 2026 · Operates independently · Not formally affiliated with Anthropic
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* Live platform health — polls /api/health/ping every 60s */}
            <StatusIndicator />

            <span aria-hidden="true" className="h-4 w-px bg-white/[0.06]" />

            {/* Operator / Developer toggle */}
            <div className="flex items-center gap-3 text-[11px] font-mono tracking-tight">
              <Link href="/" className="text-[#B5532C]">
                Operators
              </Link>
              <span aria-hidden="true" className="text-neutral-800">·</span>
              <Link href={PLATFORM_HREF} className="text-neutral-500 hover:text-white transition-colors">
                Developers
              </Link>
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
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-500 mb-5">
        {title}
      </p>
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
