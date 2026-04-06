"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Headphones, Mail, User, CheckCircle2, ShieldCheck, CreditCard, AlertCircle, ArrowRight } from "lucide-react";

interface TicketPayload {
  id: string;
  customer: string;
  email: string;
  intent: string;
  body: string;
  sentiment: string;
  history: string;
}

export default function SupportRouterPage() {
  const [pipelineState, setPipelineState] = useState<"idle" | "ingesting" | "analyzing" | "executing" | "resolved">("idle");
  const [activeTicket, setActiveTicket] = useState<TicketPayload | null>(null);

  const triggerIngestion = async () => {
    setPipelineState("ingesting");
    try {
      const res = await fetch("/api/agents/smart-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Analyze and classify support tickets for routing", task_type: "analysis" }),
      });
      const data = await res.json();
      if (data.success) {
        setPipelineState("analyzing");
        setActiveTicket({
          id: data.id || `TKT-${Date.now()}`,
          customer: data.customer || "Michael Brennan",
          email: data.email || "m.brennan@industrialparts.com",
          intent: data.intent || "REFUND_REQUEST + CHURN_RISK",
          body: data.body || "Your garbage gasket blew out my entire hydraulic line mid-shift. I lost $14,000 in downtime. I want a full refund and a replacement overnighted or I'm switching to Parker.",
          sentiment: data.sentiment || "HOSTILE (-0.92)",
          history: data.history || "$42,180 LTV (14 orders)",
        });
      } else {
        setPipelineState("idle");
      }
    } catch {
      setPipelineState("idle");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white" role="region" aria-label="Autonomous support router">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-[#00B7FF] text-xs font-bold uppercase tracking-wider mb-3">
          <Headphones className="w-3 h-3" /> Autonomous Support Router
        </div>
        <h1 className="text-3xl font-bold font-sans tracking-tight mb-2 flex items-center gap-3">
          The Omni-Closer
          <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase tracking-widest">Demo Mode</span>
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl">
          Powered by Llama-3.1-Nemotron-70B and NeMo Retriever. This node ingests high-volume support emails/tickets, extracts LTV and purchase history, and physically executes refunds, RMAs, or technical support loops with zero human intervention.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col: Webhook Stream */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 flex-1 flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-6 flex items-center gap-2">
                 <Mail className="w-4 h-4 text-[#00B7FF]" /> Webhook Ingestion
              </h3>
              
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/10 rounded-xl bg-black/40 mb-6 p-6">
                 {pipelineState === "idle" ? (
                    <div className="text-center">
                       <ShieldCheck className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
                       <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">Awaiting Yoco / Zendesk Webhook</p>
                    </div>
                 ) : (
                    <div className="w-full">
                       <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-[#00B7FF] uppercase font-bold tracking-widest animate-pulse">Incoming Payload Detected</span>
                          <span className="text-[10px] text-neutral-500 font-mono">WSS://sovereign.wss</span>
                       </div>
                       <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: pipelineState !== "ingesting" ? "100%" : "30%" }} 
                            className="h-full bg-[#00B7FF]"
                          />
                       </div>
                    </div>
                 )}
              </div>

              <button 
                 onClick={triggerIngestion}
                 disabled={pipelineState !== "idle"}
                 className="w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-gpu disabled:opacity-50 disabled:cursor-not-allowed bg-[#00B7FF]/20 text-[#00B7FF] border border-[#00B7FF]/30 hover:bg-[#00B7FF]/30 shadow-[0_0_20px_rgba(0,183,255,0.15)] flex justify-center items-center gap-2"
              >
                 Simulate Angry Customer Threat
              </button>
           </div>
        </div>

        {/* Right Col: The Execution Engine */}
        <div className="lg:col-span-8">
           <div className="h-full min-h-[600px] rounded-2xl bg-black border border-[#00B7FF]/20 flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,183,255,0.05)]">
              {/* Terminal Header */}
              <div className="h-12 border-b border-[#00B7FF]/20 bg-[#00B7FF]/5 flex items-center justify-between px-4">
                 <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#00B7FF]" />
                    <span className="text-[10px] font-mono text-[#00B7FF] tracking-widest uppercase">NeMo Retriever Resolution Stream</span>
                 </div>
                 {pipelineState === "analyzing" || pipelineState === "executing" ? (
                    <span className="text-[9px] text-[#00B7FF] font-bold uppercase tracking-widest animate-pulse">Processing...</span>
                 ) : pipelineState === "resolved" ? (
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Closed</span>
                 ) : null}
              </div>

              <div className="p-6 flex-1 flex flex-col relative noise-overlay">
                 
                 <AnimatePresence>
                    {activeTicket && (
                       <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                             <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest block mb-1">Customer LTV</span>
                                <span className="text-sm font-mono text-emerald-400">{activeTicket.history}</span>
                             </div>
                             <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest block mb-1">Sentiment Scan</span>
                                <span className="text-sm font-mono text-rose-400">{activeTicket.sentiment}</span>
                             </div>
                             <div className="bg-white/5 border border-white/10 rounded-lg p-3 col-span-2">
                                <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest block mb-1">Extracted Intent</span>
                                <span className="text-sm font-mono text-[#00B7FF]">{activeTicket.intent}</span>
                             </div>
                          </div>

                          <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-5 mb-6">
                             <div className="flex items-center gap-3 mb-3 border-b border-rose-500/10 pb-3">
                                <AlertCircle className="w-5 h-5 text-rose-500" />
                                <div>
                                   <div className="text-xs font-bold text-white">{activeTicket.customer}</div>
                                   <div className="text-[10px] text-rose-400 font-mono">{activeTicket.email}</div>
                                </div>
                             </div>
                             <p className="text-sm text-rose-100/80 leading-relaxed">&ldquo;{activeTicket.body}&rdquo;</p>
                          </div>
                       </motion.div>
                    )}
                 </AnimatePresence>

                 {/* Action Execution Log */}
                 <div className="flex-1 space-y-4 font-mono text-xs">
                    {pipelineState === "analyzing" && (
                       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[#00B7FF]/70 space-y-2">
                          <p className="animate-pulse">&gt; Routing payload to Llama-3.1-Nemotron-70B...</p>
                          <p className="animate-pulse delay-75">&gt; Cross-referencing Yoco payment logs...</p>
                          <p className="animate-pulse delay-150">&gt; Retrieving RMA warehouse authorization matrices...</p>
                       </motion.div>
                    )}

                    {pipelineState === "executing" && (
                       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-amber-400/80 space-y-3">
                          <p>&gt; <span className="text-emerald-400">RAG Check:</span> High LTV Customer ($42k) detected. Bypassing human approval queue.</p>
                          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300">
                             <CreditCard className="w-4 h-4" /> Initiating Yoco Refund Command: ref_9982x...
                          </div>
                          <p className="animate-pulse">&gt; Generating 3D CAD schematic of replacement gasket...</p>
                          <p className="animate-pulse">&gt; Drafting highly empathetic apology response...</p>
                       </motion.div>
                    )}

                    {pipelineState === "resolved" && (
                       <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-4 border-t border-[#00B7FF]/20 text-emerald-400 space-y-4">
                          <p className="font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> TICKET RESOLVED IN 4.2 SECONDS (SAVED 3 HUMAN HOURS)</p>
                          
                          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
                             <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                                <ArrowRight className="w-3 h-3" /> Autonomous Email Dispatch
                             </div>
                             <p className="text-sm text-emerald-100 leading-relaxed font-sans">
                                &ldquo;Hi Michael. I am incredibly sorry to hear the gasket on Order #4401-B ruptured. Because you&apos;ve been a loyal partner to us for 14 orders, I have proactively bypassed our return department and issued a full refund to your card ending in 4492 right now. I have also FedEx overnighted the replacement unit. It will arrive by 9AM tomorrow so your assembly line doesn&apos;t stall. Please accept my personal apology.&rdquo;
                             </p>
                          </div>
                       </motion.div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
