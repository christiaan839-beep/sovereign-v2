"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Zap, Target, FileText,
  Search, Code2, CheckCircle2, Sparkles, Cpu, Globe,
  ChevronRight, BarChart3, Gift
} from "lucide-react";
import Link from "next/link";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to Sovereign Matrix",
    subtitle: "Your AI workforce is ready. Let's get you set up in 60 seconds.",
    icon: Sparkles,
  },
  {
    id: "goal",
    title: "What's your primary goal?",
    subtitle: "We'll configure your agents based on what matters most.",
    icon: Target,
    options: [
      { id: "leads", label: "Find & close leads", desc: "Deploy lead gen, email outreach, and voice agents", icon: Target, agents: "Lead Hunter, Email Sequencer, Voice Closer" },
      { id: "content", label: "Create content at scale", desc: "Blog posts, social media, video scripts — anti-slop quality", icon: FileText, agents: "Content Engine, Brand Voice, Anti-Slop Pipeline" },
      { id: "compete", label: "Outperform competitors", desc: "SEO domination, competitor intel, market positioning", icon: Search, agents: "Site Assassin, SEO Dominator, War Room" },
      { id: "automate", label: "Automate my agency", desc: "White-label, client portals, workflow automation", icon: Cpu, agents: "Workflow Engine, Client Portal, Agent Builder" },
    ],
  },
  {
    id: "industry",
    title: "What industry are you in?",
    subtitle: "Your agents will be pre-configured with industry-specific knowledge.",
    icon: Globe,
    options: [
      { id: "agency", label: "Digital Agency", desc: "Web design, marketing, consulting", icon: Globe, agents: "Full agent suite activated" },
      { id: "saas", label: "SaaS / Tech", desc: "Software, apps, developer tools", icon: Code2, agents: "Code Agent, API Builder, Tech Writer" },
      { id: "ecommerce", label: "E-commerce", desc: "Online stores, D2C brands", icon: BarChart3, agents: "Product Writer, Ad Creator, Review Analyzer" },
      { id: "consulting", label: "Consulting / Services", desc: "Professional services, B2B", icon: Target, agents: "Proposal Writer, Research Agent, Deck Builder" },
    ],
  },
  {
    id: "first-task",
    title: "Run your first agent",
    subtitle: "Type a goal. Watch it execute. No prompt engineering needed.",
    icon: Zap,
    isAction: true,
  },
  {
    id: "complete",
    title: "You're live.",
    subtitle: "124 agents deployed. 65+ models active. Zero per-token cost.",
    icon: CheckCircle2,
    isComplete: true,
  },
];

