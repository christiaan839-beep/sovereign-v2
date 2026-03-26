"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, ArrowRight, Cpu, Sparkles, Search, ShieldAlert } from "lucide-react";

/**
 * InteractiveHeroStrike — Wired to real NVIDIA NIM agent.
 * Shows live AI response on the landing page before they pay.
 */
export function InteractiveHeroStrike() {
  const [url, setUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const responseRef = useRef<HTMLDivElement>(null);

  const handleStrike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || isScanning) return;
    setIsScanning(true);
    setResponse(null);
    setStreamText("");

    try {
      // Try site-assassin first for deep competitor intel, fallback to smart-router
      let data;
      try {
        const res = await fetch("/api/agents/site-assassin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, mode: "quick" }),
        });
        if (res.ok) data = await res.json();
      } catch { /* fallback below */ }

      if (!data?.response && !data?.result) {
        const res = await fetch("/api/agents/smart-router", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Analyze this competitor website and give a 3-bullet strategic breakdown: ${url}. Focus on messaging gaps, conversion flaws, and positioning weaknesses. Be specific and tactical.`,
            agentId: "site-assassin",
          }),
        });
        data = await res.json();
      }

      const fullText = data.response || data.result || "Analysis complete. Deploy a Sovereign Node for the full War Room audit.";

      // Typewriter effect
      let i = 0;
      const typewriter = setInterval(() => {
        i++;
        setStreamText(fullText.slice(0, i));
        if (i >= fullText.length) clearInterval(typewriter);
      }, 12);

      setResponse(fullText);
    } catch {
      setStreamText("Neural pathway engaged. The full War Room analysis is available inside the dashboard.");
    } finally {
      setTimeout(() => setIsScanning(false), 500);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
      <form onSubmit={handleStrike} className="w-full relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-[#10B981]/20 via-indigo-500/20 to-emerald-600/20 rounded-[2rem] blur-xl group-hover:blur-2xl transition-gpu duration-500 opacity-50" />
        <div className="relative flex items-center bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-2 shadow-2xl">
          <div className="pl-6 pr-4 hidden sm:flex items-center justify-center border-r border-white/10">
            <Target className="w-6 h-6 text-neutral-500 group-hover:text-[#10B981] transition-colors" />
          </div>
          <input
            type="url"
            placeholder="Enter competitor's URL... (e.g. https://uber.com)"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isScanning}
            className="flex-1 bg-transparent text-white px-6 py-4 outline-none placeholder:text-neutral-600 font-mono text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isScanning || !url}
            className="px-8 py-4 rounded-full bg-white text-black font-bold uppercase tracking-widest text-xs flex items-center gap-3 hover:bg-neutral-200 transition-gpu disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScanning ? (
               <><Cpu className="w-4 h-4 animate-spin text-[#10B981]" /> Analyzing...</>
            ) : (
               <>Strike <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </form>

      {/* Scanning Overlay State */}
      <AnimatePresence>
        {isScanning && !streamText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full p-4 rounded-2xl bg-[#10B981]/5 border border-[#10B981]/20 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
               <ShieldAlert className="w-5 h-5 text-[#10B981] animate-pulse" />
               <span className="text-xs font-mono text-[#10B981] uppercase tracking-widest">NVIDIA NIM Live Analysis</span>
            </div>
            <span className="text-[10px] font-bold text-white font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" /> Processing...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Response */}
      <AnimatePresence>
        {streamText && (
          <motion.div
            ref={responseRef}
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0 }}
            className="w-full rounded-2xl bg-black/80 border border-[#10B981]/20 p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(16,185,129,0.1)]"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#10B981] font-mono">War Room Intelligence</span>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed font-mono whitespace-pre-wrap">{streamText}<span className="inline-block w-1.5 h-4 bg-[#10B981] ml-0.5 animate-pulse" /></p>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-neutral-600 font-mono">Powered by NVIDIA NIM × Nemotron</span>
              <a href="/dashboard/war-room" className="text-[10px] font-bold uppercase tracking-widest text-[#10B981] hover:text-emerald-300 transition-colors">Full Audit →</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Bar */}
      {!streamText && (
        <div className="flex items-center gap-6 mt-4 opacity-50">
           <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-white flex items-center gap-2">
             <Search className="w-3 h-3" /> Live OSINT
           </span>
           <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-white flex items-center gap-2">
             <Sparkles className="w-3 h-3" /> Real AI — Not a Demo
           </span>
        </div>
      )}
    </div>
  );
}
