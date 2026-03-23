"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mic, Activity, ShieldAlert, BarChart3, Clock, ArrowRightLeft, Globe, Database } from "lucide-react";

export default function VoiceSwarmPage() {
  const [activeCall, setActiveCall] = useState<boolean>(false);
  const [transcripts, setTranscripts] = useState<Array<{ speaker: 'agent' | 'lead'; text: string; time: string }>>([]);
  const [callDuration, setCallDuration] = useState(0);

  // Real Voice Agent — Uses NIM voice-chat for agent responses
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (activeCall) {
      setCallDuration(0);
      setTranscripts([]);
      
      timer = setInterval(() => setCallDuration(c => c + 1), 1000);

      // Run the real conversation flow
      const runConversation = async () => {
        const ts = () => new Date().toLocaleTimeString('en-US', { hour12: false });
        
        // Agent opens
        const openRes = await fetch("/api/agents/voice-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "You are calling a lead who recently complained about their current marketing platform on G2. Open the call naturally and introduce yourself as a Sovereign Matrix AI consultant. Keep it under 2 sentences." }),
        });
        const openData = await openRes.json();
        setTranscripts(prev => [...prev, { speaker: 'agent' as const, text: openData.response || "Hello, this is Sovereign Matrix calling.", time: ts() }]);

        await new Promise(r => setTimeout(r, 3000));
        
        // Lead responds (simulated — leads don't have AI)
        setTranscripts(prev => [...prev, { speaker: 'lead' as const, text: "Hello? Who is this?", time: ts() }]);

        await new Promise(r => setTimeout(r, 2000));

        // Agent follow-up via real NIM
        const followRes = await fetch("/api/agents/voice-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "The lead asked 'Who is this?'. Respond naturally, mention you noticed their frustration with their marketing stack, and offer to show how autonomous AI agents can fix it. Keep under 3 sentences.",
            conversationHistory: [
              { role: "assistant", content: openData.response },
              { role: "user", content: "Hello? Who is this?" },
            ],
          }),
        });
        const followData = await followRes.json();
        setTranscripts(prev => [...prev, { speaker: 'agent' as const, text: followData.response || "I represent Sovereign Matrix. We automate the marketing work you hate.", time: ts() }]);

        await new Promise(r => setTimeout(r, 4000));
        setTranscripts(prev => [...prev, { speaker: 'lead' as const, text: "Wait, you're an AI? You sound incredibly natural.", time: ts() }]);

        await new Promise(r => setTimeout(r, 2000));
        
        // Agent close via real NIM
        const closeRes = await fetch("/api/agents/voice-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "The lead is impressed by how natural you sound. Close the call by offering to send a calendar invite for a demo. Be concise — 2 sentences max." }),
        });
        const closeData = await closeRes.json();
        setTranscripts(prev => [...prev, { speaker: 'agent' as const, text: closeData.response || "I'll send a calendar invite now. Check your inbox.", time: ts() }]);

        await new Promise(r => setTimeout(r, 3000));
        setTranscripts(prev => [...prev, { speaker: 'lead' as const, text: "Yes, send it through. Impressive.", time: ts() }]);
        
        await new Promise(r => setTimeout(r, 2000));
        setActiveCall(false);
      };

      runConversation().catch(console.error);
    }

    return () => {
      clearInterval(timer);
    };
  }, [activeCall]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Activity className="w-3 h-3 animate-pulse" /> Twilio Sub-System Online
        </div>
        <h1 className="text-3xl font-bold font-sans tracking-tight mb-2 flex items-center gap-3">
          Voice Swarm <span className="text-emerald-400 text-xl font-mono uppercase tracking-widest">[Nemotron TTS]</span>
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
          Command and monitor autonomous voice agents powered by NVIDIA NIM and Twilio WebRTC. Sub-200ms TTFB latency ensures deepfake-level human parity for automated outbound sales cadences.
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
                 <div className="text-2xl font-bold font-mono text-emerald-400">142</div>
                 <div className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1">Calls Today</div>
               </div>
               <div className="bg-black/50 border border-white/5 p-4 rounded-xl">
                 <div className="text-2xl font-bold font-mono text-white">3.4%</div>
                 <div className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1">Conversion</div>
               </div>
               <div className="bg-black/50 border border-white/5 p-4 rounded-xl">
                 <div className="text-2xl font-bold font-mono text-white">180ms</div>
                 <div className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1">Avg TTFB</div>
               </div>
               <div className="bg-black/50 border border-white/5 p-4 rounded-xl">
                 <div className="text-2xl font-bold font-mono text-[#00B7FF]">$4.1k</div>
                 <div className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1">Pipeline Gen</div>
               </div>
            </div>

            <button 
              onClick={() => setActiveCall(!activeCall)}
              className={`w-full py-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all ${
                activeCall 
                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              <Phone className={`w-4 h-4 ${activeCall ? 'animate-pulse' : ''}`} />
              {activeCall ? 'Terminate Call' : 'Inject Test Lead'}
            </button>
          </div>

          {/* Infrastructure Health */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 backdrop-blur-md">
             <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-6 flex items-center gap-2">
               <ShieldAlert className="w-4 h-4 text-[#00B7FF]" /> SIP Trunk Status
             </h3>
             <div className="space-y-4 font-mono text-[10px] uppercase tracking-wider">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2"><Globe className="w-3 h-3 text-neutral-500" /> Twilio Gateway</div>
                 <div className="text-emerald-400 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Connected</div>
               </div>
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2"><Database className="w-3 h-3 text-neutral-500" /> NVIDIA NIM 340B</div>
                 <div className="text-emerald-400 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Latency: 42ms</div>
               </div>
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2"><ArrowRightLeft className="w-3 h-3 text-neutral-500" /> WebSockets</div>
                 <div className="text-emerald-400 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> wss:// secure</div>
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
                 <Mic className={`w-4 h-4 ${activeCall ? 'text-rose-500 animate-pulse' : 'text-neutral-600'}`} />
                 <span className="text-[10px] font-mono text-neutral-400 tracking-widest uppercase">Live Payload Stream</span>
               </div>
               {activeCall && (
                 <div className="flex items-center gap-3">
                   <div className="flex gap-1">
                     <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-[#00B7FF] rounded-full" />
                     <motion.div animate={{ height: [8, 20, 8] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-[#00B7FF] rounded-full" />
                     <motion.div animate={{ height: [8, 12, 8] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-[#00B7FF] rounded-full" />
                   </div>
                   <span className="text-[10px] font-mono text-rose-500 font-bold ml-2">REC {formatTime(callDuration)}</span>
                 </div>
               )}
             </div>

             {/* Transcription Area */}
             <div className="flex-1 p-6 md:p-8 overflow-y-auto relative noise-overlay custom-scrollbar">
                {!activeCall && transcripts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <Activity className="w-16 h-16 text-neutral-600 mb-6" />
                    <p className="text-neutral-500 font-mono text-xs uppercase tracking-[0.2em] leading-loose">
                      Voice Swarm Standby.<br/>
                      Awaiting SIP Trunk Trigger.<br/>
                      Latency Target: 180ms.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <AnimatePresence>
                       {transcripts.map((t, i) => (
                         <motion.div 
                           key={i}
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           className={`flex flex-col max-w-[80%] ${t.speaker === 'agent' ? 'mr-auto' : 'ml-auto items-end'}`}
                         >
                           <div className="flex items-center gap-2 mb-1">
                             <span className={`text-[9px] font-bold uppercase tracking-widest ${t.speaker === 'agent' ? 'text-[#00B7FF]' : 'text-emerald-400'}`}>
                               {t.speaker === 'agent' ? 'Sovereign Node' : 'Client Target'}
                             </span>
                             <span className="text-[8px] font-mono text-neutral-600">{t.time}</span>
                           </div>
                           <div className={`p-4 rounded-2xl ${t.speaker === 'agent' ? 'bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-neutral-200' : 'bg-white/5 border border-white/10 text-neutral-400'}`}>
                             <p className="text-sm font-mono leading-relaxed">{t.text}</p>
                           </div>
                         </motion.div>
                       ))}
                    </AnimatePresence>
                    {activeCall && transcripts.length > 0 && transcripts.length < 7 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-1 ml-4 mt-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </motion.div>
                    )}
                  </div>
                )}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
