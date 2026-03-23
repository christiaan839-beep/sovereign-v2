"use client";

import { motion } from "framer-motion";
import { BrainCircuit, CheckCircle2, Cpu, Globe, Target, ShieldAlert, ChevronDown, XCircle, DollarSign, MessageSquare, Activity, Zap, Lock } from "lucide-react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";

import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { Pricing } from "@/components/ui/Pricing";
import { ImmersiveNodeLayer } from "@/components/3d/ImmersiveNodeLayer";
import { ToolShowcase } from "@/components/ui/SocialProof";

import SovereignCalculator from "@/components/SovereignCalculator";
import { AgentOrgMap } from "@/components/dashboard/AgentOrgMap";

import VideoShowcase from "@/components/DeepfakeShowcase";
import { InteractiveHeroStrike } from "@/components/ui/InteractiveHeroStrike";
import { AIDemoShowcase } from "@/components/ui/AIDemoShowcase";
import { SocialProofMetrics } from "@/components/ui/SocialProofMetrics";

// ─── Animated Counter (counts up on scroll into view) ───
function AnimatedCounter({ end, suffix = "", label }: { end: number; suffix?: string; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1800;
        const startTime = performance.now();
        const animate = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.round(eased * end));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [end]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl md:text-5xl font-black text-white tracking-tight tabular-nums">
        {count}{suffix}
      </div>
      <div className="text-xs text-neutral-500 mt-2 uppercase tracking-widest font-semibold">{label}</div>
    </div>
  );
}

