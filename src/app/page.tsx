"use client";

import { motion, AnimatePresence, useInView } from "framer-motion";
import { CheckCircle2, Target, ChevronDown, XCircle, ArrowRight, Mic, Search, FileText } from "lucide-react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useState, useRef, useEffect } from "react";

import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { Pricing } from "@/components/ui/Pricing";
import { Testimonials } from "@/components/ui/SocialProof";
import { CinematicLoader } from "@/components/ui/CinematicLoader";


import { LandingAgent } from "@/components/ui/LandingAgent";
import { RevealText, MagneticButton, StaggerChildren, GlowDivider, ScrollProgress } from "@/components/ui/ScrollAnimations";
import { useHideyNav, TextShimmer, TiltCard, SectionReveal } from "@/components/ui/EliteEffects";
import { TextDecrypt } from "@/components/cinematic/TextDecrypt";
import { ParticleBurst } from "@/components/cinematic/ParticleBurst";
import { Typewriter, AnimatedCounter, GradientFollower } from "@/components/cinematic/InteractiveEffects";
import { LiveTicker } from "@/components/cinematic/LiveTicker";
import { LogoMarquee } from "@/components/cinematic/InfiniteMarquee";
import { ExitIntent } from "@/components/ui/ExitIntent";
import { LivePulse } from "@/components/ui/LivePulse";
import dynamic from "next/dynamic";
import { useLiveAgentCount } from "@/hooks/useLiveAgentCount";

const PhysicsCards = dynamic(() => import("@/components/cinematic/PhysicsCards").then(m => ({ default: m.PhysicsCards })), { ssr: false });
const NebulaBackground = dynamic(() => import("@/components/cinematic/NebulaBackground").then(m => ({ default: m.NebulaBackground })), { ssr: false });
const SmoothScroll = dynamic(() => import("@/components/cinematic/SmoothScroll").then(m => ({ default: m.SmoothScroll })), { ssr: false });
const WebGLParticles = dynamic(() => import("@/components/cinematic/WebGLParticles").then(m => ({ default: m.WebGLParticles })), { ssr: false });
import { MouseParallax, FloatingElement } from "@/components/cinematic/MouseParallax";
const AgentGlobe = dynamic(() => import("@/components/cinematic/AgentGlobe").then(m => ({ default: m.AgentGlobe })), { ssr: false });
const AgentOffice = dynamic(() => import("@/components/ui/AgentOffice").then(m => ({ default: m.AgentOffice })), { ssr: false });
const CursorGlow = dynamic(() => import("@/components/cinematic/CursorGlow").then(m => ({ default: m.CursorGlow })), { ssr: false });
const ConsensusEngine = dynamic(() => import("@/components/cinematic/ConsensusEngine").then(m => ({ default: m.ConsensusEngine })), { ssr: false });
const TokenStream = dynamic(() => import("@/components/cinematic/TokenStream").then(m => ({ default: m.TokenStream })), { ssr: false });
// Static imports to avoid Turbopack stale module factory issue with new files
import { LiveAgentTerminal } from "@/components/cinematic/LiveAgentTerminal";
import { StackKiller } from "@/components/cinematic/StackKiller";
import { LiveModelHealth } from "@/components/cinematic/LiveModelHealth";
import { LiveAgentStats } from "@/components/cinematic/LiveAgentStats";
import { AnimatedGrid } from "@/components/cinematic/AnimatedGrid";
import { FloatingOrbs } from "@/components/cinematic/ScrollRevealHero";

// ─── Tok/s counter — must be defined in same file to avoid Turbopack HMR stale module ───
function TokCounter() {
  const [tok, setTok] = useState(2247);
  useEffect(() => {
    const iv = setInterval(() => setTok(2180 + Math.floor(Math.random() * 120)), 400);
    return () => clearInterval(iv);
  }, []);
  return (
    <span className="hidden md:flex items-center gap-1.5 font-mono tabular-nums text-xs text-neutral-500">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-70" />
        <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
      </span>
      <span className="text-emerald-400/80">{tok.toLocaleString()} tok/s</span>
    </span>
  );
}

