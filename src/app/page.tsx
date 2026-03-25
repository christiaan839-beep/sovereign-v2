"use client";

import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { BrainCircuit, CheckCircle2, Cpu, Globe, Target, ShieldAlert, ChevronDown, XCircle, MessageSquare, Activity, Zap, Lock, ArrowRight, Mic, Code2, Search, FileText } from "lucide-react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useState, useRef } from "react";

import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { Pricing } from "@/components/ui/Pricing";
import { Testimonials } from "@/components/ui/SocialProof";

import { InteractiveHeroStrike } from "@/components/ui/InteractiveHeroStrike";
import { SocialProofMetrics } from "@/components/ui/SocialProofMetrics";
// ─── Animated Energy Orb (enhanced with 3 rings + particle field) ───
function EnergyOrb() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
      {/* Core glow — emerald */}
      <div className="w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full bg-emerald-500/[0.04] blur-[120px] animate-pulse" />
      {/* Secondary core — cyan accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] md:w-[500px] md:h-[500px] rounded-full bg-cyan-500/[0.02] blur-[100px] animate-pulse" style={{ animationDelay: "1.5s" }} />
      {/* Inner ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] md:w-[300px] md:h-[300px] rounded-full border border-emerald-500/[0.08] animate-[spin_40s_linear_infinite]" />
      {/* Middle ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] md:w-[500px] md:h-[500px] rounded-full border border-emerald-500/[0.05] animate-[spin_60s_linear_infinite_reverse]" />
      {/* Outer ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full border border-cyan-500/[0.03] animate-[spin_90s_linear_infinite]" />
      {/* Floating particles — star field effect */}
      {[
        { top: "10%", left: "20%", size: "w-1 h-1", opacity: "0.4" },
        { top: "30%", left: "75%", size: "w-1.5 h-1.5", opacity: "0.3" },
        { top: "65%", left: "15%", size: "w-1 h-1", opacity: "0.5" },
        { top: "20%", left: "55%", size: "w-0.5 h-0.5", opacity: "0.6" },
        { top: "75%", left: "45%", size: "w-1 h-1", opacity: "0.3" },
        { top: "40%", left: "80%", size: "w-0.5 h-0.5", opacity: "0.4" },
        { top: "50%", left: "10%", size: "w-1.5 h-1.5", opacity: "0.2" },
        { top: "85%", left: "60%", size: "w-1 h-1", opacity: "0.5" },
        { top: "15%", left: "40%", size: "w-0.5 h-0.5", opacity: "0.6" },
        { top: "55%", left: "70%", size: "w-1 h-1", opacity: "0.3" },
        { top: "5%", left: "85%", size: "w-0.5 h-0.5", opacity: "0.5" },
        { top: "90%", left: "25%", size: "w-1 h-1", opacity: "0.2" },
        { top: "35%", left: "5%", size: "w-1.5 h-1.5", opacity: "0.3" },
        { top: "70%", left: "90%", size: "w-0.5 h-0.5", opacity: "0.6" },
        { top: "45%", left: "35%", size: "w-1 h-1", opacity: "0.4" },
        { top: "25%", left: "90%", size: "w-1 h-1", opacity: "0.2" },
        { top: "80%", left: "80%", size: "w-0.5 h-0.5", opacity: "0.5" },
        { top: "60%", left: "50%", size: "w-1.5 h-1.5", opacity: "0.2" },
        { top: "8%", left: "65%", size: "w-1 h-1", opacity: "0.4" },
        { top: "92%", left: "40%", size: "w-0.5 h-0.5", opacity: "0.6" },
      ].map((pos, i) => (
        <div key={i} className={`absolute ${pos.size} rounded-full animate-pulse ${i % 3 === 0 ? "bg-cyan-400" : "bg-emerald-400"}`}
          style={{ top: pos.top, left: pos.left, opacity: parseFloat(pos.opacity), animationDelay: `${i * 0.3}s`, animationDuration: `${2 + (i % 5) * 0.8}s` }} />
      ))}
    </div>
  );
}

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
      <div className="relative p-8 rounded-2xl border border-white/[0.06] bg-[#080808] hover:border-emerald-500/20 transition-all duration-500 overflow-hidden hover:shadow-[0_0_30px_rgba(16,185,129,0.04)]">
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
      <button className="w-full flex items-center justify-between py-6 text-left group" onClick={() => setOpen(!open)}>
        <span className="text-sm md:text-base font-medium text-white group-hover:text-neutral-400 transition-colors pr-4">{question}</span>
        <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-60 pb-6' : 'max-h-0'}`}>
        <p className="text-sm text-neutral-500 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

