"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { getMarketingPlaybooks } from "@/lib/playbooks";
import { PrimaryCTA } from "@/components/landing/PrimaryCTA";
import { StatusIndicator } from "@/components/landing/StatusIndicator";
import { TryItDemo } from "@/components/landing/TryItDemo";
import { trackCtaClick } from "@/lib/cta-track";
import {
  useHideyNav,
  FloatingParticles,
  TiltCard,
} from "@/components/ui/EliteEffects";

// Above-the-fold (or near-fold) sections — static-imported to keep
// LCP fast and avoid a flash of unstyled-skeleton in the visitor's
// first paint.
import { A2EGraph } from "@/components/landing/A2EGraph";
import { LiveProofStrip } from "@/components/landing/LiveProofStrip";
import { ThreeMoatsGrid } from "@/components/landing/ThreeMoatsGrid";
import { A2EEconomySection } from "@/components/landing/A2EEconomySection";
import { ModelRouterSection } from "@/components/landing/ModelRouterSection";
import { VerificationPipeline } from "@/components/landing/VerificationPipeline";
import { SectionDivider } from "@/components/landing/SectionDivider";
import { FilmGrain } from "@/components/landing/FilmGrain";
import { HeroProofPill } from "@/components/landing/HeroProofPill";
import { NewsletterSignup } from "@/components/landing/NewsletterSignup";

