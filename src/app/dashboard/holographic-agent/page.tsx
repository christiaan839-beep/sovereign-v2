"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
const HolographicAgent = dynamic(() => import('@/components/3d/HolographicAgent').then(m => m.HolographicAgent), {
  ssr: false,
  loading: () => <div className="w-full h-[300px] rounded-xl bg-white/[0.02] animate-pulse" />,
});
import { Mic, PhoneCall, Activity, Server, RadioReceiver } from 'lucide-react';

export default function HolographicAgentDashboard() {
  const [callActive, setCallActive] = useState(false);
  const [speakCycle, setSpeakCycle] = useState(0);

  // Deterministic speaking cycle during active call
  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => setSpeakCycle(c => c + 1), 2000);
    return () => clearInterval(interval);
  }, [callActive]);

  // Derived state — no setState in effect body
  const isSpeaking = callActive && speakCycle % 2 === 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-[#050505]" role="main" aria-label="Sentinel holographic array">
      <div className="border-b border-[#00B7FF]/20 pb-6">
        <h1 className="text-3xl font-bold text-white font-serif uppercase tracking-widest flex items-center gap-3">
           <Activity className="w-6 h-6 text-[#00B7FF]" />
           Sentinel Holographic Array
        </h1>
        <p className="text-neutral-400 mt-2 max-w-2xl">
          Real-time NVIDIA Audio2Face telemetry. Watch your autonomous agents execute outbound protocols in full 3D visual space.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-[600px]">
           <HolographicAgent isSpeaking={isSpeaking} />
        </div>

        <div className="space-y-6">
          {/* Control Panel */}
          <div className="bg-black/40 border border-[#00B7FF]/20 rounded-2xl p-6 backdrop-blur-md">
             <h3 className="text-[#00B7FF] font-mono text-xs tracking-widest uppercase mb-6 flex items-center gap-2">
               <RadioReceiver className="w-4 h-4" />
               Live Intercept Console
             </h3>

             <div className="space-y-4">
               <button
                 onClick={() => setCallActive(!callActive)}
                 aria-label={callActive ? "Terminate sentinel call" : "Initiate sentinel call"}
                 className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-gpu ${callActive ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30' : 'bg-[#00B7FF]/10 text-[#00B7FF] border border-[#00B7FF]/50 hover:bg-[#00B7FF]/20'}`}
               >
                 {callActive ? (
                   <><Mic className="w-5 h-5 animate-pulse" /> Terminate Connection</>
                 ) : (
                   <><PhoneCall className="w-5 h-5" /> Initiate Sentinel Call</>
                 )}
               </button>
             </div>

             {callActive && (
               <div className="mt-8 space-y-4 font-mono text-xs">
                 <div className="flex justify-between text-neutral-400">
                   <span>Target:</span>
                   <span className="text-white">+1 (555) 019-8472</span>
                 </div>
                 <div className="flex justify-between text-neutral-400">
                   <span>Node:</span>
                   <span className="text-white">US-EAST-NVIDIA-DGX</span>
                 </div>
                 <div className="flex justify-between text-neutral-400">
                   <span>Voice Sync:</span>
                   <span className="text-[#00B7FF]">Locked (14ms)</span>
                 </div>
                 <div className="p-4 bg-[#00B7FF]/10 rounded-lg border border-[#00B7FF]/20 text-[#00B7FF] animate-pulse">
                   {isSpeaking ? "Agent is speaking..." : "Agent is listening..."}
                 </div>
               </div>
             )}
          </div>

          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
             <h3 className="text-white font-mono text-xs tracking-widest uppercase mb-4 flex items-center gap-2">
               <Server className="w-4 h-4 text-neutral-500" />
               System Matrix
             </h3>
             <div className="space-y-3">
               <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                 <div className="bg-[#00B7FF] h-full w-[94%] animate-pulse" />
               </div>
               <p className="text-xs text-neutral-500 flex justify-between">
                 <span>GPU Alloc</span>
                 <span className="text-[#00B7FF]">94%</span>
               </p>
               
               <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden mt-4">
                 <div className="bg-[#00B7FF] h-full w-[22%]" />
               </div>
               <p className="text-xs text-neutral-500 flex justify-between">
                 <span>VRAM</span>
                 <span className="text-[#00B7FF]">22%</span>
               </p>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
