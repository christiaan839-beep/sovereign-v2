"use client";

/**
 * Sovereign Matrix — Landing v3 (the "Cinematic Frame" redesign).
 *
 * Live at /redesign for side-by-side preview against /. When approved,
 * swap the export here into /page.tsx or rename this folder to / and
 * archive the legacy file.
 *
 * Inspiration: bloodline.agency + uxconstellation.com — premium
 * dark editorial, single-frame hero, manifesto-first storytelling,
 * theatrical chapter breaks, and one scene-shift to break the dark.
 *
 * Sections:
 *   Nav · Hero (single frame, morphing keyword) ·
 *   Manifesto (editorial worldview) ·
 *   ──── Chapter I — The Moat ────
 *     ThreeMoatsGrid · MemoryMoat (cinematic v2)
 *   ──── Chapter II — The Proof ────
 *     CyanScene → VerificationPipeline + LiveVerifierDemo
 *   ──── Chapter III — The Practice ────
 *     TryItDemo
 *   ──── Chapter IV — The Terms ────
 *     PricingScene (CREAM background — breaks the dark)
 *   FinalCTACinematic (full-bleed closing) · Footer · CommandEgg
 *
 * Palette / Type:
 *   #030303 base · #B5532C copper (marketing) · #00B7FF cyan (audit)
 *   "Instrument Serif" headlines · "JetBrains Mono" meta · default sans body
 */

import {
  motion,
  AnimatePresence,
  MotionConfig,
  useScroll,
  useTransform,
} from "framer-motion";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { PrimaryCTA } from "@/components/landing/PrimaryCTA";
import { StatusIndicator } from "@/components/landing/StatusIndicator";
import { TryItDemo } from "@/components/landing/TryItDemo";
import { trackCtaClick } from "@/lib/cta-track";
import { useHideyNav, FloatingParticles } from "@/components/ui/EliteEffects";
import { A2EGraph } from "@/components/landing/A2EGraph";
import { ThreeMoatsGrid } from "@/components/landing/ThreeMoatsGrid";
import { VerificationPipeline } from "@/components/landing/VerificationPipeline";
import { FilmGrain } from "@/components/landing/FilmGrain";
import { HeroProofPill } from "@/components/landing/HeroProofPill";
import { NewsletterSignup } from "@/components/landing/NewsletterSignup";

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

const SERIF = "'Instrument Serif', Georgia, serif";
const HERO_CTA = "/signup";

/* ──────────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────────── */