function FirstTaskDemo() {
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const EXAMPLES = [
    "Find 20 SaaS companies hiring a Head of Marketing",
    "Write a blog post about AI replacing agencies",
    "Analyze competitor-agency.com and find weaknesses",
    "Create a cold email sequence for fintech CTOs",
  ];

  const runTask = async () => {
    if (!input.trim()) return;
    setRunning(true);
    setResult(null);

    try {
      const res = await fetch("/api/agents/smart-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input,
          agentId: "onboarding-first-task",
        }),
      });
      const data = await res.json();
      setResult(data.response || data.result || "Agent executed successfully. View full results in your dashboard.");
    } catch {
      setResult("Something went wrong. Please try again or skip to the dashboard — you can run this task there.");
    }
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((task) => (
          <button key={task} onClick={() => setInput(task)}
            className="text-[10px] px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:text-emerald-400 hover:border-emerald-500/20 transition-gpu">
            {task.length > 40 ? task.slice(0, 40) + "..." : task}
          </button>
        ))}
      </div>

      <div className="relative">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runTask()}
          placeholder="Give the agents a goal..."
          className="w-full bg-[#0A0A0A] border border-white/[0.08] rounded-xl px-5 py-4 pr-24 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500/30 transition-colors" />
        <button onClick={runTask} disabled={running || !input.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold uppercase tracking-wider hover:bg-emerald-500/25 transition-gpu disabled:opacity-30">
          {running ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              Running
            </span>
          ) : (
            <span className="flex items-center gap-1">Execute <ChevronRight className="w-3 h-3" /></span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider">Task Complete</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">{result}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReferralCodeInput() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const submitReferral = () => {
    if (!code.trim()) return;
    setStatus("loading");
    try {
      localStorage.setItem("sovereign_referral_code", code.trim());
      setStatus("success");
      setMessage("Referral code saved! Bonus runs will be applied after signup.");
    } catch {
      setStatus("error");
      setMessage("Failed to save referral code.");
    }
  };

  return (
    <div className="mt-6">
      {status === "success" ? (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-emerald-400 text-xs">
          <Gift className="w-3.5 h-3.5" />
          <span>{message}</span>
        </motion.div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && submitReferral()}
            placeholder="Have a referral code?"
            className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500/30 transition-colors w-48"
          />
          {code.trim() && (
            <button onClick={submitReferral} disabled={status === "loading"}
              className="text-[10px] px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-gpu disabled:opacity-50">
              {status === "loading" ? "Applying..." : "Apply"}
            </button>
          )}
          {status === "error" && (
            <span className="text-[10px] text-red-400">{message}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const step = STEPS[currentStep];

  const next = () => { if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1); };
  const back = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };
  const selectOption = (stepId: string, optionId: string) => {
    setSelections({ ...selections, [stepId]: optionId });
    setTimeout(next, 400);
  };

  return (
    <div className="min-h-screen bg-[#010101] text-white flex flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <SovereignLogo size="sm" />
        <div className="flex items-center gap-3">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-gpu duration-500 ${
              i <= currentStep ? "w-8 bg-emerald-500" : "w-4 bg-white/[0.06]"
            }`} />
          ))}
        </div>
        <Link href="/dashboard" className="text-[10px] text-neutral-600 hover:text-white transition-colors uppercase tracking-wider">Skip</Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <AnimatePresence mode="wait">
          <motion.div key={step.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} className="w-full max-w-2xl">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <step.icon className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">{step.title}</h1>
              <p className="text-neutral-500 text-sm">{step.subtitle}</p>
            </div>

            {step.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {step.options.map((opt) => {
                  const isSelected = selections[step.id] === opt.id;
                  return (
                    <button key={opt.id} onClick={() => selectOption(step.id, opt.id)}
                      className={`text-left p-5 rounded-xl border transition-gpu duration-300 ${
                        isSelected ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
                          : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]"
                      }`}>
                      <div className="flex items-center gap-3 mb-2">
                        <opt.icon className={`w-5 h-5 ${isSelected ? "text-emerald-400" : "text-neutral-600"}`} />
                        <span className={`text-sm font-semibold ${isSelected ? "text-emerald-300" : "text-white"}`}>{opt.label}</span>
                      </div>
                      <p className="text-xs text-neutral-600 mb-2">{opt.desc}</p>
                      <p className="text-[9px] text-emerald-500/50 uppercase tracking-wider">{opt.agents}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {step.id === "welcome" && <ReferralCodeInput />}

            {step.isAction && <FirstTaskDemo />}

            {step.isComplete && (
              <div className="text-center space-y-6">
                <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                  {[
                    { val: "124", label: "Agents", color: "text-emerald-400" },
                    { val: "65+", label: "Models", color: "text-cyan-400" },
                    { val: "$0", label: "Per Token", color: "text-white" },
                  ].map((s) => (
                    <div key={s.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className={`text-2xl font-black font-mono stat-glow ${s.color}`}>{s.val}</div>
                      <div className="text-[9px] text-neutral-600 uppercase tracking-wider mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
                <Link href="/dashboard"
                  className="cta-glow inline-flex items-center gap-2 px-10 py-4 bg-white text-black font-bold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-gpu">
                  Enter Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-[10px] text-neutral-600 mt-4 uppercase tracking-wider">
                  Payments powered by Yoco
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between px-6 py-6 max-w-2xl mx-auto w-full">
        <button onClick={back} disabled={currentStep === 0}
          className="flex items-center gap-2 text-xs text-neutral-600 hover:text-white transition-colors disabled:opacity-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {!step.options && !step.isComplete && (
          <button onClick={next}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-sm text-white hover:bg-white/[0.1] transition-gpu">
            {step.isAction ? "Finish Setup" : "Continue"} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
