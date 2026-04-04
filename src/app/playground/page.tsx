"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ChevronDown, Terminal, Sparkles, Lock, Copy, Check } from "lucide-react";

const AGENTS = [
  { id: "leads", name: "Lead Gen", endpoint: "/api/_agents/leads", example: "Find 25 SaaS founders in Austin, TX with Series A funding" },
  { id: "blog-gen", name: "Blog Gen", endpoint: "/api/_agents/blog-gen", example: "Write a 1500-word article on AI automation for agencies" },
  { id: "market-intel", name: "Market Intel", endpoint: "/api/_agents/market-intel", example: "Analyze the competitive landscape for AI CRM tools in 2026" },
  { id: "voice-synth", name: "Voice Synth", endpoint: "/api/_agents/voice", example: "Generate a 30-second sales pitch script for a SaaS demo" },
  { id: "seo-audit", name: "SEO Audit", endpoint: "/api/_agents/seo-dominator", example: "Run a full SEO audit on example.com with keyword gaps" },
];

export default function PlaygroundPage() {
  const [agent, setAgent] = useState(AGENTS[0]);
  const [prompt, setPrompt] = useState(AGENTS[0].example);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tries, setTries] = useState(3);

  useEffect(() => {
    const stored = localStorage.getItem("sv_playground_tries");
    if (stored) setTries(parseInt(stored, 10));
  }, []);

  const run = async () => {
    if (tries <= 0) return;
    setLoading(true);
    setResult(null);
    const remaining = tries - 1;
    setTries(remaining);
    localStorage.setItem("sv_playground_tries", String(remaining));
    try {
      const res = await fetch(agent.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch {
      setResult(JSON.stringify({ error: "Agent unavailable — sign up for full access" }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const selectAgent = (a: typeof AGENTS[number]) => {
    setAgent(a);
    setPrompt(a.example);
    setOpen(false);
    setResult(null);
  };

  const copyResult = () => {
    if (result) { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <main className="min-h-screen bg-[#010101] text-neutral-200">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono mb-4">
            <Sparkles className="w-3 h-3" /> API Playground
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">Try Agents Live</h1>
          <p className="text-neutral-500 max-w-lg mx-auto">Run any agent without signing up. See real results in seconds.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden">
          {/* Agent selector */}
          <div className="p-5 border-b border-white/5">
            <label className="text-xs text-neutral-500 font-mono mb-2 block">AGENT</label>
            <div className="relative">
              <button onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-colors text-left">
                <span className="font-mono text-emerald-400">{agent.name}</span>
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {open && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                    className="absolute z-10 mt-1 w-full rounded-lg bg-[#0a0a0a] border border-white/10 overflow-hidden">
                    {AGENTS.map((a) => (
                      <button key={a.id} onClick={() => selectAgent(a)}
                        className={`w-full text-left px-4 py-3 font-mono text-sm hover:bg-white/5 transition-colors ${a.id === agent.id ? "text-emerald-400 bg-emerald-500/5" : "text-neutral-300"}`}>
                        {a.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Prompt input */}
          <div className="p-5 border-b border-white/5">
            <label className="text-xs text-neutral-500 font-mono mb-2 block">PROMPT</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-emerald-500/40 focus:outline-none resize-none font-mono text-sm text-neutral-200 placeholder-neutral-600"
              placeholder="Enter your prompt..." />
          </div>

          {/* Run button + tries */}
          <div className="p-5 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-3">
              <button onClick={run} disabled={loading || tries <= 0}
                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm flex items-center gap-2 transition-colors">
                {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Play className="w-4 h-4" />}
                Run Agent
              </button>
              <span className="text-xs font-mono text-neutral-500">
                {tries > 0 ? `${tries} free ${tries === 1 ? "try" : "tries"} remaining` : "No tries left"}
              </span>
            </div>
            <span className="text-xs font-mono text-neutral-600">POST {agent.endpoint}</span>
          </div>

          {/* Result panel */}
          <div className="relative">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
                <Terminal className="w-3.5 h-3.5" /> Response
              </div>
              {result && (
                <button onClick={copyResult} className="text-xs text-neutral-500 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
            <pre className="p-5 text-sm font-mono overflow-auto max-h-80 text-emerald-300/80 min-h-[120px]">
              {loading && <span className="text-neutral-600 animate-pulse">Running agent...</span>}
              {!loading && !result && <span className="text-neutral-600">Agent response will appear here</span>}
              {!loading && result && result}
            </pre>
          </div>
        </motion.div>

        {/* CTA when no tries */}
        <AnimatePresence>
          {tries <= 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-8 p-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
              <Lock className="w-6 h-6 text-emerald-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">Free tries exhausted</p>
              <p className="text-neutral-400 text-sm mb-4">Sign up to get unlimited agent access and full API keys.</p>
              <a href="/pricing" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors">
                Sign Up for Unlimited Access
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
