"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Phone, Mic, Activity, ShieldAlert, BarChart3, ArrowRightLeft, Globe, Database, Settings } from "lucide-react";

export default function VoiceSwarmPage() {
  const router = useRouter();

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white" role="main" aria-label="Voice swarm module">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-500/10 border border-neutral-500/20 text-neutral-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Activity className="w-3 h-3" /> Voice Module
        </div>
        <h1 className="text-3xl font-bold font-sans tracking-tight mb-2 flex items-center gap-3">
          Voice Swarm
          <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest">Not Configured</span>
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
          Deploy AI voice agents that make calls, qualify leads, and book meetings automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Metrics & Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Status Panel */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#00B7FF] mb-6 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Global Telemetry
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
               <div className="bg-black/50 border border-white/5 p-4 rounded-xl">
                 <div className="text-2xl font-bold font-mono text-neutral-500">&mdash;</div>
                 <div className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1">Calls Today</div>
               </div>
               <div className="bg-black/50 border border-white/5 p-4 rounded-xl">
                 <div className="text-2xl font-bold font-mono text-neutral-500">&mdash;</div>
                 <div className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1">Conversion</div>
               </div>
               <div className="bg-black/50 border border-white/5 p-4 rounded-xl">
                 <div className="text-2xl font-bold font-mono text-neutral-500">&mdash;</div>
                 <div className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1">Avg TTFB</div>
               </div>
               <div className="bg-black/50 border border-white/5 p-4 rounded-xl">
                 <div className="text-2xl font-bold font-mono text-neutral-500">&mdash;</div>
                 <div className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1">Pipeline Gen</div>
               </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-center space-y-2">
              <Settings className="w-5 h-5 text-amber-400 mx-auto" />
              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Setup Required</p>
              <p className="text-[10px] text-neutral-500">Voice agents require setup. Go to Settings → API Keys to add your voice service credentials.</p>
            </div>
          </div>

          {/* Infrastructure Health */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 backdrop-blur-md">
             <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-6 flex items-center gap-2">
               <ShieldAlert className="w-4 h-4 text-[#00B7FF]" /> SIP Trunk Status
             </h3>
             <div className="space-y-4 font-mono text-[10px] uppercase tracking-wider">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2"><Globe className="w-3 h-3 text-neutral-500" /> Twilio Gateway</div>
                 <div className="text-neutral-500 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full" /> Not configured</div>
               </div>
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2"><Database className="w-3 h-3 text-neutral-500" /> ElevenLabs TTS</div>
                 <div className="text-neutral-500 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full" /> API key required</div>
               </div>
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2"><ArrowRightLeft className="w-3 h-3 text-neutral-500" /> WebSockets</div>
                 <div className="text-neutral-500 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full" /> Standby</div>
               </div>
             </div>
          </div>
        </div>

        {/* Right Column: Live Transcription Stream */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="h-full min-h-[600px] flex flex-col rounded-2xl bg-black border border-white/10 shadow-[0_0_50px_rgba(0,183,255,0.03)] overflow-hidden">
             
             {/* Terminal Header */}
             <div className="h-14 border-b border-white/10 bg-white/[0.01] flex items-center justify-between px-6">
               <div className="flex items-center gap-4">
                 <Mic className="w-4 h-4 text-neutral-500" />
                 <span className="text-[10px] font-mono text-neutral-400 tracking-widest uppercase">Live Payload Stream</span>
               </div>
             </div>

             {/* Empty State — Configuration required */}
             <div className="flex-1 p-6 md:p-8 overflow-y-auto relative noise-overlay custom-scrollbar">
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Phone className="w-10 h-10 text-neutral-700" />
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <p className="text-sm font-bold text-white">Voice agents require setup</p>
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      Add your voice service credentials in Settings &rarr; API Keys to enable real-time calls, transcription, and voice synthesis.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/dashboard/settings/api-keys")}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#00B7FF]/10 text-[#00B7FF] border border-[#00B7FF]/30 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#00B7FF]/20 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4" /> Configure Voice Agents
                  </button>
                </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
