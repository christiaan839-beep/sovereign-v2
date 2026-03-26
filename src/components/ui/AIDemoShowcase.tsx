"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Phone, BrainCircuit, ShieldAlert, Cpu, Globe } from "lucide-react";

type DemoMode = "idle" | "scraping" | "calling" | "deepfake" | "warroom" | "antigravity";

export function AIDemoShowcase() {
  const [mode, setMode] = useState<DemoMode>("idle");
  const [logs, setLogs] = useState<string[]>([]);

  const startSimulation = (selectedMode: DemoMode) => {
    setMode(selectedMode);
    setLogs([]);

    const sequences: Record<DemoMode, string[]> = {
      idle: [],
      scraping: [
        "> Initializing NemoClaw Daemon...",
        "> Bypassing Cloudflare Captcha (Success)",
        "> Connecting to Chrome Headless via CDP...",
        "> Target: competitor-agency.com/pricing",
        "> Extracting Tokenized DOM Data...",
        "> 4,209 Leads Identified in Hidden API Array.",
        "> Pushing payloads to Neon PostgreSQL.",
        "> Scraping Completed in 0.8s."
      ],
      calling: [
        "> Connecting to Twilio WebRTC Tunnel...",
        "> Initializing Nemotron-340B Instruct...",
        "> Outbound Dial: +1 (555) 019-4822",
        "> [CLIENT]: Hello, who is this?",
        "> [SWARM]: Hi there! I noticed your recent LinkedIn post about scaling issues. I am an autonomous agent representing Sovereign. Do you have 30 seconds?",
        "> [CLIENT]: Uh, sure? You're an AI?",
        "> [SWARM]: Yes. And in the 14 seconds we've been speaking, I have pre-qualified your agency for a $50k MRR boost. Shall I send the calendar invite?",
        "> Call Terminated. Lead Booked. Stripe Invoice Generated."
      ],
      warroom: [
        "> Google A2A Multi-Agent Protocol Initiated...",
        "> Node 1 (DeepSeek) analyzing target math...",
        "> Node 2 (Llama 3.3) attacking logic vulnerabilities...",
        "> Node 3 (Gemini 2.5) processing multimedia context...",
        "> Node 4 (Nemotron) forcing consensus...",
        "> STRATEGY LOCKED: Execute multi-channel SMS sequence at 08:00 AM."
      ],
      deepfake: [
        "> Spawning NVIDIA Omniverse Audio2Face...",
        "> Loading Veo 3.1 Video Generators...",
        "> Mapping facial mesh to phoneme output...",
        "> Synchronizing lip movements to Nemotron TTS...",
        "> Rendering 4K MP4 stream to iOS client...",
        "> Payload deployed via Telegram webhook."
      ],
      antigravity: [
        "> ANTIGRAVITY IDE HOOKED...",
        "> Scanning local repository for legacy bottlenecks...",
        "> Jules Code Assistant mapping dependencies...",
        "> Refactoring 400 lines of spaghetti React into optimized Turbopack components...",
        "> Committing to master. Pushing to Vercel...",
        "> Deployment Live. Zero Human Intervention."
      ]
    };

    const sequence = sequences[selectedMode];
    if (!sequence) return;

    let delay = 0;
    sequence.forEach((log) => {
      delay += 1200;
      setTimeout(() => {
        setLogs(prev => [...prev, log]);
      }, delay);
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl bg-black border border-white/10 overflow-hidden shadow-[0_0_80px_rgba(255,255,255,0.05)]">
      {/* Chrome Window Header */}
      <div className="h-12 border-b border-white/10 bg-white/[0.02] flex items-center px-4 justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
          <ShieldAlert className="w-3 h-3" /> Live Output Console
        </div>
      </div>

      <div className="grid lg:grid-cols-2 min-h-[500px]">
        {/* Left Side: Simulation Controls */}
        <div className="border-r border-white/10 p-8 flex flex-col gap-6">
          <div>
             <h3 className="text-xl font-bold text-white mb-2 font-serif uppercase tracking-widest text-[#10B981]">Test The Swarm</h3>
             <p className="text-sm text-neutral-400">Select an enterprise capability below to watch the Sovereign Matrix execute it autonomously in real-time.</p>
          </div>

          <div className="flex flex-col gap-3 flex-1">
            <button 
              onClick={() => startSimulation("antigravity")}
              className={`p-4 rounded-xl border flex items-center gap-4 transition-gpu text-left group ${mode === "antigravity" ? 'border-[#10B981] bg-[#10B981]/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
            >
              <div className={`p-2 rounded-lg ${mode === "antigravity" ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-white/5 text-neutral-400'}`}>
                 <Cpu className="w-5 h-5" />
              </div>
              <div>
                 <div className={`text-sm font-bold uppercase tracking-widest ${mode === "antigravity" ? 'text-[#10B981]' : 'text-neutral-200'}`}>Antigravity Codegen</div>
                 <div className="text-[10px] text-neutral-500 uppercase">Autonomous App Generation</div>
              </div>
            </button>

            <button 
              onClick={() => startSimulation("calling")}
              className={`p-4 rounded-xl border flex items-center gap-4 transition-gpu text-left group ${mode === "calling" ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
            >
              <div className={`p-2 rounded-lg ${mode === "calling" ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-neutral-400'}`}>
                 <Phone className="w-5 h-5" />
              </div>
              <div>
                 <div className={`text-sm font-bold uppercase tracking-widest ${mode === "calling" ? 'text-emerald-400' : 'text-neutral-200'}`}>Nemotron Voice AI</div>
                 <div className="text-[10px] text-neutral-500 uppercase">Sub-200ms Twilio Calling</div>
              </div>
            </button>

            <button 
              onClick={() => startSimulation("scraping")}
              className={`p-4 rounded-xl border flex items-center gap-4 transition-gpu text-left group ${mode === "scraping" ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
            >
              <div className={`p-2 rounded-lg ${mode === "scraping" ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-neutral-400'}`}>
                 <Globe className="w-5 h-5" />
              </div>
              <div>
                 <div className={`text-sm font-bold uppercase tracking-widest ${mode === "scraping" ? 'text-amber-400' : 'text-neutral-200'}`}>NemoClaw Scraping</div>
                 <div className="text-[10px] text-neutral-500 uppercase">Headless Chrome Penetration</div>
              </div>
            </button>

             <button 
              onClick={() => startSimulation("warroom")}
              className={`p-4 rounded-xl border flex items-center gap-4 transition-gpu text-left group ${mode === "warroom" ? 'border-rose-500 bg-rose-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
            >
              <div className={`p-2 rounded-lg ${mode === "warroom" ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5 text-neutral-400'}`}>
                 <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                 <div className={`text-sm font-bold uppercase tracking-widest ${mode === "warroom" ? 'text-rose-400' : 'text-neutral-200'}`}>Google A2A Protocol</div>
                 <div className="text-[10px] text-neutral-500 uppercase">Multi-Agent War Room</div>
              </div>
            </button>
          </div>
        </div>

        {/* Right Side: Terminal Output */}
        <div className="bg-[#050505] p-6 lg:p-8 font-mono overflow-y-auto relative">
           <div className="absolute inset-0 noise-overlay pointer-events-none" />

           <div className="relative z-10 flex flex-col h-full">
              {mode === "idle" ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-4">
                   <Terminal className="w-12 h-12 text-white" />
                   <p className="text-xs uppercase tracking-widest text-white">System Standby. Awaiting Directive.</p>
                </div>
              ) : (
                <div className="space-y-4">
                   <AnimatePresence>
                     {logs.map((log, i) => (
                       <motion.div 
                         key={i}
                         initial={{ opacity: 0, x: -10 }}
                         animate={{ opacity: 1, x: 0 }}
                         className={`text-sm ${
                           log.includes("[SWARM]") ? "text-[#10B981] font-bold"
                           : log.includes("[CLIENT]") ? "text-white"
                           : log.includes("Success") || log.includes("Generated") || log.includes("Live") || log.includes("LOCKED") ? "text-emerald-400 font-bold"
                           : "text-neutral-400"
                         }`}
                       >
                         {log}
                       </motion.div>
                     ))}
                   </AnimatePresence>
                   {logs.length > 0 && logs.length < 8 && (
                     <motion.div 
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       transition={{ repeat: Infinity, duration: 0.8 }}
                       className="w-3 h-5 bg-white/50"
                     />
                   )}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