// Below-the-fold sections — dynamic-imported with skeleton placeholders
// so the visitor's initial JS bundle is smaller, LCP is faster, and
// these heavier components (cinematic, network-on-mount, etc.) only
// hydrate once the visitor scrolls into them.
//
// SSR stays on (ssr: true) for SEO + zero-flash readability — Next.js
// still server-renders the markup, it just defers hydration.
const LiveVerifierDemo = dynamic(
  () =>
    import("@/components/landing/LiveVerifierDemo").then((m) => ({
      default: m.LiveVerifierDemo,
    })),
  {
    loading: () => (
      <section
        aria-hidden="true"
        className="relative z-10 mx-auto w-full max-w-5xl px-6 py-24"
      >
        <div className="h-72 rounded-2xl border border-white/[0.04] bg-white/[0.02] backdrop-blur-xl" />
      </section>
    ),
  },
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
 * Section map:
 *   Nav · 01 Hero · LiveProofStrip · 02 ThreeMoats · 03 A2EEconomy ·
 *   04 MemoryMoat · 05 ModelRouter · 06 VerificationPipeline ·
 *   06.5 LiveVerifierDemo · 07 FeaturedPlaybooks · 08 IndustrySection ·
 *   09 PlatformScale · 10 PricingStrip · FinalCTA · Footer · CommandEgg
 */

const HERO_CTA = "/signup";
const PLATFORM_HREF = "/platform";

const PLAYBOOK_COPY: Record<string, { outcome: string; time: string }> = {
  "agency-content-packet": {
    outcome:
      "1,500-word SEO blog + 3-email sequence + 3 ad creatives + competitor teaser. One client, every week.",
    time: "~90 sec",
  },
  "recruiting-sourcing-sprint": {
    outcome:
      "Structured ICP + boolean searches + outreach pack + 5 channels + 4-objection playbook. One role, every week.",
    time: "~90 sec",
  },
  "growth-pulse": {
    outcome:
      "Local SEO + 4 social posts + re-engagement email + WhatsApp template + offer card in your currency. Monthly.",
    time: "~90 sec",
  },
  "realestate-listing-pulse": {
    outcome:
      "MLS-grade copy + open-house posts + buyer email + 3-comp analysis + suburb market update. One listing.",
    time: "~90 sec",
  },
  "lead-blitz": {
    outcome:
      "5+ companies with contact angles guaranteed, or the run doesn't count.",
    time: "~3 min",
  },
  "competitor-takedown": {
    outcome:
      "Full report: weaknesses, market gaps, pricing arbitrage, counter-positioning.",
    time: "~4 min",
  },
  "content-machine": {
    outcome:
      "1,500+ word post, meta + keywords, plus platform-ready social snippets.",
    time: "~2 min",
  },
  "seo-domination": {
    outcome: "Content velocity score + ranked keyword gaps + topic sequence.",
    time: "~4 min",
  },
  "weekly-report": {
    outcome:
      "Executive-ready summary: wins, blockers, next steps. Scheduled every Monday.",
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
    <div className="relative min-h-screen bg-[#030303] text-white antialiased">
      {/* Cinematic film-grain overlay — analog texture, sub-3% alpha */}
      <FilmGrain />

      <Nav mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} />

      <main id="main-content" className="relative z-10">
        {/* 01 · Hero — copper surface (marketing) */}
        <Hero />

        {/* Try-it demo — embedded competitor scan, no signup */}
        <TryItDemo />

        {/* Live stats strip */}
        <LiveProofStrip />

        <SectionDivider accent="copper" />

        {/* 02 · Three Moats */}
        <ThreeMoatsGrid />

        {/* 03 · A2E Economy */}
        <A2EEconomySection />

        {/* 04 · Memory Moat */}
        <MemoryMoat />

        {/* 05 · Model Router */}
        <ModelRouterSection />

        {/* Audit surface starts here — flip the divider accent to cyan */}
        <SectionDivider accent="cyan" />

        {/* 06 · Verification Pipeline */}
        <VerificationPipeline />

        {/* 06.5 · Live Verifier — interactive proof against the real /api/verify */}
        <LiveVerifierDemo />

        {/* Back to marketing surface */}
        <SectionDivider accent="copper" />

        {/* 07 · Featured Playbooks */}
        <FeaturedPlaybooksSection />

        {/* 08 · Industries */}
        <IndustrySection />

        {/* 09 · Platform Scale */}
        <PlatformScale />

        {/* 10 · Pricing Strip */}
        <PricingStrip />

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
        <div
          className={`absolute inset-x-0 bottom-0 h-px transition-opacity duration-500 pointer-events-none ${scrolled ? "opacity-100" : "opacity-0"}`}
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(181,83,44,0.45) 50%, transparent 100%)",
          }}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-6 md:px-10 h-[60px] flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2.5 flex-shrink-0"
            aria-label="Sovereign Matrix — Home"
          >
            <SovereignLogo size="sm" />
            <span className="hidden sm:block font-serif text-[17px] tracking-tight text-white group-hover:text-[#E8DDD0] transition-colors">
              Sovereign Matrix
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-0 text-[13px]">
            <div className="flex items-center gap-6 mr-6">
              <NavLink href={PLATFORM_HREF}>Platform</NavLink>
              <NavLink href="/marketplace">Marketplace</NavLink>
              <NavLink href="/explorer">Explorer</NavLink>
              <NavLink href="/trust">Trust</NavLink>
              <NavLink href="/pricing">Pricing</NavLink>
              <NavLink href="/developers/docs">Docs</NavLink>
            </div>

            <span
              aria-hidden="true"
              className="h-4 w-px bg-white/[0.07] mr-6"
            />

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
                style={{
                  boxShadow:
                    "0 0 0 1px rgba(181,83,44,0.6), 0 0 16px rgba(181,83,44,0.3)",
                }}
              />
              Run Free Agent
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
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
                <span
                  className={`block w-5 h-[1.5px] bg-current transition-transform ${mobileNavOpen ? "rotate-45 translate-y-[7px]" : ""}`}
                />
                <span
                  className={`block w-5 h-[1.5px] bg-current transition-opacity ${mobileNavOpen ? "opacity-0" : ""}`}
                />
                <span
                  className={`block w-5 h-[1.5px] bg-current transition-transform ${mobileNavOpen ? "-rotate-45 -translate-y-[7px]" : ""}`}
                />
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
              { href: "/marketplace", label: "Marketplace" },
              { href: "/explorer", label: "Explorer" },
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
    </motion.nav>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
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
      {/* A2EGraph background at low opacity */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ opacity: 0.3 }}
      >
        <A2EGraph className="w-full h-full" />
      </div>

      {/* Copper radial gradient overlay — 4% center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(181,83,44,0.04) 0%, transparent 65%)",
        }}
        aria-hidden="true"
      />

      {/* Copper dust particles */}
      <FloatingParticles
        count={20}
        maxSize={1.6}
        colors={[
          "rgba(181, 83, 44, 0.4)",
          "rgba(224, 133, 88, 0.25)",
          "rgba(255, 190, 130, 0.10)",
        ]}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Bottom fade for smooth section transition */}
      <div
        className="absolute bottom-0 inset-x-0 h-32 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, #030303 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto w-full text-center">
        {/* Pre-badge — HeroProofPill fetches /api/agent-runs/latest-public
            on mount and shows the freshest verified receipt id with a
            live cyan pulse. Stripe's hero shows a fake code editor;
            this is Sovereign's analog — real proof-of-life from the
            production verifier as the very first thing a visitor sees. */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
          className="flex items-center justify-center gap-3 mb-8 flex-wrap"
        >
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            01 / 10
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <HeroProofPill />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-9xl leading-[1.02] tracking-[-0.02em] mb-6"
        >
          <span className="block text-white">Audit-grade</span>
          {/* Slow gradient sweep between the two brand accents —
              treats the dual-accent rule itself as a typographic
              move. See globals.css `.brand-sweep`. Respects
              prefers-reduced-motion. */}
          <span className="block brand-sweep">AI agents.</span>
          <span className="block text-white text-3xl sm:text-5xl md:text-6xl lg:text-7xl mt-3">
            Every output, cryptographically signed.
          </span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="text-[17px] md:text-[19px] text-neutral-400 leading-[1.55] mb-4 max-w-2xl mx-auto"
        >
          137 production agents that research, draft, qualify, and call — and
          ship a verifiable HMAC-signed receipt every time. Built for teams that
          need AI <em className="not-italic text-neutral-300">and</em> a paper
          trail.
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-[15px] md:text-[16px] text-neutral-500 leading-[1.55] mb-10 max-w-xl mx-auto"
        >
          Free forever — 50 verified runs/mo. Pro from R997/mo (≈ $49). No
          per-seat fees. ZAR + USD billing. POPIA-native, SOC2-mapped,
          audit-ready on day one.
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
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </motion.div>

        {/* Pricing micro-line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-[11px] font-mono text-neutral-600 tracking-wide mb-6"
        >
          Free · R997/mo · R3,997/mo · $0 · $49/mo · $199/mo ·{" "}
          <Link
            href="/pricing"
            className="hover:text-neutral-400 transition-colors underline decoration-white/10 hover:decoration-white/30"
          >
            full pricing
          </Link>
        </motion.p>

        {/* Trust line — audit-grade positioning */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.95, duration: 0.5 }}
          className="text-[11px] font-mono text-neutral-700 tracking-wide mb-12"
        >
          <Link href="/spec" className="hover:text-cyan-300 transition-colors">
            VAOS 1.0 open standard
          </Link>
          <span className="text-neutral-800 mx-1">·</span>
          <Link
            href="/verified"
            className="hover:text-cyan-300 transition-colors"
          >
            Live verifier demo
          </Link>
          <span className="text-neutral-800 mx-1">·</span>
          <Link
            href="/explorer"
            className="hover:text-cyan-300 transition-colors"
          >
            Receipt explorer
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
            <svg
              width="14"
              height="20"
              viewBox="0 0 14 20"
              fill="none"
              className="text-neutral-700"
            >
              <path
                d="M7 2v10M3.5 8.5L7 12l3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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
        style={{
          background:
            "radial-gradient(circle, rgba(181,83,44,1) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto">
        <SectionHead n="04" label="the compounding moat" />

        <div className="grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-[58px] leading-[1.05] mb-6 tracking-[-0.02em]">
              Agents that get
              <br />
              <em className="not-italic text-[#B5532C]">smarter every run.</em>
            </h2>
            <p className="text-[16px] text-neutral-400 leading-[1.65] mb-6 max-w-md">
              Every execution is embedded in semantic memory — 1024-dimensional
              vectors that capture what you worked on, what worked, and what
              your business is about. Future agents retrieve relevant context
              automatically. No re-briefing. No lost context.
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
              style={{
                background:
                  "linear-gradient(to bottom, rgba(181,83,44,0.25) 0%, rgba(181,83,44,0.9) 100%)",
              }}
              aria-hidden="true"
            />

            <div className="space-y-8">
              {timeline.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    delay: i * 0.12,
                    duration: 0.55,
                    ease: [0.16, 1, 0.3, 1],
                  }}
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
                      style={{
                        color: `rgba(181,83,44,${0.6 + nodeOpacity[i] * 0.4})`,
                      }}
                    >
                      {item.label}
                    </p>
                    <p className="text-[14px] text-neutral-300 leading-[1.6]">
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <p className="mt-10 text-[10px] font-mono text-neutral-700 leading-relaxed pl-[60px]">
              Powered by NVIDIA NIM embeddings (nvidia/nv-embedqa-e5-v5,
              1024-dim) · Stored in your private tenant namespace · Never shared
              across users
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 07 · Featured Playbooks ───────────────────────────────────── */

// Slugs that have a dedicated public marketing + intake page under
// /playbooks/<slug>. All others default to the auth-gated dashboard runner.
const PUBLIC_PLAYBOOK_PAGES = new Set([
  "agency-content-packet",
  "recruiting-sourcing-sprint",
  "growth-pulse",
  "realestate-listing-pulse",
]);

function playbookHref(slug: string): string {
  return PUBLIC_PLAYBOOK_PAGES.has(slug)
    ? `/playbooks/${slug}`
    : `/dashboard/playbooks?auto=${slug}`;
}

function FeaturedPlaybooksSection() {
  return (
    <section className="px-6 py-28 md:py-36 bg-[#040303]">
      <div className="max-w-6xl mx-auto">
        <SectionHead n="07" label="cornerstone playbooks" />
        <h2 className="font-serif text-4xl md:text-6xl lg:text-[68px] leading-[1.05] mb-5 max-w-3xl tracking-[-0.02em]">
          Pick your vertical.
          <br />
          <em className="not-italic text-[#B5532C]">
            One brief → a full week of deliverables.
          </em>
        </h2>
        <p className="text-neutral-400 max-w-xl leading-relaxed mb-16 text-[15px]">
          Four vertical-specific packets that do the buyer&apos;s actual weekly
          work — not generic AI assistants. Every output structured, every asset
          whitelabel-ready, every run guaranteed or it doesn&apos;t count.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURED_PLAYBOOKS.map((pb) => (
            <TiltCard key={pb.slug} tiltStrength={6} className="h-full">
              <Link
                href={playbookHref(pb.slug)}
                onClick={() => trackCtaClick("playbook-card")}
                className="group relative block h-full p-6 rounded-[6px] border border-white/[0.06] bg-white/[0.025] hover:border-[#B5532C]/35 hover:bg-[#B5532C]/[0.04] transition-all duration-300 overflow-hidden"
                style={{
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 0 rgba(0,0,0,0.5)",
                }}
              >
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

          <Link
            href="/playbooks"
            className="group relative flex flex-col justify-between h-full p-6 rounded-[6px] border border-dashed border-white/[0.07] hover:border-[#B5532C]/30 transition-all duration-300"
          >
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-600 mb-3">
                4 verticals · 25+ playbooks
              </p>
              <h3 className="font-serif text-2xl text-neutral-500 group-hover:text-white transition-colors leading-tight tracking-tight mb-2">
                See every playbook
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                B2B agencies, recruiting agencies, real estate, African SMBs —
                plus the full library of lead gen, content, and
                competitive-intel playbooks.
              </p>
            </div>
            <span className="mt-6 text-[11px] font-mono tracking-wide text-neutral-600 group-hover:text-[#B5532C] transition-colors">
              Browse all →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── 08 · Industry Section ─────────────────────────────────────── */
function IndustrySection() {
  const industries = [
    {
      code: "HC",
      label: "Healthcare",
      desc: "Clinical documentation, prior authorization review, and ICD-10 coding — every run checked by Claude before reaching your EHR.",
      href: "/for-healthcare",
    },
    {
      code: "LG",
      label: "Legal",
      desc: "Contract review in minutes, not billable hours. Compliance monitoring with a cryptographic audit trail on every opinion.",
      href: "/for-legal",
    },
    {
      code: "AG",
      label: "Agriculture",
      desc: "Crop intelligence, pest-risk modelling, and yield forecasting tuned to the specific cultivar and region you operate in.",
      href: "/for-agriculture",
    },
    {
      code: "MF",
      label: "Manufacturing",
      desc: "Predictive maintenance signals and supply-chain disruption alerts read straight off your sensor and ERP streams.",
      href: "/for-manufacturing",
    },
    {
      code: "CS",
      label: "Cybersecurity",
      desc: "Threat hunting, CVE triage, and SOC automation with a human-in-the-loop approval layer on anything destructive.",
      href: "/for-cybersecurity",
    },
    {
      code: "FI",
      label: "Fintech",
      desc: "Fraud pattern detection, KYC / AML flagging, and regulator-ready reporting that holds up under an audit.",
      href: "/for-fintech",
    },
    {
      code: "RE",
      label: "Real Estate",
      desc: "Listing generation, lease abstraction, and broker-grade valuation memos produced from the document bundle you already hold.",
      href: "/for-realestate",
    },
    {
      code: "GV",
      label: "Government",
      desc: "Permit processing, benefits eligibility, and FOIA response drafting — every step logged to an immutable ledger.",
      href: "/for-government",
    },
  ];

  return (
    <section className="px-6 py-20 md:py-28 bg-[#030303]">
      <div className="max-w-6xl mx-auto">
        <SectionHead n="08" label="industries served" />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <h2 className="font-serif text-4xl md:text-5xl lg:text-[58px] leading-[1.05] max-w-2xl tracking-[-0.02em]">
            Eight industries.
            <br />
            <em className="not-italic text-[#B5532C]">One platform.</em>
          </h2>
          <p className="text-[14px] text-neutral-500 max-w-sm leading-relaxed md:text-right">
            Every vertical has dedicated agents built for its specific
            regulatory requirements, terminology, and output formats.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {industries.map((ind, i) => (
            <motion.div
              key={ind.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                delay: i * 0.05,
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <Link
                href={ind.href}
                className="group relative block h-full p-5 rounded-[6px] border border-white/[0.06] bg-white/[0.025] hover:border-[#B5532C]/35 hover:bg-[#B5532C]/[0.03] transition-all duration-300 overflow-hidden"
                style={{
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 0 rgba(0,0,0,0.5)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background:
                      "radial-gradient(circle at 20% 0%, rgba(181,83,44,0.18) 0%, transparent 45%)",
                  }}
                />
                <span className="relative inline-flex items-center justify-center h-6 w-6 rounded-full border border-white/[0.12] text-neutral-500 font-mono text-[10px] mb-4 tracking-wide group-hover:border-[#B5532C]/40 group-hover:text-[#B5532C] transition-colors">
                  {ind.code}
                </span>
                <p className="relative text-[14px] font-semibold text-white mb-1.5 tracking-tight">
                  {ind.label}
                </p>
                <p className="relative text-[11.5px] text-neutral-500 leading-[1.55]">
                  {ind.desc}
                </p>
                <span
                  aria-hidden="true"
                  className="absolute bottom-4 right-4 text-[10px] font-mono text-neutral-700 group-hover:text-[#B5532C] transition-colors"
                >
                  →
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 09 · Platform Scale ───────────────────────────────────────── */
const SCALE_METRICS = [
  {
    n: "137",
    label: "Agents",
    sub: "Across 8 industries and 19 task categories. Healthcare, legal, agriculture, manufacturing, cybersecurity, and more.",
    href: "/platform",
  },
  {
    n: "90+",
    label: "Integrations",
    sub: "Slack, HubSpot, Salesforce, Stripe, Notion, Clearbit, Apollo, Hunter — BYOK for data enrichment.",
    href: "/integrations",
  },
  {
    n: "8",
    label: "Model providers",
    sub: "NIM · Claude · Gemini · Groq · Cerebras · Ollama · DeepSeek · Tavily. 11-deep failover chain.",
    href: "/platform",
  },
  {
    n: "5",
    label: "Verification layers",
    sub: "Jailbreak → PII → content policy → quality gate → Claude critic. Every single run, no exceptions.",
    href: "/trust",
  },
] as const;

function PlatformScale() {
  return (
    <section className="px-6 py-0 bg-[#030303] border-t border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/[0.05] border-b border-white/[0.04]">
          {SCALE_METRICS.map((m) => (
            <motion.a
              key={m.label}
              href={m.href}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5 }}
              className="group block px-6 py-10 md:px-8 md:py-12 hover:bg-white/[0.015] transition-colors"
            >
              <div className="font-serif text-[52px] md:text-[64px] text-white leading-none tracking-[-0.02em] mb-3 group-hover:text-[#E8DDD0] transition-colors">
                {m.n}
              </div>
              <div className="text-[13px] font-medium text-neutral-300 mb-2 tracking-tight">
                {m.label}
              </div>
              <div className="text-[11px] font-mono text-neutral-600 leading-[1.65] max-w-[200px]">
                {m.sub}
              </div>
            </motion.a>
          ))}
        </div>

        <div className="py-5 flex items-center justify-between">
          <p className="text-[11px] font-mono text-neutral-700 tracking-wide">
            137 agents · 8 industries · 90+ integrations · full surface at{" "}
            <Link
              href="/platform"
              className="text-neutral-500 hover:text-white transition-colors"
            >
              /platform
            </Link>{" "}
            and{" "}
            <Link
              href="/developers/docs"
              className="text-neutral-500 hover:text-white transition-colors"
            >
              /developers/docs
            </Link>
          </p>
          <Link
            href="/dashboard"
            className="text-[11px] font-mono text-neutral-600 hover:text-[#B5532C] transition-colors tracking-wide"
          >
            Open dashboard →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── 10 · Pricing Strip ────────────────────────────────────────── */
function PricingStrip() {
  const tiers = [
    { name: "Free", price: null, popular: false },
    { name: "Pro", price: "$49", popular: true },
    { name: "Team", price: "$199", popular: false },
    { name: "Enterprise", price: "Custom", popular: false },
  ];

  return (
    <section className="px-6 py-20 md:py-28 bg-[#040303]">
      <div className="max-w-4xl mx-auto">
        <SectionHead n="10" label="pricing" />

        <h2 className="font-serif text-3xl md:text-5xl leading-[1.08] mb-4 tracking-[-0.02em] max-w-2xl">
          Simple, Transparent Pricing.
          <br />
          <em className="not-italic text-[#B5532C]">
            Start free. Scale when it clicks.
          </em>
        </h2>
        <p className="text-neutral-400 text-[14px] mb-10 max-w-lg leading-relaxed">
          No credit card on free tier. No annual contracts. Cancel anytime.
        </p>

        <div
          className="p-6 rounded-[8px] border border-white/[0.06] bg-white/[0.025]"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
        >
          <div className="flex flex-wrap gap-3 mb-6">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className="relative flex items-center gap-2 px-4 py-2 rounded-[4px] border"
                style={{
                  borderColor: tier.popular
                    ? "rgba(181,83,44,0.55)"
                    : "rgba(255,255,255,0.07)",
                  background: tier.popular
                    ? "rgba(181,83,44,0.08)"
                    : "rgba(255,255,255,0.02)",
                }}
              >
                <span className="font-mono text-[12px] text-white">
                  {tier.name}
                </span>
                {tier.price && (
                  <span className="font-mono text-[12px] text-[#B5532C]">
                    {tier.price}/mo
                  </span>
                )}
                {tier.popular && (
                  <span className="absolute -top-2 -right-1 font-mono text-[8px] text-[#B5532C] bg-[#B5532C]/10 border border-[#B5532C]/35 px-1.5 py-0.5 rounded-full tracking-wide">
                    Popular
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-[12px] font-mono text-neutral-500">
              Free tier: 50 agent runs/month · No card required · Upgrade when
              it&apos;s obvious
            </p>
            <Link
              href="/pricing"
              className="group inline-flex items-center gap-1.5 text-[12px] font-mono text-[#B5532C] hover:text-white transition-colors tracking-tight"
            >
              See full pricing
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ─────────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section
      className="px-6 py-24 md:py-32 mx-6 mb-12 md:mx-12 lg:mx-20 rounded-[10px] border border-[#B5532C]/20 overflow-hidden relative"
      style={{ background: "rgba(181,83,44,0.06)" }}
    >
      {/* Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(181,83,44,0.06) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-2xl mx-auto text-center">
        <div className="mb-8 flex items-center justify-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            10 / 10
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            your move
          </p>
        </div>

        <h2 className="font-serif text-4xl md:text-6xl leading-[1.04] mb-6 tracking-tight">
          Your AI Workforce
          <br />
          <em className="not-italic text-[#B5532C]">Starts Free</em>
        </h2>

        <p className="text-[15px] md:text-[17px] text-neutral-400 mb-10 leading-[1.6] max-w-lg mx-auto">
          No credit card required. 137 agents ready in 60 seconds. 50 runs reset
          every month — free forever.
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
              style={{
                boxShadow:
                  "0 0 0 1px rgba(181,83,44,0.5), 0 0 24px rgba(181,83,44,0.2)",
              }}
            />
            Run Your First Agent Free
            <span
              aria-hidden="true"
              className="text-[#B5532C] transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
          <a
            href="mailto:hello@sovereignmatrix.agency"
            onClick={() => trackCtaClick("email-sales")}
            className="inline-flex items-center px-6 py-4 border border-white/[0.12] text-neutral-400 font-mono text-[13px] tracking-wide hover:text-white hover:border-white/30 transition-colors rounded-[4px]"
          >
            Contact sales
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono text-neutral-600">
          {[
            "Claude critic on every run",
            "Full audit trail",
            "Cancel anytime",
          ].map((t) => (
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
            <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-5">
              Colophon
            </p>
            <p className="font-serif text-[22px] md:text-[28px] leading-[1.35] text-white tracking-tight">
              Sovereign Matrix is an independent studio building agent
              infrastructure for operators — one playbook,{" "}
              <em className="not-italic text-[#B5532C]">one guarantee</em>, one
              audit trail at a time.
            </p>
            <p className="mt-6 text-[14px] text-neutral-400 leading-relaxed max-w-xl">
              Hand-written in Cape Town. Claude is the critic on every run.
              We&apos;re not Anthropic — we just build on their model and
              publish the receipts.
            </p>
          </div>

          <Link
            href={HERO_CTA}
            className="group inline-flex items-center gap-3 text-[13px] font-mono tracking-tight text-neutral-400 hover:text-white transition-colors whitespace-nowrap"
          >
            <span className="font-serif italic text-lg text-[#B5532C] not-italic">
              →
            </span>
            <span className="border-b border-white/[0.1] group-hover:border-[#B5532C] pb-0.5 transition-colors">
              Run your first playbook
            </span>
          </Link>
        </div>

        {/* Newsletter capture — release notes + security advisories,
            ~2 emails / month. Cyan-themed (audit/infrastructure
            surface) per the dual-accent brand rule. */}
        <div className="mb-12 max-w-md">
          <p className="mb-3 text-[11px] font-mono uppercase tracking-widest text-neutral-500">
            Release notes + security advisories
          </p>
          <NewsletterSignup source="landing-footer" />
        </div>

        {/* Link grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-8 mb-16">
          <FooterCol
            title="Product"
            links={[
              { href: "/platform", label: "Agents" },
              { href: "/dashboard/playbooks", label: "Playbooks" },
              { href: "/dashboard", label: "Dashboard" },
              { href: "/marketplace", label: "Marketplace" },
              { href: "/trust", label: "Trust" },
            ]}
          />
          <FooterCol
            title="Solutions"
            links={[
              { href: "/for-healthcare", label: "Healthcare" },
              { href: "/for-legal", label: "Legal" },
              { href: "/for-agriculture", label: "Agriculture" },
              { href: "/for-manufacturing", label: "Manufacturing" },
              { href: "/for-cybersecurity", label: "Security" },
            ]}
          />
          <FooterCol
            title="Developers"
            links={[
              { href: "/developers/docs", label: "API Docs" },
              { href: "/integrations", label: "Integrations" },
              {
                href: "https://www.npmjs.com/package/@sovereignmatrix/mcp",
                label: "MCP Server",
                external: true,
              },
              { href: "/changelog", label: "Changelog" },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { href: "/about", label: "About" },
              { href: "/case-studies", label: "Customers" },
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
              <span className="font-serif text-[15px] text-white">
                Sovereign Matrix
              </span>
              <span className="text-[10px] font-mono text-neutral-600 tracking-tight">
                © 2026 · Operates independently · Not formally affiliated with
                Anthropic
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <Link
              href="/built-with-claude"
              className="inline-flex items-center gap-1.5 text-[10px] font-mono text-neutral-600 hover:text-[#B5532C] transition-colors tracking-tight group"
            >
              <span className="text-[#B5532C]/50 group-hover:text-[#B5532C] transition-colors">
                ◆
              </span>
              Built with Claude
            </Link>

            <span aria-hidden="true" className="h-4 w-px bg-white/[0.06]" />

            <StatusIndicator />

            <span aria-hidden="true" className="h-4 w-px bg-white/[0.06]" />

            <div className="flex items-center gap-3 text-[11px] font-mono tracking-tight">
              <Link href="/" className="text-[#B5532C]">
                Operators
              </Link>
              <span aria-hidden="true" className="text-neutral-800">
                ·
              </span>
              <Link
                href={PLATFORM_HREF}
                className="text-neutral-500 hover:text-white transition-colors"
              >
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
