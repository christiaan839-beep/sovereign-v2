"use client";

import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
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
import { RevealText, ScaleOnScroll, MagneticButton, StaggerChildren, GlowDivider, ScrollProgress } from "@/components/ui/ScrollAnimations";
import { TextDecrypt } from "@/components/cinematic/TextDecrypt";
import { ScrollVelocitySkew, ClipReveal } from "@/components/cinematic/ScrollVelocity";
import { ParticleBurst } from "@/components/cinematic/ParticleBurst";
import { Typewriter, GradientFollower, Tilt3D, AnimatedCounter } from "@/components/cinematic/InteractiveEffects";
import { LiveTicker } from "@/components/cinematic/LiveTicker";
import { LogoMarquee } from "@/components/cinematic/InfiniteMarquee";
import { ExitIntent } from "@/components/ui/ExitIntent";
import dynamic from "next/dynamic";
import { TextMorph } from "@/components/ui/TextMorph";

const HeroParticles = dynamic(() => import("@/components/ui/HeroParticles").then(m => ({ default: m.HeroParticles })), { ssr: false });
const HeroOrb = dynamic(() => import("@/components/cinematic/HeroOrb").then(m => ({ default: m.HeroOrb })), { ssr: false });
const AgentNetwork = dynamic(() => import("@/components/cinematic/AgentNetwork").then(m => ({ default: m.AgentNetwork })), { ssr: false });

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
            <p className="text-sm text-neutral-500 leading-relaxed">{desc}</p>
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
        <p className="text-sm text-neutral-500 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

// ─── Model Badge (enhanced with subtle glow) ───
function ModelBadge({ name, type }: { name: string; type: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl hover:border-emerald-500/20 hover:bg-emerald-500/[0.03] transition-gpu duration-500 group">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] group-hover:shadow-[0_0_12px_rgba(16,185,129,0.8)] transition-shadow" />
      <span className="text-xs font-medium text-neutral-300 group-hover:text-white transition-colors">{name}</span>
      <span className="text-[9px] text-emerald-500/40 uppercase font-mono">{type}</span>
    </div>
  );
}

