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

// ─── Animated Energy Orb ───
function EnergyOrb() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
      {/* Core glow */}
      <div className="w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full bg-emerald-500/[0.03] blur-[120px] animate-pulse" />
      {/* Inner ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full border border-emerald-500/[0.06] animate-[spin_60s_linear_infinite]" />
      {/* Outer ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full border border-emerald-500/[0.03] animate-[spin_90s_linear_infinite_reverse]" />
      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div key={i} className="absolute w-1 h-1 bg-emerald-400/40 rounded-full animate-pulse"
          style={{
            top: `${20 + Math.sin(i * 1.2) * 40}%`,
            left: `${20 + Math.cos(i * 1.2) * 40}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${2 + i * 0.3}s`,
          }} />
      ))}
    </div>
  );
}

// ─── Capability Card ───
function CapabilityCard({ icon: Icon, title, desc, accent }: { icon: React.ElementType; title: string; desc: string; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="group relative"
    >
      <div className="relative p-8 rounded-2xl border border-white/[0.06] bg-[#080808] hover:border-white/[0.12] transition-all duration-500 overflow-hidden">
        {/* Hover glow */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br ${accent} to-transparent`} />

        <div className="relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-5 group-hover:border-white/20 transition-colors">
            <Icon className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-neutral-500 leading-relaxed">{desc}</p>
        </div>
      </div>
    </motion.div>
  );
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
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 pb-6' : 'max-h-0'}`}>
        <p className="text-sm text-neutral-500 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

// ─── Model Badge ───
function ModelBadge({ name, type }: { name: string; type: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
      <span className="text-xs font-medium text-neutral-300">{name}</span>
      <span className="text-[9px] text-neutral-600 uppercase">{type}</span>
    </div>
  );
}

