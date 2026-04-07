"use client";

import { motion, AnimatePresence, useInView } from "framer-motion";
import { BrainCircuit, CheckCircle2, Cpu, Target, ChevronDown, XCircle, ArrowRight, Mic, Code2, Search, FileText } from "lucide-react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useState, useRef, useEffect } from "react";

import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { Pricing } from "@/components/ui/Pricing";
import { Testimonials } from "@/components/ui/SocialProof";
import { CinematicLoader } from "@/components/ui/CinematicLoader";


import { SocialProofMetrics } from "@/components/ui/SocialProofMetrics";
import { LandingAgent } from "@/components/ui/LandingAgent";
import { AgentOffice } from "@/components/ui/AgentOffice";
import { RevealText, MagneticButton, StaggerChildren, GlowDivider, ScrollProgress } from "@/components/ui/ScrollAnimations";
import { FloatingParticles, useHideyNav, TextShimmer, TiltCard, SectionReveal } from "@/components/ui/EliteEffects";
import { TextDecrypt } from "@/components/cinematic/TextDecrypt";
import { ScrollVelocitySkew, ClipReveal } from "@/components/cinematic/ScrollVelocity";
import { ParticleBurst } from "@/components/cinematic/ParticleBurst";
import { Typewriter, GradientFollower, Tilt3D, AnimatedCounter } from "@/components/cinematic/InteractiveEffects";
import { LiveTicker } from "@/components/cinematic/LiveTicker";
import { LogoMarquee } from "@/components/cinematic/InfiniteMarquee";
import { ExitIntent } from "@/components/ui/ExitIntent";
import { LivePulse } from "@/components/ui/LivePulse";
import dynamic from "next/dynamic";
import { useLiveAgentCount } from "@/hooks/useLiveAgentCount";

const AgentNetwork = dynamic(() => import("@/components/cinematic/AgentNetwork").then(m => ({ default: m.AgentNetwork })), { ssr: false });
const PhysicsCards = dynamic(() => import("@/components/cinematic/PhysicsCards").then(m => ({ default: m.PhysicsCards })), { ssr: false });
const NebulaBackground = dynamic(() => import("@/components/cinematic/NebulaBackground").then(m => ({ default: m.NebulaBackground })), { ssr: false });
const SmoothScroll = dynamic(() => import("@/components/cinematic/SmoothScroll").then(m => ({ default: m.SmoothScroll })), { ssr: false });
import { MouseParallax, FloatingElement } from "@/components/cinematic/MouseParallax";

// ─── Capability Card (enhanced with emerald hover glow) ───
function CapabilityCard({ icon: Icon, title, desc, accent, href }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; accent: string; href?: string }) {
  const content = (
    <Tilt3D maxTilt={6} scale={1.01}>
      <div className="group relative cursor-pointer">
        <div className="relative p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-emerald-500/20 transition-gpu duration-500 overflow-hidden hover:shadow-[0_0_40px_rgba(16,185,129,0.06)] hover:bg-white/[0.04]">
          {/* Hover glow */}
          <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br ${accent} to-transparent`} />

          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-5 group-hover:border-emerald-500/20 transition-colors">
              <Icon className="w-5 h-5 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">{desc}</p>
            <div className="mt-4 flex items-center gap-1 text-[10px] text-emerald-500/50 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              Try it <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
    </Tilt3D>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

// ─── FAQ Item ───
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5">
      <button type="button" className="w-full flex items-center justify-between py-6 text-left group" onClick={() => setOpen(!open)}>
        <span className="text-sm md:text-base font-medium text-white group-hover:text-neutral-400 transition-colors pr-4">{question}</span>
        <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-gpu duration-300 ${open ? 'max-h-60 pb-6' : 'max-h-0'}`}>
        <p className="text-sm text-neutral-400 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

// ─── Count Up On View ───
function CountUpOnView({ target, suffix = "", prefix = "", duration = 1.5 }: { target: number; suffix?: string; prefix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  // Start at target (not 0) to prevent flash-of-zero before hydration/viewport
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (!isInView) return;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, target, duration]);

  return <span ref={ref}>{prefix}{value.toLocaleString()}{suffix}</span>;
}

// ─── Time Count Up (mm:ss format) ───
function TimeCountUpOnView({ minutes, seconds, duration = 1.5 }: { minutes: number; seconds: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const totalTarget = minutes * 60 + seconds;
  const [totalSec, setTotalSec] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setTotalSec(Math.round(eased * totalTarget));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, totalTarget, duration]);

  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return <span ref={ref}>{m}m {s.toString().padStart(2, "0")}s</span>;
}

// ─── Enterprise Section (CSS-only parallax — no useScroll dependency) ───
function EnterpriseSection() {
  return (
    <section id="enterprise" className="py-32 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(16,185,129,0.03),transparent)]" />
      {/* Grid background */}
      <div
        className="absolute inset-[-20%] bg-[linear-gradient(rgba(16,185,129,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.01)_1px,transparent_1px)] bg-[size:80px_80px] pointer-events-none"
      />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Sovereign AI</RevealText>
          <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] mb-6">
            Your data. Your infrastructure. Your autonomous workforce.
          </RevealText>
          <RevealText as="p" delay={0.2} className="text-sm text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Built on NVIDIA NIM inference with 35+ open-source models. Zero per-token costs.
            Air-gapped deployment available. Enterprise-grade security from day one.
          </RevealText>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
            <div className="text-5xl md:text-6xl font-black mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-400">
              <AnimatedCounter target={130} duration={2} />
            </div>
            <div className="text-sm font-semibold text-white mb-1">Specialized Agents</div>
            <p className="text-xs text-neutral-400">Purpose-built for specific business functions.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-center">
            <div className="text-5xl md:text-6xl font-black mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-400">
              <AnimatedCounter target={65} suffix="+" duration={1.5} />
            </div>
            <div className="text-sm font-semibold text-white mb-1">Open-Source Models</div>
            <p className="text-xs text-neutral-400">Automatic failover. Zero vendor lock-in.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="text-center">
            <div className="text-5xl md:text-6xl font-black mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-400">
              $<AnimatedCounter target={0} duration={0.5} />
            </div>
            <div className="text-sm font-semibold text-white mb-1">Per-Token Cost</div>
            <p className="text-xs text-neutral-400">Scale inference without scaling your bill.</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "25 Autopilot Playbooks", desc: "Schedule multi-agent workflows to run hourly, daily, or weekly — 24/7" },
            { label: "25+ Live Integrations", desc: "Slack, Sheets, HubSpot, Yoco, GitHub, Discord, and more" },
            { label: "White-Label Platform", desc: "Custom domains, branding, client portals" },
            { label: "2,200+ Tok/s Inference", desc: "Cerebras wafer-scale engine for instant classification" },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.08 }}
              className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:border-emerald-500/15 transition-gpu duration-300">
              <div className="text-xs font-semibold text-white mb-0.5">{item.label}</div>
              <p className="text-[10px] text-neutral-500">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <MagneticButton href="/partner" strength={0.2}>
            <span className="group inline-flex items-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-gpu cursor-pointer">
              Book a Strategy Call <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}

// ─── Interactive Demo with Tabs ───
const DEMO_SCENARIOS = [
  {
    id: "leads",
    label: "Lead Gen",
    icon: Target,
    prompt: "Find 50 leads in fintech — Series A, US-based, with open CMO roles.",
    agent: "Lead Agent",
    response: "Found 53 matches. Enriched with LinkedIn profiles, funding data, and email verification. 48 have validated emails.",
    badges: [
      { text: "53 leads found", color: "emerald" },
      { text: "48 verified emails", color: "cyan" },
      { text: "CSV ready", color: "neutral" },
    ],
  },
  {
    id: "content",
    label: "Content",
    icon: FileText,
    prompt: "Write a 1,500-word blog post about AI agents replacing agency work. Anti-slop. Sound human.",
    agent: "Content Agent",
    response: "Draft complete. 1,487 words. AI detection score: 4.2% (human-passing). Readability: Grade 8. SEO optimized for 3 target keywords.",
    badges: [
      { text: "4.2% AI score", color: "emerald" },
      { text: "1,487 words", color: "cyan" },
      { text: "SEO optimized", color: "neutral" },
    ],
  },
  {
    id: "market-intel",
    label: "Market Intel",
    icon: Search,
    prompt: "Analyze hubspot.com — tech stack, market positioning, and untapped opportunities.",
    agent: "Market Analyst",
    response: "Tech stack: React, Next.js, Contentful CMS. Found 847 uncontested keyword opportunities. Identified 12 positioning angles in underserved segments.",
    badges: [
      { text: "847 opportunities", color: "emerald" },
      { text: "12 positioning angles", color: "cyan" },
      { text: "Full report", color: "neutral" },
    ],
  },
  {
    id: "voice",
    label: "Voice Call",
    icon: Mic,
    prompt: "Call the top 10 leads from today's search. Qualify for budget and timeline. Book meetings.",
    agent: "Voice Agent",
    response: "10 calls completed in 4m 32s. AI disclosed on each call. 6 answered. 3 qualified (budget confirmed). 2 meetings booked directly to your calendar.",
    badges: [
      { text: "3 qualified", color: "emerald" },
      { text: "2 meetings booked", color: "cyan" },
      { text: "< 200ms latency", color: "neutral" },
    ],
  },
];

