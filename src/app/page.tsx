"use client";

import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { BrainCircuit, CheckCircle2, Cpu, Target, ChevronDown, XCircle, ArrowRight, Mic, Code2, Search, FileText } from "lucide-react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useState, useRef } from "react";

import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { Pricing } from "@/components/ui/Pricing";
import { Testimonials } from "@/components/ui/SocialProof";
import { CinematicLoader } from "@/components/ui/CinematicLoader";

import { InteractiveHeroStrike } from "@/components/ui/InteractiveHeroStrike";
import { SocialProofMetrics } from "@/components/ui/SocialProofMetrics";
import { LandingAgent } from "@/components/ui/LandingAgent";
import { AgentOffice } from "@/components/ui/AgentOffice";
import { RevealText, ScaleOnScroll, MagneticButton, StaggerChildren, GlowDivider } from "@/components/ui/ScrollAnimations";
import { TextDecrypt } from "@/components/cinematic/TextDecrypt";
import { ScrollVelocitySkew, ClipReveal } from "@/components/cinematic/ScrollVelocity";
import { ParticleBurst } from "@/components/cinematic/ParticleBurst";
import dynamic from "next/dynamic";
import { TextMorph } from "@/components/ui/TextMorph";

const HeroParticles = dynamic(() => import("@/components/ui/HeroParticles").then(m => ({ default: m.HeroParticles })), { ssr: false });

// ─── Capability Card (enhanced with emerald hover glow) ───
function CapabilityCard({ icon: Icon, title, desc, accent, href }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; accent: string; href?: string }) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="group relative cursor-pointer"
    >
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
    </motion.div>
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
    id: "competitor",
    label: "Competitor Intel",
    icon: Search,
    prompt: "Analyze competitor hubspot.com — tech stack, SEO gaps, content strategy weaknesses.",
    agent: "Site Assassin",
    response: "Tech stack: React, Next.js, Contentful CMS. SEO gaps: 847 uncontested long-tail keywords. Weakness: No AI agent content. Counter-strategy: 12 tactical moves identified.",
    badges: [
      { text: "847 keyword gaps", color: "emerald" },
      { text: "12 counter-moves", color: "cyan" },
      { text: "Full report", color: "neutral" },
    ],
  },
  {
    id: "voice",
    label: "Voice Call",
    icon: Mic,
    prompt: "Cold-call the top 10 leads from today's search. Qualify for budget and timeline. Book meetings.",
    agent: "Voice Closer",
    response: "10 calls completed in 4m 32s. 6 answered. 3 qualified (budget confirmed). 2 meetings booked directly to your calendar for Thursday.",
    badges: [
      { text: "3 qualified", color: "emerald" },
      { text: "2 meetings booked", color: "cyan" },
      { text: "< 200ms latency", color: "neutral" },
    ],
  },
];