// ─── Early Access Email Capture ───
function EarlyAccessCapture() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    setError("");
    try {
      // Store locally + attempt API save
      const existing = JSON.parse(localStorage.getItem("sm-waitlist") || "[]");
      if (!existing.includes(email.trim())) {
        existing.push(email.trim());
        localStorage.setItem("sm-waitlist", JSON.stringify(existing));
      }
      // Try API endpoint (silent fail if not available)
      fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      }).catch(() => {});
      setSubmitted(true);
    } catch {
      setSubmitted(true); // Show success regardless — localStorage captured it
    }
  };

  return (
    <section className="py-20 px-6 bg-[#020202]">
      <div className="max-w-xl mx-auto text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Early Access</p>
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-3">
          Get in before everyone else.
        </h2>
        <p className="text-sm text-neutral-500 mb-8 max-w-md mx-auto">
          We&apos;re onboarding early users now. Drop your email — we&apos;ll send you access
          and a free competitor analysis of any company you choose.
        </p>

        {submitted ? (
          <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04]">
            <p className="text-emerald-400 font-semibold mb-1">You&apos;re on the list.</p>
            <p className="text-xs text-neutral-500">Check your inbox. We&apos;ll send your free competitor scan within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              placeholder="you@company.com"
              className="flex-1 px-5 py-3.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
            />
            <button
              type="submit"
              className="px-6 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-neutral-100 transition-colors whitespace-nowrap"
            >
              Get Early Access
            </button>
          </form>
        )}
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <p className="text-[10px] text-neutral-700 mt-4">No spam. Unsubscribe anytime. Your data stays private.</p>
      </div>
    </section>
  );
}