export default function Home() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-emerald-500/20 font-sans antialiased">

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
            <Link href="/demo" className="text-xs text-neutral-500 hover:text-white transition-colors">Platform</Link>
            <Link href="/pricing" className="text-xs text-neutral-500 hover:text-white transition-colors">Pricing</Link>
            <Link href="/partner" className="text-xs text-neutral-500 hover:text-white transition-colors">Enterprise</Link>
            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
              <button className="text-xs text-neutral-500 hover:text-white transition-colors">Log in</button>
            </SignInButton>
            <Link href="/demo" className="px-4 py-1.5 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-all">
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
              <Link href="/demo" className="text-sm text-neutral-300 hover:text-white py-1" onClick={() => setMobileNavOpen(false)}>Platform</Link>
              <Link href="/pricing" className="text-sm text-neutral-300 hover:text-white py-1" onClick={() => setMobileNavOpen(false)}>Pricing</Link>
              <Link href="/partner" className="text-sm text-neutral-300 hover:text-white py-1" onClick={() => setMobileNavOpen(false)}>Enterprise</Link>
              <Link href="/demo" className="px-5 py-2.5 rounded-xl bg-white text-sm font-semibold text-black text-center mt-2" onClick={() => setMobileNavOpen(false)}>Get Started</Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ═══ HERO — The Superpower Moment ═══ */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">

        <EnergyOrb />

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.015)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Status badge */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.04] mb-10">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[11px] text-emerald-400/80 font-medium">109 Agents Live</span>
          </motion.div>

          {/* Headline */}
          <motion.h1 initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.9 }}
            className="text-[clamp(2.5rem,8vw,7rem)] font-black leading-[0.92] tracking-[-0.03em] mb-8">
            <span className="text-white">One platform.</span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400">
              Every agent.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.7 }}
            className="text-base md:text-lg text-neutral-500 max-w-xl mx-auto leading-relaxed mb-12">
            Content. SEO. Leads. Voice. Code. Vision. 109 AI agents that do the work —
            powered by Nemotron, Claude, and Gemini. Zero per-token cost.
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Link href="/demo" className="group flex items-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-all">
              Start Building <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/pricing" className="px-7 py-3.5 border border-white/10 text-neutral-300 font-medium rounded-full text-sm hover:border-white/20 hover:text-white transition-all">
              View Pricing
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
          </motion.div>

          {/* Interactive demo */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6 }}>
            <InteractiveHeroStrike />
          </motion.div>
        </div>
      </motion.section>

      {/* ═══ SOCIAL PROOF METRICS ═══ */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <SocialProofMetrics />
      </section>

      {/* ═══ WHAT IT DOES — 6 Capabilities ═══ */}
      <section className="py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Capabilities</p>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">What you can do with it.</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <CapabilityCard icon={Cpu} title="Browser Automation" desc="Point an agent at a website. It opens a real browser, navigates, extracts data, and reports back." accent="from-blue-500/[0.04]" />
            <CapabilityCard icon={BrainCircuit} title="Document Intelligence" desc="Upload PDFs, contracts, reports. Ask questions in plain English. Get answers from your data." accent="from-violet-500/[0.04]" />
            <CapabilityCard icon={Target} title="Sales Outreach" desc="Find prospects. Write personalized emails. Send sequences. Qualify responses. Book meetings." accent="from-emerald-500/[0.04]" />
            <CapabilityCard icon={Search} title="Competitor Intel" desc="Paste a URL. Get their tech stack, SEO gaps, content strategy, and moves you can make." accent="from-amber-500/[0.04]" />
            <CapabilityCard icon={Mic} title="Voice Agents" desc="AI makes calls, qualifies leads, books meetings. Sub-200ms response. Sounds human." accent="from-rose-500/[0.04]" />
            <CapabilityCard icon={Code2} title="Code & Deploy" desc="Describe what you want built. The agent writes code, reviews it, and prepares deployment." accent="from-cyan-500/[0.04]" />
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS — Architecture ═══ */}
      <section className="py-24 px-6 bg-[#050505] border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Architecture</p>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Built on models you control.</h2>
            <p className="text-neutral-500 max-w-xl mx-auto">Smart routing across 39 open-source models. Automatic failover. Zero vendor lock-in.</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { name: "Nemotron Ultra 253B", desc: "Complex reasoning & synthesis" },
              { name: "NemoClaw OS", desc: "Local hardware execution" },
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
                className="p-5 rounded-xl bg-[#0A0A0A] border border-white/[0.06] hover:border-emerald-500/15 transition-colors group">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 group-hover:bg-emerald-400 transition-colors" />
                  <p className="text-sm font-semibold text-white">{tech.name}</p>
                </div>
                <p className="text-xs text-neutral-600">{tech.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHY DIFFERENT — Comparison ═══ */}
      <section className="py-24 px-6 border-t border-white/[0.04]">
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
                {["Humans must prompt every step", "No memory between sessions", "Cannot use external tools", "Zero autonomous decision making"].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-neutral-500 text-sm">
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-700" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-8 rounded-2xl bg-[#0A0A0A] border border-emerald-500/10">
              <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sovereign Matrix
              </h3>
              <p className="text-emerald-500/50 text-xs mb-6">What we built</p>
              <ul className="space-y-3">
                {["Give a goal — agents plan and execute", "Persistent memory via vector DBs", "Controls browsers, hardware, APIs", "Self-correcting autonomous loops"].map((item, i) => (
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
      <section className="py-24 px-6 bg-[#050505] border-t border-white/[0.04]">
        <Testimonials />
      </section>

      {/* ═══ ENTERPRISE METRICS ═══ */}
      <section className="py-32 px-6 relative overflow-hidden border-t border-white/[0.04]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(16,185,129,0.03),transparent)]" />
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
              { metric: "109", label: "Specialized Agents", desc: "Purpose-built for specific business functions." },
              { metric: "39", label: "Open-Source Models", desc: "Automatic failover. Zero vendor lock-in." },
              { metric: "$0", label: "Per-Token Cost", desc: "Scale inference without scaling your bill." },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <div className="text-5xl md:text-6xl font-black text-white mb-2 tracking-tight">{item.metric}</div>
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
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
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
      <section id="pricing" className="py-24 border-t border-white/[0.04]">
        <Pricing />
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-24 px-6 bg-[#050505] border-t border-white/[0.04]">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-12 text-center tracking-tight">Common Questions</h2>
          <div className="rounded-2xl border border-white/[0.06] bg-[#080808] p-1">
            {[
              { q: "What is Sovereign Matrix?", a: "An AI agent platform with 109 specialized agents for sales, marketing, content, and operations. It routes tasks across multiple AI models and executes multi-step workflows autonomously." },
              { q: "Can agents run locally without cloud?", a: "Yes. The NemoClaw daemon runs on your local machine using Ollama models. You can execute workflows completely offline — your data never leaves your hardware." },
              { q: "Is there a contract or lock-in?", a: "No. All plans are month-to-month with no contracts. Cancel instantly from your dashboard. Your data is always exportable." },
              { q: "How is this different from ChatGPT or Jasper?", a: "Those are prompt-based tools — you type, they respond. Sovereign Matrix agents are autonomous — give them a goal and they plan, execute, and report back without step-by-step prompting." },
            ].map((faq, i) => <FAQItem key={i} question={faq.q} answer={faq.a} />)}
          </div>
        </motion.div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="py-32 text-center px-6 relative overflow-hidden border-t border-white/[0.04]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.04),transparent_70%)]" />
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative z-10">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-5 tracking-tight leading-[1.05]">
            Stop paying for tools<br className="hidden md:block" /> that don&apos;t scale.
          </h2>
          <p className="text-neutral-500 max-w-md mx-auto mb-10">
            One platform. 109 agents. Zero per-token costs. Free to start.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/demo" className="group flex items-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-all">
              Start Building <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/pricing" className="px-7 py-3.5 border border-white/10 text-neutral-300 font-medium rounded-full text-sm hover:border-white/20 hover:text-white transition-all">
              Compare Plans
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/[0.04] px-6">
        <div className="max-w-5xl mx-auto py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <SovereignLogo size="sm" />
                <span className="text-sm font-semibold text-white">Sovereign Matrix</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">AI agent platform. 109 agents, 39 models, one dashboard.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><Link href="/pricing" className="text-xs text-neutral-600 hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/demo" className="text-xs text-neutral-600 hover:text-white transition-colors">Demo</Link></li>
                <li><Link href="/dashboard" className="text-xs text-neutral-600 hover:text-white transition-colors">Dashboard</Link></li>
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