export default function RedesignPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-dvh bg-[#030303] text-white antialiased overflow-x-hidden">
        <FilmGrain />
        <Nav
          mobileNavOpen={mobileNavOpen}
          setMobileNavOpen={setMobileNavOpen}
        />

        <main id="main-content" className="relative z-10">
          <Hero />
          <Manifesto />

          <ChapterMarker
            roman="I"
            title="The Moat"
            subtitle="Three layers. One ledger."
            accent="copper"
          />
          <ThreeMoatsGrid />
          <MemoryMoatV2 />

          <ChapterMarker
            roman="II"
            title="The Proof"
            subtitle="Verify without our permission."
            accent="cyan"
          />
          <CyanScene>
            <VerificationPipeline />
            <LiveVerifierDemo />
          </CyanScene>

          <ChapterMarker
            roman="III"
            title="The Practice"
            subtitle="One brief. A full week of deliverables."
            accent="copper"
          />
          <TryItDemo />

          <ChapterMarker
            roman="IV"
            title="The Terms"
            subtitle="Pay when it clicks."
            accent="copper"
          />
          <PricingScene />

          <FinalCTACinematic />
        </main>

        <Footer />
        <CommandEgg />
      </div>
    </MotionConfig>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Nav — same structure as live `/`, slimmer chrome
 * ────────────────────────────────────────────────────────────────── */

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

  const links = [
    { href: "/platform", label: "Platform" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/trust", label: "Trust" },
    { href: "/pricing", label: "Pricing" },
    { href: "/developers/docs", label: "Docs" },
  ];

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
            ? "bg-[#030303]/85 backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div
          className={`absolute inset-x-0 bottom-0 h-px transition-opacity duration-500 pointer-events-none ${scrolled ? "opacity-100" : "opacity-0"}`}
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(181,83,44,0.4) 50%, transparent 100%)",
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
            <span
              className="hidden sm:block text-[17px] tracking-tight text-white group-hover:text-[#E8DDD0] transition-colors"
              style={{ fontFamily: SERIF }}
            >
              Sovereign Matrix
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-[13px]">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group relative text-neutral-400 hover:text-white transition-colors tracking-tight"
              >
                {l.label}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 left-0 right-0 h-px scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left"
                  style={{ background: "rgba(181,83,44,0.6)" }}
                />
              </Link>
            ))}

            <span aria-hidden="true" className="h-4 w-px bg-white/[0.07]" />

            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
              <button className="text-neutral-500 hover:text-white transition-colors text-[13px] tracking-tight">
                Log in
              </button>
            </SignInButton>

            <Link
              href={HERO_CTA}
              onClick={() => trackCtaClick("nav-run-free")}
              className="group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#B5532C] text-white font-medium text-[12.5px] tracking-tight rounded-[3px] hover:bg-[#C96234] transition-colors"
            >
              Run Free Agent
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </div>

          <div className="md:hidden flex items-center">
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
            {links.map((item) => (
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
              onClick={() => {
                trackCtaClick("mobile-nav-run-free");
                setMobileNavOpen(false);
              }}
            >
              Run Free Agent →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Hero — single frame, morphing keyword
 *
 * Bloodline-style: asymmetric, left-aligned, one big idea, no
 * ABA-bombing the visitor with seven elements above the fold.
 * The keyword morphs through (provable → signed → unforgeable → yours)
 * on a slow loop so it feels alive without scroll-tying.
 * ────────────────────────────────────────────────────────────────── */

const MORPH_WORDS = ["provable", "signed", "unforgeable", "yours"] as const;

function Hero() {
  const [wordIdx, setWordIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parallax: graph drifts up slower than scroll for cinematic depth.
  const { scrollY } = useScroll();
  const graphY = useTransform(scrollY, [0, 800], [0, -80]);
  const graphOpacity = useTransform(scrollY, [0, 600], [0.42, 0.05]);

  useEffect(() => {
    const t = setInterval(() => {
      setWordIdx((i) => (i + 1) % MORPH_WORDS.length);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[100dvh] flex items-stretch px-0 overflow-hidden"
    >
      {/* Right-half A2E constellation — clipped so the headline left side
          stays pure black. Bloodline-style asymmetry. */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 w-full md:w-[58%] pointer-events-none"
        style={{ y: graphY, opacity: graphOpacity }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 25%, black 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 25%, black 100%)",
          }}
        >
          <A2EGraph className="w-full h-full" showLabels={false} />
        </div>
      </motion.div>

      {/* Copper dust */}
      <FloatingParticles
        count={14}
        maxSize={1.4}
        colors={[
          "rgba(181, 83, 44, 0.35)",
          "rgba(224, 133, 88, 0.2)",
          "rgba(255, 190, 130, 0.08)",
        ]}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Bottom scene-fade for clean transition into Manifesto */}
      <div
        className="absolute bottom-0 inset-x-0 h-40 pointer-events-none z-[1]"
        style={{
          background: "linear-gradient(to bottom, transparent 0%, #030303 90%)",
        }}
        aria-hidden="true"
      />

      {/* Content grid — left col = headline + CTA, right col = meta rail */}
      <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-12 gap-6 px-6 md:px-12 lg:px-16 pt-32 pb-24">
        {/* Left — headline */}
        <div className="col-span-12 lg:col-span-8 flex flex-col justify-center">
          {/* Chapter pre-line */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5 }}
            className="flex items-center gap-4 mb-10 flex-wrap"
          >
            <span className="font-mono text-[10px] text-neutral-600 tracking-[0.32em] uppercase">
              Prologue
            </span>
            <span aria-hidden="true" className="h-px w-8 bg-white/[0.14]" />
            <HeroProofPill />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="leading-[0.95] tracking-[-0.025em] text-[clamp(3.2rem,9.5vw,9.5rem)] mb-2"
            style={{ fontFamily: SERIF, fontWeight: 400 }}
          >
            <span className="block text-neutral-100">The agents work.</span>
            <span className="block text-neutral-500">
              We&rsquo;ve made the work{" "}
              <span
                className="relative inline-block align-baseline"
                aria-live="polite"
              >
                <AnimatePresence mode="wait">
                  <motion.em
                    key={MORPH_WORDS[wordIdx]}
                    initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    className="not-italic text-[#E08558] inline-block"
                  >
                    {MORPH_WORDS[wordIdx]}
                  </motion.em>
                </AnimatePresence>
                <span
                  aria-hidden="true"
                  className="absolute -bottom-2 left-0 right-0 h-[2px]"
                  style={{
                    background:
                      "linear-gradient(to right, transparent, rgba(181,83,44,0.55), transparent)",
                  }}
                />
              </span>
              .
            </span>
          </motion.h1>

          {/* Sub-line */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.55 }}
            className="mt-10 text-[16px] md:text-[18px] text-neutral-400 leading-[1.55] max-w-[42ch]"
          >
            140 production agents that research, draft, qualify, and call. Every
            output ships with an Ed25519-signed receipt — post-quantum-ready,
            anchored to Bitcoin, verifiable without our permission.
          </motion.p>

          {/* CTA + secondary */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.55 }}
            className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          >
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute inset-0 -m-3 rounded-full blur-3xl opacity-50 pointer-events-none motion-reduce:opacity-0"
                style={{
                  background:
                    "radial-gradient(ellipse, rgba(181,83,44,0.35) 0%, transparent 70%)",
                }}
              />
              <div className="relative">
                <PrimaryCTA href={HERO_CTA} variant="hero">
                  Demand a Receipt
                </PrimaryCTA>
              </div>
            </div>
            <Link
              href="/transparency/verify"
              onClick={() => trackCtaClick("hero-marketplace")}
              className="group inline-flex items-center gap-2 text-[13px] font-mono tracking-tight text-neutral-400 hover:text-white transition-colors"
            >
              <span className="opacity-60 group-hover:opacity-100 transition-opacity">
                or
              </span>
              <span className="border-b border-white/[0.18] group-hover:border-white/60 pb-0.5 transition-colors">
                verify someone else&rsquo;s
              </span>
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
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-8 text-[11px] font-mono text-neutral-600 tracking-[0.14em] uppercase"
          >
            Free · 50 verified runs / mo · No card · POPIA + SOC2 mapped
          </motion.p>
        </div>

        {/* Right — meta rail (vertical, monospace, theatrical) */}
        <aside className="hidden lg:flex col-span-4 flex-col items-end justify-between text-right">
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase leading-relaxed"
          >
            <div>VAOS / v1.0.0</div>
            <div className="mt-1">Ed25519 · ML-DSA-65</div>
            <div className="mt-1">RFC 6962 · OTS-anchored</div>
          </motion.div>

          {/* Hero index — abstract page anchor, makes scroll feel like
              a film reel (bloodline / uxconstellation move) */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="font-mono leading-tight"
            style={{ fontFamily: SERIF }}
          >
            <div className="text-[140px] text-[#0e0e0e] tracking-tight">00</div>
            <div className="text-[11px] text-neutral-600 tracking-[0.22em] uppercase font-mono -mt-2">
              / Prologue
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="font-mono text-[10px] text-neutral-700 tracking-[0.22em] uppercase"
          >
            scroll ↓
          </motion.div>
        </aside>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Manifesto — editorial worldview, scroll-revealed
 *
 * Premium creative agency sites always have ONE moment of pure
 * editorial. The product features come AFTER you've fallen in love
 * with the worldview. This is that moment.
 * ────────────────────────────────────────────────────────────────── */

function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const rimLight = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]);

  return (
    <section
      ref={ref}
      className="relative px-6 md:px-12 py-32 md:py-44 overflow-hidden"
      style={{ background: "#070504" }}
    >
      {/* Copper rim light that grows as you scroll through the section */}
      <motion.div
        aria-hidden="true"
        className="absolute -left-40 top-1/2 -translate-y-1/2 h-[700px] w-[700px] blur-[160px] pointer-events-none"
        style={{
          opacity: rimLight,
          background:
            "radial-gradient(circle, rgba(181,83,44,0.22) 0%, transparent 65%)",
        }}
      />

      <div className="relative max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4 mb-12"
        >
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.32em] uppercase">
            Manifesto
          </span>
          <span aria-hidden="true" className="h-px w-12 bg-white/[0.14]" />
          <span
            className="text-[13px] italic text-neutral-500 tracking-tight"
            style={{ fontFamily: SERIF }}
          >
            why we built this
          </span>
        </motion.div>

        <div
          className="leading-[1.16] tracking-[-0.02em] text-[clamp(2rem,4.4vw,4.4rem)]"
          style={{ fontFamily: SERIF, fontWeight: 400 }}
        >
          {[
            {
              text: "Every other AI platform asks you to trust them.",
              muted: false,
            },
            {
              text: "We don’t.",
              muted: false,
              highlight: true,
            },
            {
              text: "We give you the math instead.",
              muted: true,
            },
          ].map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                delay: i * 0.18,
                duration: 0.9,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`mb-3 ${
                line.muted
                  ? "text-neutral-500"
                  : line.highlight
                    ? "text-[#E08558]"
                    : "text-neutral-100"
              }`}
            >
              {line.text}
            </motion.p>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-20 grid md:grid-cols-12 gap-8 md:gap-14"
        >
          <div className="md:col-span-1 hidden md:block">
            <div
              className="h-px w-full mt-3"
              style={{
                background:
                  "linear-gradient(to right, rgba(181,83,44,0.7), transparent)",
              }}
            />
          </div>
          <div className="md:col-span-11 text-[15px] md:text-[17px] text-neutral-400 leading-[1.75] max-w-[64ch]">
            <p>
              Each run leaves a signed receipt. Each receipt enters a public
              log. Each entry is anchored to Bitcoin every 24 hours. Anyone
              &mdash; your auditor, your customer, your regulator, your
              skeptical CTO &mdash; can verify the work without our help,
              without our keys, and without our permission.
            </p>
            <p
              className="mt-8 text-[20px] md:text-[26px] text-neutral-100 leading-[1.35]"
              style={{ fontFamily: SERIF }}
            >
              That&rsquo;s what audit-grade means.{" "}
              <em className="not-italic brand-sweep">
                Not a promise. A proof.
              </em>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * ChapterMarker — theatrical full-bleed section break
 *
 * Bloodline / uxconstellation move: every major content shift is a
 * "chapter" break with breathing room. Roman numeral + serif title +
 * accent rule + downward arrow. Slow staggered fade-in.
 * ────────────────────────────────────────────────────────────────── */

function ChapterMarker({
  roman,
  title,
  subtitle,
  accent,
}: {
  roman: string;
  title: string;
  subtitle: string;
  accent: "copper" | "cyan";
}) {
  const color = accent === "cyan" ? "#00B7FF" : "#B5532C";
  const colorSoft = accent === "cyan" ? "#7DD9FF" : "#E08558";

  return (
    <section
      className="relative px-6 py-32 md:py-44 overflow-hidden"
      style={{ background: "#030303" }}
      aria-label={`Chapter ${roman} — ${title}`}
    >
      {/* Accent rim glow */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent 0%, ${color}55 50%, transparent 100%)`,
        }}
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 -translate-x-1/2 top-0 w-[600px] h-32 blur-[100px] opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse, ${color}33 0%, transparent 70%)`,
        }}
      />

      <div className="relative max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, letterSpacing: "0.5em" }}
          whileInView={{ opacity: 1, letterSpacing: "0.32em" }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="font-mono text-[10px] uppercase mb-10"
          style={{ color }}
        >
          Chapter
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.1, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="text-[clamp(5rem,14vw,12rem)] leading-none mb-6"
          style={{
            fontFamily: SERIF,
            color,
            textShadow: `0 0 60px ${color}33`,
          }}
        >
          {roman}
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="text-[clamp(2rem,5vw,4rem)] leading-[1.05] tracking-[-0.02em] text-neutral-100 mb-4"
          style={{ fontFamily: SERIF }}
        >
          {title}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="text-[14px] md:text-[16px] italic tracking-tight"
          style={{ fontFamily: SERIF, color: colorSoft }}
        >
          {subtitle}
        </motion.p>

        {/* Downward indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-16 inline-flex flex-col items-center gap-2"
        >
          <span
            aria-hidden="true"
            className="block h-12 w-px"
            style={{
              background: `linear-gradient(to bottom, ${color}66, transparent)`,
            }}
          />
          <span
            aria-hidden="true"
            className="font-mono text-[10px] tracking-[0.3em] uppercase"
            style={{ color: `${color}99` }}
          >
            ↓
          </span>
        </motion.div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * MemoryMoatV2 — rebuilt cleaner, no chapter ticker (chapter marker
 * upstream owns that). Cinematic horizontal timeline.
 * ────────────────────────────────────────────────────────────────── */

function MemoryMoatV2() {
  const timeline = [
    {
      label: "Day 1",
      desc: "First run on a fresh tenant. Lead Blitz against SaaS founders in London returns 8 prospects, signed receipt id rcpt_…001.",
    },
    {
      label: "Week 2",
      desc: "Competitor Takedown on the same vertical. The agent retrieves the Day-1 prospect set + recent outreach from semantic memory.",
    },
    {
      label: "Month 2",
      desc: "A new Lead Blitz auto-loads the prior ICP, the angles that converted, and the angles that didn't. Receipt chain anchors today to the past.",
    },
    {
      label: "Month 6",
      desc: "Each new run begins from ~180 days of signed prior context. Every retrieval verifiable — trace which past receipts informed today's output.",
    },
  ];

  return (
    <section className="relative px-6 py-24 md:py-32 bg-[#040303] overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute right-0 top-1/2 -translate-y-1/2 h-[600px] w-[500px] opacity-[0.06] blur-[140px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(181,83,44,1) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-14 items-start">
          <div>
            <h2
              className="text-[clamp(2.4rem,4.8vw,3.8rem)] leading-[1.04] mb-6 tracking-[-0.02em] text-neutral-100"
              style={{ fontFamily: SERIF, fontWeight: 400 }}
            >
              Memory that{" "}
              <em className="not-italic text-[#E08558]">verifies itself</em>.
            </h2>
            <p className="text-[15px] md:text-[16px] text-neutral-400 leading-[1.7] max-w-md mb-6">
              Every run leaves a signed trace. Tomorrow&rsquo;s agents read
              yesterday&rsquo;s decisions, and{" "}
              <em className="not-italic text-neutral-200">
                every retrieved memory is itself a verifiable receipt
              </em>
              . The chain of which past calls informed today&rsquo;s output is
              reconstructable from public bytes &mdash; by you, your customer,
              your regulator.
            </p>
            <p
              className="text-[14px] text-neutral-500 leading-[1.7] max-w-md italic mb-8"
              style={{ fontFamily: SERIF }}
            >
              The compounding moat isn&rsquo;t &ldquo;the agent gets
              smarter.&rdquo; It&rsquo;s that your retrieval graph becomes
              audit-grade.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-[12px] font-mono text-[#E08558] hover:text-white transition-colors tracking-[0.1em] uppercase"
            >
              Start your memory
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </div>

          <div className="relative pl-2 md:pl-0">
            <div
              aria-hidden="true"
              className="absolute left-[18px] top-4 bottom-2 w-px"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(181,83,44,0.18) 0%, rgba(181,83,44,0.85) 100%)",
              }}
            />
            <div className="space-y-9">
              {timeline.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    delay: i * 0.12,
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="relative flex gap-6"
                >
                  <div
                    className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center"
                    style={{
                      background: `rgba(181,83,44,${0.04 + (i / 3) * 0.08})`,
                      borderColor: `rgba(181,83,44,${0.22 + (i / 3) * 0.5})`,
                    }}
                  >
                    <span className="font-mono text-[9px] text-neutral-400 tracking-wide">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="pt-1.5">
                    <p
                      className="font-mono text-[10px] tracking-[0.2em] uppercase mb-1.5"
                      style={{
                        color: `rgba(224,133,88,${0.65 + (i / 3) * 0.35})`,
                      }}
                    >
                      {item.label}
                    </p>
                    <p className="text-[13.5px] text-neutral-300 leading-[1.65] max-w-[46ch]">
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * CyanScene — wraps verification content in an audit-surface scene
 *
 * Deep, slightly blue-shifted black; cyan rim light; grid overlay.
 * The brand rule: copper sells, cyan proves. This scene flips the
 * lighting for the "proves" chapter so visitors feel the shift.
 * ────────────────────────────────────────────────────────────────── */

function CyanScene({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative" style={{ background: "#040608" }}>
      {/* Cyan rim glow top + bottom */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, rgba(0,183,255,0.4) 50%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, rgba(0,183,255,0.25) 50%, transparent 100%)",
        }}
      />
      {/* Faint grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,183,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,183,255,0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Corner cyan glow */}
      <div
        aria-hidden="true"
        className="absolute -left-40 top-1/3 h-[500px] w-[500px] blur-[140px] opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(0,183,255,0.5) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * PricingScene — CREAM background scene
 *
 * The page is dark from hero to here. This is the first scene-shift —
 * inverts the page to warm cream + copper to mark a tonal pivot
 * ("now we talk terms"). bloodline.agency-style scene change.
 * ────────────────────────────────────────────────────────────────── */

function PricingScene() {
  const tiers = [
    { name: "Free", price: "$0", sub: "50 runs / mo", popular: false },
    { name: "Growth", price: "$49", sub: "200 runs / mo", popular: true },
    {
      name: "Sovereign Node",
      price: "$199",
      sub: "2K runs / mo",
      popular: false,
    },
    { name: "Enterprise", price: "$499", sub: "10K runs / mo", popular: false },
  ];

  return (
    <section
      className="relative px-6 py-28 md:py-40 overflow-hidden"
      style={{ background: "#F4EFE6", color: "#1a0f08" }}
    >
      {/* Subtle copper paper grain */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #B5532C 1px, transparent 0)",
          backgroundSize: "4px 4px",
        }}
      />
      {/* Top + bottom hairlines */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(181,83,44,0.4), transparent)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(181,83,44,0.4), transparent)",
        }}
      />

      <div className="relative max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-[#B5532C]">
            Terms
          </span>
          <span
            aria-hidden="true"
            className="h-px w-12"
            style={{ background: "rgba(181,83,44,0.4)" }}
          />
          <span
            className="text-[13px] italic text-[#5c3d2b] tracking-tight"
            style={{ fontFamily: SERIF }}
          >
            free until obvious
          </span>
        </div>

        <h2
          className="text-[clamp(2.4rem,5.2vw,4.4rem)] leading-[1.05] tracking-[-0.02em] mb-5"
          style={{ fontFamily: SERIF, fontWeight: 400, color: "#1a0f08" }}
        >
          Simple terms.
          <br />
          <em className="not-italic text-[#B5532C]">
            Start free. Scale when it clicks.
          </em>
        </h2>
        <p className="text-[15px] leading-[1.65] max-w-xl mb-12 text-[#5c3d2b]">
          No credit card on the free tier. No annual contracts. No per-seat
          fees. Cancel any time. ZAR + USD billing.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {tiers.map((t) => (
            <div
              key={t.name}
              className="relative p-5 rounded-[6px] border bg-white/50 backdrop-blur-sm"
              style={{
                borderColor: t.popular
                  ? "rgba(181,83,44,0.85)"
                  : "rgba(26,15,8,0.10)",
                boxShadow: t.popular
                  ? "0 12px 32px -16px rgba(181,83,44,0.45)"
                  : "0 1px 0 rgba(26,15,8,0.04)",
              }}
            >
              {t.popular && (
                <span
                  className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[9px] font-mono tracking-[0.15em] uppercase"
                  style={{
                    background: "#B5532C",
                    color: "#fff",
                  }}
                >
                  Popular
                </span>
              )}
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#5c3d2b] mb-2">
                {t.name}
              </p>
              <p
                className="text-[2rem] leading-none tracking-tight mb-1"
                style={{ fontFamily: SERIF, color: "#1a0f08" }}
              >
                {t.price}
                <span className="text-[14px] text-[#9e7a5e]"> /mo</span>
              </p>
              <p className="text-[11px] font-mono text-[#5c3d2b]">{t.sub}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[12px] font-mono text-[#5c3d2b] tracking-tight">
            Every plan ships with the same Ed25519 receipts and POPIA + SOC2
            mapping. Pricing is run volume, not features.
          </p>
          <Link
            href="/pricing"
            onClick={() => trackCtaClick("pricing-teaser-full")}
            className="group inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[3px] text-[12px] font-mono tracking-[0.1em] uppercase border transition-colors"
            style={{
              borderColor: "#B5532C",
              color: "#B5532C",
            }}
          >
            See full pricing
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * FinalCTACinematic — full-bleed theatrical closing
 *
 * Replaces the contained orange card with a wider, more spacious
 * cinema closing. Faint A2EGraph behind, big serif, one CTA.
 * ────────────────────────────────────────────────────────────────── */

function FinalCTACinematic() {
  return (
    <section
      className="relative px-6 py-32 md:py-48 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #030303 0%, #0a0604 50%, #030303 100%)",
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
      >
        <A2EGraph className="w-full h-full" showLabels={false} />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(3,3,3,0.6) 0%, rgba(3,3,3,0.95) 80%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] blur-[160px] opacity-50 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(181,83,44,0.4) 0%, transparent 65%)",
        }}
      />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center gap-4 mb-10"
        >
          <span aria-hidden="true" className="h-px w-12 bg-white/[0.14]" />
          <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-[#E08558]">
            End of reel
          </span>
          <span aria-hidden="true" className="h-px w-12 bg-white/[0.14]" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-[clamp(2.8rem,7vw,6.5rem)] leading-[1.02] tracking-[-0.025em] mb-8"
          style={{ fontFamily: SERIF, fontWeight: 400 }}
        >
          <span className="block text-neutral-100">Open the ledger.</span>
          <span className="block text-[#E08558] italic">
            Make your first receipt.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-[15px] md:text-[17px] text-neutral-400 leading-[1.6] max-w-lg mx-auto mb-12"
        >
          No credit card. 140 agents ready in 60 seconds. 50 verified runs reset
          every month &mdash; free forever.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
        >
          <PrimaryCTA href={HERO_CTA} variant="final">
            Run Your First Agent
          </PrimaryCTA>
          <a
            href="mailto:hello@sovereignmatrix.agency"
            onClick={() => trackCtaClick("email-sales")}
            className="group inline-flex items-center gap-2 px-6 py-3.5 text-[13px] font-mono tracking-[0.1em] uppercase text-neutral-400 hover:text-white border border-white/[0.12] hover:border-white/30 rounded-[3px] transition-colors"
          >
            Talk to sales
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono text-neutral-600 tracking-tight"
        >
          {[
            "Claude critic on every run",
            "Full audit trail",
            "Cancel anytime",
          ].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-[#B5532C]/70">
                ✓
              </span>
              {t}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Footer — slimmer than `/`, keeps colophon as the editorial closer
 * ────────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="px-6 pt-24 pb-12 border-t border-white/[0.04] bg-[#020202]">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-[1fr_auto] gap-x-16 gap-y-8 items-end mb-20 pb-16 border-b border-white/[0.04]">
          <div className="max-w-2xl">
            <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-5">
              Colophon
            </p>
            <p
              className="text-[22px] md:text-[28px] leading-[1.35] text-white tracking-tight"
              style={{ fontFamily: SERIF }}
            >
              Sovereign Matrix is an independent studio building agent
              infrastructure for operators &mdash; one playbook,{" "}
              <em className="not-italic text-[#E08558]">one guarantee</em>, one
              audit trail at a time.
            </p>
            <p className="mt-6 text-[14px] text-neutral-400 leading-relaxed max-w-xl">
              Hand-written in Cape Town. Claude is the critic on every run, and
              every run leaves a public receipt anyone can verify.
            </p>
          </div>

          <Link
            href={HERO_CTA}
            onClick={() => trackCtaClick("footer-colophon")}
            className="group inline-flex items-center gap-3 text-[13px] font-mono tracking-tight text-neutral-400 hover:text-white transition-colors whitespace-nowrap"
          >
            <span className="text-lg text-[#B5532C]">→</span>
            <span className="border-b border-white/[0.1] group-hover:border-[#B5532C] pb-0.5 transition-colors">
              Run your first playbook
            </span>
          </Link>
        </div>

        <div className="mb-12 max-w-md">
          <p className="mb-3 text-[11px] font-mono uppercase tracking-widest text-neutral-500">
            Release notes + security advisories
          </p>
          <NewsletterSignup source="redesign-footer" />
        </div>

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

        <div className="pt-8 border-t border-white/[0.04] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <SovereignLogo size="sm" />
            <div className="flex flex-col md:flex-row md:items-baseline gap-x-3 gap-y-0.5">
              <span
                className="text-[15px] text-white"
                style={{ fontFamily: SERIF }}
              >
                Sovereign Matrix
              </span>
              <span className="text-[10px] font-mono text-neutral-600 tracking-tight">
                © 2026 · Independent · Apache 2.0 verifiers
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
            <Link
              href="/redesign"
              className="text-[11px] font-mono tracking-tight text-[#B5532C]"
            >
              Redesign preview
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
