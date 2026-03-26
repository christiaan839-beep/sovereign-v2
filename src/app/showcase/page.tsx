"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Brain, Search, Mail, Mic, Code2, Shield, Globe,
  ArrowRight, CheckCircle2, Activity, Target, Cpu,
  BarChart3, Users, FileText, Bot, Sparkles
} from "lucide-react";
import Link from "next/link";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

// ─── Typing Effect ───
function useTypingEffect(text: string, speed = 30, startDelay = 0) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayed(text.slice(0, i + 1));
        i++;
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);
    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);

  return { displayed, done };
}

// ─── Agent Node (visual) ───
function AgentNode({ name, icon: Icon, color, active, delay = 0 }: {
  name: string; icon: React.ComponentType<{ className?: string }>; color: string; active: boolean; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: active ? 1 : 0.3, scale: active ? 1 : 0.9 }}
      transition={{ delay, duration: 0.5 }}
      className={`flex flex-col items-center gap-2 ${active ? "" : "opacity-30"}`}
    >
      <div className={`relative w-14 h-14 rounded-xl border flex items-center justify-center transition-gpu duration-500 ${
        active
          ? `bg-${color}-500/10 border-${color}-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]`
          : "bg-white/[0.02] border-white/[0.06]"
      }`}>
        <Icon className={`w-6 h-6 transition-colors ${active ? `text-emerald-400` : "text-neutral-600"}`} />
        {active && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
          </span>
        )}
      </div>
      <span className={`text-[10px] font-medium transition-colors ${active ? "text-emerald-400" : "text-neutral-600"}`}>
        {name}
      </span>
    </motion.div>
  );
}

// ─── Demo Scenarios ───
const SCENARIOS = [
  {
    id: "leads",
    title: "Lead Generation",
    userPrompt: "Find 50 Series A fintech companies in the US with open CMO roles. Get verified emails.",
    agentSteps: [
      { agent: "Smart Router", icon: Cpu, text: "Analyzing task... Routing to Lead Generation swarm.", duration: 1200 },
      { agent: "Apollo Ghost Fleet", icon: Target, text: "Deploying 8 parallel search agents across LinkedIn, Crunchbase, and AngelList.", duration: 2000 },
      { agent: "Data Enrichment", icon: Users, text: "Cross-referencing 247 matches. Filtering by funding stage and hiring signals.", duration: 1800 },
      { agent: "Email Verifier", icon: Mail, text: "Running SMTP verification on 53 qualified leads. 48 emails confirmed valid.", duration: 1500 },
      { agent: "PII Scanner", icon: Shield, text: "Safety check passed. No sensitive data in output. Compliance verified.", duration: 800 },
    ],
    result: {
      metrics: [
        { label: "Leads Found", value: "53", color: "emerald" },
        { label: "Verified Emails", value: "48", color: "cyan" },
        { label: "Avg Score", value: "8.7/10", color: "emerald" },
        { label: "Time", value: "12s", color: "white" },
      ],
      output: "53 Series A fintech companies identified. 48 have verified CMO email addresses. Top 5 leads scored 9.2+ based on hiring velocity and funding recency. CSV export ready."
    }
  },
  {
    id: "competitor",
    title: "Competitor Intelligence",
    userPrompt: "Analyze competitor-agency.com — their tech stack, SEO gaps, and counter-strategy.",
    agentSteps: [
      { agent: "Smart Router", icon: Cpu, text: "Task classified as Competitor Intel. Routing to Site Assassin.", duration: 1000 },
      { agent: "Browser Agent", icon: Globe, text: "Opening headless browser. Navigating competitor-agency.com. Extracting page structure.", duration: 2200 },
      { agent: "Tech Stack Scanner", icon: Code2, text: "Detected: React 18, Tailwind CSS, Vercel, Stripe, HubSpot CRM, Intercom chat.", duration: 1600 },
      { agent: "SEO Analyzer", icon: Search, text: "Found 23 keyword gaps. Competitor ranks for 'ai agency' but misses 'autonomous agents'.", duration: 1800 },
      { agent: "War Room", icon: Brain, text: "Generating counter-strategy. 5 actionable moves identified to outposition competitor.", duration: 2000 },
    ],
    result: {
      metrics: [
        { label: "Tech Stack Items", value: "14", color: "emerald" },
        { label: "SEO Gaps", value: "23", color: "cyan" },
        { label: "Counter Moves", value: "5", color: "emerald" },
        { label: "Time", value: "18s", color: "white" },
      ],
      output: "Full competitive analysis complete. Competitor uses 6 separate tools you can replace with Sovereign Matrix. 23 keyword opportunities identified. Top counter-move: target 'autonomous AI agency' — competitor has zero content in this space."
    }
  },
  {
    id: "content",
    title: "Content Creation",
    userPrompt: "Write a 2,000-word blog post about AI agents replacing traditional agencies. Make it sound human, not AI.",
    agentSteps: [
      { agent: "Smart Router", icon: Cpu, text: "Task: long-form content. Routing to DeepSeek V3.2 for generation.", duration: 1000 },
      { agent: "DeepSeek V3.2", icon: FileText, text: "Generating 2,147-word draft. Structure: intro, 5 sections, conclusion with CTA.", duration: 3000 },
      { agent: "Anti-Slop Pipeline", icon: Sparkles, text: "Stage 1: Polish. Stage 2: Humanize. Stage 3: Score. AI detection: 4% (human-passing).", duration: 2000 },
      { agent: "Brand Voice", icon: Bot, text: "Applying brand voice memory. Tone: authoritative but accessible. No buzzwords.", duration: 1200 },
      { agent: "Quality Score", icon: BarChart3, text: "Final quality: 94/100. Readability: Grade 8. Uniqueness: 97%. Ready to publish.", duration: 800 },
    ],
    result: {
      metrics: [
        { label: "Word Count", value: "2,147", color: "emerald" },
        { label: "AI Detection", value: "4%", color: "cyan" },
        { label: "Quality", value: "94/100", color: "emerald" },
        { label: "Time", value: "8s", color: "white" },
      ],
      output: "2,147-word blog post generated. AI detection score: 4% (passes all major detectors). Brand voice applied from memory. One-click publish available for WordPress, Medium, and LinkedIn."
    }
  },
];

