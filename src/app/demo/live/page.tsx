"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2, CheckCircle2, ArrowRight, Sparkles, Target, FileText, Search, Copy, Check } from "lucide-react";
import Link from "next/link";
import { TOTAL_MODELS } from "@/lib/platform-stats";

/**
 * LIVE DEMO — Let visitors run a real agent without signing up.
 * This is the viral growth engine. Visitors see real AI output
 * and share the results. Limited to 3 free tries.
 */

const DEMO_AGENTS = [
  {
    id: "leads",
    name: "Find Leads",
    icon: Target,
    color: "emerald",
    placeholder: "Find 10 SaaS companies in Austin, TX with Series A funding",
    description: "Discover and qualify B2B prospects instantly",
  },
  {
    id: "content",
    name: "Write Content",
    icon: FileText,
    color: "cyan",
    placeholder: "Write a 500-word blog post about AI replacing manual agency work",
    description: "Generate human-quality content in seconds",
  },
  {
    id: "seo",
    name: "SEO Audit",
    icon: Search,
    color: "violet",
    placeholder: "Analyze example.com for SEO opportunities and keyword gaps",
    description: "Full technical SEO analysis with actionable insights",
  },
];

export default function LiveDemoPage() {
  const [selected, setSelected] = useState(0);
  const [prompt, setPrompt] = useState(DEMO_AGENTS[0].placeholder);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [triesLeft, setTriesLeft] = useState(() => {
    if (typeof window !== "undefined") {
      const used = parseInt(localStorage.getItem("sovereign_demo_tries") || "0");
      return Math.max(0, 3 - used);
    }
    return 3;
  });
  const [copied, setCopied] = useState(false);

  const agent = DEMO_AGENTS[selected];

  const runDemo = async () => {
    if (triesLeft <= 0 || running) return;

    setRunning(true);
    setResult(null);

    try {
      const res = await fetch("/api/demo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      setResult(data.response || data.output || data.result || "Try again or sign up for full access.");

      // Track demo usage
      const used = parseInt(localStorage.getItem("sovereign_demo_tries") || "0") + 1;
      localStorage.setItem("sovereign_demo_tries", String(used));
      setTriesLeft(Math.max(0, 3 - used));
    } catch {
      setResult("Demo temporarily unavailable. Sign up for unlimited access.");
    } finally {
      setRunning(false);
    }
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <div className="max-w-4xl mx-auto px-6 py-24">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <Link href="/" className="text-xs text-neutral-500 hover:text-white transition-colors uppercase tracking-widest mb-8 inline-block">← Back to Home</Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Live Demo — No Signup Required</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Try it right now.</h1>
          <p className="text-neutral-500 max-w-lg mx-auto">Pick an agent, type a goal, and watch it execute. {triesLeft} free {triesLeft === 1 ? "try" : "tries"} remaining.</p>
        </motion.div>

        {/* Agent Selector */}
        <div className="flex gap-3 mb-6 justify-center">
          {DEMO_AGENTS.map((a, i) => (
            <button
              key={a.id}
              onClick={() => { setSelected(i); setPrompt(a.placeholder); setResult(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                selected === i
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-white/[0.02] text-neutral-500 border border-white/[0.06] hover:text-white"
              }`}
            >
              <a.icon className="w-4 h-4" />
              {a.name}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-[#060606]">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
            </div>
            <span className="text-[10px] text-neutral-500 ml-3 font-mono">{agent.name} Agent</span>
          </div>
          <div className="p-5">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none resize-none leading-relaxed"
              placeholder={agent.placeholder}
            />
            <div className="flex items-center justify-between mt-4">
              <span className="text-[10px] text-neutral-500">{triesLeft} free {triesLeft === 1 ? "try" : "tries"} remaining</span>
              <button
                onClick={runDemo}
                disabled={running || triesLeft <= 0 || !prompt.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {running ? "Running..." : "Execute"}
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6 mb-8"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Result</span>
                </div>
                <button onClick={copyResult} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-white transition-colors">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto custom-scrollbar">{result}</pre>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upgrade CTA */}
        {triesLeft <= 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <h2 className="text-xl font-bold text-white mb-3">Want unlimited access?</h2>
            <p className="text-neutral-400 mb-6">Sign up free — no credit card required. Get 100 agent runs per month.</p>
            <Link href="/onboarding" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-200 transition-colors">
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}

        {triesLeft > 0 && !result && (
          <p className="text-center text-xs text-neutral-500 mt-8">
            Powered by {TOTAL_MODELS} AI models via NVIDIA NIM. Zero per-token cost.
          </p>
        )}
      </div>
    </div>
  );
}
