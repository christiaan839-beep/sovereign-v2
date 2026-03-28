"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Terminal, ShieldAlert, CheckCircle2, Play, Network, Eye, Crosshair } from "lucide-react";

function renderMessageText(text: string) {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    const thought = thinkMatch[1].trim();
    const rest = text.replace(/<think>[\s\S]*?<\/think>/, "").trim();
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 shadow-inner">
          <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2"><Network className="w-3 h-3" /> DeepSeek Internal Reasoning</p>
          <p className="text-xs font-mono text-indigo-300/70 whitespace-pre-wrap leading-relaxed">{thought}</p>
        </div>
        <p className="text-sm leading-relaxed font-mono whitespace-pre-wrap">{rest}</p>
      </div>
    );
  }
  return <p className="text-sm leading-relaxed font-mono whitespace-pre-wrap">{text}</p>;
}

export default function WarRoomColosseum() {
  const [topic, setTopic] = useState("Cold Outreach Campaign for B2B SaaS");
  const [status, setStatus] = useState<"idle" | "debating" | "consensus">("idle");
  const [messages, setMessages] = useState<Array<{
    agent: "Nemotron" | "Llama" | "Kosmos" | "DeepSeek";
    text: string;
  }>>([]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startDebate = async () => {
    setStatus("debating");
    setMessages([]);

    try {
      const res = await fetch("/api/agents/collab-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: topic, room_type: "debate" }),
      });

      if (!res.body) throw new Error("Stream not supported by server");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let consensusIndex = -1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.trim().startsWith('data: ') && line.trim() !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.replace('data: ', ''));
              
              if (data.type === 'proposal' || data.type === 'critique') {
                const mappedAgent = data.agent === 'Strategist' ? 'DeepSeek' : data.agent === 'Operator' ? 'Llama' : 'Kosmos';
                setMessages(prev => [...prev, { agent: mappedAgent, text: `${data.type.toUpperCase()}:\n${data.text}` }]);
              } else if (data.type === 'consensus_start') {
                setMessages(prev => {
                  consensusIndex = prev.length;
                  return [...prev, { agent: 'Nemotron', text: 'CONSENSUS DEPLOYMENT:\n' }];
                });
                setStatus("consensus");
              } else if (data.type === 'consensus_chunk') {
                setMessages(prev => {
                  if (consensusIndex === -1) return prev;
                  const newMsgs = [...prev];
                  newMsgs[consensusIndex] = {
                    ...newMsgs[consensusIndex],
                    text: newMsgs[consensusIndex].text + data.text
                  };
                  return newMsgs;
                });
              } else if (data.type === 'done') {
                setStatus("consensus");
              } else if (data.type === 'error') {
                setMessages(prev => [...prev, { agent: 'Nemotron', text: `[SYSTEM ERROR] ${data.text}` }]);
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } catch {
      setMessages([{ agent: "Nemotron", text: "Network error. Check your connection to the Sovereign execution layer." }]);
      setStatus("consensus");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white overflow-hidden relative" role="main" aria-label="Multi-agent war room">
      {/* Background WebGL-style Glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(99,102,241,0.05),transparent_70%)] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(0,183,255,0.03),transparent_70%)] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="mb-10 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-[#00B7FF] text-xs font-bold uppercase tracking-wider mb-3">
          <Swords className="w-3 h-3" /> 4-Node NVIDIA Protocol
        </div>
        <h1 className="text-4xl font-bold font-sans tracking-tight mb-2 flex items-center gap-3">
          Multi-Agent War Room
        </h1>
        <p className="text-sm text-neutral-400 max-w-3xl leading-relaxed">
          Input your target vector. Four highly specialized, open-weights AI models will physically debate each other in real-time. The Master Strategist, Red Team Challenger, Visual Auditor, and Orchestrator will identify logic flaws and synthesize the ultimate, battle-tested consensus before execution.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        {/* Left Col: Setup & Nodes */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Directive Input Form */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-6 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-rose-500" /> Target Directive
            </h3>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              aria-label="War room target directive"
              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#00B7FF]/50 outline-none resize-none transition-colors"
              placeholder="E.g., Design a LinkedIn outreach sequence..."
            />
            <button 
              onClick={startDebate}
              disabled={status === "debating" || !topic}
              className="w-full mt-6 py-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-gpu disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#00B7FF]/20 to-rose-600/20 text-white border-white/10 hover:border-white/20 hover:shadow-[0_0_30px_rgba(0,183,255,0.2)]"
            >
              <Swords className="w-4 h-4" /> Initiate 4-Node Debate
            </button>
          </div>

          {/* 4 Node Grid */}
          <div className="grid grid-cols-2 gap-4">
             <motion.div 
               className={`rounded-2xl border p-5 flex flex-col items-center justify-center text-center transition-gpu duration-500 ${status === 'debating' && messages.find(m => m.agent === 'DeepSeek') && !messages.find(m => m.agent === 'Nemotron') ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'border-white/5 bg-white/[0.01]'}`}
             >
                <Terminal className={`w-8 h-8 mb-3 ${status === 'debating' && !messages.find(m => m.agent === 'Nemotron') ? 'text-indigo-400 animate-pulse' : 'text-neutral-600'}`} />
                <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-1">DeepSeek-R1</h4>
                <p className="text-[9px] text-indigo-400/80 font-mono uppercase">Strategist</p>
             </motion.div>

             <motion.div 
               className={`rounded-2xl border p-5 flex flex-col items-center justify-center text-center transition-gpu duration-500 ${status === 'debating' && messages.find(m => m.agent === 'Llama') && !messages.find(m => m.agent === 'Nemotron') ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-white/5 bg-white/[0.01]'}`}
             >
                <ShieldAlert className={`w-8 h-8 mb-3 ${status === 'debating' && !messages.find(m => m.agent === 'Nemotron') ? 'text-amber-400 animate-pulse' : 'text-neutral-600'}`} />
                <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-1">Llama 3.3</h4>
                <p className="text-[9px] text-amber-400/80 font-mono uppercase">Red Team</p>
             </motion.div>

             <motion.div 
               className={`rounded-2xl border p-5 flex flex-col items-center justify-center text-center transition-gpu duration-500 ${status === 'debating' && messages.find(m => m.agent === 'Kosmos') && !messages.find(m => m.agent === 'Nemotron') ? 'border-pink-500/50 bg-pink-500/10 shadow-[0_0_20px_rgba(236,72,153,0.2)]' : 'border-white/5 bg-white/[0.01]'}`}
             >
                <Eye className={`w-8 h-8 mb-3 ${status === 'debating' && !messages.find(m => m.agent === 'Nemotron') ? 'text-pink-400 animate-pulse' : 'text-neutral-600'}`} />
                <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-1">Kosmos-2</h4>
                <p className="text-[9px] text-pink-400/80 font-mono uppercase">Visual Scraper</p>
             </motion.div>

             <motion.div 
               className={`rounded-2xl border p-5 flex flex-col items-center justify-center text-center transition-gpu duration-500 ${status === 'consensus' || messages.find(m => m.agent === 'Nemotron') ? 'border-[#10B981]/70 bg-[#10B981]/10 shadow-[0_0_30px_rgba(0,183,255,0.3)]' : 'border-white/5 bg-white/[0.01]'}`}
             >
                <Network className={`w-8 h-8 mb-3 ${status === 'consensus' || messages.find(m => m.agent === 'Nemotron') ? 'text-[#10B981] animate-pulse drop-shadow-[0_0_10px_rgba(0,183,255,0.8)]' : 'text-neutral-600'}`} />
                <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-1">Nemotron 340B</h4>
                <p className="text-[9px] text-[#10B981]/80 font-mono uppercase">Synthesis Core</p>
             </motion.div>
          </div>
        </div>

        {/* Right Col: The Output Stream */}
        <div className="lg:col-span-8">
           <div className="h-full min-h-[600px] flex flex-col rounded-3xl bg-[#050505] border border-white/5 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
               <div className="h-14 border-b border-white/5 bg-white/[0.01] flex items-center justify-between px-6 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                    </div>
                    <span className="ml-2 text-[10px] font-mono text-neutral-500 tracking-[0.2em] uppercase">Multi-Thread Synapse Console</span>
                  </div>
                  {status === "debating" && (
                     <div className="flex items-center gap-2 text-[10px] text-rose-500 font-mono focus:outline-none uppercase tracking-widest font-bold">
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Calculating...
                     </div>
                  )}
                  {status === "consensus" && (
                    <div className="flex items-center gap-2 text-[10px] text-[#10B981] font-mono focus:outline-none uppercase tracking-widest font-bold">
                       <CheckCircle2 className="w-3.5 h-3.5" /> Consensus Achieved
                    </div>
                  )}
               </div>

               <div
                 ref={scrollRef}
                 className="p-6 lg:p-10 flex-1 overflow-y-auto space-y-8 custom-scrollbar relative noise-overlay"
                 aria-live="polite"
               >
                  {messages.length === 0 && status === "idle" && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                       <Network className="w-16 h-16 text-neutral-600 mb-6" />
                       <p className="text-neutral-500 font-mono text-xs uppercase tracking-[0.2em] leading-loose">
                         War Room Standby.<br/>
                         Awaiting Target Directive initialization.<br/>
                         CUDA Cores: Green.
                       </p>
                    </div>
                  )}

                  <AnimatePresence>
                     {messages.map((msg, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex flex-col gap-2"
                        >
                           <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${msg.agent === 'DeepSeek' ? 'text-indigo-400' : msg.agent === 'Llama' ? 'text-amber-400' : msg.agent === 'Kosmos' ? 'text-pink-400' : 'text-[#10B981]'}`}>
                                {msg.agent} Terminal
                              </span>
                              <div className="h-px flex-1 bg-white/5" />
                              <span className="text-[8px] font-mono text-neutral-600">0.0{i * 12 + 6}ms</span>
                           </div>
                           
                           <div className={`rounded-xl p-5 border backdrop-blur-sm ${
                             msg.agent === "Nemotron" && msg.text.includes("CONSENSUS DEPLOYMENT")
                               ? "bg-[#10B981]/10 border-[#10B981]/50 text-white shadow-[0_0_30px_rgba(0,183,255,0.15)]"
                               : "bg-white/[0.02] border-white/5 text-neutral-200"
                           }`}>
                              {renderMessageText(msg.text)}
                           </div>
                        </motion.div>
                     ))}
                  </AnimatePresence>

                  {status === "consensus" && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="pt-8">
                       <button className="w-full py-5 rounded-2xl bg-white text-black flex items-center justify-center gap-3 font-bold uppercase tracking-[0.2em] text-xs hover:bg-neutral-200 transition-gpu shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                         <Play className="w-4 h-4 fill-black" /> Transmit to n8n Queue
                       </button>
                    </motion.div>
                  )}
               </div>
           </div>
        </div>
      </div>
    </div>
  );
}