// ─── Interactive Chat Demo ───
function ChatDemo({ scenario }: { scenario: typeof SCENARIOS[0] }) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [showResult, setShowResult] = useState(false);
  const [started, setStarted] = useState(false);
  const stepsRef = useRef<HTMLDivElement>(null);

  const startDemo = () => {
    setStarted(true);
    setCurrentStep(0);
    setShowResult(false);
  };

  useEffect(() => {
    if (!started || currentStep < 0) return;

    if (currentStep < scenario.agentSteps.length) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        stepsRef.current?.scrollTo({ top: stepsRef.current.scrollHeight, behavior: "smooth" });
      }, scenario.agentSteps[currentStep].duration);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setShowResult(true), 500);
      return () => clearTimeout(timer);
    }
  }, [currentStep, started, scenario.agentSteps]);

  // Reset when scenario changes
  useEffect(() => {
    setStarted(false);
    setCurrentStep(-1);
    setShowResult(false);
  }, [scenario.id]);

  return (
    <div className="relative">
      {/* Window Chrome */}
      <div className="scan-line rounded-2xl border border-white/[0.08] bg-[#080808] overflow-hidden shadow-[0_0_80px_rgba(16,185,129,0.04)]">
        {/* Title Bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-[#050505]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-[10px] text-neutral-600 ml-3 font-mono">sovereign-matrix.agency/dashboard — {scenario.title}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-emerald-500/60 uppercase tracking-wider">Live</span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="p-6 min-h-[400px] flex flex-col">
          {/* User Message */}
          <div className="flex justify-end mb-4">
            <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-md bg-emerald-500/10 border border-emerald-500/15">
              <p className="text-sm text-emerald-200">{scenario.userPrompt}</p>
            </div>
          </div>

          {/* Agent Steps */}
          <div ref={stepsRef} className="flex-1 space-y-3 overflow-y-auto max-h-[280px] custom-scrollbar">
            {!started && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-full">
                <button
                  onClick={startDemo}
                  className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/30 transition-gpu"
                >
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-300">Execute Agent Workflow</span>
                  <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

            <AnimatePresence mode="popLayout">
              {scenario.agentSteps.slice(0, currentStep >= 0 ? currentStep + 1 : 0).map((step, i) => {
                const isActive = i === currentStep && currentStep < scenario.agentSteps.length;
                const isDone = i < currentStep || showResult;

                return (
                  <motion.div
                    key={`${scenario.id}-${i}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-3"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border transition-gpu ${
                      isDone
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : isActive
                          ? "bg-cyan-500/10 border-cyan-500/20"
                          : "bg-white/[0.02] border-white/[0.06]"
                    }`}>
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <step.icon className={`w-4 h-4 ${isActive ? "text-cyan-400 animate-pulse" : "text-neutral-600"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          isDone ? "text-emerald-500/70" : isActive ? "text-cyan-500/70" : "text-neutral-600"
                        }`}>
                          {step.agent}
                        </span>
                        {isActive && <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ping" />}
                      </div>
                      <p className="text-xs text-neutral-400 leading-relaxed">{step.text}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Result */}
            <AnimatePresence>
              {showResult && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mt-4 pt-4 border-t border-emerald-500/10"
                >
                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {scenario.result.metrics.map((m) => (
                      <div key={m.label} className="text-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className={`text-lg font-black font-mono stat-glow ${
                          m.color === "emerald" ? "text-emerald-400" : m.color === "cyan" ? "text-cyan-400" : "text-white"
                        }`}>{m.value}</div>
                        <div className="text-[8px] text-neutral-600 uppercase tracking-wider mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Output */}
                  <div className="px-4 py-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider">Task Complete</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">{scenario.result.output}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Network Visualization ───
function AgentNetwork({ activeAgents }: { activeAgents: string[] }) {
  const agents = [
    { name: "Router", icon: Cpu },
    { name: "Lead Gen", icon: Target },
    { name: "Browser", icon: Globe },
    { name: "Voice", icon: Mic },
    { name: "Content", icon: FileText },
    { name: "Code", icon: Code2 },
    { name: "Safety", icon: Shield },
    { name: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 p-6">
      {agents.map((agent, i) => (
        <AgentNode
          key={agent.name}
          name={agent.name}
          icon={agent.icon}
          color="emerald"
          active={activeAgents.includes(agent.name) || activeAgents.length === 0}
          delay={i * 0.1}
        />
      ))}
    </div>
  );
}

// ─── Main Showcase Page ───
export default function ShowcasePage() {
  const [activeScenario, setActiveScenario] = useState(0);
  const scenario = SCENARIOS[activeScenario];

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 py-3">
        <div className="bg-[#080808]/90 backdrop-blur-2xl border border-white/[0.06] rounded-full px-5 h-12 flex items-center justify-between w-full max-w-4xl">
          <Link href="/" className="flex items-center gap-2.5">
            <SovereignLogo size="sm" />
            <span className="text-sm font-semibold text-white">Showcase</span>
          </Link>
          <Link href="/dashboard" className="px-4 py-1.5 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-gpu">
            Try It Live
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-12 px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.04] mb-8">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400/80 font-medium">Interactive Demo</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
            <span className="text-shimmer">See the agents work.</span>
          </h1>
          <p className="text-neutral-500 max-w-xl mx-auto text-sm md:text-base">
            Choose a scenario. Watch autonomous agents collaborate in real-time.
            Every step is a real capability. Nothing simulated.
          </p>
        </motion.div>
      </section>

      {/* Scenario Selector */}
      <section className="px-6 mb-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveScenario(i)}
              className={`flex-1 px-5 py-4 rounded-xl border text-left transition-gpu duration-300 ${
                activeScenario === i
                  ? "bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
                  : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]"
              }`}
            >
              <span className={`text-xs font-bold uppercase tracking-wider ${
                activeScenario === i ? "text-emerald-400" : "text-neutral-600"
              }`}>{s.title}</span>
              <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">{s.userPrompt}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Demo Area */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Network */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-white/[0.06] bg-[#080808] p-4">
              <div className="flex items-center gap-2 mb-4 px-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Agent Network</span>
              </div>
              <AgentNetwork activeAgents={[]} />

              {/* Stats */}
              <div className="mt-4 pt-4 border-t border-white/[0.04] grid grid-cols-2 gap-3 px-2">
                <div>
                  <div className="text-2xl font-black text-white font-mono stat-glow">132</div>
                  <div className="text-[9px] text-neutral-600 uppercase tracking-wider">Agents Ready</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-emerald-400 font-mono stat-glow">51+</div>
                  <div className="text-[9px] text-neutral-600 uppercase tracking-wider">Models Active</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-cyan-400 font-mono">$0</div>
                  <div className="text-[9px] text-neutral-600 uppercase tracking-wider">Per Token</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white font-mono">&lt;200ms</div>
                  <div className="text-[9px] text-neutral-600 uppercase tracking-wider">Latency</div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Demo */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <ChatDemo scenario={scenario} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* 5-Layer Safety Pipeline Visual */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-3">Security Architecture</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight">5-layer safety. Zero leaks.</h2>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            {[
              { layer: "1", name: "Jailbreak Detection", desc: "Blocks prompt injection & role manipulation", icon: Shield, color: "emerald" },
              { layer: "2", name: "Topic Control", desc: "Restricts agents to authorized subjects only", icon: Target, color: "emerald" },
              { layer: "3", name: "Content Safety", desc: "NeMo 4B model blocks toxic outputs", icon: Brain, color: "cyan" },
              { layer: "4", name: "PII Scanning", desc: "Intercepts credit cards, SSNs, emails before output", icon: Search, color: "emerald" },
              { layer: "5", name: "Quality Scoring", desc: "Evaluates if output solves the original goal", icon: BarChart3, color: "cyan" },
            ].map((layer, i) => (
              <motion.div
                key={layer.layer}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex-1 p-4 rounded-xl border border-white/[0.06] bg-[#080808] card-cinematic group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-black text-emerald-400">{layer.layer}</span>
                  <layer.icon className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <h3 className="text-xs font-bold text-white mb-1">{layer.name}</h3>
                <p className="text-[10px] text-neutral-600 leading-relaxed">{layer.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Ready to deploy?</h2>
          <p className="text-neutral-500 mb-8 text-sm">132 agents. 51+ models. Zero per-token cost. Start free.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/dashboard" className="cta-glow group flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-gpu">
              Start Free <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/" className="px-8 py-4 border border-white/10 text-neutral-300 font-medium rounded-full text-sm hover:border-white/20 hover:text-white transition-gpu">
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