function InteractiveDemo() {
  const [active, setActive] = useState(0);
  const scenario = DEMO_SCENARIOS[active];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7 }}
      className="relative max-w-3xl mx-auto"
    >
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        {DEMO_SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(i)}
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
                <p className="text-sm text-neutral-300 leading-relaxed mb-3">{scenario.response}</p>
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
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  return (
    <CinematicLoader>
    <div className="relative min-h-screen bg-[#010101] text-white selection:bg-emerald-500/20 font-sans antialiased">

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
            <Link href="#capabilities" className="text-xs text-neutral-500 hover:text-white transition-colors">Platform</Link>
            <Link href="#pricing" className="text-xs text-neutral-500 hover:text-white transition-colors">Pricing</Link>
            <Link href="#enterprise" className="text-xs text-neutral-500 hover:text-white transition-colors">Enterprise</Link>
            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
              <button className="text-xs text-neutral-500 hover:text-white transition-colors">Log in</button>
            </SignInButton>
            <Link href="/onboarding" className="px-4 py-1.5 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-gpu">
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
              <Link href="/onboarding" className="px-5 py-2.5 rounded-xl bg-white text-sm font-semibold text-black text-center mt-2" onClick={() => setMobileNavOpen(false)}>Get Started</Link>
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
            <span className="text-[11px] text-neutral-400 font-medium">132 agents deployed</span>
          </motion.div>

          {/* Headline — clean, massive, no clutter */}
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-[clamp(2.5rem,8vw,7rem)] font-black leading-[0.9] tracking-[-0.03em] mb-6">
            <span className="text-shimmer">
              Your AI{" "}<br /><TextMorph />
            </span>
          </motion.h1>

          {/* Subtitle — specific, not generic */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.7 }}
            className="text-lg md:text-xl text-neutral-500 max-w-xl mx-auto leading-relaxed mb-10">
            Paste a competitor URL. Get their full strategy in 30 seconds.
            No prompting. No copying. No manual work.
          </motion.p>

          {/* CTAs — one primary, one secondary */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <ParticleBurst>
            <MagneticButton href="/onboarding" strength={0.2}>
              <span className="group flex items-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-gpu duration-500 cursor-pointer">
                Deploy Your First Agent <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </MagneticButton>
            </ParticleBurst>
            <MagneticButton href="/showcase" strength={0.15}>
              <span className="px-7 py-3.5 rounded-full text-sm font-medium text-neutral-400 border border-white/[0.06] hover:border-white/[0.12] hover:text-white transition-gpu duration-300 cursor-pointer inline-block">
                Watch Demo
              </span>
            </MagneticButton>
          </motion.div>

          {/* Model strip — understated, not flashy */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-2">
            <ModelBadge name="Nemotron Ultra" type="253B" />
            <ModelBadge name="Claude" type="MCP" />
            <ModelBadge name="Gemini 2.5" type="Pro" />
            <ModelBadge name="DeepSeek" type="R1" />
            <ModelBadge name="NemoClaw" type="AGT" />
            <ModelBadge name="Kimi K2.5" type="1T" />
          </motion.div>
        </div>

        {/* Scroll-reveal glassmorphic card */}
        <div className="relative z-20 -mt-[5vh] pb-12 px-6">
          <ScaleOnScroll className="max-w-4xl mx-auto">
            {/* Glassmorphic demo card */}
            <div className="relative rounded-3xl border border-white/[0.08] bg-[#080808]/80 backdrop-blur-2xl overflow-hidden shadow-[0_0_80px_rgba(16,185,129,0.06)]">
              {/* Gradient border glow */}
              <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-emerald-500/20 via-transparent to-cyan-500/10 pointer-events-none" />

              <div className="relative p-1">
                <div className="rounded-[22px] overflow-hidden">
                  {/* Interactive STRIKE */}
                  <InteractiveHeroStrike />
                </div>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="flex justify-center mt-8">
              <ChevronDown className="w-5 h-5 text-neutral-600 animate-bounce" />
            </div>
          </ScaleOnScroll>
        </div>
      </motion.section>

      {/* ═══ POWERED BY — minimal trust strip ═══ */}
      <div className="flex items-center justify-center gap-6 py-8 px-4">
        <span className="text-[10px] uppercase tracking-[0.25em] text-neutral-600">Built on</span>
        {["NVIDIA NIM", "NemoClaw", "Ollama", "Vercel", "Neon"].map((name) => (
          <span key={name} className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-default">{name}</span>
        ))}
      </div>

      {/* ═══ SOCIAL PROOF METRICS ═══ */}
      <GlowDivider />
      <section className="py-24 px-6">
        <SocialProofMetrics />
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
            <CapabilityCard icon={Search} title="Competitor Intel" desc="Paste a competitor URL. Get their full tech stack, SEO gaps, content strategy, and specific counter-moves you can execute." accent="from-cyan-500/[0.04]" href="/showcase" />
            <CapabilityCard icon={Mic} title="Voice Agents" desc="AI cold-calls prospects, qualifies leads, and books meetings directly onto your calendar. Sub-200ms response in 12 languages." accent="from-emerald-600/[0.04]" href="/dashboard" />
            <CapabilityCard icon={Code2} title="Code & Deploy" desc="Describe a feature in plain English. The agent writes production code, reviews it for bugs, and prepares it for deployment." accent="from-emerald-300/[0.04]" href="/dashboard" />
          </StaggerChildren>
        </div>
      </section>
      </ScrollVelocitySkew>

      {/* ═══ AGENT OFFICE — Living digital workspace ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 bg-[#030303]">
        <AgentOffice />
      </section>

      {/* ═══ LIVE DEMO ═══ */}
      <GlowDivider />
      <section id="demo" className="py-24 px-6 bg-[#050505]">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-14">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60">Live Demo</p>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">See it in action.</h2>
            <p className="text-neutral-500 max-w-lg mx-auto">Give a goal. Watch agents deliver. No prompting required.</p>
          </motion.div>

          <InteractiveDemo />
        </div>
      </section>

      {/* ═══ HOW IT WORKS — Architecture ═══ */}
      <GlowDivider />
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Architecture</RevealText>
            <RevealText as="h2" delay={0.1} className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Built on models you control.</RevealText>
            <RevealText as="p" delay={0.2} className="text-neutral-500 max-w-xl mx-auto">Smart routing across 51+ open-source models. Automatic failover. Zero vendor lock-in.</RevealText>
          </div>

          <ClipReveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 circuit-grid p-4 rounded-2xl">
            {[
              { name: "Nemotron Ultra 253B", desc: "Complex reasoning & synthesis" },
              { name: "NemoClaw", desc: "Enterprise autonomous agent framework" },
              { name: "Claude MCP", desc: "Tool use & computer control" },
              { name: "Gemini 2.5 Pro", desc: "Cognitive engine & grounding" },
              { name: "NVIDIA NIM", desc: "Free inference at scale" },
              { name: "NeMo Guardrails", desc: "5-layer safety pipeline" },
              { name: "DeepSeek V3.2", desc: "Long-form content generation" },
              { name: "FLUX.2", desc: "Image generation" },
              { name: "Cosmos VLM", desc: "Video generation & visual reasoning" },
              { name: "Kimi K2.5", desc: "1T parameter multimodal reasoning" },
              { name: "DeepSeek R1", desc: "Advanced chain-of-thought reasoning" },
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
      <section className="py-24 px-6 bg-[#050505]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <RevealText as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">The Difference</RevealText>
            <div className="overflow-hidden">
              <TextDecrypt text="Not another chatbot." className="text-3xl md:text-5xl font-bold text-white tracking-tight" as="h2" speed={20} delay={200} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-8 rounded-2xl bg-[#080808] border border-white/[0.04]">
              <h3 className="text-lg font-semibold text-neutral-400 mb-1 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-neutral-500" /> Prompt-Based AI
              </h3>
              <p className="text-neutral-500 text-xs mb-6">What everyone else sells</p>
              <ul className="space-y-3">
                {["You type a prompt. Copy the response. Paste into Gmail. Repeat 50 times a day.", "Forgets your brand, your clients, and everything you told it yesterday.", "Cannot open a browser, send an email, make a call, or push code to production.", "You do the planning. You do the quality check. You do the formatting. It just types."].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-neutral-500 text-sm">
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-500" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-8 rounded-2xl bg-[#0A0A0A] border border-emerald-500/10 hover:border-emerald-500/20 transition-gpu duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.04)]">
              <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Agent-Powered Execution
              </h3>
              <p className="text-emerald-500/50 text-xs mb-6">What your business actually needs</p>
              <ul className="space-y-3">
                {["Type one goal. Walk away. 132 agents plan the steps, execute them, and deliver finished work.", "Remembers your brand voice, your client preferences, and what failed last time.", "Opens real browsers. Sends real emails. Makes real phone calls. Deploys real code.", "Catches its own errors, retries with a different approach, and self-corrects — no human needed."].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-neutral-300 text-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <GlowDivider />
      <section className="py-24 px-6">
        <Testimonials />
      </section>

      {/* ═══ ENTERPRISE METRICS ═══ */}
      <GlowDivider />
      <section id="enterprise" className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(16,185,129,0.03),transparent)]" />
        {/* Subtle grid for depth */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.01)_1px,transparent_1px)] bg-[size:80px_80px] pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Sovereign AI</p>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] mb-6">
              Your data. Your infrastructure.<br className="hidden md:block" /> Your autonomous workforce.
            </h2>
            <p className="text-sm text-neutral-400 max-w-2xl mx-auto leading-relaxed">
              Built on the same NVIDIA NIM and NemoClaw stack trusted by Google, Cisco, and CrowdStrike.
              Air-gapped deployment. Zero data residency violations. Enterprise-grade from day one.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {[
              { metric: "132", label: "Specialized Agents", desc: "Purpose-built for specific business functions." },
              { metric: "51+", label: "Open-Source Models", desc: "Automatic failover. Zero vendor lock-in." },
              { metric: "$0", label: "Per-Token Cost", desc: "Scale inference without scaling your bill." },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <div className="text-5xl md:text-6xl font-black text-white mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-400">{item.metric}</div>
                <div className="text-sm font-semibold text-white mb-1">{item.label}</div>
                <p className="text-xs text-neutral-500">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Air-Gapped Execution", desc: "Run entirely on your own hardware via NemoClaw" },
              { label: "5-Layer NeMo Guardrails", desc: "Jailbreak, topic, content, PII, quality" },
              { label: "White-Label Franchise", desc: "Your brand, your domain, your clients" },
              { label: "NVIDIA + Google Stack", desc: "NIM, Nemotron, Gemini, Blackwell-ready" },
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
            <Link href="/partner" className="group inline-flex items-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-gpu">
              Book a Strategy Call <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ═══ PRICING ═══ */}
      <GlowDivider />
      <section id="pricing" className="py-24">
        <Pricing />
      </section>

      {/* ═══ FAQ ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 bg-[#050505]">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-12 text-center tracking-tight">Common Questions</h2>
          <div className="rounded-2xl border border-white/[0.06] bg-[#080808] p-1">
            {[
              { q: "What is Sovereign Matrix?", a: "An autonomous AI agent platform. 132 specialized agents handle sales, marketing, content, and operations end-to-end. A smart router picks the best model from 51+ open-source LLMs per task. You set goals — agents deliver results." },
              { q: "Is this just another ChatGPT wrapper?", a: "No. ChatGPT is a chatbot. Sovereign Matrix is 132 autonomous agents that execute: finding leads, building pages, writing outreach sequences, qualifying prospects, making calls. They open real browsers, hit real APIs, plan multi-step workflows, and self-correct without manual prompting." },
              { q: "Can agents run locally without cloud?", a: "Yes. NemoClaw runs on your machine via Ollama. Full offline execution — your data never leaves your hardware. Built for sensitive client work and air-gapped environments." },
              { q: "Is there a contract or lock-in?", a: "No contracts. Month-to-month. Cancel from your dashboard. Data is always exportable. NVIDIA NIM inference is free — you only pay for premium features." },
              { q: "How long does setup take?", a: "Under 60 seconds. Sign up, complete the 5-step onboarding wizard, and deploy your first agent immediately. No Docker, no terminal commands, no technical setup required for the cloud version." },
              { q: "What integrations are supported?", a: "NVIDIA NIM, Ollama (local models), ElevenLabs (voice), Pinecone (vector memory), Clerk (auth), Neon PostgreSQL (database), Vercel (hosting), PayFast, and Stripe. A public API at /api/v1/ is available for custom integrations." },
              { q: "Is my data safe?", a: "Yes. A 5-layer NeMo Guardrails safety pipeline protects every interaction: jailbreak detection, topic control, content safety, PII scanning, and quality scoring. Plus local execution means data never touches the cloud if you choose." },
              { q: "What is the white-label Cartel license?", a: "The Cartel license lets agencies rebrand the entire platform as their own. Custom domain, client portals, your logo. Clients think you built the technology. It is an agency-in-a-box franchise model — resell at whatever margin you choose." },
            ].map((faq, i) => <FAQItem key={i} question={faq.q} answer={faq.a} />)}
          </div>
        </motion.div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <GlowDivider />
      <section className="py-32 text-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.04),transparent_70%)]" />
        {/* Circuit-style grid accent */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,183,255,0.008)_1px,transparent_1px),linear-gradient(90deg,rgba(0,183,255,0.008)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative z-10">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-5 tracking-tight leading-[1.05]">
            Your competitors hire.<br className="hidden md:block" /> You deploy.
          </h2>
          <p className="text-neutral-500 max-w-lg mx-auto mb-10">
            132 agents. 51+ models. Zero per-token cost. Deploy your first agent in 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <ParticleBurst>
            <MagneticButton href="/onboarding" strength={0.25}>
              <span className="cta-glow group flex items-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-gpu cursor-pointer">
                Start Free <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </MagneticButton>
            </ParticleBurst>
            <MagneticButton href="#pricing" strength={0.15}>
              <span className="px-7 py-3.5 border border-white/10 text-neutral-300 font-medium rounded-full text-sm hover:border-white/20 hover:text-white transition-gpu cursor-pointer inline-block">
                Compare Plans
              </span>
            </MagneticButton>
          </div>
        </motion.div>
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
              <p className="text-xs text-neutral-500 leading-relaxed">The autonomous AI agent platform. 132 agents. 51+ models. Zero per-token cost. Built on NVIDIA NIM.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><Link href="/pricing" className="text-xs text-neutral-500 hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/showcase" className="text-xs text-neutral-500 hover:text-white transition-colors">Interactive Demo</Link></li>
                <li><Link href="/docs" className="text-xs text-neutral-500 hover:text-white transition-colors">API Docs</Link></li>
                <li><Link href="/onboarding" className="text-xs text-neutral-500 hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Resources</h4>
              <ul className="space-y-2.5">
                <li><Link href="/blog" className="text-xs text-neutral-500 hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/case-studies" className="text-xs text-neutral-500 hover:text-white transition-colors">Case Studies</Link></li>
                <li><Link href="/about" className="text-xs text-neutral-500 hover:text-white transition-colors">About</Link></li>
                <li><Link href="/partner" className="text-xs text-neutral-500 hover:text-white transition-colors">Partners</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Legal</h4>
              <ul className="space-y-2.5">
                <li><Link href="/privacy" className="text-xs text-neutral-500 hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="text-xs text-neutral-500 hover:text-white transition-colors">Terms</Link></li>
                <li><Link href="/privacy#popia" className="text-xs text-neutral-500 hover:text-white transition-colors">POPIA Compliant</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Contact</h4>
              <ul className="space-y-2.5">
                <li><a href="mailto:christiaan@sovereignmatrix.agency" className="text-xs text-neutral-500 hover:text-white transition-colors">christiaan@sovereignmatrix.agency</a></li>
                <li><span className="text-xs text-neutral-500">Cape Town, South Africa</span></li>
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
    </div>
    </CinematicLoader>
  );
}
