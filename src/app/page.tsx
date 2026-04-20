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
import { KeyboardNative } from "@/components/landing/KeyboardNative";
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

        {/* ═══ 02 · BUILT-ON TRUST STRIP ═══ */}
        <BuiltOnStrip />

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

        {/* ═══ 06.5 · PRINCIPLES + BUILT FOR (bone-cream chapter) ═══ */}
        <Principles />

        {/* ═══ 07 · CLAUDE CRITIC NARRATIVE ═══ */}
        <ClaudeNarrative />

        {/* ═══ 07.5 · FOUNDER QUOTE — editorial breath ═══ */}
        <FounderQuote />

        {/* ═══ 08 · FOUNDER NETWORK — spatial seats visualization ═══ */}
        <FounderSeats />

        {/* ═══ 09 · SHIP RECORD ═══ */}
        <ShipRecord />

        {/* ═══ 09.5 · KEYBOARD NATIVE ═══ */}
        <KeyboardNative />

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
 * Shared label for every major section: copper "NN / 10" monogram +
 * short uppercase kicker. Matches the pattern in the Hero and
 * Principles sections. Using one component keeps the spacing, type
 * weights, and copper-to-bone palette drift-proof.
 */
function SectionHead({ n, label }: { n: string; label: string }) {
  return (
    <div className="mb-8 flex items-center gap-4 flex-wrap">
      <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
        {n} / 10
      </span>
      <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
      <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C]">
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
        className={`transition-[background,border-color] duration-300 ${
          scrolled || mobileNavOpen
            ? "bg-[#030303]/85 backdrop-blur-xl border-b border-white/[0.05]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          {/* Wordmark */}
          <Link href="/" className="group flex items-center gap-2.5" aria-label="Sovereign Matrix — Home">
            <SovereignLogo size="sm" />
            <span className="hidden sm:block font-serif text-[17px] tracking-tight text-white">
              Sovereign Matrix
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-[13px]">
            <NavLink href={PLATFORM_HREF}>Platform</NavLink>
            <NavLink href="/customers">Customers</NavLink>
            <NavLink href="/trust">Trust</NavLink>
            <NavLink href="/pricing">Pricing</NavLink>

            {/* Subtle divider */}
            <span aria-hidden="true" className="h-4 w-px bg-white/[0.08]" />

            {/* Keyboard hint — Antigravity signature */}
            <div
              className="group hidden lg:flex items-center gap-1.5 text-neutral-500 text-[11px] font-mono select-none"
              title="Press / to open the command palette"
            >
              <span>Press</span>
              <kbd className="rounded border border-white/[0.08] bg-white/[0.025] px-1.5 py-0.5 text-[10px] text-neutral-300 group-hover:text-white group-hover:border-white/20 transition-colors">
                /
              </kbd>
            </div>

            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
              <button className="text-neutral-400 hover:text-white transition-colors text-[13px]">
                Log in
              </button>
            </SignInButton>

            <Link
              href={HERO_CTA}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-[#030303] font-medium text-[12.5px] tracking-tight rounded-[3px] hover:bg-[#F4EFE6] transition-colors"
            >
              Start free
              <span aria-hidden="true" className="text-[#B5532C]">→</span>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 -mr-2"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
          >
            <div className="space-y-1.5">
              <span className={`block w-5 h-[1.5px] bg-white transition-transform ${mobileNavOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
              <span className={`block w-5 h-[1.5px] bg-white transition-opacity ${mobileNavOpen ? "opacity-0" : ""}`} />
              <span className={`block w-5 h-[1.5px] bg-white transition-transform ${mobileNavOpen ? "-rotate-45 -translate-y-[7px]" : ""}`} />
            </div>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 left-4 right-4 p-5 rounded-2xl md:hidden bg-[#080808]/95 backdrop-blur-2xl border border-white/[0.06] flex flex-col gap-3 shadow-2xl"
          >
            <MobileLink href={PLATFORM_HREF} onClick={() => setMobileNavOpen(false)}>
              Platform
            </MobileLink>
            <MobileLink href="/customers" onClick={() => setMobileNavOpen(false)}>
              Customers
            </MobileLink>
            <MobileLink href="/trust" onClick={() => setMobileNavOpen(false)}>
              Trust
            </MobileLink>
            <MobileLink href="/pricing" onClick={() => setMobileNavOpen(false)}>
              Pricing
            </MobileLink>
            <Link
              href={HERO_CTA}
              className="mt-3 px-5 py-2.5 bg-white text-[#030303] text-sm text-center font-medium rounded-[3px]"
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
      className="relative text-neutral-300 hover:text-white transition-colors tracking-tight"
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
        count={28}
        maxSize={2.2}
        colors={[
          "rgba(181, 83, 44, 0.55)",
          "rgba(224, 133, 88, 0.4)",
          "rgba(255, 255, 255, 0.25)",
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
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C]">
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
          Five production-grade playbooks. Real output in three minutes.
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
      desc: "50 enriched leads, a published blog post, or a competitive analysis — not a demo, real deliverables.",
    },
  ];

  return (
    <section className="px-6 py-24 md:py-32 border-t border-white/[0.04]">
      <div className="max-w-5xl mx-auto">
        <SectionHead n="02" label="The proof" />
        <h2 className="font-serif text-3xl md:text-5xl leading-[1.1] mb-16 max-w-3xl tracking-tight">
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
    <section className="px-6 py-28 md:py-36 border-t border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        <SectionHead n="04" label="Five playbooks" />
        <h2 className="font-serif text-3xl md:text-5xl leading-[1.1] mb-5 max-w-3xl tracking-tight">
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
                className="group relative block h-full p-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-[#B5532C]/50 hover:bg-[#B5532C]/[0.04] transition-colors overflow-hidden"
              >
                {/* Copper sheen that slides in on hover — subtle depth */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 0%, rgba(181,83,44,0.08) 0%, transparent 60%)",
                  }}
                />

                <p className="relative text-[10px] font-mono uppercase tracking-[0.18em] text-[#B5532C] mb-3">
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
                <span className="relative text-[11px] font-mono tracking-wide text-[#B5532C] group-hover:text-white transition-colors">
                  Run this →
                </span>
              </Link>
            </TiltCard>
          ))}
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
    <section className="relative px-6 py-28 md:py-36 border-t border-white/[0.04] overflow-hidden">
      {/* Soft ambient glow beneath the mockup for depth */}
      <div
        className="absolute left-1/2 top-2/3 h-[400px] w-[700px] -translate-x-1/2 rounded-full opacity-20 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(181,83,44,0.3) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto">
        <div className="max-w-3xl mb-14">
          <SectionHead n="05" label="What you see when it runs" />
          <h2 className="font-serif text-3xl md:text-5xl leading-[1.1] mb-6 tracking-tight">
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
          Above: the actual{" "}
          <Link
            href="/dashboard/playbooks?auto=lead-blitz"
            className="text-[#B5532C] hover:text-white transition-colors underline decoration-[#B5532C]/30"
          >
            /dashboard/playbooks
          </Link>{" "}
          view · steps + models + output · every run 5-layer verified
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
        "86% of enterprise AI projects never ship. We sell shipped outcomes — leads enriched, content drafted, reports written — not pilots and proofs-of-concept.",
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
    <section className="px-6 py-28 md:py-36 border-t border-white/[0.04] bg-[#0A0807]">
      <div className="max-w-4xl mx-auto">
        <SectionHead n="07" label="Claude as critic" />
        <h2 className="font-serif text-3xl md:text-5xl leading-[1.1] mb-8 tracking-tight">
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

        {/* Real response shape — technical proof for engineers scanning the page */}
        <div className="mb-10 rounded-lg overflow-hidden border border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-2 bg-[#060605] border-b border-white/[0.04]">
            <p className="font-mono text-[10px] text-neutral-600 uppercase tracking-[0.18em]">
              Every agent response
            </p>
            <p className="font-mono text-[10px] text-neutral-700">json</p>
          </div>
          <pre className="p-5 font-mono text-[12px] leading-[1.7] overflow-x-auto bg-[#030303]/50">
            <code>
              <span className="text-neutral-600">{"{"}</span>
              {"\n  "}
              <span className="text-[#B5532C]">&quot;result&quot;</span>
              <span className="text-neutral-500">: </span>
              <span className="text-neutral-300">&quot;...&quot;</span>
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
              <span className="text-cyan-400">0.96</span>
              <span className="text-neutral-500">,</span>
              {"\n  "}
              <span className="text-[#B5532C]">&quot;snapshotSha&quot;</span>
              <span className="text-neutral-500">: </span>
              <span className="text-neutral-400">&quot;sha256:4f3c...a91e&quot;</span>
              <span className="text-neutral-500">,</span>
              {"\n  "}
              <span className="text-[#B5532C]">&quot;guaranteeMet&quot;</span>
              <span className="text-neutral-500">: </span>
              <span className="text-cyan-400">true</span>
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
    <section className="relative px-6 py-28 md:py-36 border-t border-white/[0.04] overflow-hidden">
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
            A guaranteed deliverable or the run doesn&apos;t count.
            Simple rules, strictly enforced — the kind of software I
            wish someone had sold me in 2024.
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