function InteractiveDemo() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const scenario = DEMO_SCENARIOS[active];

  // Auto-cycle through scenarios every 6 seconds (pauses on hover/interaction)
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % DEMO_SCENARIOS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7 }}
      className="relative max-w-3xl mx-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        {DEMO_SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { setActive(i); setPaused(true); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-gpu duration-300 whitespace-nowrap ${
              active === i
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-white/[0.02] text-neutral-500 border border-white/[0.06] hover:text-white hover:border-white/[0.12]"
            }`}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Window chrome */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.04)]">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-[#060606]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
          </div>
          <span className="text-[10px] text-neutral-500 ml-3 font-mono">sovereign-matrix.agency/dashboard</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={scenario.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="p-6 space-y-4"
          >
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-md bg-emerald-500/10 border border-emerald-500/15">
                <p className="text-sm text-emerald-200">{scenario.prompt}</p>
              </div>
            </div>

            {/* Agent response */}
            <div className="flex justify-start">
              <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-500/70 font-medium uppercase tracking-wider">{scenario.agent}</span>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed mb-3">
                  <Typewriter key={scenario.id} text={scenario.response} speed={15} />
                </p>
                <div className="flex flex-wrap gap-2">
                  {scenario.badges.map((b, i) => (
                    <span key={i} className={`text-[10px] px-2 py-1 rounded-md ${
                      b.color === "emerald" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" :
                      b.color === "cyan" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/15" :
                      "bg-white/[0.04] text-neutral-400 border border-white/[0.06]"
                    }`}>{b.text}</span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const agentCount = useLiveAgentCount();
  const navVisible = useHideyNav(80);

  return (
    <CinematicLoader>
    <div className="relative min-h-screen bg-[#010101] text-white selection:bg-emerald-500/20 font-sans antialiased">

      {/* Smooth scroll — Lenis (Antigravity's floating scroll feel) */}
      <SmoothScroll />

      {/* Scroll progress bar */}
      <ScrollProgress />

      {/* Skip to content — accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-emerald-500 focus:text-black focus:rounded-lg focus:text-sm focus:font-bold">
        Skip to main content
      </a>

      {/* ═══ NAVIGATION ═══ */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: navVisible ? 1 : 0, y: navVisible ? 0 : -10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed top-0 inset-x-0 z-50 pointer-events-none"
      >
        <div className="px-6 md:px-10 h-16 flex items-center justify-between pointer-events-auto max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <SovereignLogo size="sm" />
            <span className="hidden sm:block text-sm font-semibold text-white">Sovereign Matrix</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#capabilities" className="text-sm text-neutral-400 hover:text-white transition-colors">Product</Link>
            <Link href="#pricing" className="text-sm text-neutral-400 hover:text-white transition-colors">Pricing</Link>
            <Link href="/docs" className="text-sm text-neutral-400 hover:text-white transition-colors">Docs</Link>
            <Link href="/enterprise" className="text-sm text-neutral-400 hover:text-white transition-colors">Enterprise</Link>
            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
              <button className="text-sm text-neutral-500 hover:text-white transition-colors">Log in</button>
            </SignInButton>
            <Link href="/signup" className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors">
              Get Started
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle menu">
            <div className="space-y-1.5">
              <span className={`block w-5 h-[1.5px] bg-white transition-gpu ${mobileNavOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block w-5 h-[1.5px] bg-white transition-gpu ${mobileNavOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-[1.5px] bg-white transition-gpu ${mobileNavOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </div>
          </button>
        </div>

        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="absolute top-16 left-4 right-4 p-5 rounded-2xl md:hidden bg-[#080808]/95 backdrop-blur-2xl border border-white/[0.06] flex flex-col gap-3 shadow-2xl pointer-events-auto">
              <Link href="#capabilities" className="text-sm text-neutral-300 hover:text-white py-1" onClick={() => setMobileNavOpen(false)}>Platform</Link>
              <Link href="#pricing" className="text-sm text-neutral-300 hover:text-white py-1" onClick={() => setMobileNavOpen(false)}>Pricing</Link>
              <Link href="#enterprise" className="text-sm text-neutral-300 hover:text-white py-1" onClick={() => setMobileNavOpen(false)}>Enterprise</Link>
              <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-sm font-semibold text-black text-center mt-2" onClick={() => setMobileNavOpen(false)}>Get Started</Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <main id="main-content">

      {/* ═══ HERO — Antigravity-level cinematic with physics ═══ */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#010101]">

        {/* Layer 0: Animated nebula — slowly morphing cosmic clouds */}
        <NebulaBackground />

        {/* Layer 1: Deep grid — creates depth perception */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.015)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_50%,black_20%,transparent_100%)]" />

        {/* Layer 2: Floating particles — multi-colored, mouse-reactive */}
        <FloatingParticles
          count={60}
          colors={[
            "rgba(16, 185, 129, 0.6)",
            "rgba(6, 182, 212, 0.5)",
            "rgba(139, 92, 246, 0.45)",
            "rgba(59, 130, 246, 0.35)",
            "rgba(236, 72, 153, 0.3)",
            "rgba(245, 158, 11, 0.25)",
          ]}
          maxSize={4}
        />

        {/* Layer 3: Dual ambient glow — creates atmosphere */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.04] blur-[180px]" />
          <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] rounded-full bg-cyan-500/[0.03] blur-[160px]" />
        </div>

        {/* Layer 4: Vignette — focus attention to center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#010101_80%)] pointer-events-none" />

        {/* Content — cinematic staggered reveal */}
        <div className="relative z-10 max-w-4xl mx-auto text-center px-6">

          {/* Brand mark — floats in from above */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center gap-2.5 mb-12"
          >
            <SovereignLogo size="sm" />
            <span className="text-sm font-semibold text-white/80 tracking-wide">Sovereign Matrix</span>
          </motion.div>

          {/* Headline — cinematic entrance, each line staggered */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-[clamp(2.8rem,9vw,6.5rem)] font-black leading-[0.92] tracking-[-0.04em] mb-8"
          >
            <motion.span
              initial={{ opacity: 0, y: 60, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.2, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-white block"
            >
              Hire AI employees.
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 60, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.5, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="block"
            >
              <TextShimmer className="font-black">Fire busywork.</TextShimmer>
            </motion.span>
          </motion.h1>

          {/* Subtitle — benefits, not specs */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}
            className="text-lg md:text-xl text-neutral-400 max-w-xl mx-auto leading-relaxed mb-6">
            130 AI agents that find leads, write content, scan competitors, and close deals.
            They work 24/7. They cost $19/month. They never call in sick.
          </motion.p>

          {/* Proof strip — tiny, credible */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}
            className="flex items-center justify-center gap-4 text-xs text-neutral-500 mb-10">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500/60" />35+ open-source models</span>
            <span className="hidden sm:block text-neutral-700">|</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500/60" />$0 per-token cost</span>
            <span className="hidden sm:block text-neutral-700">|</span>
            <span className="hidden sm:flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500/60" />Runs on your hardware</span>
          </motion.div>

          {/* Two CTAs — primary = free tool (instant value), secondary = sign up */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <MagneticButton href="/free/competitor-scan" strength={0.15}>
              <span className="group flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all cursor-pointer">
                Scan a Competitor Free <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </MagneticButton>
            <MagneticButton href="/signup" strength={0.15}>
              <span className="px-8 py-4 rounded-full text-sm font-semibold text-neutral-300 border border-white/[0.1] hover:border-white/[0.2] hover:text-white transition-all cursor-pointer inline-block">
                Start free — no credit card
              </span>
            </MagneticButton>
          </motion.div>

          {/* Draggable physics agent cards — Antigravity signature feature */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 1 }}
            className="mt-16 w-full max-w-3xl mx-auto"
          >
            <PhysicsCards className="h-[220px]" />
          </motion.div>
        </div>
      </section>

      {/* ═══ LIVE ACTIVITY TICKER ═══ */}
      <LiveTicker />

      {/* ═══ TRY IT NOW — Free tools (no signup, instant value) ═══ */}
      <section className="py-16 px-6 bg-[#020202] border-y border-white/[0.03] relative overflow-hidden">
        {/* Floating accents */}
        <FloatingElement className="absolute top-16 right-[8%] w-2 h-2 rounded-full bg-emerald-500/25" speed={0.7} range={18} />
        <FloatingElement className="absolute bottom-20 left-[12%] w-3 h-3 rounded-full bg-cyan-500/15 blur-[1px]" speed={1} range={22} />
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <SectionReveal>
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-3">Try it now — no signup</p>
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">
                Free AI tools. Instant results.
              </h2>
              <p className="text-sm text-neutral-500 max-w-md mx-auto">
                See what 130 AI agents can do. Pick a tool, paste a URL, get real intelligence in 30 seconds.
              </p>
            </SectionReveal>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                title: "Competitor Scanner",
                desc: "Paste any URL. Get their weaknesses, market gaps, and a battle plan.",
                href: "/free/competitor-scan",
                icon: Target,
                badge: "Most popular",
                accent: "from-red-500/10",
              },
              {
                title: "SEO Audit",
                desc: "Instant domain analysis. Keyword gaps, technical issues, content strategy.",
                href: "/free/seo-audit",
                icon: Search,
                badge: null,
                accent: "from-cyan-500/10",
              },
              {
                title: "Lead Finder",
                desc: "Find qualified leads in any niche. Enriched with LinkedIn and email data.",
                href: "/free/lead-finder",
                icon: Target,
                badge: null,
                accent: "from-emerald-500/10",
              },
            ].map((tool) => (
              <Link key={tool.title} href={tool.href}>
                <motion.div
                  whileHover={{ y: -4, borderColor: "rgba(16,185,129,0.2)" }}
                  className="group relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer h-full"
                >
                  {tool.badge && (
                    <span className="absolute top-4 right-4 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {tool.badge}
                    </span>
                  )}
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.accent} to-transparent border border-white/[0.06] flex items-center justify-center mb-4`}>
                    <tool.icon className="w-5 h-5 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{tool.title}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed mb-3">{tool.desc}</p>
                  <span className="text-[11px] text-emerald-500/70 group-hover:text-emerald-400 flex items-center gap-1 transition-colors">
                    Try free <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ POWERED BY — infinite scrolling trust strip ═══ */}
      <LogoMarquee />

      {/* ═══ LIVE DEMO — Interactive agent terminal (replaces dead video placeholder) ═══ */}
      <section className="py-20 px-6 bg-[#030303]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <SectionReveal>
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Live Demo</p>
              <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
                Tell it what you need. Watch it work.
              </h2>
              <p className="text-sm text-neutral-500">
                Click a scenario. Watch the agent respond in real time.
              </p>
            </SectionReveal>
          </div>
          <InteractiveDemo />
        </div>
      </section>

      {/* ═══ THE PROBLEM — Pain section with floating accents ═══ */}
      <section className="py-24 px-6 bg-[#060606] relative overflow-hidden">
        {/* Floating accent dots — Antigravity: everything moves */}
        <FloatingElement className="absolute top-20 left-[10%] w-2 h-2 rounded-full bg-red-500/20 blur-[1px]" speed={0.8} range={15} />
        <FloatingElement className="absolute top-40 right-[15%] w-3 h-3 rounded-full bg-red-400/15 blur-[2px]" speed={1.2} range={25} />
        <FloatingElement className="absolute bottom-32 left-[20%] w-1.5 h-1.5 rounded-full bg-amber-500/20" speed={0.6} range={12} />
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <RevealText as="h2" className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
              You don&apos;t need more tools. You need employees that don&apos;t sleep.
            </RevealText>
            <RevealText as="p" delay={0.1} className="text-neutral-500 max-w-lg mx-auto">
              Every hour you spend on research, outreach, and content is an hour you&apos;re not closing deals.
            </RevealText>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: XCircle,
                title: "Leads go cold",
                problem: "A prospect fills out your form at 2 AM. You respond at 9 AM. They already booked with your competitor.",
                cost: "Lost: ~$4,200/deal",
              },
              {
                icon: XCircle,
                title: "Manual research burns hours",
                problem: "Every new prospect means 45 minutes on LinkedIn, their website, and Crunchbase. Multiply that by 50 leads a week.",
                cost: "Lost: ~37 hours/month",
              },
              {
                icon: XCircle,
                title: "Content can't keep up",
                problem: "You need 4 blog posts, 12 social posts, and 3 email sequences per client per month. Your team maxes out at 2 clients.",
                cost: "Lost: ~$8,000/client",
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-2xl border border-white/[0.06] bg-[#0A0A0A] hover:border-red-500/20 transition-gpu duration-300 group"
              >
                <card.icon className="w-6 h-6 text-red-400/60 mb-4 group-hover:text-red-400 transition-colors" />
                <h3 className="text-base font-semibold text-white mb-3">{card.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed mb-4">{card.problem}</p>
                <span className="text-xs font-mono text-red-400/60">{card.cost}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-center mt-12"
          >
            <p className="text-sm text-neutral-400">
              Sovereign Matrix fixes all three.{" "}
              <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                See how →
              </Link>
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══ PLATFORM METRICS — Social proof with real numbers ═══ */}
      <section className="py-16 px-6 border-y border-white/[0.04]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 130, suffix: "+", label: "AI Agents", desc: "Purpose-built for business" },
            { value: 65, suffix: "+", label: "AI Models", desc: "Auto-routed per task" },
            { value: 25, suffix: "", label: "Autopilot Playbooks", desc: "Scheduled multi-agent workflows" },
            { value: 2200, suffix: "+", label: "Tok/s Speed", desc: "Cerebras wafer-scale inference" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <div className="text-3xl md:text-4xl font-black text-white mb-1">
                <AnimatedCounter target={stat.value} duration={1.5} />{stat.suffix}
              </div>
              <div className="text-sm font-semibold text-white mb-0.5">{stat.label}</div>
              <div className="text-xs text-neutral-500">{stat.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ SOCIAL PROOF METRICS ═══ */}
      {/* ═══ RESULTS PREVIEW — Show what the product delivers ═══ */}
      {/* Section transition gradient */}
      <div className="h-24 bg-gradient-to-b from-[#010101] via-[#030303] to-[#010101] pointer-events-none" />
      <GlowDivider />
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Real Results</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">What your AI employees produce.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-500 max-w-lg mx-auto">Real output. Real agents. Move your mouse — the cards follow.</RevealText>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Result Card 1 — Leads (mouse parallax depth) */}
            <MouseParallax depth={0.015}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="rounded-xl border border-white/[0.06] bg-[#080808] overflow-hidden group hover:border-emerald-500/15 transition-gpu duration-300"
            >
              <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-white">Lead Gen Agent</span>
                <span className="ml-auto text-[9px] text-emerald-500/60 uppercase tracking-wider"><CountUpOnView target={32} suffix="s" duration={1.2} /></span>
              </div>
              <div className="p-4 space-y-2">
                {["Acme Corp — CEO — john@acme.com ✓", "TechFlow — CTO — sarah@techflow.io ✓", "DataPipe — VP Sales — mike@datapipe.com ✓", "CloudBase — CMO — lisa@cloudbase.ai ✓"].map((lead, i) => (
                  <div key={i} className="text-xs font-mono text-neutral-400">{lead}</div>
                ))}
                <div className="text-xs font-mono text-emerald-400 font-semibold pt-1">+ <CountUpOnView target={46} duration={1.5} /> more verified leads</div>
              </div>
            </motion.div></MouseParallax>
            {/* Result Card 2 — Content */}
            <MouseParallax depth={0.025}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="rounded-xl border border-white/[0.06] bg-[#080808] overflow-hidden group hover:border-cyan-500/15 transition-gpu duration-300"
            >
              <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-white">Content Agent</span>
                <span className="ml-auto text-[9px] text-cyan-500/60 uppercase tracking-wider"><TimeCountUpOnView minutes={2} seconds={14} duration={1.8} /></span>
              </div>
              <div className="p-4">
                <div className="text-xs font-semibold text-white mb-1">Why AI Agents Are Replacing Agencies</div>
                <div className="text-[10px] text-neutral-500 leading-relaxed">The marketing agency model is fundamentally broken. You pay $15,000/month for a team of 5 people who spend 80% of their time on tasks an AI can do in seconds...</div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"><CountUpOnView target={1487} suffix=" words" duration={1.5} /></span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/15">SEO score: 94</span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-white/[0.04] text-neutral-400 border border-white/[0.06]">AI: 4.2%</span>
                </div>
              </div>
            </motion.div></MouseParallax>
            {/* Result Card 3 — Analysis */}
            <MouseParallax depth={0.035}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="rounded-xl border border-white/[0.06] bg-[#080808] overflow-hidden group hover:border-violet-500/15 transition-gpu duration-300"
            >
              <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-white">Market Analyst</span>
                <span className="ml-auto text-[9px] text-violet-500/60 uppercase tracking-wider"><TimeCountUpOnView minutes={1} seconds={8} duration={1.5} /></span>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500">Tech Stack</span>
                  <span className="text-[10px] text-white font-mono">React, Next.js, Contentful</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500">Keyword Gaps</span>
                  <span className="text-[10px] text-emerald-400 font-mono"><CountUpOnView target={847} suffix=" opportunities" duration={1.8} /></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500">Weak Points</span>
                  <span className="text-[10px] text-amber-400 font-mono">12 positioning angles</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500">Overall Score</span>
                  <span className="text-[10px] text-white font-bold font-mono">73/100</span>
                </div>
              </div>
            </motion.div></MouseParallax>
          </div>
        </div>
      </section>

      <GlowDivider />
      <section className="py-24 px-6">
        <SocialProofMetrics agentCount={agentCount} />
      </section>

      {/* ═══ INTELLIGENCE STACK — How it thinks ═══ */}
      {/* Section transition gradient */}
      <div className="h-20 bg-gradient-to-b from-[#010101] via-[#030303] to-[#010101] pointer-events-none" />
      <GlowDivider />
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Intelligence Architecture</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">One mind. Many models.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-500 max-w-xl mx-auto">Every task is routed to the optimal model. If one fails, the next picks up instantly. No single point of failure.</RevealText>
          </div>

          <StaggerChildren className="grid md:grid-cols-4 gap-3" staggerDelay={0.06}>
            {[
              { label: "You", desc: "Describe a goal in plain English", icon: "01", accent: "white" },
              { label: "Smart Router", desc: "Classifies task type, selects optimal model", icon: "02", accent: "emerald" },
              { label: "Agent Team", desc: "Specialized agents execute in parallel", icon: "03", accent: "cyan" },
              { label: "Quality Gate", desc: "NeMo Guardrails verify, score, and deliver", icon: "04", accent: "emerald" },
            ].map((step) => (
              <div key={step.label} className="relative group">
                <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/20 transition-gpu duration-300">
                  <div className={`text-3xl font-black font-mono mb-3 ${step.accent === "emerald" ? "text-emerald-500/20" : step.accent === "cyan" ? "text-cyan-500/20" : "text-white/10"}`}>{step.icon}</div>
                  <div className="text-sm font-semibold text-white mb-1">{step.label}</div>
                  <div className="text-xs text-neutral-500 leading-relaxed">{step.desc}</div>
                </div>
              </div>
            ))}
          </StaggerChildren>

          {/* Failover visualization */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-8 flex items-center justify-center gap-2 flex-wrap"
          >
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest mr-2">Failover chain:</span>
            {["Ollama (local)", "NIM (free)", "Gemini", "Claude (BYOK)"].map((model, i) => (
              <span key={model} className="flex items-center gap-1.5">
                <span className="text-[10px] text-neutral-500 px-2 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.02]">{model}</span>
                {i < 3 && <span className="text-neutral-500 text-xs">→</span>}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ WHAT IT DOES — 6 Capabilities ═══ */}
      <GlowDivider />
      <ScrollVelocitySkew>
      <section id="capabilities" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Capabilities</RevealText>
            <div className="overflow-hidden">
              <TextDecrypt text="What you can do with it." className="text-3xl md:text-5xl font-bold text-white tracking-tight" as="h2" speed={25} />
            </div>
          </div>

          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" staggerDelay={0.06}>
            <CapabilityCard icon={Cpu} title="Browser Automation" desc="Point an agent at any website. It opens a real browser, clicks through pages, extracts data, and delivers a structured report." accent="from-emerald-500/[0.04]" href="/showcase" />
            <CapabilityCard icon={BrainCircuit} title="Document Intelligence" desc="Upload PDFs, contracts, or reports. Ask questions in plain English. Get precise answers backed by your own data." accent="from-emerald-400/[0.04]" href="/dashboard" />
            <CapabilityCard icon={Target} title="Sales Outreach" desc="Find 50 prospects in 30 seconds. Write personalized cold emails. Send sequences. Qualify responses. Book meetings automatically." accent="from-emerald-500/[0.04]" href="/showcase" />
            <CapabilityCard icon={Search} title="Market Intelligence" desc="Analyze any website or market. Get tech stack breakdowns, positioning gaps, untapped keyword opportunities, and actionable insights." accent="from-cyan-500/[0.04]" href="/showcase" />
            <CapabilityCard icon={Mic} title="Voice Agents" desc="AI cold-calls prospects, qualifies leads, and books meetings directly onto your calendar. Sub-200ms response in 12 languages." accent="from-emerald-600/[0.04]" href="/dashboard" />
            <CapabilityCard icon={Code2} title="Code & Deploy" desc="Describe a feature in plain English. The agent writes production code, reviews it for bugs, and prepares it for deployment." accent="from-emerald-300/[0.04]" href="/dashboard" />
          </StaggerChildren>
        </div>
      </section>
      </ScrollVelocitySkew>

      {/* ═══ THE AGENT INFRASTRUCTURE STACK ═══ */}
      <GlowDivider />
      <section className="py-20 px-6 bg-[#030303] perf-section">
        <GradientFollower className="max-w-5xl mx-auto" color="rgba(16, 185, 129, 0.04)" size={700}>
          <div className="text-center mb-14">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">The Full Stack</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Agents are born smart. But they&apos;re born naked.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-400 max-w-xl mx-auto">
              Voice made ElevenLabs an $11B company. Memory made Mem0 an AWS partner. Sovereign Matrix gives your agents the entire stack — voice, memory, payments, tools, workflows, and identity — in one platform.
            </RevealText>
          </div>

          {/* Solved layers — compact row */}
          <div className="mb-3">
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-[0.2em] font-semibold mb-3 ml-1">Already solved</p>
            <StaggerChildren className="grid grid-cols-3 gap-3" staggerDelay={0.06}>
              {[
                { title: "Voice", desc: "Real phone calls, lead qualification, meeting booking. Sub-200ms in 12 languages.", highlight: "Solved" },
                { title: "Memory", desc: "Knowledge graph with persistent context. Agents remember your brand, clients, and history.", highlight: "Solved" },
                { title: "Payments", desc: "Yoco, PayStack, Stripe. Agents process transactions and track revenue end to end.", highlight: "Solved" },
              ].map((item) => (
                <div key={item.title} className="p-5 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold">{item.highlight}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </StaggerChildren>
          </div>

          {/* Building layers — full cards */}
          <div>
            <p className="text-[10px] text-cyan-400/70 uppercase tracking-[0.2em] font-semibold mb-3 ml-1">The rest of the stack</p>
            <StaggerChildren className="grid md:grid-cols-2 gap-4" staggerDelay={0.08}>
              {[
                {
                  title: "Multi-Model Intelligence",
                  desc: "65+ models auto-routed per task. Smart router picks the optimal model. 11-deep failover chain. Native function calling lets agents choose their own tools.",
                  highlight: "65+ models",
                  color: "text-cyan-400",
                },
                {
                  title: "Workflow Orchestration",
                  desc: "25 playbooks chain agents into autonomous pipelines. Conditional branching, parallel execution, scheduled cron. Runs 24/7 on autopilot — you wake up to results.",
                  highlight: "25 playbooks",
                  color: "text-violet-400",
                },
                {
                  title: "Trust & Safety",
                  desc: "5-layer security pipeline on every execution: jailbreak detection, content safety, PII scanning, quality scoring, critic agent QA. Full audit trail. NemoClaw sandbox for air-gapped local execution.",
                  highlight: "5-layer pipeline",
                  color: "text-rose-400",
                },
                {
                  title: "Integrations & Identity",
                  desc: "Slack, HubSpot, Salesforce, GitHub, Discord, and 20+ more. Agents connect to your existing stack — CRM, email, calendar, database. They don't work in isolation.",
                  highlight: "25+ connectors",
                  color: "text-amber-400",
                },
              ].map((item) => (
                <TiltCard key={item.title} tiltStrength={6} className="rounded-2xl">
                  <div className="p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/15 transition-gpu duration-500 group">
                    <div className={`text-[10px] uppercase tracking-widest mb-3 font-semibold ${item.color}`}>{item.highlight}</div>
                    <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">{item.desc}</p>
                  </div>
                </TiltCard>
              ))}
            </StaggerChildren>
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5 }}
            className="mt-10 text-center">
            <p className="text-xs text-neutral-500">
              Voice, memory, and payments built $11B+ in standalone companies. We ship the entire stack — including trust and safety — in one platform.
            </p>
          </motion.div>
        </GradientFollower>
      </section>

      {/* ═══ HOW IT WORKS — 3-step flow ═══ */}
      <GlowDivider />
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">How It Works</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight">Three steps. Real results.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-500 max-w-lg mx-auto mt-3">From goal to output in under 3 minutes. No prompt engineering. No technical setup.</RevealText>
          </div>

          <StaggerChildren className="grid md:grid-cols-3 gap-6" staggerDelay={0.12}>
            {[
              {
                step: "01",
                title: "Describe your goal",
                desc: "Type what you need in plain English. The smart router analyzes your request and selects the best agents and models.",
                example: "\"Find 50 fintech companies with Series A funding and draft cold outreach emails\"",
                gradient: "from-emerald-500/10 to-emerald-500/0",
                color: "text-emerald-400",
              },
              {
                step: "02",
                title: "Agents execute in parallel",
                desc: "Specialized agents break your goal into steps. Lead Hunter scrapes data, Email Agent drafts sequences, Critic Agent verifies quality.",
                example: "3 agents \u00b7 2 models \u00b7 consensus verified",
                gradient: "from-cyan-500/10 to-cyan-500/0",
                color: "text-cyan-400",
              },
              {
                step: "03",
                title: "Get verified output",
                desc: "Every result passes through the 5-layer safety pipeline. Verified emails, production-ready content, actionable intelligence — not drafts.",
                example: "53 leads with verified emails \u00b7 ready to export",
                gradient: "from-violet-500/10 to-violet-500/0",
                color: "text-violet-400",
              },
            ].map((item, i) => (
              <TiltCard key={item.step} tiltStrength={5} className="rounded-2xl">
                <div className="relative group">
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-white/10 transition-gpu duration-500">
                    <div className={`text-4xl font-black ${item.color} opacity-20 mb-3 font-mono`}>{item.step}</div>
                    <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed mb-4">{item.desc}</p>
                    <div className="p-3 rounded-lg bg-black/30 border border-white/[0.04]">
                      <p className="text-[11px] text-neutral-500 font-mono leading-relaxed">{item.example}</p>
                    </div>
                    {/* Connector arrow */}
                    {i < 2 && <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-neutral-700 text-lg z-10">&rarr;</div>}
                  </div>
                </div>
              </TiltCard>
            ))}
          </StaggerChildren>

          {/* CTA below steps */}
          <div className="text-center mt-10">
            <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-sm text-neutral-300 hover:bg-white/10 hover:text-white transition-all">
              Try it now — free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ AGENT NETWORK — Live visualization ═══ */}
      {/* Section transition gradient */}
      <div className="h-20 bg-gradient-to-b from-[#010101] via-[#020202] to-[#020202] pointer-events-none" />
      <GlowDivider />
      <section className="py-24 px-6 bg-[#020202] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.02),transparent_70%)]" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Agent Intelligence Network</RevealText>
              <RevealText as="h2" delay={0.1} className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-6">Agents that think together.</RevealText>
              <RevealText as="p" delay={0.2} className="text-neutral-500 leading-relaxed mb-8">
                Watch 130+ agents communicate in real-time. When the Lead Gen agent qualifies a prospect, the Email Sequence agent starts outreach. When SEO finds a keyword, Content writes the article. Intelligence flows between agents — creating compound intelligence no single model can match.
              </RevealText>
              <div className="space-y-3">
                {[
                  { label: "Cross-Agent Learning", desc: "Agents share discoveries via a real-time signal bus" },
                  { label: "Adversarial Debate", desc: "Agent teams critique each other before delivering output" },
                  { label: "Persistent Memory", desc: "Every interaction makes future responses smarter" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-white">{item.label}</div>
                      <div className="text-xs text-neutral-500">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <AgentNetwork />
          </div>
        </div>
      </section>

      {/* ═══ AGENT OFFICE — Living digital workspace ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 bg-[#030303]">
        <AgentOffice />
      </section>

      {/* ═══ EXECUTION TRANSPARENCY — What Manus charges $100M ARR for, we show for free ═══ */}
      {/* Section transition gradient */}
      <div className="h-20 bg-gradient-to-b from-[#030303] via-[#020202] to-[#020202] pointer-events-none" />
      <GlowDivider />
      <section className="py-24 px-6 bg-[#020202] perf-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Full Transparency</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Watch every step. Trust every output.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-500 max-w-lg mx-auto">No black boxes. See exactly which model runs, what data flows where, and why each decision was made.</RevealText>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-2xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.04)]">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-[#060606]">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
              </div>
              <span className="text-[10px] text-neutral-500 ml-3 font-mono">sovereign-matrix — execution log</span>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-500/70">LIVE</span>
              </span>
            </div>

            {/* Execution feed */}
            <div className="p-5 font-mono text-xs space-y-2.5 max-h-[320px] overflow-hidden">
              {[
                { time: "09:14:02", agent: "Smart Router", action: "Classified task → lead_generation", model: "Nemotron 3 Super", color: "text-emerald-400" },
                { time: "09:14:02", agent: "NemoGuard", action: "Input safety check → PASS (jailbreak: 0.02, pii: clean)", model: "NemoGuard 8B", color: "text-cyan-400" },
                { time: "09:14:03", agent: "Lead Gen", action: "Searching 4 data sources in parallel...", model: "GLM-4.7 (tool calling)", color: "text-violet-400" },
                { time: "09:14:05", agent: "Lead Gen", action: "Found 53 matches. Enriching with email verification...", model: "—", color: "text-violet-400" },
                { time: "09:14:08", agent: "Lead Gen", action: "48/53 emails verified. Scoring leads by ICP fit...", model: "Qwen 3 (multilingual)", color: "text-violet-400" },
                { time: "09:14:10", agent: "Cross-Agent Signal", action: "LEAD_QUALIFIED → Email Sequence agent subscribed", model: "Signal Bus", color: "text-amber-400" },
                { time: "09:14:10", agent: "Email Sequence", action: "Generating 3-step outreach for top 10 leads...", model: "DeepSeek V3.2", color: "text-rose-400" },
                { time: "09:14:14", agent: "NemoGuard", action: "Output safety check → PASS (moderation: clean, quality: 0.94)", model: "NemoGuard 8B", color: "text-cyan-400" },
                { time: "09:14:14", agent: "Memory", action: "Saved 53 leads + 10 sequences to tenant memory", model: "NV-EmbedQA", color: "text-neutral-400" },
                { time: "09:14:15", agent: "Pipeline Complete", action: "53 leads enriched, 10 sequences drafted, 48 emails verified", model: "Total: 12.8s", color: "text-emerald-400" },
              ].map((log, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3">
                  <span className="text-neutral-500 shrink-0">{log.time}</span>
                  <span className={`font-semibold shrink-0 w-[140px] truncate ${log.color}`}>{log.agent}</span>
                  <span className="text-neutral-400 flex-1">{log.action}</span>
                  <span className="text-neutral-500 shrink-0 text-[10px] hidden sm:block">{log.model}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <div className="mt-6 flex items-center justify-center gap-6 text-[10px] text-neutral-500">
            <span>Every agent execution is logged</span>
            <span className="text-neutral-500" aria-hidden="true">|</span>
            <span>Full audit trail for compliance</span>
            <span className="text-neutral-500" aria-hidden="true">|</span>
            <span>Real-time in the dashboard</span>
          </div>
        </div>
      </section>

      {/* ═══ TRUST & SECURITY ═══ */}
      <section className="py-24 px-6 bg-[#020202]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Trust Infrastructure</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">No more Wild West. Every action is authenticated.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-500 max-w-lg mx-auto">Every agent execution runs through a 5-layer safety pipeline. Full audit trail. Air-gapped local execution available. Your data never leaves your hardware.</RevealText>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "5-Layer Safety Pipeline",
                points: ["Jailbreak detection pre-flight", "Content safety screening", "PII scanning on all outputs", "Quality scoring with auto-retry", "Critic agent QA gate"],
              },
              {
                title: "Data Isolation",
                points: ["Multi-tenant architecture", "Per-user encrypted API keys", "Tenant memory isolation", "No cross-account data leakage", "Full data export anytime"],
              },
              {
                title: "Audit & Compliance",
                points: ["Every execution logged with timestamps", "RBAC with 4 role levels", "SOC 2 Type II audit trail", "Request correlation IDs", "Rate limiting at every layer"],
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
              >
                <h3 className="text-sm font-semibold text-white mb-4">{card.title}</h3>
                <ul className="space-y-2.5">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-neutral-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60 mt-0.5 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[10px] text-neutral-500">
            <span>780+ automated tests</span>
            <span aria-hidden="true">|</span>
            <span>Encrypted at rest + in transit</span>
            <span aria-hidden="true">|</span>
            <span>Air-gapped deployment available</span>
            <span aria-hidden="true">|</span>
            <span>GDPR-ready data handling</span>
          </div>
        </div>
      </section>

      {/* Demo section moved to top of page — duplicate removed */}

      {/* ═══ CONSENSUS ENGINE — The Technical Moat ═══ */}
      <GlowDivider />
      <SectionReveal>
      <section className="py-24 px-6 perf-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-violet-500/60 mb-4">Multi-Model Verification</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Your agents don&apos;t just generate. They debate.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-500 max-w-xl mx-auto">Every critical output passes through generate → critique → synthesize across independent models. The result is verified, not hallucinated.</RevealText>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                step: "1",
                title: "Generate",
                model: "Nemotron Ultra 253B",
                desc: "The primary model drafts the complete output — leads, content, analysis, or code. Full context, maximum capability.",
                color: "cyan",
                icon: "draft",
              },
              {
                step: "2",
                title: "Critique",
                model: "DeepSeek V3.2",
                desc: "A different model reviews the draft for hallucinations, factual errors, bias, and quality issues. Acts as a devil's advocate.",
                color: "amber",
                icon: "review",
              },
              {
                step: "3",
                title: "Synthesize",
                model: "Gemma 4 31B",
                desc: "A third model incorporates the critique, resolves conflicts, and produces the final verified output. Three minds, one answer.",
                color: "emerald",
                icon: "final",
              },
            ].map((s, i) => {
              const colorMap: Record<string, string> = {
                cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
                amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
                emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
              };
              const classes = colorMap[s.color];
              return (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.5 }}
                  className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 relative"
                >
                  {i < 2 && (
                    <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-neutral-700 text-lg">→</div>
                  )}
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${classes} text-[10px] font-bold uppercase tracking-widest border mb-4`}>
                    Step {s.step} — {s.title}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed mb-3">{s.desc}</p>
                  <div className="text-[10px] font-mono text-neutral-600">Powered by {s.model}</div>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <p className="text-xs text-neutral-600">
              This is how <span className="text-white font-medium">consensus verification</span> works.
              Three independent models. Three perspectives. One verified answer.
              Not available on ChatGPT, CrewAI, n8n, or any competitor.
            </p>
          </div>
        </div>
      </section>
      </SectionReveal>

      {/* ═══ HOW IT WORKS — Architecture ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 perf-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Architecture</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Built on models you control.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-500 max-w-xl mx-auto">Smart routing across 65+ open-source models. Automatic failover. Zero vendor lock-in.</RevealText>
          </div>

          <ClipReveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 circuit-grid p-4 rounded-2xl">
            {[
              { name: "Nemotron Ultra 253B", desc: "Complex reasoning & synthesis" },
              { name: "Llama 4 Scout", desc: "10M context — analyze entire codebases" },
              { name: "Claude Sonnet 4.6", desc: "Tool use, computer control, MCP" },
              { name: "Gemini 2.5 Pro", desc: "Cognitive engine & grounding" },
              { name: "DeepSeek V3.2", desc: "Strongest open-source reasoning" },
              { name: "Qwen 3", desc: "Best multilingual — 50+ languages" },
              { name: "NVIDIA NIM", desc: "Free inference at scale" },
              { name: "NeMo Guardrails", desc: "5-layer safety pipeline" },
              { name: "Cerebras WSE", desc: "2,200+ tok/s instant inference" },
              { name: "Mistral Small 3", desc: "Ultra-fast function calling" },
              { name: "FLUX.1", desc: "Production image generation" },
              { name: "Kokoro TTS", desc: "Open-source voice synthesis" },
              { name: "Ollama", desc: "Local air-gapped execution" },
            ].map((tech, i) => (
              <motion.div key={tech.name} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="p-5 rounded-xl bg-[#0A0A0A] border border-white/[0.06] hover:border-emerald-500/20 transition-gpu duration-300 group hover:shadow-[0_0_20px_rgba(16,185,129,0.03)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 group-hover:bg-emerald-400 group-hover:shadow-[0_0_6px_rgba(16,185,129,0.5)] transition-gpu" />
                  <p className="text-sm font-semibold text-white">{tech.name}</p>
                </div>
                <p className="text-xs text-neutral-400">{tech.desc}</p>
              </motion.div>
            ))}
          </div>
          </ClipReveal>
        </div>
      </section>

      {/* ═══ WHY DIFFERENT — Comparison ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 bg-[#050505] perf-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Old vs New</RevealText>
            <div className="overflow-hidden">
              <TextDecrypt text="From chatbot to autonomous workforce." className="text-3xl md:text-5xl font-bold text-white tracking-tight" as="h2" speed={20} delay={200} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-8 rounded-2xl bg-[#080808] border border-white/[0.04]">
              <h3 className="text-lg font-semibold text-neutral-400 mb-1 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-neutral-500" /> The Old Way
              </h3>
              <p className="text-neutral-400 text-xs mb-6">Prompt, copy, paste, repeat</p>
              <ul className="space-y-3">
                {["You type a prompt. Copy the response. Paste it somewhere else. Repeat 50 times a day.", "Every session starts from zero — no memory of your brand, clients, or past work.", "Limited to text generation — can't browse the web, send emails, or execute tasks.", "You do the planning, quality checking, and formatting. The AI just generates text."].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-neutral-400 text-sm">
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-500" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-8 rounded-2xl bg-[#0A0A0A] border border-emerald-500/10 hover:border-emerald-500/20 transition-gpu duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.04)]">
              <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> The Autonomous Way
              </h3>
              <p className="text-emerald-500/50 text-xs mb-6">Set the goal. Agents deliver.</p>
              <ul className="space-y-3">
                {["Describe one goal. 130+ agents plan the steps, execute in parallel, and deliver finished work.", "Learns your brand voice, remembers client preferences, and improves with every interaction.", "Opens real browsers. Sends real emails. Generates real content. Deploys real code.", "Self-corrects errors, retries with different approaches, and optimizes its own performance over time."].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-neutral-300 text-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ USE CASES BY INDUSTRY ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 perf-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Who Uses This</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight">Built for builders.</RevealText>
          </div>

          <StaggerChildren className="grid md:grid-cols-3 gap-5" staggerDelay={0.08}>
            {[
              {
                industry: "Marketing Agencies",
                use: "White-label the platform and resell to clients. One dashboard runs lead gen, content, SEO, and reporting for every client simultaneously.",
                agents: "Lead Gen, Content, SEO, Email Sequence, Client Report",
                result: "5x client capacity without hiring",
              },
              {
                industry: "SaaS Companies",
                use: "Automate outbound sales pipeline from prospecting to meeting booking. Voice agents qualify leads, email sequences nurture, and CRM syncs automatically.",
                agents: "Leads, Voice Agent, Outbound, Booking, Competitor Watch",
                result: "3x qualified meetings per rep",
              },
              {
                industry: "E-commerce Brands",
                use: "Generate product descriptions, ad creatives, social posts, and SEO-optimized landing pages at scale. One prompt produces content across all channels.",
                agents: "Content, Ads, Design, Page Builder, Programmatic SEO",
                result: "50+ pages generated per hour",
              },
            ].map((uc) => (
              <div key={uc.industry} className="p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/15 transition-gpu duration-500 group">
                <h3 className="text-base font-semibold text-white mb-2">{uc.industry}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed mb-4">{uc.use}</p>
                <div className="text-[10px] text-emerald-500/50 uppercase tracking-wider mb-2">Agents used</div>
                <p className="text-xs text-neutral-400 mb-3">{uc.agents}</p>
                <div className="pt-3 border-t border-white/[0.04]">
                  <span className="text-xs font-medium text-emerald-400">{uc.result}</span>
                </div>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ═══ COMPETITOR COMPARISON MATRIX ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 perf-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">The Comparison</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">How we stack up.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-400 max-w-lg mx-auto">
              Not hype. Real capabilities side by side.
            </RevealText>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="text-left px-5 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Capability</th>
                    <th className="px-4 py-4 text-xs font-bold text-emerald-400 uppercase tracking-wider text-center">Sovereign</th>
                    <th className="px-4 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-center">ChatGPT</th>
                    <th className="px-4 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-center">n8n</th>
                    <th className="px-4 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-center">Manus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {[
                    { cap: "Autonomous agents", sov: true, gpt: false, n8n: false, man: true },
                    { cap: "Multi-model routing (35+)", sov: true, gpt: false, n8n: false, man: false },
                    { cap: "Visual workflow builder", sov: true, gpt: false, n8n: true, man: false },
                    { cap: "White-label / reseller", sov: true, gpt: false, n8n: false, man: false },
                    { cap: "Self-healing PEER loop", sov: true, gpt: false, n8n: false, man: false },
                    { cap: "Adversarial synthesis (3-agent debate)", sov: true, gpt: false, n8n: false, man: false },
                    { cap: "Real-time citations with sources", sov: true, gpt: false, n8n: false, man: false },
                    { cap: "Knowledge graph memory", sov: true, gpt: false, n8n: false, man: false },
                    { cap: "Policy engine + budget controls", sov: true, gpt: false, n8n: false, man: false },
                    { cap: "Human-in-the-loop approvals", sov: true, gpt: false, n8n: true, man: false },
                    { cap: "$0 per-token (open-source models)", sov: true, gpt: false, n8n: false, man: false },
                    { cap: "Local / air-gapped execution", sov: true, gpt: false, n8n: true, man: false },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-neutral-300 text-xs">{row.cap}</td>
                      <td className="px-4 py-3 text-center">{row.sov ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-neutral-600 mx-auto" />}</td>
                      <td className="px-4 py-3 text-center">{row.gpt ? <CheckCircle2 className="w-4 h-4 text-neutral-400 mx-auto" /> : <XCircle className="w-4 h-4 text-neutral-600 mx-auto" />}</td>
                      <td className="px-4 py-3 text-center">{row.n8n ? <CheckCircle2 className="w-4 h-4 text-neutral-400 mx-auto" /> : <XCircle className="w-4 h-4 text-neutral-600 mx-auto" />}</td>
                      <td className="px-4 py-3 text-center">{row.man ? <CheckCircle2 className="w-4 h-4 text-neutral-400 mx-auto" /> : <XCircle className="w-4 h-4 text-neutral-600 mx-auto" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-white/[0.04] text-center">
              <span className="text-[10px] text-neutral-600">Based on publicly available feature lists as of April 2026</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SPEED SECTION — Cerebras + inference performance ═══ */}
      <section className="py-16 px-6 bg-[#020202] border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: 2200, suffix: "+", label: "Tokens/Second", sub: "Cerebras wafer-scale inference", color: "text-cyan-400" },
              { value: 25, suffix: "", label: "Playbooks", sub: "1-click autonomous workflows", color: "text-violet-400" },
              { value: 11, suffix: "", label: "Failover Models", sub: "Auto-switches if one fails", color: "text-emerald-400" },
              { value: 0, suffix: "", label: "Downtime", sub: "Multi-provider redundancy", color: "text-white", prefix: "$" },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="text-center p-5 rounded-xl border border-white/[0.04] bg-white/[0.01]"
              >
                <div className={`text-3xl md:text-4xl font-black tracking-tight mb-1 ${stat.color}`}>
                  {stat.prefix || ""}<AnimatedCounter target={stat.value} duration={1.5} />{stat.suffix}
                </div>
                <div className="text-xs font-semibold text-neutral-300 mb-0.5">{stat.label}</div>
                <div className="text-[10px] text-neutral-600">{stat.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ AGENTIC AUTOPILOT — 24/7 Autonomous Execution ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 bg-[#020202] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(139,92,246,0.03),transparent)]" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute h-full w-full rounded-full bg-violet-400 opacity-50" />
                <span className="relative rounded-full h-2 w-2 bg-violet-400" />
              </span>
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-violet-400/70">Always On</p>
            </div>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Agents that run your business while you sleep.
            </RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-400 max-w-xl mx-auto">
              Playbooks chain multiple agents into autonomous workflows. Set a schedule, walk away — Sovereign runs lead gen, content, outreach, and reporting 24/7. You wake up to results.
            </RevealText>
          </div>

          {/* Autopilot Live Terminal */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-2xl border border-violet-500/10 bg-[#0A0A0A] overflow-hidden shadow-[0_0_60px_rgba(139,92,246,0.04)] mb-10">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-[#060606]">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
              </div>
              <span className="text-[10px] text-neutral-500 ml-3 font-mono">autopilot — Lead Blitz playbook</span>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-[10px] text-violet-400/70">RUNNING</span>
              </span>
            </div>

            <div className="p-5 font-mono text-xs space-y-3">
              {[
                { step: 1, agent: "Lead Scraper", status: "done", result: "53 leads found in 4.2s", color: "text-emerald-400", icon: "check" },
                { step: 2, agent: "Email Verifier", status: "done", result: "48/53 verified (90.5% hit rate)", color: "text-emerald-400", icon: "check" },
                { step: 3, agent: "ICP Scorer", status: "done", result: "Ranked by fit score — top 10 highlighted", color: "text-emerald-400", icon: "check" },
                { step: 4, agent: "Outreach Writer", status: "running", result: "Drafting 3-step sequence for top 20...", color: "text-violet-400", icon: "spin" },
                { step: 5, agent: "CRM Sync", status: "pending", result: "Waiting for step 4", color: "text-neutral-500", icon: "wait" },
                { step: 6, agent: "Telegram Alert", status: "pending", result: "Will notify on completion", color: "text-neutral-500", icon: "wait" },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3">
                  <span className={`w-5 text-center ${s.color}`}>
                    {s.icon === "check" ? <CheckCircle2 className="w-3.5 h-3.5 inline" /> :
                     s.icon === "spin" ? <span className="inline-block w-3.5 h-3.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" /> :
                     <span className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-600" />}
                  </span>
                  <span className="text-neutral-500 w-4">{s.step}.</span>
                  <span className={`font-semibold w-[120px] truncate ${s.color}`}>{s.agent}</span>
                  <span className="text-neutral-400 flex-1">{s.result}</span>
                </motion.div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="px-5 pb-4">
              <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500"
                  initial={{ width: "0%" }}
                  whileInView={{ width: "60%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-neutral-600">3 of 6 steps complete</span>
                <span className="text-[10px] text-violet-400/60">~45s remaining</span>
              </div>
            </div>
          </motion.div>

          {/* Autopilot Features */}
          <StaggerChildren className="grid md:grid-cols-3 gap-5" staggerDelay={0.08}>
            {[
              {
                title: "25 Pre-Built Playbooks",
                desc: "Lead Blitz, SEO Domination, Content Machine, Competitor Takedown — pick a business outcome, fill 2 fields, hit deploy. The right agent team assembles automatically.",
                highlight: "1-click deploy",
              },
              {
                title: "Scheduled Execution",
                desc: "Run playbooks hourly, daily, or weekly on autopilot. Wake up to 50 new leads, a week's worth of content, and a competitor report — every morning.",
                highlight: "Cron-powered",
              },
              {
                title: "Real-Time Step Tracking",
                desc: "Watch each agent execute live in the dashboard. Every step writes to the database — poll for progress, see results as they arrive, get Telegram alerts on completion.",
                highlight: "Live dashboard",
              },
            ].map((item) => (
              <div key={item.title} className="p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-violet-500/15 transition-gpu duration-500 group">
                <div className="text-[10px] text-violet-400/60 uppercase tracking-widest mb-3 font-semibold">{item.highlight}</div>
                <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </StaggerChildren>

          <div className="mt-10 text-center">
            <MagneticButton href="/dashboard/autopilot" strength={0.15}>
              <span className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-violet-300 border border-violet-500/20 hover:bg-violet-500/10 transition-colors cursor-pointer">
                Open Autopilot Dashboard <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* ═══ AGENCY SPOTLIGHT ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 bg-[#030303] perf-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">For Agencies</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">White-label it. Resell it. Scale it.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-400 max-w-lg mx-auto">One subscription. Unlimited clients. Your brand, your domain, your revenue.</RevealText>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-8 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02]">
              <h3 className="text-lg font-bold text-white mb-4">The Math</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-neutral-400">Your cost</span><span className="text-white font-mono">R9,997/mo (~$540)</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">Resell to 20 clients at R2,000/mo</span><span className="text-white font-mono">R40,000/mo</span></div>
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between"><span className="text-emerald-400 font-semibold">Your profit</span><span className="text-emerald-400 font-bold font-mono">R30,003/mo</span></div>
              </div>
            </div>
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <h3 className="text-lg font-bold text-white mb-4">What You Get</h3>
              <ul className="space-y-2">
                {["Your brand on every page", "Custom domain (ai.youragency.com)", "Client portals with usage tracking", "All 130+ agents under your roof", "Workflow templates your clients love", "You keep 100% of client revenue"].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-neutral-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 text-center">
            <MagneticButton href="/for-agencies" strength={0.15}>
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors cursor-pointer">
                Learn about white-label <ArrowRight className="w-4 h-4" />
              </span>
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <GlowDivider />
      <section className="py-24 px-6">
        <Testimonials />
      </section>

      {/* ═══ ENTERPRISE METRICS ═══ */}
      {/* Section transition gradient */}
      <div className="h-24 bg-gradient-to-b from-[#010101] via-[#020202] to-[#010101] pointer-events-none" />
      <GlowDivider />
      <EnterpriseSection />

      {/* ═══ PRICING ═══ */}
      <GlowDivider />
      <section id="pricing" className="py-24">
        <Pricing />
      </section>

      {/* ═══ FAQ ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 bg-[#050505] perf-section">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-2xl mx-auto">
          <RevealText as="h2" className="text-2xl md:text-3xl font-bold text-white mb-12 text-center tracking-tight">Common Questions</RevealText>
          <div className="rounded-2xl border border-white/[0.06] bg-[#080808] p-1">
            {[
              { q: "What is Sovereign Matrix?", a: "An autonomous AI agent platform. 130+ specialized agents handle sales, marketing, content, and operations end-to-end. A smart router picks the best model from 65+ open-source LLMs per task. You set goals — agents deliver results." },
              { q: "Is this just another ChatGPT wrapper?", a: "No. ChatGPT is a chatbot. Sovereign Matrix is 130+ autonomous agents that execute: finding leads, building pages, writing outreach sequences, qualifying prospects, making calls. They open real browsers, hit real APIs, plan multi-step workflows, and self-correct without manual prompting." },
              { q: "Can agents run locally without cloud?", a: "Yes. NemoClaw runs on your machine via Ollama. Full offline execution — your data never leaves your hardware. Built for sensitive client work and air-gapped environments." },
              { q: "Is there a contract or lock-in?", a: "No contracts. Month-to-month. Cancel from your dashboard. Data is always exportable. NVIDIA NIM inference is free — you only pay for premium features." },
              { q: "How long does setup take?", a: "Under 60 seconds. Sign up, complete the 5-step onboarding wizard, and deploy your first agent immediately. No Docker, no terminal commands, no technical setup required for the cloud version." },
              { q: "What integrations are supported?", a: "NVIDIA NIM, Ollama (local models), ElevenLabs (voice), Pinecone (vector memory), Clerk (auth), Neon PostgreSQL (database), Vercel (hosting), PayFast, Yoco, and PayStack. A public API is available for custom integrations." },
              { q: "Is my data safe?", a: "Yes. A 5-layer NeMo Guardrails safety pipeline protects every interaction: jailbreak detection, topic control, content safety, PII scanning, and quality scoring. Plus local execution means data never touches the cloud if you choose." },
              { q: "What is the white-label Enterprise license?", a: "The Enterprise license lets agencies rebrand the entire platform as their own. Custom domain, client portals, your logo. It is a complete AI business-in-a-box — deploy under your brand and scale your agency without hiring." },
              { q: "How is this different from ChatGPT?", a: "ChatGPT is a chatbot — you type, it responds with text. Sovereign Matrix has 130+ specialized agents that execute real tasks: finding leads with verified emails, sending email sequences, making phone calls, building landing pages, and running SEO audits. The agents work autonomously — you set a goal, they plan and execute without constant prompting." },
              { q: "What happens to my data?", a: "Your data stays in your account. We use encrypted storage, RBAC access controls, and a full audit trail. You can export all your data anytime from Settings. For maximum security, run agents locally via NemoClaw — your data never leaves your network." },
            ].map((faq, i) => <FAQItem key={i} question={faq.q} answer={faq.a} />)}
          </div>
        </motion.div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      {/* Section transition gradient */}
      <div className="h-20 bg-gradient-to-b from-[#050505] via-[#030303] to-[#010101] pointer-events-none" />
      <GlowDivider />
      <section className="py-32 text-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.04),transparent_70%)]" />
        {/* Circuit-style grid accent */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,183,255,0.008)_1px,transparent_1px),linear-gradient(90deg,rgba(0,183,255,0.008)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="relative z-10">
          <RevealText as="h2" className="text-4xl md:text-6xl font-black text-white mb-5 tracking-tight leading-[1.05]">
            Your competitors hire humans.
          </RevealText>
          <div className="overflow-hidden mb-5">
            <TextDecrypt text="You deploy AI employees." className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.05]" as="h2" speed={20} delay={400} />
          </div>
          <RevealText as="p" delay={0.3} className="text-neutral-400 max-w-lg mx-auto mb-4">
            130 agents. 35+ models. They work weekends. They don&apos;t need benefits.
            They cost less than your morning coffee. Start in 60 seconds.
          </RevealText>
          <RevealText as="p" delay={0.4} className="text-emerald-400/70 text-sm mb-10">
            Free forever plan. No credit card. 50 runs/month included.
          </RevealText>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <ParticleBurst>
            <MagneticButton href="/free/competitor-scan" strength={0.25}>
              <span className="cta-glow group flex items-center gap-2 px-8 py-4 bg-white text-black font-bold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-gpu cursor-pointer">
                Try Free — Scan a Competitor <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </MagneticButton>
            </ParticleBurst>
            <MagneticButton href="/signup" strength={0.15}>
              <span className="px-7 py-3.5 border border-white/10 text-neutral-300 font-medium rounded-full text-sm hover:border-white/20 hover:text-white transition-gpu cursor-pointer inline-block">
                Create Free Account
              </span>
            </MagneticButton>
          </div>
        </div>
      </section>

      </main>

      {/* ═══ FOOTER ═══ */}
      <GlowDivider />
      <footer className="px-6">
        <div className="max-w-5xl mx-auto py-14">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <SovereignLogo size="sm" />
                <span className="text-sm font-semibold text-white">Sovereign Matrix</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">The autonomous AI agent platform. 130+ agents. 65+ models. Flat pricing, no usage fees. Built on NVIDIA NIM.</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-neutral-400 mb-4">Product</h3>
              <ul className="space-y-2.5">
                <li><Link href="/pricing" className="text-xs text-neutral-500 hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/playground" className="text-xs text-neutral-500 hover:text-white transition-colors">API Playground</Link></li>
                <li><Link href="/docs" className="text-xs text-neutral-500 hover:text-white transition-colors">API Docs</Link></li>
                <li><Link href="/signup" className="text-xs text-neutral-500 hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-neutral-400 mb-4">Free Tools</h3>
              <ul className="space-y-2.5">
                <li><Link href="/free/competitor-scan" className="text-xs text-neutral-500 hover:text-white transition-colors">Competitor Scanner</Link></li>
                <li><Link href="/free/seo-audit" className="text-xs text-neutral-500 hover:text-white transition-colors">SEO Audit</Link></li>
                <li><Link href="/free/lead-finder" className="text-xs text-neutral-500 hover:text-white transition-colors">Lead Finder</Link></li>
                <li><Link href="/changelog" className="text-xs text-neutral-500 hover:text-white transition-colors">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-neutral-400 mb-4">Legal &amp; Trust</h3>
              <ul className="space-y-2.5">
                <li><Link href="/privacy" className="text-xs text-neutral-500 hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-xs text-neutral-500 hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/security" className="text-xs text-neutral-500 hover:text-white transition-colors">Security</Link></li>
                <li><Link href="/sla" className="text-xs text-neutral-500 hover:text-white transition-colors">SLA</Link></li>
                <li><Link href="/dpa" className="text-xs text-neutral-500 hover:text-white transition-colors">DPA</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-neutral-400 mb-4">Contact</h3>
              <ul className="space-y-2.5">
                <li><a href="mailto:christiaan@sovereignmatrix.agency" className="text-xs text-neutral-500 hover:text-white transition-colors">christiaan@sovereignmatrix.agency</a></li>
                <li><span className="text-xs text-neutral-500">Cape Town, South Africa</span></li>
                <li className="pt-2 flex items-center gap-3">
                  <a href="https://x.com/sovereignmatrix" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white transition-colors" aria-label="Twitter/X">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                  </a>
                  <a href="https://linkedin.com/company/sovereignmatrix" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white transition-colors" aria-label="LinkedIn">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                  </a>
                  <a href="https://github.com/sovereignmatrix" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white transition-colors" aria-label="GitHub">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-white/[0.04] flex items-center justify-between">
            <p className="text-[10px] text-neutral-500">&copy; 2026 Sovereign Matrix</p>
            <p className="text-[10px] text-neutral-500">Powered by NVIDIA NIM</p>
          </div>
        </div>
      </footer>

      {/* Cursor glow effect is handled by the ambient glow in the hero section */}

      {/* Live pulse — shows platform activity in real-time */}
      <LivePulse />

      {/* Floating conversational AI agent */}
      <LandingAgent />

      {/* Exit intent — captures visitors about to leave */}
      <ExitIntent />
    </div>
    </CinematicLoader>
  );
}
