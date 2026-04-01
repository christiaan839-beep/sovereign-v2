"use client";

import React, { useState, useEffect, useRef } from "react";
import { Ghost, ShieldAlert, Target, Terminal, Search, User, MessageSquare, Zap, Crosshair } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface GhostResult {
  lead: {
    name: string;
    title: string;
    company: string;
    linkedIn: string;
  };
  complaint: {
    source: string;
    text: string;
  };
  draftMessage: string;
}

export default function GhostProtocolDashboard() {
  const [target, setTarget] = useState("");
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [result, setResult] = useState<GhostResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const startGhostFleet = async () => {
    if (!target) return;

    setIsDeploying(true);
    setPhase(1);
    setResult(null);
    setLogs([]);
    addLog(`INITIATING GHOST FLEET for target: ${target}`);
    addLog("PHASE 1: Scraping G2 & ProductHunt for negative sentiment...");

    try {
      setPhase(2);
      addLog("Researching competitor data...");

      const res = await fetch("/api/agents/ghost-fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorName: target }),
      });

      if (!res.ok) throw new Error("API Connection Failed");

      setPhase(3);
      addLog("Analyzing results and generating outreach...");

      const data = await res.json();

      setResult(data);
      setPhase(4);
      setIsDeploying(false);
      addLog("Analysis complete. Outreach draft ready.");

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      addLog(`ERROR: ${message}`);
      setIsDeploying(false);
      setPhase(0);
    }
  };

  const executeNemoClaw = async () => {
    const nemoclawUrl = process.env.NEXT_PUBLIC_NEMOCLAW_URL || null;
    if (!nemoclawUrl) {
      addLog("NemoClaw is not configured. Go to Settings \u2192 API Keys to set your NemoClaw URL.");
      addLog("NemoClaw requires a local daemon. This feature is for users running Sovereign Matrix on their own hardware. See docs for setup instructions.");
      return;
    }

    addLog("WARNING: Handing off payload to local OpenClaw daemon...");
    addLog("NemoClaw taking physical control of OS to dispatch LinkedIn connection request.");

    try {
      const res = await fetch(`${nemoclawUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openclaw-agent",
          messages: [{ role: "user", content: `Please go to ${result?.lead.linkedIn} and send this message: ${result?.draftMessage}` }]
        })
      });
      if (res.ok) addLog("OpenClaw acknowledged. Physical execution initiated.");
      else addLog("OpenClaw daemon did not respond successfully. Check your NemoClaw configuration.");
    } catch {
      addLog("NemoClaw requires a local daemon. This feature is for users running Sovereign Matrix on their own hardware. See docs for setup instructions.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] p-6 lg:p-10 font-mono text-[#00B7FF] bg-[#050505]" role="main" aria-label="Ghost fleet SDR pipeline">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="border-b border-[#00B7FF]/30 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-[0.2em] flex items-center gap-4 text-white">
              <Ghost className="w-8 h-8 text-[#00B7FF]" />
              Ghost Fleet SDR
            </h1>
            <p className="text-[#00B7FF]/60 mt-2 uppercase text-xs tracking-widest flex items-center gap-2">
              <Crosshair className="w-4 h-4" /> Competitor Outreach Pipeline
            </p>
            <p className="text-sm text-neutral-400 mt-2 normal-case tracking-normal max-w-xl">
              Analyze competitor reviews and auto-generate targeted outreach sequences.
            </p>
          </div>
          <div className="text-right text-xs bg-black/50 p-3 rounded-lg border border-red-500/20">
            <p className="text-red-500 flex items-center justify-end gap-2 font-bold uppercase">
              <ShieldAlert className="w-4 h-4" /> RESTRICTED ASSET
            </p>
            <p className="text-red-400/60 mt-1">Requires NemoClaw Edge Daemon</p>
          </div>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Left Column: Command Entry */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                <Target className="w-5 h-5 text-[#00B7FF]" />
                Acquire Target
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-2">Competitor Name or Domain</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      aria-label="Competitor name or domain"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#00B7FF]/50 transition-colors placeholder:text-neutral-500"
                      placeholder="e.g. Salesforce, GoHighLevel, HubSpot"
                      value={target}
                      onChange={e => setTarget(e.target.value)}
                      disabled={isDeploying}
                    />
                  </div>
                </div>

                <button 
                  onClick={startGhostFleet}
                  disabled={!target || isDeploying}
                  className="w-full bg-[#00B7FF]/10 border border-[#00B7FF]/30 text-[#00B7FF] font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-[#00B7FF] hover:text-black transition-gpu disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Ghost className="w-5 h-5" />
                  {isDeploying ? "Sniper Active..." : "Initiate Ghost Fleet"}
                </button>
              </div>

              {/* Progress Tracker */}
              <div className="mt-8 space-y-4">
                {[
                  { p: 1, label: "Scraping Complaints" },
                  { p: 2, label: "Apollo Enrichment" },
                  { p: 3, label: "Nemotron Synthesis" },
                  { p: 4, label: "Target Locked" }
                ].map((step, idx) => (
                  <div key={idx} className={`flex items-center gap-3 text-xs uppercase tracking-widest ${phase >= step.p ? "text-white" : "text-neutral-500"}`}>
                    <div className={`w-3 h-3 rounded-full border ${phase > step.p ? "bg-[#00B7FF] border-[#00B7FF]" : phase === step.p ? "border-[#00B7FF] animate-ping" : "border-neutral-700"}`} />
                    {step.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Terminal Feed */}
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 h-48 flex flex-col">
              <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
                <Terminal className="w-4 h-4 text-neutral-400" />
                <span className="text-[10px] text-neutral-400 uppercase tracking-widest">NemoClaw Console</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {logs.map((log, i) => (
                  <p key={i} className={`text-[10px] leading-relaxed ${log.includes("ERROR") || log.includes("WARNING") ? "text-red-400" : log.includes("SUCCESS") ? "text-emerald-400" : "text-neutral-400"}`}>
                    {log}
                  </p>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>
          </div>

          {/* Right Column: The Payload */}
          <div className="lg:col-span-7">
            <div className="bg-black/40 border border-[#00B7FF]/20 rounded-2xl h-full p-6 relative overflow-hidden flex flex-col">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#00B7FF05_1px,transparent_1px),linear-gradient(to_bottom,#00B7FF05_1px,transparent_1px)] bg-[size:1rem_1rem] pointer-events-none" />
              
              {!result ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center relative z-10">
                  <Ghost className="w-24 h-24 mb-6 text-[#00B7FF] animate-pulse" />
                  <p className="text-sm uppercase tracking-widest text-[#00B7FF]">Awaiting Target Acquistion</p>
                  <p className="text-xs text-neutral-500 mt-2 max-w-sm">Enter a competitor name to intercept negative sentiment and synthesize a sniper outreach payload.</p>
                </div>
              ) : (
                <AnimatePresence>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 flex flex-col h-full space-y-6"
                  >
                    {/* The Target Card */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-[#00B7FF]/10 border border-[#00B7FF]/30 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-[#00B7FF]" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-lg">{result.lead.name}</h3>
                          <p className="text-xs text-[#00B7FF] uppercase tracking-widest">{result.lead.title} at {result.lead.company}</p>
                        </div>
                      </div>
                      <div className="bg-black/50 p-4 border border-red-500/20 rounded-lg">
                         <span className="text-[10px] text-red-500 uppercase font-bold tracking-widest block mb-2 flex items-center gap-1">
                           <ShieldAlert className="w-3 h-3" /> Intercepted {result.complaint.source} Complaint:
                         </span>
                         <p className="text-sm text-neutral-300 italic">&ldquo;{result.complaint.text}&rdquo;</p>
                      </div>
                    </div>

                    {/* The Payload Card */}
                    <div className="bg-white/5 border border-[#00B7FF]/30 rounded-xl p-5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] text-[#00B7FF] uppercase font-bold tracking-widest flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" /> Synthesized Outreach (Nemotron 340B)
                        </span>
                      </div>
                      <div className="flex-1 bg-black/50 p-4 border border-white/10 rounded-lg text-white text-sm leading-relaxed backdrop-blur-sm">
                        {result.draftMessage}
                      </div>
                    </div>

                    {/* The Trigger */}
                    <button 
                      onClick={executeNemoClaw}
                      className="w-full bg-red-600/20 border border-red-500 text-red-500 font-black uppercase tracking-widest py-4 rounded-xl hover:bg-red-600 hover:text-white hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-gpu flex items-center justify-center gap-3"
                    >
                      <Zap className="w-5 h-5 fill-current" />
                      Deploy via NemoClaw (Local RPA)
                    </button>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