/* ─── 09 · Ship record ──────────────────────────────────────────── */

function ShipRecord() {
  return (
    <section className="px-6 py-20 border-t border-white/[0.04] bg-[#0A0807]">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-10">
        <div className="flex-1">
          <SectionHead n="09" label="Ship record" />
          <h2 className="font-serif text-2xl md:text-4xl leading-[1.15] mb-4 max-w-xl tracking-tight">
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/commits/main"
              target="_blank"
              rel="noopener"
              className="text-white hover:text-[#B5532C] transition-colors"
            >
              80+ commits. 15 migrations. 1,192 tests passing.
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
    <section className="px-6 py-32 md:py-44 border-t border-white/[0.04]">
      <div className="max-w-3xl mx-auto text-center">
        <div className="mb-8 flex items-center justify-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            10 / 10
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C]">
            Get started
          </p>
        </div>
        <h2 className="font-serif text-4xl md:text-7xl leading-[1.02] mb-10 tracking-tight">
          Three minutes.
          <br />
          <em className="not-italic text-[#B5532C]">One playbook.</em>
          <br />
          Real output.
        </h2>
        <p className="text-[17px] md:text-[19px] text-neutral-400 mb-12 max-w-xl mx-auto leading-[1.55]">
          No credit card. No developer. No six-month integration. Your first
          50 runs are free; the next tier is $49/mo, $24.50 if you grab a
          Founder Network slot.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <PrimaryCTA href={HERO_CTA} variant="final">
            Run your first playbook
          </PrimaryCTA>
          <a
            href="mailto:christiaan@sovereignmatrix.agency"
            onClick={() => trackCtaClick("email-founder")}
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