// ─── Model Badge (enhanced with subtle glow) ───
function ModelBadge({ name, type }: { name: string; type: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-emerald-500/15 transition-all duration-300">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
      <span className="text-xs font-medium text-neutral-300">{name}</span>
      <span className="text-[9px] text-neutral-600 uppercase">{type}</span>
    </div>
  );
}

// ─── Live Demo Mockup ───
function LiveDemoMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7 }}
      className="relative max-w-3xl mx-auto"
    >
      {/* Window chrome */}
      <div className="scan-line rounded-2xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.04)]">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-[#060606]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
          </div>
          <span className="text-[10px] text-neutral-600 ml-3 font-mono">sovereign-matrix.agency/dashboard</span>
        </div>

        {/* Chat content */}
        <div className="p-6 space-y-4">
          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-md bg-emerald-500/10 border border-emerald-500/15">
              <p className="text-sm text-emerald-200">Find 50 leads in fintech — Series A, US-based, with open CMO roles.</p>
            </div>
          </div>

          {/* Agent response */}
          <div className="flex justify-start">
            <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-500/70 font-medium uppercase tracking-wider">Lead Agent</span>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed mb-3">
                Found 53 matches. Enriched with LinkedIn profiles, funding data, and email verification. 48 have validated emails.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">53 leads found</span>
                <span className="text-[10px] px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/15">48 verified emails</span>
                <span className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] text-neutral-400 border border-white/[0.06]">CSV ready</span>
              </div>
            </div>
          </div>
        </div>
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
    <div className="relative min-h-screen bg-[#010101] text-white selection:bg-emerald-500/20 font-sans antialiased">

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
            <Link href="/dashboard" className="px-4 py-1.5 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-all">
              Get Started
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle menu">
            <div className="space-y-1.5">
              <span className={`block w-5 h-[1.5px] bg-white transition-all ${mobileNavOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block w-5 h-[1.5px] bg-white transition-all ${mobileNavOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-[1.5px] bg-white transition-all ${mobileNavOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
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
              <Link href="/dashboard" className="px-5 py-2.5 rounded-xl bg-white text-sm font-semibold text-black text-center mt-2" onClick={() => setMobileNavOpen(false)}>Get Started</Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ═══ HERO — The Superpower Moment ═══ */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">

        <EnergyOrb />

        {/* Holographic grid overlay — emerald pulsing lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.025)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />
        {/* Secondary fine grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,183,255,0.008)_1px,transparent_1px),linear-gradient(90deg,rgba(0,183,255,0.008)_1px,transparent_1px)] bg-[size:15px_15px] pointer-events-none" />
        {/* Top vignette */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#010101] to-transparent pointer-events-none z-[1]" />
        {/* Bottom vignette */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#010101] to-transparent pointer-events-none z-[1]" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Status badge */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.04] mb-10">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[11px] text-emerald-400/80 font-medium">132 Agents Live</span>
          </motion.div>

          {/* Headline */}
          <motion.h1 initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.9 }}
            className="text-[clamp(2.5rem,8vw,7rem)] font-black leading-[0.92] tracking-[-0.03em] mb-8">
            <span className="text-shimmer">
              The agents are live.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.7 }}
            className="text-base md:text-lg text-neutral-500 max-w-2xl mx-auto leading-relaxed mb-12">
            While your competitors hire. You deploy. 132 autonomous agents across 51 open-source models. Zero per-token cost. This is the future of work.
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Link href="/dashboard" className="cta-glow group flex items-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-all">
              Start Free <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/showcase" className="px-7 py-3.5 border border-white/10 text-neutral-300 font-medium rounded-full text-sm hover:border-white/20 hover:text-white transition-all">
              Watch Demo
            </Link>
          </motion.div>

          {/* Model badges — shows the power stack */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-2 mb-20">
            <ModelBadge name="Nemotron Ultra" type="253B" />
            <ModelBadge name="Claude" type="MCP" />
            <ModelBadge name="Gemini 2.5" type="PRO" />
            <ModelBadge name="DeepSeek" type="V3.2" />
            <ModelBadge name="FLUX" type="IMG" />
            <ModelBadge name="NemoClaw" type="OS" />
            <ModelBadge name="Kimi K2.5" type="1T" />
          </motion.div>

          {/* Interactive demo */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6 }}>
            <InteractiveHeroStrike />
          </motion.div>
        </div>
      </motion.section>

      {/* ═══ POWERED BY STRIP ═══ */}
      <div className="flex items-center justify-center gap-8 py-6 opacity-40">
        <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-600">Powered by</span>
        <span className="text-[10px] text-neutral-500">NVIDIA NIM</span>
        <span className="text-[10px] text-neutral-600">&bull;</span>
        <span className="text-[10px] text-neutral-500">NemoClaw</span>
        <span className="text-[10px] text-neutral-600">&bull;</span>
        <span className="text-[10px] text-neutral-500">Kimi K2.5</span>
        <span className="text-[10px] text-neutral-600">&bull;</span>
        <span className="text-[10px] text-neutral-500">DeepSeek R1</span>
      </div>

      {/* ═══ SOCIAL PROOF METRICS ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <section className="py-20 px-6">
        <SocialProofMetrics />
      </section>

      {/* ═══ WHAT IT DOES — 6 Capabilities ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <section id="capabilities" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Capabilities</p>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">What you can do with it.</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <CapabilityCard icon={Cpu} title="Browser Automation" desc="Point an agent at a website. It opens a real browser, navigates, extracts data, and reports back." accent="from-emerald-500/[0.04]" href="/showcase" />
            <CapabilityCard icon={BrainCircuit} title="Document Intelligence" desc="Upload PDFs, contracts, reports. Ask questions in plain English. Get answers from your data." accent="from-emerald-400/[0.04]" href="/dashboard" />
            <CapabilityCard icon={Target} title="Sales Outreach" desc="Find prospects. Write personalized emails. Send sequences. Qualify responses. Book meetings." accent="from-emerald-500/[0.04]" href="/showcase" />
            <CapabilityCard icon={Search} title="Competitor Intel" desc="Paste a URL. Get their tech stack, SEO gaps, content strategy, and moves you can make." accent="from-cyan-500/[0.04]" href="/showcase" />
            <CapabilityCard icon={Mic} title="Voice Agents" desc="AI makes calls, qualifies leads, books meetings. Sub-200ms response. Sounds human." accent="from-emerald-600/[0.04]" href="/dashboard" />
            <CapabilityCard icon={Code2} title="Code & Deploy" desc="Describe what you want built. The agent writes code, reviews it, and prepares deployment." accent="from-emerald-300/[0.04]" href="/dashboard" />
          </div>
        </div>
      </section>

      {/* ═══ LIVE DEMO ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
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

          <LiveDemoMockup />
        </div>
      </section>

      {/* ═══ HOW IT WORKS — Architecture ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Architecture</p>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Built on models you control.</h2>
            <p className="text-neutral-500 max-w-xl mx-auto">Smart routing across 51+ open-source models. Automatic failover. Zero vendor lock-in.</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 circuit-grid p-4 rounded-2xl">
            {[
              { name: "Nemotron Ultra 253B", desc: "Complex reasoning & synthesis" },
              { name: "NemoClaw / OpenClaw", desc: "Enterprise autonomous agent platform" },
              { name: "Claude MCP", desc: "Tool use & computer control" },
              { name: "Gemini 2.5 Pro", desc: "Cognitive engine & grounding" },
              { name: "NVIDIA NIM", desc: "Free inference at scale" },
              { name: "NeMo Guardrails", desc: "5-layer safety pipeline" },
              { name: "DeepSeek V3.2", desc: "Long-form content generation" },
              { name: "FLUX.2", desc: "Image generation" },
              { name: "Cosmos", desc: "Video & visual reasoning" },
            ].map((tech, i) => (
              <motion.div key={tech.name} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="p-5 rounded-xl bg-[#0A0A0A] border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-300 group hover:shadow-[0_0_20px_rgba(16,185,129,0.03)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 group-hover:bg-emerald-400 group-hover:shadow-[0_0_6px_rgba(16,185,129,0.5)] transition-all" />
                  <p className="text-sm font-semibold text-white">{tech.name}</p>
                </div>
                <p className="text-xs text-neutral-600">{tech.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHY DIFFERENT — Comparison ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <section className="py-24 px-6 bg-[#050505]">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">The Difference</p>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">Not another chatbot.</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-8 rounded-2xl bg-[#080808] border border-white/[0.04]">
              <h3 className="text-lg font-semibold text-neutral-400 mb-1 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-neutral-600" /> Prompt-Based AI
              </h3>
              <p className="text-neutral-600 text-xs mb-6">What everyone else sells</p>
              <ul className="space-y-3">
                {["You type every prompt manually", "Forgets everything between sessions", "Cannot open a browser or send an email", "You do the thinking — it just types"].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-neutral-500 text-sm">
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-700" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-8 rounded-2xl bg-[#0A0A0A] border border-emerald-500/10 hover:border-emerald-500/20 transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.04)]">
              <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Agent-Powered Execution
              </h3>
              <p className="text-emerald-500/50 text-xs mb-6">What your business actually needs</p>
              <ul className="space-y-3">
                {["Set a goal — agents deliver results autonomously", "Remembers your business context across sessions", "Finds leads, writes content, builds pages for you", "Catches its own mistakes and self-corrects"].map((item, i) => (
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
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <section className="py-24 px-6">
        <Testimonials />
      </section>

      {/* ═══ ENTERPRISE METRICS ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <section id="enterprise" className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(16,185,129,0.03),transparent)]" />
        {/* Subtle grid for depth */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.01)_1px,transparent_1px)] bg-[size:80px_80px] pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Enterprise</p>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] mb-6">
              Real value comes from AI<br className="hidden md:block" /> that delivers at scale.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {[
              { metric: "132", label: "Specialized Agents", desc: "Purpose-built for specific business functions." },
              { metric: "51", label: "Open-Source Models", desc: "Automatic failover. Zero vendor lock-in." },
              { metric: "$0", label: "Per-Token Cost", desc: "Scale inference without scaling your bill." },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <div className="text-5xl md:text-6xl font-black text-white mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-400">{item.metric}</div>
                <div className="text-sm font-semibold text-white mb-1">{item.label}</div>
                <p className="text-xs text-neutral-600">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "5-Layer Safety", desc: "Jailbreak, topic, content, PII, quality" },
              { label: "White-Label", desc: "Your brand, your domain, your clients" },
              { label: "Voice Pipeline", desc: "Sub-200ms, 12 languages" },
              { label: "SOC2 Stack", desc: "NVIDIA + Neon + Clerk + Vercel" },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.08 }}
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:border-emerald-500/15 transition-all duration-300">
                <div className="text-xs font-semibold text-white mb-0.5">{item.label}</div>
                <p className="text-[10px] text-neutral-600">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/partner" className="group inline-flex items-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-all">
              Book a Strategy Call <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ═══ PRICING ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <section id="pricing" className="py-24">
        <Pricing />
      </section>

      {/* ═══ FAQ ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
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
            ].map((faq, i) => <FAQItem key={i} question={faq.q} answer={faq.a} />)}
          </div>
        </motion.div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <section className="py-32 text-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.04),transparent_70%)]" />
        {/* Circuit-style grid accent */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,183,255,0.008)_1px,transparent_1px),linear-gradient(90deg,rgba(0,183,255,0.008)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative z-10">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-5 tracking-tight leading-[1.05]">
            Stop paying for tools<br className="hidden md:block" /> that don&apos;t scale.
          </h2>
          <p className="text-neutral-500 max-w-md mx-auto mb-10">
            One platform. 132 agents. Zero per-token costs. Free to start.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/dashboard" className="cta-glow group flex items-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-all">
              Start Free <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="#pricing" className="px-7 py-3.5 border border-white/10 text-neutral-300 font-medium rounded-full text-sm hover:border-white/20 hover:text-white transition-all">
              Compare Plans
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <footer className="px-6">
        <div className="max-w-5xl mx-auto py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <SovereignLogo size="sm" />
                <span className="text-sm font-semibold text-white">Sovereign Matrix</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">The autonomous AI agent platform. 132 agents. 51+ models. Zero per-token cost. Built on NVIDIA NIM.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><Link href="/pricing" className="text-xs text-neutral-600 hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/showcase" className="text-xs text-neutral-600 hover:text-white transition-colors">Interactive Demo</Link></li>
                <li><Link href="/dashboard" className="text-xs text-neutral-600 hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/onboarding" className="text-xs text-neutral-600 hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Legal</h4>
              <ul className="space-y-2.5">
                <li><Link href="/privacy" className="text-xs text-neutral-600 hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="text-xs text-neutral-600 hover:text-white transition-colors">Terms</Link></li>
                <li><span className="text-xs text-neutral-700">POPIA Compliant</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Contact</h4>
              <ul className="space-y-2.5">
                <li><a href="mailto:hello@sovereignmatrix.agency" className="text-xs text-neutral-600 hover:text-white transition-colors">hello@sovereignmatrix.agency</a></li>
                <li><span className="text-xs text-neutral-700">Cape Town, South Africa</span></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-white/[0.04] flex items-center justify-between">
            <p className="text-[10px] text-neutral-700">&copy; 2026 Sovereign Matrix</p>
            <p className="text-[10px] text-neutral-700">Powered by NVIDIA NIM</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
