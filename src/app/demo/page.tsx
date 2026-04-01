"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Zap, Brain, Target, Shield, Search, Cpu, Lock } from "lucide-react";
import Link from "next/link";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

const DEMO_AGENTS = [
  {
    id: "war-room",
    name: "War Room",
    icon: Target,
    color: "text-orange-400",
    border: "border-orange-500/20",
    prompt: "Analyze uber.com and identify 3 strategic weaknesses in their market positioning",
    description: "Competitive intelligence — runs OSINT reconnaissance on any competitor.",
  },
  {
    id: "seo",
    name: "SEO X-Ray",
    icon: Search,
    color: "text-blue-400",
    border: "border-blue-500/20",
    prompt: "Generate a technical SEO audit for a fintech startup targeting South African millennials",
    description: "Technical SEO analysis with keyword gaps and content strategy.",
  },
  {
    id: "content",
    name: "Kilo-Writer",
    icon: Brain,
    color: "text-violet-400",
    border: "border-violet-500/20",
    prompt: "Write a 500-word LinkedIn thought leadership post about autonomous AI agents in marketing",
    description: "Long-form content engine — blogs, social posts, email sequences.",
  },
  {
    id: "shield",
    name: "Morpheus Shield",
    icon: Shield,
    color: "text-red-400",
    border: "border-red-500/20",
    prompt: "Scan this text for PII exposure: 'Contact John Smith at john@company.com, his SSN is 123-45-6789 for the confidential merger'",
    description: "NeMo Guardrails — PII redaction, compliance, brand protection.",
  },
];

export default function DemoPage() {
  const [selectedAgent, setSelectedAgent] = useState(DEMO_AGENTS[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [timeLeft, setTimeLeft] = useState(180);
  const [demoStarted, setDemoStarted] = useState(false);
  const [queriesUsed, setQueriesUsed] = useState(0);
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!demoStarted || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [demoStarted, timeLeft]);

  const handleRun = async () => {
    if (isRunning || timeLeft <= 0 || queriesUsed >= 5) return;
    setDemoStarted(true);
    setIsRunning(true);
    setStreamText("");

    try {
      const res = await fetch("/api/_agents/smart-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: selectedAgent.prompt, agentId: selectedAgent.id }),
      });
      const data = await res.json();
      const fullText = data.response || data.result || "Agent response complete. Deploy a Sovereign Node for unlimited access.";
      
      let i = 0;
      const typewriter = setInterval(() => {
        i++;
        setStreamText(fullText.slice(0, i));
        if (i >= fullText.length) clearInterval(typewriter);
      }, 12);

      setQueriesUsed(q => q + 1);
    } catch {
      setStreamText("Something went wrong. Please try again or sign up for full access.");
    } finally {
      setTimeout(() => setIsRunning(false), 500);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed top-0 inset-x-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <SovereignLogo size="sm" />
            <span className="text-sm font-bold tracking-[0.15em] uppercase font-serif">Sandbox</span>
          </Link>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${timeLeft > 30 ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
              <span className="text-xs font-mono text-neutral-400">{formatTime(timeLeft)} remaining</span>
            </div>
            <span className="text-xs font-mono text-neutral-600">{queriesUsed}/5 queries</span>
            <Link href="/pricing" className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 transition-gpu">
              Upgrade
            </Link>
          </div>
        </div>
      </div>

      <div className="pt-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-[0.2em] mb-6">
            <Zap className="w-3 h-3" /> Live Sandbox — No Login Required
          </motion.div>
          <h1 className="text-3xl md:text-5xl font-bold text-white serif-text mb-4">Try the Swarm. Live.</h1>
          <p className="text-neutral-500 max-w-xl mx-auto">5 queries. 3 minutes. Real NVIDIA NIM agents. Zero commitment.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {DEMO_AGENTS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => { setSelectedAgent(agent); setStreamText(""); }}
              className={`p-4 rounded-xl border transition-gpu text-left ${selectedAgent.id === agent.id ? `${agent.border} bg-white/[0.04] ring-1 ring-white/10` : "border-white/5 bg-white/[0.01] hover:bg-white/[0.03]"}`}
            >
              <agent.icon className={`w-5 h-5 ${agent.color} mb-2`} />
              <div className="text-sm font-bold text-white">{agent.name}</div>
              <div className="text-[10px] text-neutral-600 mt-1 line-clamp-2">{agent.description}</div>
            </button>
          ))}
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <selectedAgent.icon className={`w-4 h-4 ${selectedAgent.color}`} />
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">{selectedAgent.name} Agent</span>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed mb-4 font-mono bg-black/30 p-4 rounded-xl border border-white/5">{selectedAgent.prompt}</p>
          <button
            onClick={handleRun}
            disabled={isRunning || timeLeft <= 0 || queriesUsed >= 5}
            className="px-8 py-4 rounded-xl bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-neutral-200 transition-gpu disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isRunning ? <><Cpu className="w-4 h-4 animate-spin" /> Processing...</> : <><Zap className="w-4 h-4" /> Execute Agent</>}
          </button>
        </div>

        <AnimatePresence>
          {streamText && (
            <motion.div ref={responseRef} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-black/80 border border-emerald-500/20 rounded-2xl p-6 mb-8 shadow-[0_0_40px_rgba(16,185,129,0.05)]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 font-mono">{selectedAgent.name} Response</span>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed font-mono whitespace-pre-wrap">{streamText}<span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse" /></p>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-neutral-600 font-mono">NVIDIA NIM × Nemotron</span>
                <span className="text-[10px] text-neutral-600 font-mono">{queriesUsed}/5 used</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(timeLeft <= 0 || queriesUsed >= 5) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <Lock className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white serif-text mb-3">Sandbox Expired</h2>
            <p className="text-neutral-500 mb-8 max-w-md mx-auto">You&apos;ve seen what 5 queries can do. Imagine 72 agents running 24/7.</p>
            <Link href="/pricing" className="inline-flex items-center gap-2 px-10 py-5 rounded-2xl bg-white text-black font-bold uppercase tracking-widest text-sm hover:bg-neutral-200 transition-gpu shadow-[0_0_40px_rgba(255,255,255,0.15)] group">
              Deploy Your Node <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