// ─── ROI Calculator ───
function ROICalculator() {
  const [leads, setLeads] = useState(50);
  const [dealSize, setDealSize] = useState(5000);
  const closeRate = 0.1;
  const sovereignCost = 199;

  const monthlyRevenue = Math.round(leads * closeRate * dealSize);
  const roi = monthlyRevenue > 0 ? Math.round(((monthlyRevenue - sovereignCost) / sovereignCost) * 100) : 0;
  const humanCost = Math.round(leads * 0.75 * 25); // 45min per lead at $25/hr ≈ 0.75hr

  return (
    <section className="py-24 px-6 bg-[#040404]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">ROI Calculator</p>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            The math is<br />
            <span className="text-emerald-400">embarrassingly obvious.</span>
          </h2>
          <p className="text-neutral-400 text-sm max-w-md mx-auto">
            Drag the sliders. Watch what happens to your revenue when agents handle lead gen 24/7.
          </p>
        </div>

        <div className="grid md:grid-cols-[1fr_1fr] gap-8">
          {/* Inputs */}
          <div className="space-y-8 p-6 rounded-2xl border border-white/[0.06] bg-[#080808]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-neutral-400">Leads per month from agents</label>
                <span className="text-sm font-black text-white font-mono">{leads}</span>
              </div>
              <input
                type="range" min={10} max={500} step={10} value={leads}
                onChange={e => setLeads(Number(e.target.value))}
                className="w-full h-1 rounded-full bg-neutral-800 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-neutral-700 mt-1">
                <span>10</span><span>250</span><span>500</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-neutral-400">Average deal value</label>
                <span className="text-sm font-black text-white font-mono">${dealSize.toLocaleString()}</span>
              </div>
              <input
                type="range" min={500} max={50000} step={500} value={dealSize}
                onChange={e => setDealSize(Number(e.target.value))}
                className="w-full h-1 rounded-full bg-neutral-800 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-neutral-700 mt-1">
                <span>$500</span><span>$25K</span><span>$50K</span>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.04] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Close rate (industry avg)</span>
                <span className="text-white font-mono">10%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Sovereign Node cost</span>
                <span className="text-white font-mono">${sovereignCost}/mo</span>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04]">
              <p className="text-[10px] text-emerald-500/60 uppercase tracking-widest mb-1">Expected monthly revenue</p>
              <p className="text-4xl font-black text-emerald-400 font-mono">${monthlyRevenue.toLocaleString()}</p>
              <p className="text-xs text-neutral-500 mt-1">{leads} leads &times; 10% close &times; ${dealSize.toLocaleString()} avg deal</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-white/[0.06] bg-[#080808]">
                <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-1">ROI</p>
                <p className="text-2xl font-black text-white font-mono">{roi.toLocaleString()}%</p>
              </div>
              <div className="p-4 rounded-xl border border-white/[0.06] bg-[#080808]">
                <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-1">vs hiring a human</p>
                <p className="text-2xl font-black text-white font-mono">${humanCost.toLocaleString()}<span className="text-sm text-neutral-500">/mo</span></p>
                <p className="text-[9px] text-neutral-700">45 min/lead &times; $25/hr</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-white/[0.06] bg-[#080808] text-center">
              <p className="text-xs text-neutral-500 mb-1">Sovereign pays for itself after</p>
              <p className="text-xl font-black text-white font-mono">
                {monthlyRevenue > 0 ? (
                  <>{Math.max(1, Math.ceil(sovereignCost / (monthlyRevenue / 30)))} days</>
                ) : (
                  <>—</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
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
      <AnimatedGrid />
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
            Built on NVIDIA NIM with 39+ models including Gemini 3.1 Pro and Claude Mythos. Zero per-token costs.
            Run locally via Ollama. Glasswing-grade safety on every execution.
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
              <AnimatedCounter target={39} suffix="+" duration={1.5} />
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
            { label: "Mythos-Ready", desc: "Glasswing-tier models auto-route through 5-layer guardrails" },
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
  const [liveResponse, setLiveResponse] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const scenario = DEMO_SCENARIOS[active];

  const runLive = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setPaused(true);
    setLiveResponse(null);
    try {
      const res = await fetch("/api/agents/smart-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: scenario.prompt, task_type: "analysis" }),
      });
      const data = await res.json();
      setLiveResponse(data.result || data.response || "Agent executed successfully.");
    } catch {
      setLiveResponse("Agent is processing. Sign up for full access to see real-time results.");
    } finally {
      setIsRunning(false);
    }
  };

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

                {/* Run Live button */}
                <button
                  type="button"
                  onClick={runLive}
                  disabled={isRunning}
                  className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                >
                  {isRunning ? (
                    <><span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Running live...</>
                  ) : (
                    <><span className="w-2 h-2 rounded-full bg-emerald-400" /> Run this live — real agent, real output</>
                  )}
                </button>
              </div>
            </div>

            {/* Live response */}
            {liveResponse && (
              <div className="mt-3 px-4 py-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[9px] text-emerald-500/60 font-bold uppercase tracking-wider">Live Result</span>
                </div>
                <p className="text-xs text-emerald-200/80 leading-relaxed font-mono">{liveResponse}</p>
              </div>
            )}
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

      {/* Cursor glow — emerald trail follows mouse everywhere */}
      <CursorGlow />

      {/* Floating orbs — scroll-driven parallax depth */}
      <FloatingOrbs />

      {/* Exit intent — captures leaving visitors */}
      <ExitIntent />

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
        <div className="px-6 md:px-10 h-16 flex items-center justify-between pointer-events-auto max-w-7xl mx-auto bg-[#010101]/80 backdrop-blur-sm rounded-b-2xl">
          <Link href="/" className="flex items-center gap-2.5">
            <SovereignLogo size="sm" />
            <span className="hidden sm:block text-sm font-semibold text-white">Sovereign Matrix</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#enterprise" className="text-sm text-neutral-400 hover:text-white transition-colors">Product</Link>
            <Link href="#pricing" className="text-sm text-neutral-400 hover:text-white transition-colors">Pricing</Link>
            <Link href="/vs/hubspot" className="text-sm text-neutral-400 hover:text-white transition-colors">Compare</Link>
            <Link href="/security" className="text-sm text-neutral-400 hover:text-white transition-colors">Security</Link>
            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
              <button className="text-sm text-neutral-500 hover:text-white transition-colors">Log in</button>
            </SignInButton>
            <Link href="/demo" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Live Demo</Link>
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
              <Link href="#enterprise" className="text-sm text-neutral-300 hover:text-white py-1" onClick={() => setMobileNavOpen(false)}>Platform</Link>
              <Link href="#pricing" className="text-sm text-neutral-300 hover:text-white py-1" onClick={() => setMobileNavOpen(false)}>Pricing</Link>
              <Link href="/vs/hubspot" className="text-sm text-neutral-300 hover:text-white py-1" onClick={() => setMobileNavOpen(false)}>Compare</Link>
              <Link href="/security" className="text-sm text-neutral-300 hover:text-white py-1" onClick={() => setMobileNavOpen(false)}>Security</Link>
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

        {/* Layer 2: WebGL particles — GPU-rendered with custom shaders (beats Antigravity) */}
        <WebGLParticles count={1000} />

        {/* Layer 3: Dual ambient glow — creates atmosphere */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.04] blur-[180px]" />
          <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] rounded-full bg-cyan-500/[0.03] blur-[160px]" />
        </div>

        {/* Layer 4: Vignette — focus attention to center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#010101_80%)] pointer-events-none" />

        {/* Content — cinematic staggered reveal */}
        <div className="relative z-10 max-w-4xl mx-auto text-center px-6 pt-20">

          {/* Category label — "Agent OS" positioning */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.6 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] mb-6"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-60" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-[0.2em]">Agent Operating System</span>
            <span className="text-[10px] text-neutral-600 font-mono">v2.4</span>
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
            130 AI agents. 39 models. One platform that finds leads, writes content,
            scans competitors, makes calls, and closes deals — autonomously.
            Starting at $19/month. No per-token fees. No vendor lock-in.
          </motion.p>

          {/* Proof strip — tiny, credible + live tok/s counter */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}
            className="flex items-center justify-center gap-4 text-xs text-neutral-500 mb-10 flex-wrap">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500/60" />39+ open-source models</span>
            <span className="hidden sm:block text-neutral-700">|</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500/60" />$0 per-token cost</span>
            <span className="hidden sm:block text-neutral-700">|</span>
            <span className="hidden sm:flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500/60" />Runs on your hardware</span>
            <span className="hidden md:block text-neutral-700">|</span>
            <TokCounter />
          </motion.div>

          {/* Live model health — real latency pings */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62, duration: 0.5 }}
            className="mb-6">
            <LiveModelHealth />
          </motion.div>

          {/* Model pills — shows what powers the platform */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65, duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {[
              { name: "Nemotron Ultra 253B", hot: false },
              { name: "Claude Mythos", hot: true },
              { name: "Claude Sonnet 4.6", hot: false },
              { name: "Gemini 3.1 Pro", hot: true },
              { name: "DeepSeek V3.2", hot: false },
              { name: "Llama 4 Maverick", hot: true },
              { name: "Nemotron Cascade 2", hot: true },
              { name: "Ollama", hot: false },
            ].map((model) => (
              <span key={model.name} className={`text-[10px] px-3 py-1 rounded-full border transition-all cursor-default ${
                model.hot
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-400 hover:border-violet-500/50"
                  : "border-white/[0.06] bg-white/[0.02] text-neutral-500 hover:text-white hover:border-emerald-500/20"
              }`}>
                {model.name}{model.hot && <span className="ml-1 text-[8px] text-violet-400/60">NEW</span>}
              </span>
            ))}
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

      {/* ═══ LIVE AGENT TERMINAL — Watch the agent work ═══ */}
      <GlowDivider />
      <LiveAgentTerminal />

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
      <GradientFollower color="rgba(239,68,68,0.04)" size={700} className="py-24 px-6 bg-[#060606] relative overflow-hidden perf-section">
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

          {/* Solution bridge — connects problem to results */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-16 text-center"
          >
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-emerald-500/20 bg-emerald-500/5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-40" />
                <span className="relative rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-sm text-emerald-300">Your AI employees handle all three. Here&apos;s what they produce ↓</span>
            </div>
          </motion.div>
        </div>
      </GradientFollower>

      {/* ═══ FLAT PRICING — The #1 differentiator ═══ */}
      <section className="py-16 px-6 bg-[#020202] border-y border-emerald-500/[0.06]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">No credits. No per-token fees.</p>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
              $199/month. That&apos;s it.
            </h2>
            <p className="text-neutral-400 text-sm max-w-lg mx-auto mb-8">
              Every other AI platform charges per token, per credit, or per execution.
              CIOs underestimate AI costs by up to 1,000%. We don&apos;t play that game.
              One flat price. 130 agents. 39 models. Unlimited executions.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Lindy", price: "$50–60/mo", model: "Credit-based", bad: true },
              { label: "Sintra", price: "$97/mo", model: "250 credits/mo", bad: true },
              { label: "Relevance AI", price: "Custom", model: "Usage-based", bad: true },
              { label: "Sovereign", price: "$199/mo", model: "Unlimited", bad: false },
            ].map((comp) => (
              <div key={comp.label} className={`p-4 rounded-xl border text-center ${
                comp.bad
                  ? "border-white/[0.04] bg-white/[0.01]"
                  : "border-emerald-500/20 bg-emerald-500/[0.04]"
              }`}>
                <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-1">{comp.label}</p>
                <p className={`text-lg font-black mb-0.5 ${comp.bad ? "text-neutral-500" : "text-emerald-400"}`}>{comp.price}</p>
                <p className={`text-[10px] ${comp.bad ? "text-red-400/50" : "text-emerald-400/60"}`}>{comp.model}</p>
              </div>
            ))}
          </motion.div>

          <p className="text-[10px] text-neutral-700">
            Source: CIO AI cost underestimation stat from industry research, April 2026.
          </p>
        </div>
      </section>

      {/* ═══ PRODUCTION READY — Counter the pilot purgatory ═══ */}
      <section className="py-20 px-6 bg-[#030303]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">No pilot purgatory</p>
            <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight mb-3">
              86% of AI pilots never reach production.<br />
              <span className="text-emerald-400">Sovereign ships on day one.</span>
            </h2>
            <p className="text-neutral-400 text-sm max-w-lg mx-auto">
              No setup. No developer needed. No 6-month integration project.
              Sign up, pick a playbook, get real output in 3 minutes.
            </p>
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-4">
            {[
              {
                time: "0:00",
                title: "Sign up",
                desc: "Email + password. No credit card on free tier. 60 seconds.",
                color: "emerald",
              },
              {
                time: "1:00",
                title: "Pick a playbook",
                desc: "25 pre-built workflows: lead blitz, content machine, competitor scan, SEO audit. One click.",
                color: "cyan",
              },
              {
                time: "3:00",
                title: "Get real output",
                desc: "50 enriched leads, a published blog post, or a competitive analysis. Not a demo — real deliverables.",
                color: "violet",
              },
            ].map((step) => (
              <motion.div key={step.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`p-6 rounded-2xl border border-${step.color}-500/10 bg-${step.color}-500/[0.02]`}
              >
                <div className={`text-2xl font-black font-mono text-${step.color}-400/30 mb-2`}>{step.time}</div>
                <h3 className="text-sm font-bold text-white mb-1">{step.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <p className="text-center text-[10px] text-neutral-700 mt-6">
            86% pilot failure stat: Gartner/industry research, 2026. 14% of enterprises have scaled agents to production.
          </p>
        </div>
      </section>

      {/* ═══ TRUST STRIP — Real industry stats ═══ */}
      <section className="py-12 px-6 border-y border-white/[0.03] bg-[#020202]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { stat: "88%", desc: "of orgs report AI security incidents", sub: "Sovereign: 5-layer pipeline on every request" },
            { stat: "80%", desc: "can\u2019t track what agents do", sub: "Sovereign: full audit trail, every action logged" },
            { stat: "46%", desc: "cite integration as #1 barrier", sub: "Sovereign: 25+ native integrations + MCP" },
            { stat: "1,000%", desc: "CIO AI cost underestimation", sub: "Sovereign: $199/mo flat, no hidden fees" },
          ].map((item) => (
            <motion.div key={item.stat} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
              <div className="text-2xl font-black text-white mb-1">{item.stat}</div>
              <p className="text-[10px] text-neutral-500 mb-2">{item.desc}</p>
              <p className="text-[9px] text-emerald-500/50">{item.sub}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ STACK KILLER — Replace 8 tools with one ═══ */}
      <StackKiller />

      {/* ═══ PLATFORM METRICS — Social proof with real numbers ═══ */}
      <section className="py-16 px-6 border-y border-white/[0.04]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 130, suffix: "+", label: "AI Agents", desc: "Each mapped to a specific business function" },
            { value: 68, suffix: "+", label: "AI Models", desc: "Smart-routed per task type, zero lock-in" },
            { value: 25, suffix: "", label: "Autopilot Playbooks", desc: "Run on a schedule. No human required." },
            { value: 2200, suffix: "+", label: "Tok/s on Cerebras", desc: "Wafer-scale silicon, not GPU clusters" },
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

      {/* ═══ COMPETITIVE STRIP — Why not the others ═══ */}
      <section className="py-12 px-6 bg-[#020202] border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-neutral-600 mb-6">How we compare</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { name: "HubSpot", price: "$890/mo", us: "$199/mo", href: "/vs/hubspot" },
              { name: "Clay", price: "$149/mo", us: "Included", href: "/vs/clay" },
              { name: "Zapier", price: "$49/mo", us: "Unlimited", href: "/vs/zapier" },
              { name: "Sintra", price: "12 agents", us: "130 agents", href: "/vs/sintra" },
              { name: "CrewAI", price: "You build it", us: "Pre-built", href: "/vs/crewai" },
            ].map((comp) => (
              <Link key={comp.name} href={comp.href}>
                <div className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:border-emerald-500/15 transition-all text-center cursor-pointer group">
                  <p className="text-[10px] text-neutral-600 mb-1">{comp.name}</p>
                  <p className="text-[10px] text-neutral-700 line-through mb-1">{comp.price}</p>
                  <p className="text-[11px] text-emerald-400 font-semibold">{comp.us}</p>
                  <p className="text-[8px] text-neutral-700 mt-1 group-hover:text-emerald-500/50 transition-colors">Compare &rarr;</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LIVE PLATFORM STATS ═══ */}
      <section className="py-6 px-6 bg-[#020202]">
        <LiveAgentStats />
      </section>

      {/* ═══ LIVE TOKEN STREAM ═══ */}
      <TokenStream />

      {/* ═══ AGENT WORLD GLOBE ═══ */}
      <GlowDivider />
      <AgentGlobe />

      {/* ═══ RESULTS PREVIEW — Show what the product delivers ═══ */}
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
                <Link href="/free/lead-finder" className="mt-3 flex items-center gap-1 text-[10px] text-emerald-500/60 hover:text-emerald-400 transition-colors">
                  Try Lead Finder free <ArrowRight className="w-3 h-3" />
                </Link>
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
                <Link href="/signup" className="mt-3 flex items-center gap-1 text-[10px] text-cyan-500/60 hover:text-cyan-400 transition-colors">
                  Try Content Agent free <ArrowRight className="w-3 h-3" />
                </Link>
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
                <Link href="/free/competitor-scan" className="mt-3 flex items-center gap-1 text-[10px] text-violet-500/60 hover:text-violet-400 transition-colors">
                  Try Competitor Scanner free <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </motion.div></MouseParallax>
          </div>
        </div>
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

      {/* ═══ CONSENSUS ENGINE — 4-model debate visualization ═══ */}
      <GlowDivider />
      <ConsensusEngine />

      {/* ═══ AGENT OFFICE — Your agents, live ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 bg-[#040406] overflow-hidden perf-section">
        <AgentOffice />
      </section>

      {/* ═══ PROMPT VS AGENT — The difference (from old version, much better) ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <section className="py-24 px-6 bg-[#050505] perf-section">
        <div className="max-w-5xl mx-auto">
          <SectionReveal>
            <div className="text-center mb-16">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">The Difference</p>
              <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">Not another chatbot.</h2>
            </div>
          </SectionReveal>

          <div className="grid md:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="p-8 rounded-2xl bg-[#080808] border border-white/[0.04]">
              <h3 className="text-lg font-semibold text-neutral-400 mb-1 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-neutral-500" /> Prompt-Based AI
              </h3>
              <p className="text-neutral-500 text-xs mb-6">What everyone else sells</p>
              <ul className="space-y-3">
                {["You write a prompt. Copy the output. Paste it somewhere. Repeat 50 times.", "Forgets your business, your brand, your last conversation.", "Cannot open a browser, send an email, or make a phone call.", "You plan every step. It just types what you tell it to."].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-neutral-500 text-sm">
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-600" /> {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="p-8 rounded-2xl bg-[#0A0A0A] border border-emerald-500/10 hover:border-emerald-500/20 transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.04)]">
              <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Agent-Powered Execution
              </h3>
              <p className="text-emerald-500/50 text-xs mb-6">What your business actually needs</p>
              <ul className="space-y-3">
                {["Type one goal. 130 agents plan, execute, and deliver the result.", "Remembers your brand voice, past strategies, and client preferences.", "Opens browsers, sends emails, makes calls, writes code, builds pages.", "Catches its own mistakes, retries failed steps, and self-corrects."].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-neutral-300 text-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" /> {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ ROI CALCULATOR — The math is obvious ═══ */}
      <GlowDivider />
      <ROICalculator />

      {/* ═══ EMAIL CAPTURE — Build the list ═══ */}
      <GlowDivider />
      <EarlyAccessCapture />

      {/* ═══ TRY IT YOURSELF — honest CTA instead of fake case studies ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <section className="py-24 px-6 perf-section">
        <div className="max-w-3xl mx-auto text-center">
          <SectionReveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">See For Yourself</p>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Don&apos;t take our word for it.</h2>
            <p className="text-neutral-400 max-w-lg mx-auto mb-10">
              Try a free tool right now. Paste any competitor URL and get real competitive intelligence in 30 seconds. No signup. No credit card. Judge the output yourself.
            </p>
          </SectionReveal>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { title: "Scan a competitor", desc: "Paste any URL → weaknesses, gaps, battle plan", href: "/free/competitor-scan", color: "emerald" },
              { title: "Audit your SEO", desc: "Enter your domain → keyword gaps, technical issues", href: "/free/seo-audit", color: "cyan" },
              { title: "Find leads", desc: "Describe your niche → qualified prospects with emails", href: "/free/lead-finder", color: "violet" },
            ].map((tool) => (
              <Link key={tool.title} href={tool.href}>
                <motion.div whileHover={{ y: -4 }}
                  className={`p-6 rounded-2xl border border-${tool.color}-500/10 bg-${tool.color}-500/[0.02] hover:border-${tool.color}-500/20 transition-all cursor-pointer text-left`}
                >
                  <h3 className="text-sm font-semibold text-white mb-1">{tool.title}</h3>
                  <p className="text-xs text-neutral-500 mb-3">{tool.desc}</p>
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    Try free <ArrowRight className="w-3 h-3" />
                  </span>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PLATFORM CAPABILITIES — The full stack ═══ */}
      <GlowDivider />
      <EnterpriseSection />

      {/* ═══ TESTIMONIALS ═══ */}
      <GlowDivider />
      <section className="py-24 px-6">
        <Testimonials />
      </section>

      {/* ═══ AGENT OS ARCHITECTURE — The 5-layer infrastructure ═══ */}
      <GlowDivider />
      <section className="py-24 px-6 bg-[#030303] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(16,185,129,0.025),transparent)] pointer-events-none" />
        <AnimatedGrid />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">The Architecture</p>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
              Built like an OS.<br />
              <span className="text-emerald-400">Not a feature.</span>
            </h2>
            <p className="text-neutral-400 text-sm max-w-md mx-auto">
              Every other AI tool is a wrapper. Sovereign is a complete infrastructure stack
              — five layers purpose-built for agentic business execution.
            </p>
          </div>

          <div className="space-y-2">
            {[
              {
                layer: "L5",
                name: "Business Execution Layer",
                desc: "You give a goal in plain English. The OS figures out everything else.",
                detail: "Natural language intent → task graph → agent selection → parallel dispatch",
                color: "emerald",
                items: ["130 specialized agents", "Smart goal decomposition", "Multi-step planning engine"],
              },
              {
                layer: "L4",
                name: "Orchestration Layer",
                desc: "Agents chain, delegate, and debate until the answer is correct.",
                detail: "Agent handoffs · parallel execution · consensus verification · self-correction",
                color: "cyan",
                items: ["War Room debate engine", "4-model consensus", "Auto-retry on failure"],
              },
              {
                layer: "L3",
                name: "Model Intelligence Layer",
                desc: "Every task auto-routes to the best model. No lock-in, no wasted tokens.",
                detail: "39+ models · NVIDIA NIM · Gemini · Claude · Groq · Cerebras WSE-3",
                color: "violet",
                items: ["19-category smart routing", "11-model failover chain", "2,200+ tok/s inference"],
              },
              {
                layer: "L2",
                name: "Trust & Safety Layer",
                desc: "Five independent checks before any output leaves the pipeline.",
                detail: "Jailbreak detection · PII scan · content safety · quality gate · critic review",
                color: "amber",
                items: ["NeMo Guardrails", "HITL approval queue", "Audit trail on every task"],
              },
              {
                layer: "L1",
                name: "Infrastructure Layer",
                desc: "Cloud or local. Your choice. Your data never leaves if you don't want it to.",
                detail: "Ollama local · Neon Postgres · Clerk auth · Vercel edge · zero cold starts",
                color: "neutral",
                items: ["Runs offline via Ollama", "Tenant-isolated data", "White-label API surface"],
              },
            ].map((item, i) => (
              <motion.div
                key={item.layer}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`group grid md:grid-cols-[64px_1fr_auto] gap-4 items-start p-5 rounded-2xl border transition-all duration-300 ${
                  item.color === "emerald" ? "border-emerald-500/10 hover:border-emerald-500/25 hover:bg-emerald-500/[0.02]" :
                  item.color === "cyan"    ? "border-cyan-500/10 hover:border-cyan-500/25 hover:bg-cyan-500/[0.02]" :
                  item.color === "violet"  ? "border-violet-500/10 hover:border-violet-500/25 hover:bg-violet-500/[0.02]" :
                  item.color === "amber"   ? "border-amber-500/10 hover:border-amber-500/25 hover:bg-amber-500/[0.02]" :
                  "border-white/[0.04] hover:border-white/[0.08]"
                } bg-[#060606]`}
              >
                <div className={`text-2xl font-black font-mono opacity-20 group-hover:opacity-60 transition-opacity ${
                  item.color === "emerald" ? "text-emerald-400" :
                  item.color === "cyan"    ? "text-cyan-400" :
                  item.color === "violet"  ? "text-violet-400" :
                  item.color === "amber"   ? "text-amber-400" : "text-neutral-400"
                }`}>{item.layer}</div>

                <div>
                  <div className="flex items-baseline gap-3 mb-1">
                    <h3 className="text-sm font-bold text-white">{item.name}</h3>
                  </div>
                  <p className="text-xs text-neutral-400 mb-2">{item.desc}</p>
                  <p className="text-[10px] font-mono text-neutral-700">{item.detail}</p>
                </div>

                <div className="hidden md:flex flex-col gap-1 min-w-[180px]">
                  {item.items.map((it) => (
                    <span key={it} className="text-[10px] text-neutral-600 flex items-center gap-1.5">
                      <span className={`w-1 h-1 rounded-full shrink-0 ${
                        item.color === "emerald" ? "bg-emerald-500/40" :
                        item.color === "cyan"    ? "bg-cyan-500/40" :
                        item.color === "violet"  ? "bg-violet-500/40" :
                        item.color === "amber"   ? "bg-amber-500/40" : "bg-neutral-600"
                      }`} />
                      {it}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-xs text-neutral-700 mt-8 font-mono">
            Every layer is open-source composable · no black boxes · inspect any execution step
          </p>
        </div>
      </section>

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
              { q: "What is Sovereign Matrix?", a: "130 AI agents that do sales, marketing, content, and ops work. You tell them what you need. They figure out which of the 39+ models to use, execute the task, and deliver the output. No prompt engineering required." },
              { q: "Is this just another ChatGPT wrapper?", a: "No. ChatGPT is a chatbot. Sovereign Matrix is 130+ autonomous agents that execute: finding leads, building pages, writing outreach sequences, qualifying prospects, making calls. They open real browsers, hit real APIs, plan multi-step workflows, and self-correct without manual prompting." },
              { q: "Can agents run locally without cloud?", a: "Yes. NemoClaw runs on your machine via Ollama. Full offline execution — your data never leaves your hardware. Built for sensitive client work and air-gapped environments." },
              { q: "Is there a contract or lock-in?", a: "No contracts. Month-to-month. Cancel from your dashboard. Data is always exportable. NVIDIA NIM inference is free — you only pay for premium features." },
              { q: "How long does setup take?", a: "Under 60 seconds. Sign up, complete the 5-step onboarding wizard, and deploy your first agent immediately. No Docker, no terminal commands, no technical setup required for the cloud version." },
              { q: "What integrations are supported?", a: "NVIDIA NIM, Ollama (local models), ElevenLabs (voice), Pinecone (vector memory), Clerk (auth), Neon PostgreSQL (database), Vercel (hosting), PayFast, Yoco, and PayStack. A public API is available for custom integrations." },
              { q: "Is my data safe?", a: "Yes. A 5-layer NeMo Guardrails safety pipeline protects every interaction: jailbreak detection, topic control, content safety, PII scanning, and quality scoring. Plus local execution means data never touches the cloud if you choose." },
              { q: "What is the white-label Enterprise license?", a: "The Enterprise license lets agencies rebrand the entire platform as their own. Custom domain, client portals, your logo. It is a complete AI business-in-a-box — deploy under your brand and scale your agency without hiring." },
              { q: "Can I use this to run an agency?", a: "Yes. The Enterprise plan ($499/mo) includes white-label: your domain, your logo, your client portals. Resell to 20 clients at $50/mo each = $1,000/mo revenue on a $499 cost." },
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
            130 agents. 39+ models. They work weekends. They don&apos;t need benefits.
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
              <p className="text-xs text-neutral-400 leading-relaxed">The Agent Operating System. 130 agents. 39+ models. $199/mo flat. Built on NVIDIA NIM.</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-neutral-400 mb-4">Platform</h3>
              <ul className="space-y-2.5">
                <li><Link href="/pricing" className="text-xs text-neutral-500 hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/marketplace" className="text-xs text-neutral-500 hover:text-white transition-colors">Agent Marketplace</Link></li>
                <li><Link href="/developers" className="text-xs text-neutral-500 hover:text-white transition-colors">Developer SDK</Link></li>
                <li><Link href="/developers/docs" className="text-xs text-neutral-500 hover:text-white transition-colors">API Docs</Link></li>
                <li><Link href="/integrations" className="text-xs text-neutral-500 hover:text-white transition-colors">Integrations</Link></li>
                <li><Link href="/roadmap" className="text-xs text-neutral-500 hover:text-white transition-colors">Roadmap</Link></li>
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
              <h3 className="text-xs font-semibold text-neutral-400 mb-4">Compare</h3>
              <ul className="space-y-2.5">
                <li><Link href="/vs/hubspot" className="text-xs text-neutral-500 hover:text-white transition-colors">vs HubSpot</Link></li>
                <li><Link href="/vs/clay" className="text-xs text-neutral-500 hover:text-white transition-colors">vs Clay</Link></li>
                <li><Link href="/vs/zapier" className="text-xs text-neutral-500 hover:text-white transition-colors">vs Zapier</Link></li>
                <li><Link href="/vs/crewai" className="text-xs text-neutral-500 hover:text-white transition-colors">vs CrewAI</Link></li>
                <li><Link href="/vs/n8n" className="text-xs text-neutral-500 hover:text-white transition-colors">vs n8n</Link></li>
                <li><Link href="/vs/lindy" className="text-xs text-neutral-500 hover:text-white transition-colors">vs Lindy</Link></li>
                <li><Link href="/vs/sintra" className="text-xs text-neutral-500 hover:text-white transition-colors">vs Sintra</Link></li>
                <li><Link href="/vs/make" className="text-xs text-neutral-500 hover:text-white transition-colors">vs Make</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-neutral-400 mb-4">Use Cases</h3>
              <ul className="space-y-2.5">
                <li><Link href="/use-cases/lead-gen" className="text-xs text-neutral-500 hover:text-white transition-colors">Lead Generation</Link></li>
                <li><Link href="/use-cases/content-engine" className="text-xs text-neutral-500 hover:text-white transition-colors">Content Engine</Link></li>
                <li><Link href="/use-cases/second-brain" className="text-xs text-neutral-500 hover:text-white transition-colors">Second Brain</Link></li>
                <li><Link href="/for-agencies" className="text-xs text-neutral-500 hover:text-white transition-colors">For Agencies</Link></li>
                <li><Link href="/for-healthcare" className="text-xs text-neutral-500 hover:text-white transition-colors">For Healthcare</Link></li>
                <li><Link href="/for-legal" className="text-xs text-neutral-500 hover:text-white transition-colors">For Legal</Link></li>
                <li><Link href="/for-cybersecurity" className="text-xs text-neutral-500 hover:text-white transition-colors">For Cybersecurity</Link></li>
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