// ─── Count Up On View ───
function CountUpOnView({ target, suffix = "", prefix = "", duration = 1.5 }: { target: number; suffix?: string; prefix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

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

// ─── Enterprise Section with Parallax ───
function EnterpriseSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <section id="enterprise" ref={sectionRef} className="py-32 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(16,185,129,0.03),transparent)]" />
      {/* Parallax grid background */}
      <motion.div
        style={{ y: backgroundY }}
        className="absolute inset-[-20%] bg-[linear-gradient(rgba(16,185,129,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.01)_1px,transparent_1px)] bg-[size:80px_80px] pointer-events-none"
      />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Sovereign AI</RevealText>
          <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] mb-6">
            Your data. Your infrastructure. Your autonomous workforce.
          </RevealText>
          <RevealText as="p" delay={0.2} className="text-sm text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Built on the same NVIDIA NIM and NemoClaw stack trusted by Google, Cisco, and CrowdStrike.
            Air-gapped deployment. Zero data residency violations. Enterprise-grade from day one.
          </RevealText>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
            <div className="text-5xl md:text-6xl font-black mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-400">
              <AnimatedCounter target={124} duration={2} />
            </div>
            <div className="text-sm font-semibold text-white mb-1">Specialized Agents</div>
            <p className="text-xs text-neutral-500">Purpose-built for specific business functions.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-center">
            <div className="text-5xl md:text-6xl font-black mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-400">
              <AnimatedCounter target={51} suffix="+" duration={1.5} />
            </div>
            <div className="text-sm font-semibold text-white mb-1">Open-Source Models</div>
            <p className="text-xs text-neutral-500">Automatic failover. Zero vendor lock-in.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="text-center">
            <div className="text-5xl md:text-6xl font-black mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-400">
              $<AnimatedCounter target={0} duration={0.5} />
            </div>
            <div className="text-sm font-semibold text-white mb-1">Per-Token Cost</div>
            <p className="text-xs text-neutral-500">Scale inference without scaling your bill.</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Workflow Automation", desc: "Visual builder with branching, parallel, and scheduling" },
            { label: "25+ Live Integrations", desc: "Slack, Sheets, HubSpot, Stripe, GitHub, Discord, and more" },
            { label: "White-Label Platform", desc: "Custom domains, branding, client portals" },
            { label: "Team Roles & Audit Trail", desc: "RBAC, SOC 2 ready, full activity log" },
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

function useLiveAgentCount() {
  const [count, setCount] = useState(124);
  useEffect(() => {
    // Simulate real-time variance — in production this would hit /api/health
    const interval = setInterval(() => {
      setCount(122 + Math.floor(Math.random() * 5)); // 122-126
    }, 8000);
    return () => clearInterval(interval);
  }, []);
  return count;
}

export default function Home() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const agentCount = useLiveAgentCount();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  return (
    <CinematicLoader>
    <div className="relative min-h-screen bg-[#010101] text-white selection:bg-emerald-500/20 font-sans antialiased">

      {/* Scroll progress bar */}
      <ScrollProgress />

      {/* Skip to content — accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-emerald-500 focus:text-black focus:rounded-lg focus:text-sm focus:font-bold">
        Skip to main content
      </a>

      {/* ═══ NAVIGATION ═══ */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 py-3 pointer-events-none"
      >
        <div className="bg-[#080808]/90 backdrop-blur-2xl border border-white/[0.06] rounded-full px-5 h-12 flex items-center justify-between pointer-events-auto w-full max-w-4xl">
          <Link href="/" className="flex items-center gap-2.5">
            <SovereignLogo size="sm" />
            <span className="hidden sm:block text-sm font-semibold text-white">Sovereign Matrix</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="#capabilities" className="text-xs text-neutral-400 hover:text-white transition-colors">Product</Link>
            <Link href="#pricing" className="text-xs text-neutral-400 hover:text-white transition-colors">Pricing</Link>
            <Link href="/docs" className="text-xs text-neutral-400 hover:text-white transition-colors">Docs</Link>
            <Link href="/enterprise" className="text-xs text-neutral-400 hover:text-white transition-colors">Enterprise</Link>
            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
              <button className="text-xs text-neutral-500 hover:text-white transition-colors">Log in</button>
            </SignInButton>
            <Link href="/signup" className="px-4 py-1.5 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-gpu">
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

      {/* ═══ HERO ═══ */}
      <motion.section id="main-content" ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">

        {/* 3D Particle background */}
        <HeroParticles />

        {/* Single ambient glow — not 5 layered gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-emerald-500/[0.04] blur-[200px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,#010101_70%)]" />
        </div>

        {/* Reactive 3D Orb — follows mouse */}
        <HeroOrb />

        {/* Vignettes */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#010101] to-transparent pointer-events-none z-[1]" />
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-[#010101] to-transparent pointer-events-none z-[1]" />

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
          {/* Status — minimal */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.8 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.06] mb-8">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-40" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[11px] text-neutral-400 font-medium">{agentCount} agents deployed</span>
          </motion.div>

          {/* Headline — clear, honest, no hype */}
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-[clamp(2.5rem,8vw,5.5rem)] font-black leading-[0.95] tracking-[-0.03em] mb-6">
            <span className="text-white">The AI platform that</span>
            <br />
            <span className="text-shimmer">actually does the work.</span>
          </motion.h1>

          {/* Subtitle — clear, readable, high contrast */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.7 }}
            className="text-base md:text-lg max-w-xl mx-auto leading-relaxed mb-8">
            <span className="text-neutral-200">Most AI tools just generate text.</span>{" "}
            <span className="text-neutral-400">Sovereign Matrix has 124 agents that find leads, write content, send emails, and build pages — end to end.</span>
          </motion.p>

          {/* CTAs — one primary, one secondary */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <ParticleBurst>
            <MagneticButton href="/signup" strength={0.2}>
              <span className="group flex items-center gap-2 px-8 py-4 bg-white text-black font-bold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-gpu duration-500 cursor-pointer">
                Start Free — No Credit Card <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </MagneticButton>
            </ParticleBurst>
            <MagneticButton href="/demo/live" strength={0.15}>
              <span className="px-8 py-4 rounded-full text-sm font-semibold text-neutral-300 border border-white/[0.08] hover:border-emerald-500/20 hover:text-white transition-gpu duration-300 cursor-pointer inline-block">
                Try Live Demo
              </span>
            </MagneticButton>
          </motion.div>

          {/* Trusted by — prominent, confident */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.6 }}
            className="flex flex-col items-center gap-3">
            <span className="text-[10px] text-neutral-500 uppercase tracking-[0.25em]">Built on infrastructure from</span>
            <div className="flex items-center gap-8">
              {["NVIDIA", "Google", "Anthropic", "Meta", "Mistral"].map((name) => (
                <span key={name} className="text-sm font-semibold text-neutral-500 hover:text-neutral-300 transition-colors cursor-default">{name}</span>
              ))}
            </div>
          </motion.div>

          {/* Origin */}
          <div className="text-center pt-6">
            <span className="text-[9px] text-neutral-500/60 tracking-[0.2em]">Cape Town, South Africa</span>
          </div>
        </div>

        {/* Product preview — simulated agent output */}
        <div className="relative z-20 mt-8 pb-6 px-6">
          <ScaleOnScroll className="max-w-2xl mx-auto">
            <div className="relative rounded-2xl border border-white/[0.06] bg-[#080808]/90 backdrop-blur-2xl overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.04)]">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-[#060606]">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                </div>
                <span className="text-[10px] text-neutral-500 ml-3 font-mono">sovereign-matrix.agency/dashboard</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-500/70">LIVE</span>
                </span>
              </div>
              <div className="p-6 font-mono text-sm space-y-3">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0, duration: 0.4 }}
                  className="text-neutral-300">
                  <span className="text-emerald-400 mr-2">&gt;</span>Find 50 SaaS leads in the US
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 0.4 }}
                  className="text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Found 53 matches in 28 seconds
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 0.4 }}
                  className="text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> 48 emails verified
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.8, duration: 0.4 }}
                  className="text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Results exported to Google Sheets
                </motion.div>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="flex justify-center mt-10">
              <ChevronDown className="w-5 h-5 text-neutral-500 animate-bounce" aria-hidden="true" />
            </div>
          </ScaleOnScroll>
        </div>
      </motion.section>

      {/* ═══ LIVE ACTIVITY TICKER ═══ */}
      <LiveTicker />

      {/* ═══ POWERED BY — infinite scrolling trust strip ═══ */}
      <LogoMarquee />

      {/* ═══ PLATFORM METRICS — Social proof with real numbers ═══ */}
      <section className="py-16 px-6 border-y border-white/[0.04]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 124, suffix: "", label: "AI Agents", desc: "Purpose-built for business" },
            { value: 65, suffix: "+", label: "AI Models", desc: "Auto-routed per task" },
            { value: 25, suffix: "+", label: "Integrations", desc: "CRM, Email, Dev, Database, and more" },
            { value: 198, suffix: "", label: "Tests Passing", desc: "Production-grade reliability" },
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
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">What your agents deliver.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-500 max-w-lg mx-auto">Not mockups. Not concepts. Actual output from real agent executions.</RevealText>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Result Card 1 — Leads */}
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
            </motion.div>

            {/* Result Card 2 — Content */}
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
            </motion.div>

            {/* Result Card 3 — Analysis */}
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
            </motion.div>
          </div>
        </div>
      </section>

      <GlowDivider />
      <section className="py-24 px-6">
        <SocialProofMetrics />
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

      {/* ═══ WHY THIS IS DIFFERENT — Innovation pillars ═══ */}
      <GlowDivider />
      <section className="py-20 px-6 bg-[#030303] perf-section">
        <GradientFollower className="max-w-5xl mx-auto" color="rgba(16, 185, 129, 0.04)" size={700}>
          <div className="text-center mb-14">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Why It&apos;s Different</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight">AI that works. Not just talks.</RevealText>
          </div>

          <StaggerChildren className="grid md:grid-cols-3 gap-5" staggerDelay={0.08}>
            {[
              {
                title: "Multi-Model Intelligence",
                desc: "Not locked to one model. The smart router picks from 65+ models per task — GLM-5 for agentic reasoning, Qwen 3.5 VLM for vision, Nemotron 3 Super for throughput. Native function calling lets models choose which tools to use.",
                highlight: "65+ models",
              },
              {
                title: "Agent Teams That Debate",
                desc: "Complex problems get multiple specialists analyzing in parallel. A Devil's Advocate challenges every conclusion. The lead agent synthesizes into a well-vetted plan.",
                highlight: "Adversarial synthesis",
              },
              {
                title: "Workflow Automation",
                desc: "Chain agents into automated pipelines with conditional branching and parallel execution. If a lead qualifies, the voice agent calls. If not, email nurture starts. Choose from 8 pre-built templates or build your own.",
                highlight: "Visual builder",
              },
              {
                title: "Cross-Agent Learning",
                desc: "When the SEO agent finds a keyword opportunity, the content agent knows immediately. When a lead is qualified, the email agent starts the sequence. Intelligence flows between agents automatically.",
                highlight: "Shared intelligence",
              },
              {
                title: "Enterprise Controls",
                desc: "Team roles (Owner, Admin, Editor, Viewer), full audit trail of every action, scheduled workflows on cron, and real-time notifications. SOC 2 ready with encrypted API keys.",
                highlight: "RBAC + audit trail",
              },
              {
                title: "Connect Everything",
                desc: "Slack, Google Sheets, Airtable, Notion, HubSpot, Salesforce, Stripe, GitHub, Discord, Twilio, MongoDB, Supabase, and more. Every integration works as a workflow step — find leads, then auto-add to your CRM and notify your team.",
                highlight: "25+ integrations",
              },
            ].map((item) => (
              <div key={item.title} className="p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/15 transition-gpu duration-500 group">
                <div className="text-[10px] text-emerald-500/60 uppercase tracking-widest mb-3 font-semibold">{item.highlight}</div>
                <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </StaggerChildren>
        </GradientFollower>
      </section>

      {/* ═══ HOW IT WORKS — 3-step flow ═══ */}
      <GlowDivider />
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">How It Works</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight">How it works</RevealText>
          </div>

          <StaggerChildren className="grid md:grid-cols-3 gap-6" staggerDelay={0.12}>
            {[
              {
                step: "01",
                title: "Tell it what you need",
                desc: "\"Find 50 SaaS companies hiring a Head of Marketing.\" Plain English. No prompt engineering. No technical setup.",
                gradient: "from-emerald-500/10 to-emerald-500/0",
              },
              {
                step: "02",
                title: "AI agents do the work",
                desc: "The smart router picks the best AI model for the job. Specialized agents break your goal into steps and work in parallel.",
                gradient: "from-cyan-500/10 to-cyan-500/0",
              },
              {
                step: "03",
                title: "Get results, not drafts",
                desc: "Verified emails in your inbox. Blog posts ready to publish. Meetings on your calendar. Work you can use immediately — not drafts you have to edit.",
                gradient: "from-emerald-400/10 to-emerald-400/0",
              },
            ].map((item) => (
              <div key={item.step} className="relative group">
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-emerald-500/15 transition-gpu duration-500">
                  <div className="text-5xl font-black text-white/[0.04] mb-4 font-mono">{item.step}</div>
                  <h3 className="text-lg font-semibold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </StaggerChildren>
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
                Watch 124 agents communicate in real-time. When the Lead Gen agent qualifies a prospect, the Email Sequence agent starts outreach. When SEO finds a keyword, Content writes the article. Intelligence flows between agents — creating compound intelligence no single model can match.
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
            <span className="text-neutral-600">|</span>
            <span>Full audit trail for compliance</span>
            <span className="text-neutral-600">|</span>
            <span>Real-time in the dashboard</span>
          </div>
        </div>
      </section>

      {/* ═══ LIVE DEMO ═══ */}
      <GlowDivider />
      <section id="demo" className="py-24 px-6 bg-[#050505]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60">Live Demo</p>
            </div>
            <RevealText as="h2" className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">See it in action.</RevealText>
            <RevealText as="p" delay={0.15} className="text-neutral-500 max-w-lg mx-auto">Give a goal. Watch agents deliver. No prompting required.</RevealText>
          </div>

          <InteractiveDemo />
        </div>
      </section>

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
                <p className="text-xs text-neutral-500">{tech.desc}</p>
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
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">A New Paradigm</RevealText>
            <div className="overflow-hidden">
              <TextDecrypt text="From prompting to deploying." className="text-3xl md:text-5xl font-bold text-white tracking-tight" as="h2" speed={20} delay={200} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-8 rounded-2xl bg-[#080808] border border-white/[0.04]">
              <h3 className="text-lg font-semibold text-neutral-400 mb-1 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-neutral-500" /> The Old Way
              </h3>
              <p className="text-neutral-500 text-xs mb-6">Prompt, copy, paste, repeat</p>
              <ul className="space-y-3">
                {["You type a prompt. Copy the response. Paste it somewhere else. Repeat 50 times a day.", "Every session starts from zero — no memory of your brand, clients, or past work.", "Limited to text generation — can't browse the web, send emails, or execute tasks.", "You do the planning, quality checking, and formatting. The AI just generates text."].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-neutral-500 text-sm">
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-500" /> {item}
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
                {["Describe one goal. 124 agents plan the steps, execute in parallel, and deliver finished work.", "Learns your brand voice, remembers client preferences, and improves with every interaction.", "Opens real browsers. Sends real emails. Generates real content. Deploys real code.", "Self-corrects errors, retries with different approaches, and optimizes its own performance over time."].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-neutral-300 text-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" /> {item}
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
                <p className="text-sm text-neutral-500 leading-relaxed mb-4">{uc.use}</p>
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
                {["Your brand on every page", "Custom domain (ai.youragency.com)", "Client portals with usage tracking", "All 124 agents under your roof", "Workflow templates your clients love", "You keep 100% of client revenue"].map(item => (
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
              { q: "What is Sovereign Matrix?", a: "An autonomous AI agent platform. 124 specialized agents handle sales, marketing, content, and operations end-to-end. A smart router picks the best model from 65+ open-source LLMs per task. You set goals — agents deliver results." },
              { q: "Is this just another ChatGPT wrapper?", a: "No. ChatGPT is a chatbot. Sovereign Matrix is 124 autonomous agents that execute: finding leads, building pages, writing outreach sequences, qualifying prospects, making calls. They open real browsers, hit real APIs, plan multi-step workflows, and self-correct without manual prompting." },
              { q: "Can agents run locally without cloud?", a: "Yes. NemoClaw runs on your machine via Ollama. Full offline execution — your data never leaves your hardware. Built for sensitive client work and air-gapped environments." },
              { q: "Is there a contract or lock-in?", a: "No contracts. Month-to-month. Cancel from your dashboard. Data is always exportable. NVIDIA NIM inference is free — you only pay for premium features." },
              { q: "How long does setup take?", a: "Under 60 seconds. Sign up, complete the 5-step onboarding wizard, and deploy your first agent immediately. No Docker, no terminal commands, no technical setup required for the cloud version." },
              { q: "What integrations are supported?", a: "NVIDIA NIM, Ollama (local models), ElevenLabs (voice), Pinecone (vector memory), Clerk (auth), Neon PostgreSQL (database), Vercel (hosting), PayFast, and Stripe. A public API at /api/v1/ is available for custom integrations." },
              { q: "Is my data safe?", a: "Yes. A 5-layer NeMo Guardrails safety pipeline protects every interaction: jailbreak detection, topic control, content safety, PII scanning, and quality scoring. Plus local execution means data never touches the cloud if you choose." },
              { q: "What is the white-label Enterprise license?", a: "The Enterprise license lets agencies rebrand the entire platform as their own. Custom domain, client portals, your logo. It is a complete AI business-in-a-box — deploy under your brand and scale your agency without hiring." },
              { q: "How is this different from ChatGPT?", a: "ChatGPT is a chatbot — you type, it responds with text. Sovereign Matrix has 124 specialized agents that execute real tasks: finding leads with verified emails, sending email sequences, making phone calls, building landing pages, and running SEO audits. The agents work autonomously — you set a goal, they plan and execute without constant prompting." },
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
            Ready to see what AI agents can do?
          </RevealText>
          <div className="overflow-hidden mb-5">
            <TextDecrypt text="Try it free. Judge for yourself." className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.05]" as="h2" speed={20} delay={400} />
          </div>
          <RevealText as="p" delay={0.3} className="text-neutral-400 max-w-lg mx-auto mb-4">
            124 agents. 65+ open-source models. Workflows, integrations, and analytics — all included on the free plan. No credit card. Cancel anytime.
          </RevealText>
          <RevealText as="p" delay={0.4} className="text-emerald-400/70 text-sm mb-10">
            Free forever plan. No credit card. Set up in 60 seconds.
          </RevealText>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <ParticleBurst>
            <MagneticButton href="/signup" strength={0.25}>
              <span className="cta-glow group flex items-center gap-2 px-8 py-4 bg-white text-black font-bold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-gpu cursor-pointer">
                Start Free Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </MagneticButton>
            </ParticleBurst>
            <MagneticButton href="#pricing" strength={0.15}>
              <span className="px-7 py-3.5 border border-white/10 text-neutral-300 font-medium rounded-full text-sm hover:border-white/20 hover:text-white transition-gpu cursor-pointer inline-block">
                Compare Plans
              </span>
            </MagneticButton>
          </div>
        </div>
      </section>

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
              <p className="text-xs text-neutral-500 leading-relaxed">The autonomous AI agent platform. 124 agents. 65+ models. Flat pricing, no usage fees. Built on NVIDIA NIM.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><Link href="/pricing" className="text-xs text-neutral-500 hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/playground" className="text-xs text-neutral-500 hover:text-white transition-colors">API Playground</Link></li>
                <li><Link href="/docs" className="text-xs text-neutral-500 hover:text-white transition-colors">API Docs</Link></li>
                <li><Link href="/signup" className="text-xs text-neutral-500 hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Resources</h4>
              <ul className="space-y-2.5">
                <li><Link href="/whitepaper" className="text-xs text-neutral-500 hover:text-white transition-colors">Whitepaper</Link></li>
                <li><Link href="/changelog" className="text-xs text-neutral-500 hover:text-white transition-colors">Changelog</Link></li>
                <li><Link href="/status" className="text-xs text-neutral-500 hover:text-white transition-colors">System Status</Link></li>
                <li><Link href="/partner" className="text-xs text-neutral-500 hover:text-white transition-colors">Partners</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Legal & Trust</h4>
              <ul className="space-y-2.5">
                <li><Link href="/privacy" className="text-xs text-neutral-500 hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-xs text-neutral-500 hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/security" className="text-xs text-neutral-500 hover:text-white transition-colors">Security</Link></li>
                <li><Link href="/sla" className="text-xs text-neutral-500 hover:text-white transition-colors">SLA</Link></li>
                <li><Link href="/dpa" className="text-xs text-neutral-500 hover:text-white transition-colors">DPA</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Contact</h4>
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

      {/* Floating conversational AI agent */}
      <LandingAgent />

      {/* Exit intent — captures visitors about to leave */}
      <ExitIntent />
    </div>
    </CinematicLoader>
  );
}