// ─── Live Agent Status Ticker ───
function AgentStatusTicker() {
  const agents = [
    { name: "SEO Dominator", status: "active" },
    { name: "Content Engine", status: "active" },
    { name: "Lead Qualifier", status: "active" },
    { name: "NemoClaw OS", status: "active" },
    { name: "Voice Dialer", status: "standby" },
    { name: "Code Reviewer", status: "active" },
    { name: "PII Guard", status: "active" },
    { name: "Meeting Notes", status: "standby" },
    { name: "Smart Router", status: "active" },
    { name: "Brand Audit", status: "active" },
    { name: "Doc Intel", status: "active" },
    { name: "Translator", status: "standby" },
  ];

  return (
    <div className="relative overflow-hidden w-full py-4">
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10" />
      <motion.div
        className="flex gap-3 whitespace-nowrap"
        animate={{ x: [0, -1200] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {[...agents, ...agents, ...agents].map((agent, i) => (
          <div key={i} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] text-xs font-medium text-neutral-400 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${agent.status === "active" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-amber-500/60"}`} />
            {agent.name}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5">
      <button
        className="w-full flex items-center justify-between py-6 text-left group"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm md:text-base font-medium text-white group-hover:text-neutral-400 transition-colors pr-4">{question}</span>
        <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 pb-6' : 'max-h-0'}`}>
        <p className="text-sm text-neutral-500 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
    <div className="min-h-screen bg-[#000000] text-white selection:bg-white/20 font-sans">
      
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 flex justify-center px-6 py-4 pointer-events-none">
         <div className="bg-[#0A0A0A]/80 backdrop-blur-xl border border-white/10 rounded-full px-6 h-14 flex items-center justify-between pointer-events-auto w-full max-w-5xl transition-all duration-300">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <SovereignLogo size="sm" />
            <span className="hidden sm:block text-sm font-semibold tracking-wide text-white group-hover:text-neutral-300 transition-colors">Sovereign Matrix</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
             <Link href="/demo" className="text-xs font-semibold tracking-wide text-neutral-400 hover:text-white transition-colors">Platform</Link>
             <Link href="/pricing" className="text-xs font-semibold tracking-wide text-neutral-400 hover:text-white transition-colors">Pricing</Link>
             <Link href="/partner" className="text-xs font-semibold tracking-wide text-neutral-400 hover:text-white transition-colors">Enterprise</Link>
             <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
               <button className="text-xs font-semibold tracking-wide text-neutral-400 hover:text-white transition-colors">Log in</button>
             </SignInButton>
             <Link href="/demo" className="relative px-5 py-2 rounded-full bg-white text-xs font-bold text-black hover:bg-neutral-100 transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-[1.03]">
               Deploy Now
             </Link>
          </div>
          
          <button className="md:hidden flex flex-col gap-1.5 p-2" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle menu">
            <span className={`w-5 h-[1.5px] bg-white transition-all ${mobileNavOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`w-5 h-[1.5px] bg-white transition-all ${mobileNavOpen ? 'opacity-0' : ''}`} />
            <span className={`w-5 h-[1.5px] bg-white transition-all ${mobileNavOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>

        {mobileNavOpen && (
          <div className="absolute top-20 left-6 right-6 p-6 rounded-2xl md:hidden bg-[#0A0A0A] border border-white/10 flex flex-col gap-4 shadow-2xl pointer-events-auto">
            <Link href="/demo" className="text-sm font-medium text-neutral-300 hover:text-white" onClick={() => setMobileNavOpen(false)}>Platform</Link>
            <Link href="/pricing" className="text-sm font-medium text-neutral-300 hover:text-white" onClick={() => setMobileNavOpen(false)}>Pricing</Link>
            <Link href="/partner" className="text-sm font-medium text-neutral-300 hover:text-white" onClick={() => setMobileNavOpen(false)}>Enterprise</Link>
            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
              <button className="text-sm font-medium text-neutral-300 hover:text-white text-left" onClick={() => setMobileNavOpen(false)}>Log in</button>
            </SignInButton>
            <Link href="/demo" className="px-5 py-3 rounded-xl bg-white text-sm font-bold text-black text-center mt-4" onClick={() => setMobileNavOpen(false)}>Deploy Now</Link>
          </div>
        )}
      </nav>

      <main className="pt-40 pb-20 px-6 relative overflow-hidden flex flex-col items-center min-h-[95vh] justify-center">
         <div className="absolute inset-0 pointer-events-none z-0">
           {/* Premium gradient system — subtle, layered, cinematic */}
           <div className="absolute top-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-indigo-950/30 blur-[180px]" />
           <div className="absolute top-[10%] right-[-10%] w-[35%] h-[35%] rounded-full bg-emerald-950/20 blur-[150px]" />
           <div className="absolute bottom-[-15%] left-[-5%] w-[40%] h-[40%] rounded-full bg-cyan-950/15 blur-[160px]" />
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04),transparent_50%)]" />
           <div className="absolute inset-0 noise-overlay" />
         </div>

        <ImmersiveNodeLayer />

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="relative z-10 w-full max-w-5xl mx-auto text-center">
          
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 text-xs font-semibold tracking-wide mb-10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_20px_rgba(255,255,255,0.02)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
            </span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-300">100% Data Sovereignty</span>
          </motion.div>

          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black mb-8 leading-[1.02] tracking-tighter text-white drop-shadow-2xl">
            Your Agents.<br/>
            <span className="bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_6s_ease-in-out_infinite] bg-gradient-to-r from-white via-neutral-400 to-white">
              Your Infrastructure.
            </span>
          </h1>

          <p className="text-base md:text-xl text-neutral-500 max-w-2xl mx-auto leading-relaxed mb-14 font-normal">
            Deploy 100+ AI agents across sales, marketing, and operations. Open-source models. Zero inference costs. Your infrastructure, your data.
          </p>

          <div className="mb-20">
            <InteractiveHeroStrike />
          </div>

          <div className="w-full max-w-6xl mx-auto mb-20 hidden md:block">
            {/* Gradient border card — $100M aesthetic */}
            <div className="relative rounded-2xl p-[1px] bg-gradient-to-b from-white/15 via-white/5 to-transparent">
              <div className="rounded-2xl bg-[#0A0A0A] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#080808]">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500 font-mono">Live Agent Network</span>
                  </div>
                  <span className="text-[10px] text-neutral-600 font-mono">106 agents deployed</span>
                </div>
                <div className="p-4">
                  <AgentOrgMap />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-16 max-w-4xl mx-auto">
              {[
                { icon: Lock, label: "Open-Source Architecture", color: "text-emerald-400" },
                { icon: Cpu, label: "39 NVIDIA NIM Models", color: "text-cyan-400" },
                { icon: Zap, label: "Zero Inference Costs", color: "text-amber-400" },
                { icon: Activity, label: "4-Layer Safety Pipeline", color: "text-violet-400" },
              ].map((badge) => (
                <div key={badge.label} className="flex items-center gap-2 text-[10px] md:text-xs font-semibold text-neutral-300 border border-white/10 bg-white/[0.02] backdrop-blur-md px-4 py-2 rounded-full hover:bg-white/[0.04] transition-colors cursor-default">
                  <badge.icon className={`w-3.5 h-3.5 ${badge.color}`} />
                  {badge.label}
                </div>
              ))}
           </div>

          {/* Live Agent Ticker */}
          <div className="w-full max-w-4xl mx-auto mb-16">
            <AgentStatusTicker />
          </div>

          {/* Animated Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-3xl mx-auto mb-20 py-8 px-6 rounded-2xl border border-white/5 bg-white/[0.01]"
          >
            <AnimatedCounter end={100} suffix="+" label="AI Agents" />
            <AnimatedCounter end={39} label="NIM Models" />
            <AnimatedCounter end={12} label="Languages" />
            <AnimatedCounter end={0} suffix="ms" label="Cold Start" />
          </motion.div>

          <SocialProofMetrics />
          
          <div className="w-full max-w-5xl mx-auto mb-20 mt-20">
             <AIDemoShowcase />
          </div>

        </motion.div>

        <div className="w-full max-w-7xl mx-auto relative z-10 mt-10">
           <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Enterprise Infrastructure</h2>
              <p className="text-neutral-500 text-sm">Four core systems working in absolute unison.</p>
            </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
              {[
                { icon: BrainCircuit, title: "Enterprise RAG Pipeline", desc: "Ground every AI response in your actual business data using vector retrieval and 120B-parameter reasoning models." },
                { icon: Target, title: "Local Edge Execution", desc: "Run agents locally from your terminal with zero cloud dependency. Full offline capability via the OpenClaw daemon." },
                { icon: Globe, title: "Voice Agent Pipeline", desc: "Deploy AI voice agents for outbound calls with sub-200ms latency. Automated qualification, booking, and follow-up." },
                { icon: ShieldAlert, title: "Safety & Guardrails", desc: "4-layer pipeline: jailbreak detection, content safety, PII redaction, and output quality scoring. Every agent, automatically." }
              ].map((feature, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6 }}
                  className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl group hover:border-white/15 hover:bg-white/[0.04] transition-all duration-500 backdrop-blur-xl relative overflow-hidden shadow-2xl hover:shadow-[0_8px_40px_rgba(255,255,255,0.03)] hover:-translate-y-1">
                  <div className="absolute -top-6 -right-6 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-700">
                    <feature.icon className="w-40 h-40 text-white" />
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative z-10 shadow-inner group-hover:border-white/20 transition-colors duration-500">
                    <feature.icon className="w-5 h-5 text-white group-hover:text-emerald-300 transition-colors duration-500" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3 tracking-tight relative z-10">{feature.title}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed font-medium relative z-10">{feature.desc}</p>
                </motion.div>
              ))}
           </div>
        </div>

        <div className="w-full max-w-7xl mx-auto relative z-10 mt-32 mb-24">
          <div className="text-center mb-16">
             <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">What The Agents Actually Do.</h2>
             <p className="text-neutral-500 max-w-2xl mx-auto">Each capability runs on real infrastructure — no simulations, no placeholders. Open-source models you own.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Cpu, title: "Desktop Automation", desc: "Agents control headless browsers to research competitors, scrape public data, and execute multi-step workflows autonomously.", tag: "DAEMON" },
              { icon: BrainCircuit, title: "Private Document RAG", desc: "Upload corporate documents and run vector analysis locally. Your data never leaves your infrastructure. Zero per-token API fees.", tag: "LOCAL VECTOR" },
              { icon: Target, title: "Outbound Sales Engine", desc: "Augment your sales team with AI-powered prospecting, personalized email sequences, and automated lead qualification.", tag: "OUTBOUND" },
              { icon: ShieldAlert, title: "Spatial Analytics", desc: "Connect video feeds for real-time spatial analysis. Foot traffic counting, occupancy monitoring, and behavioral analytics for retail.", tag: "ANALYTICS" },
              { icon: Globe, title: "AI Code Generation", desc: "Generate, review, and commit production code using local models. Integrated with your existing git workflow and CI/CD pipelines.", tag: "CODING" },
              { icon: MessageSquare, title: "Mobile Command", desc: "Control your agent swarm from Telegram or WhatsApp. Trigger competitive analysis, generate reports, or deploy campaigns on the go.", tag: "MOBILE" },
            ].map((feature, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="bg-[#050505] p-8 border border-white/5 hover:border-white/15 rounded-3xl transition-all duration-500 shadow-xl hover:shadow-[0_4px_30px_rgba(255,255,255,0.02)] hover:-translate-y-0.5 group">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shadow-inner">
                    <feature.icon className="w-4 h-4 text-white drop-shadow-md" />
                  </div>
                   <span className="text-[9px] uppercase tracking-widest text-neutral-400 font-bold border border-white/10 bg-white/5 backdrop-blur-md px-3 py-1 rounded-full">{feature.tag}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">{feature.title}</h3>
                <p className="text-sm text-neutral-400 font-medium leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* Section divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <section className="py-32 bg-[#050505] px-6">
         <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-600 mb-4">The Difference</p>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">Why Open-Source Architecture.</h2>
              <p className="text-base text-neutral-500 max-w-xl mx-auto">
                Most AI tools are chatbots with a wrapper. This is a full agent orchestration platform with real autonomy.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
              <div className="bg-[#0A0A0A] p-8 border border-white/5 rounded-2xl relative overflow-hidden">
                <h3 className="text-xl font-bold text-neutral-400 mb-2 flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-neutral-600" /> 1st Gen: Prompt-Based AI
                </h3>
                <p className="text-neutral-600 font-mono text-sm mb-8">Isolated Chatbots & Static APIs</p>
                
                <ul className="space-y-4">
                  {[
                    "Humans must prompt every single step",
                    "Limited to text and code generation",
                    "No memory between sessions",
                    "Cannot use external software or tools",
                    "Hallucinates when context window fills",
                    "Zero autonomous decision making"
                  ].map((item, i) => (
                     <li key={i} className="flex items-start gap-3 text-neutral-500">
                       <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-neutral-600" />
                       <span className="text-sm">{item}</span>
                     </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#111111] p-8 border border-white/10 rounded-2xl relative overflow-hidden">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-white" /> 2nd Gen: Agentic AI (Sovereign OS)
                </h3>
                <p className="text-neutral-400 font-mono text-sm mb-8">Goal-Oriented Autonomous Swarms</p>
                
                <ul className="space-y-4">
                  {[
                    "Give a single goal; the agent plans and executes",
                    "Powered by Anthropic's free open-source MCP standard",
                    "Agents control browsers, mouse, and local hardware",
                    "Self-correcting recursive execution loops",
                    "Agents speak to each other to solve complex tasks",
                    "Persistent long-term memory via Vector DBs"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-neutral-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-white" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-20">
              <SovereignCalculator />
            </div>
         </div>
      </section>

      <VideoShowcase />

      <section id="pricing" className="py-24 bg-[#000000] relative border-t border-white/5">
         <div className="mb-24">
           <ToolShowcase />
         </div>
         <Pricing />
      </section>

      <section className="py-32 bg-[#050505] px-6">
        <motion.div 
          initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
          className="max-w-5xl mx-auto"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-6 bg-white/5">
                Engineered for Scale
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight tracking-tight">
                Built on Models You Control.
              </h2>
              <div className="w-8 h-px bg-white/20 mb-6" />
              <p className="text-neutral-400 leading-relaxed mb-6 text-sm">
                Sovereign Matrix routes tasks across multiple AI providers — local Ollama models, NVIDIA NIM, Google Gemini, Claude, and Groq. Smart routing picks the best model for each task automatically.
              </p>
              <p className="text-neutral-400 leading-relaxed mb-8 text-sm">
                Every agent call is audited, rate-limited, and secured. NeMo Guardrails handle content safety. Vector memory persists context across sessions. You own the data and the infrastructure.
              </p>
              <Link href="/pricing" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors">
                Deploy Infrastructure
              </Link>
            </div>
            
            <div className="space-y-6">
              <h3 className="text-xs font-semibold text-neutral-500 mb-6 uppercase tracking-widest">Architecture Verification</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: "Gemini 2.5", desc: "Cognitive Engine" },
                  { name: "Anthropic MCP", desc: "Open Tool Standard" },
                  { name: "Claude Computer Use", desc: "OS-Level Automation" },
                  { name: "NemoClaw OS", desc: "Hardware Control" },
                  { name: "TensorRT", desc: "Microsecond Latency" },
                  { name: "NeMo Guardrails", desc: "Zero Hallucinations" },
                ].map((tech) => (
                  <div key={tech.name} className="p-4 rounded-xl bg-[#0A0A0A] border border-white/5">
                    <p className="text-sm font-semibold text-white mb-1">{tech.name}</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{tech.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="py-32 bg-[#000000] px-6 border-t border-white/5">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Common Questions</h2>
            <p className="text-neutral-500">How the platform works, what it costs, and what you own.</p>
          </div>

          <div className="border border-white/5 rounded-2xl bg-[#0A0A0A] p-2">
            {[
              {
                q: "What is Sovereign Matrix?",
                a: "An AI agent orchestration platform with 100+ specialized agents for sales, marketing, content, and operations. It routes tasks across multiple AI models and executes multi-step workflows autonomously."
              },
              {
                q: "Can agents run locally without cloud?",
                a: "Yes. The OpenClaw daemon runs on your local machine using Ollama models. You can execute workflows completely offline — your data never leaves your hardware."
              },
              {
                q: "Is there a contract or lock-in?",
                a: "No. All plans are month-to-month with no contracts. You can cancel instantly from your dashboard. Your data and configurations are always exportable."
              },
            ].map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </motion.div>
      </section>

      <section className="py-40 text-center px-6 bg-[#050505] border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_70%)]" />
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 mb-6">No credit card required</p>
          <h2 className="text-4xl md:text-7xl font-black text-white mb-6 tracking-tight leading-[1.05]">Ready to Deploy.</h2>
          <p className="text-base text-neutral-500 max-w-md mx-auto mb-12">Start with the free tier. Scale when you see results.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/pricing" className="inline-flex px-8 py-4 bg-white text-black font-bold rounded-full text-sm hover:bg-neutral-200 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-[1.02]">
              Get Started Free
            </Link>
            <Link href="/demo" className="inline-flex px-8 py-4 border border-white/10 text-white font-semibold rounded-full text-sm hover:border-white/20 hover:bg-white/[0.03] transition-all">
              Watch Demo
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="bg-[#000000] border-t border-white/5 px-6">
        <div className="max-w-6xl mx-auto py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <SovereignLogo size="sm" />
                <span className="text-sm font-semibold tracking-wide text-white">Sovereign OS</span>
              </div>
              <p className="text-sm text-neutral-500 leading-relaxed max-w-xs">Open-source AI agent orchestration for enterprises. Self-hosted or cloud-managed.</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-white mb-6">Infrastructure</h4>
              <ul className="space-y-4">
                <li><Link href="/pricing" className="text-sm text-neutral-500 hover:text-white transition-colors">Architecture Overview</Link></li>
                <li><Link href="/#pricing" className="text-sm text-neutral-500 hover:text-white transition-colors">Licensing Model</Link></li>
                <li><Link href="/dashboard" className="text-sm text-neutral-500 hover:text-white transition-colors">Command Terminal</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-white mb-6">Compliance</h4>
              <ul className="space-y-4">
                <li><Link href="/privacy" className="text-sm text-neutral-500 hover:text-white transition-colors">Privacy Paradigm</Link></li>
                <li><Link href="/terms" className="text-sm text-neutral-500 hover:text-white transition-colors">Terms of Operations</Link></li>
                <li><span className="text-sm text-neutral-600">POPIA Adherent</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-white mb-6">Communications</h4>
              <ul className="space-y-4">
                <li><a href="mailto:hello@sovereignmatrix.agency" className="text-sm text-neutral-500 hover:text-white transition-colors">hello@sovereignmatrix.agency</a></li>
                <li><span className="text-sm text-neutral-600">Base: Western Cape</span></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-neutral-600">© 2026 Sovereign Matrix. All rights reserved.</p>
            <p className="text-xs text-neutral-600">Built in South Africa.</p>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
