"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Swords, Target, Crosshair, Radar, AlertTriangle, Terminal, Zap } from "lucide-react";

export default function MarketIntelligence() {
  const [target, setTarget] = useState("");
  const [scanning, setScanning] = useState(false);
  const [useWarRoom, setUseWarRoom] = useState(false);
  const [intel, setIntel] = useState<{domain: string, threatLevel: string, vulnerabilities: string[], counterStrikes: string[]} | null>(null);
  const [warRoomResult, setWarRoomResult] = useState<{synthesis: string, perspectives: Array<{role: string, analysis: string}>, confidence: number, duration: string} | null>(null);

  const initiateTacticalScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setScanning(true);
    setIntel(null);
    setWarRoomResult(null);

    try {
      if (useWarRoom) {
        // Full Agent Team — 4 specialists analyze in parallel + debate
        const res = await fetch("/api/agents/war-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objective: `Deep competitive analysis of ${target}. Find weaknesses, pricing gaps, technical vulnerabilities, and growth opportunities we can exploit.`, team: "war-room" }),
        });
        const data = await res.json();
        setWarRoomResult({
          synthesis: data.synthesis || data.result?.synthesis || "Analysis complete.",
          perspectives: data.perspectives || data.result?.perspectives || [],
          confidence: data.confidence || data.result?.confidence || 0.75,
          duration: data.duration || data.result?.duration || "—",
        });
      } else {
        // Quick single-agent scan
        const res = await fetch("/api/agents/competitor-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target }),
        });
        const data = await res.json();
        if (data.success) {
          setIntel({
            domain: target,
            threatLevel: data.threat_level || "HIGH",
            vulnerabilities: data.vulnerabilities || [],
            counterStrikes: data.counter_strikes || [],
          });
        } else {
          setIntel({
            domain: target,
            threatLevel: "UNKNOWN",
            vulnerabilities: ["Scan failed — check your API keys in Settings."],
            counterStrikes: ["Ensure a Tavily or Gemini key is configured."],
          });
        }
      }
    } catch {
      setIntel({
        domain: target,
        threatLevel: "ERROR",
        vulnerabilities: ["Network error during scan."],
        counterStrikes: ["Check your connection and try again."],
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 lg:p-8" role="main" aria-label="Competitor analysis">
      
      {/* Header */}
      <header className="border-b border-emerald-500/20 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Swords className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-white">Market Intelligence</h1>
            <p className="text-neutral-500 font-mono text-xs uppercase tracking-widest mt-1">Deep Analysis Engine</p>
          </div>
        </div>
      </header>

      {/* Analysis Form */}
      <div className="bg-black/60 backdrop-blur-3xl border border-emerald-500/20 rounded-3xl p-8 shadow-[0_0_50px_rgba(16,185,129,0.05)]">
         <h2 className="text-xl font-bold font-serif mb-6 flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-emerald-400" /> Analyze a Market or Company
         </h2>
         {/* War Room Toggle */}
         <div className="flex items-center gap-3 mb-6">
           <button
             type="button"
             onClick={() => setUseWarRoom(false)}
             className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${!useWarRoom ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-white/[0.02] text-neutral-500 border border-white/[0.06]"}`}
           >
             Quick Scan
           </button>
           <button
             type="button"
             onClick={() => setUseWarRoom(true)}
             className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${useWarRoom ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/[0.02] text-neutral-500 border border-white/[0.06]"}`}
           >
             <Swords className="w-3 h-3" /> War Room (4 Agents)
           </button>
         </div>

         <form onSubmit={initiateTacticalScan} className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
               <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500/50" />
               <input
                 type="text"
                 placeholder="e.g., example.com"
                 value={target}
                 onChange={(e) => setTarget(e.target.value)}
                 aria-label="Website or company to analyze"
                 className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl py-4 pl-12 pr-4 text-white font-mono placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
               />
            </div>
            <button
              type="submit"
              disabled={!target || scanning}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold uppercase tracking-widest text-xs px-8 py-4 rounded-xl transition-gpu disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {scanning ? (
                 <><Radar className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                 <><Target className="w-4 h-4" /> Initiate Scan</>
              )}
            </button>
         </form>
      </div>

      {/* Analysis Loading */}
      {scanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 border border-emerald-500/20 bg-black/40 rounded-3xl" aria-live="polite">
           <Radar className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-6 opacity-80" />
           <h3 className="text-xl font-bold font-serif text-white mb-2">Analyzing Market Data</h3>
           <p className="text-neutral-500 text-sm font-mono">Crawling website structure... Extracting positioning data... Identifying opportunities...</p>
        </motion.div>
      )}

      {intel && !scanning && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-2 gap-6" aria-live="polite">
           {/* Opportunities */}
           <div className="bg-black/60 border border-amber-500/20 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-8">
                 <AlertTriangle className="w-6 h-6 text-amber-500" />
                 <h2 className="text-xl font-bold font-serif text-white">Market Gaps Identified</h2>
              </div>
              <ul className="space-y-4">
                 {intel.vulnerabilities.map((vuln: string, i: number) => (
                    <li key={i} className="flex gap-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                       <span className="text-amber-500 font-mono font-bold">0{i+1}</span>
                       <p className="text-sm text-neutral-300">{vuln}</p>
                    </li>
                 ))}
              </ul>
           </div>

           {/* Strategic Opportunities */}
           <div className="bg-black/60 border border-emerald-500/20 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-8">
                 <Zap className="w-6 h-6 text-emerald-500" />
                 <h2 className="text-xl font-bold font-serif text-white">Strategic Opportunities</h2>
              </div>
              <ul className="space-y-4">
                 {intel.counterStrikes.map((strike: string, i: number) => (
                    <li key={i} className="flex gap-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                       <span className="text-emerald-500 font-mono font-bold">0{i+1}</span>
                       <p className="text-sm text-neutral-300">{strike}</p>
                    </li>
                 ))}
              </ul>
           </div>
        </motion.div>
      )}
      {/* War Room Multi-Agent Results */}
      {warRoomResult && !scanning && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" aria-live="polite">
          {/* Confidence + Duration */}
          <div className="flex items-center gap-4 text-sm">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
              {Math.round(warRoomResult.confidence * 100)}% Confidence
            </span>
            <span className="text-neutral-600 text-xs font-mono">{warRoomResult.duration}</span>
            <span className="text-neutral-600 text-xs">{warRoomResult.perspectives.length} agent perspectives</span>
          </div>

          {/* Synthesis */}
          <div className="bg-black/60 border border-emerald-500/20 rounded-3xl p-8">
            <h2 className="text-xl font-bold font-serif text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-500" /> Battle Plan (Synthesized)
            </h2>
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-neutral-300 leading-relaxed font-sans">{warRoomResult.synthesis}</pre>
            </div>
          </div>

          {/* Individual Perspectives */}
          <div className="grid lg:grid-cols-2 gap-4">
            {warRoomResult.perspectives.map((p, i) => (
              <div key={i} className="bg-black/40 border border-white/[0.06] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-widest">{p.role}</span>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-neutral-400 leading-relaxed font-sans max-h-48 overflow-y-auto custom-scrollbar">{p.analysis}</pre>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
