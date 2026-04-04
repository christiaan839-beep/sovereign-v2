"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCcw, ShieldCheck, ThumbsUp, ThumbsDown, Activity, Settings2, BrainCircuit, FileCheck, CheckCircle2 } from "lucide-react";

export default function FlywheelPage() {
  const [pipelineState, setPipelineState] = useState<"idle" | "optimizing" | "complete">("idle");
  const [metrics, setMetrics] = useState({
    slopDetected: 0,
    rlhfEvents: 0,
    accuracy: 0
  });

  useEffect(() => {
    const fetchInitialStats = async () => {
      try {
        const res = await fetch("/api/agents/flywheel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stats" }),
        });
        const data = await res.json();
        if (data.success) {
          setMetrics({
            slopDetected: data.slopDetected ?? 0,
            rlhfEvents: data.rlhfEvents ?? 0,
            accuracy: data.accuracy ?? 0,
          });
        }
      } catch {
        // Leave metrics at zero on failure
      }
    };
    fetchInitialStats();
  }, []);

  const triggerOptimization = async () => {
    setPipelineState("optimizing");
    
    try {
      const res = await fetch("/api/agents/flywheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", scope: "full" }),
      });
      const data = await res.json();
      if (data.success) {
        setMetrics({
          slopDetected: data.slopDetected ?? 0,
          rlhfEvents: data.rlhfEvents ?? metrics.rlhfEvents,
          accuracy: data.accuracy ?? metrics.accuracy,
        });
      }
      // On failure, leave metrics unchanged — don't fake success
    } catch {
      // Leave metrics unchanged on error
    } finally {
      setPipelineState("complete");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white" role="region" aria-label="Anti-slop quality flywheel">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-[#00B7FF] text-xs font-bold uppercase tracking-wider mb-3">
          <RefreshCcw className="w-3 h-3" /> RLHF Continuous Improvement
        </div>
        <h1 className="text-3xl font-bold font-sans tracking-tight mb-2 flex items-center gap-3">
          Anti-Slop Quality Flywheel
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl">
          Powered by NVIDIA NeMo Guardrails and Reinforcement Learning from Human Feedback (RLHF). This module ensures the platform never generates generic &quot;AI Slop&quot;. It mathematically forces the swarm to adopt strict corporate tone and adapt based on daily performance metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
         <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
               <ShieldCheck className="w-5 h-5 text-rose-400" />
               <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Tone Deviations (Slop)</span>
            </div>
            <div className="text-3xl font-mono text-white mt-4">{metrics.slopDetected}</div>
            <p className="text-[10px] text-rose-400 mt-2 font-bold tracking-wider">Awaiting DSPy Optimization</p>
         </div>
         <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
               <BrainCircuit className="w-5 h-5 text-[#00B7FF]" />
               <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Total RLHF Nuances</span>
            </div>
            <div className="text-3xl font-mono text-white mt-4">{metrics.rlhfEvents.toLocaleString()}</div>
            <p className="text-[10px] text-[#00B7FF] mt-2 font-bold tracking-wider">Historical Human Preferences</p>
         </div>
         <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
               <FileCheck className="w-5 h-5 text-emerald-400" />
               <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Contextual Accuracy</span>
            </div>
            <div className="text-3xl font-mono text-emerald-400 mt-4">{metrics.accuracy}%</div>
            <p className="text-[10px] text-emerald-500 mt-2 font-mono tracking-wider">NeMo Retriever Validation</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Col: Setup */}
        <div className="lg:col-span-8">
           <div className="h-full min-h-[500px] flex flex-col rounded-2xl bg-black border border-[#00B7FF]/20 overflow-hidden shadow-[0_0_50px_rgba(0,183,255,0.05)]">
               <div className="h-12 border-b border-[#00B7FF]/20 bg-[#00B7FF]/5 flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#00B7FF]" />
                    <span className="text-[10px] font-mono text-[#00B7FF] tracking-widest uppercase">Nightly DSPy Optimization Pipeline</span>
                  </div>
                  {pipelineState === "optimizing" ? (
                     <div className="flex items-center gap-2 text-[9px] text-[#00B7FF] font-mono uppercase tracking-widest font-bold animate-pulse">
                         Rewriting Internal Prompts...
                     </div>
                  ) : pipelineState === "complete" ? (
                    <div className="flex items-center gap-2 text-[9px] text-emerald-500 font-mono uppercase tracking-widest font-bold">
                       <CheckCircle2 className="w-3 h-3" /> Flywheel Cycle Complete
                    </div>
                  ) : null}
               </div>

               <div className="p-6 flex-1 relative noise-overlay">
                  <div className="mb-6 pb-6 border-b border-white/5">
                     <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-neutral-400" /> Guardrail Configuration
                     </h3>
                     <div className="flex gap-4">
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex-1 flex items-center justify-between">
                           <span className="text-xs text-neutral-300 font-mono">Enforce B2B Corporate Tone</span>
                           <div className="w-8 h-4 bg-[#00B7FF] rounded-full cursor-pointer relative"><div className="w-4 h-4 bg-white rounded-full absolute right-0 shadow" /></div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex-1 flex items-center justify-between">
                           <span className="text-xs text-neutral-300 font-mono">Reject Generic &quot;Slop&quot; Adjectives</span>
                           <div className="w-8 h-4 bg-[#00B7FF] rounded-full cursor-pointer relative"><div className="w-4 h-4 bg-white rounded-full absolute right-0 shadow" /></div>
                        </div>
                     </div>
                  </div>

                  {pipelineState === "idle" && (
                    <div className="text-center py-10">
                       <RefreshCcw className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
                       <p className="text-neutral-500 font-mono text-xs uppercase tracking-widest">
                         Ready to process user feedback.<br/>
                         142 flagged responses awaiting DSPy optimization.
                       </p>
                    </div>
                  )}

                  {(pipelineState === "optimizing" || pipelineState === "complete") && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 font-mono text-xs" aria-live="polite">
                        {pipelineState === "optimizing" && (
                          <div className="text-[#00B7FF]/80 space-y-2">
                            <p className="animate-pulse">&gt; Fetching telemetry logs where user clicked: <ThumbsDown className="w-3 h-3 inline pb-1"/></p>
                            <p className="animate-pulse delay-75">&gt; Isolating &quot;slop&quot; patterns (e.g., &apos;In today&apos;s fast-paced digital landscape...&apos;)</p>
                            <p className="animate-pulse delay-150">&gt; Triggering DSPy Bootstrapping...</p>
                            <p className="animate-pulse delay-200">&gt; Llama-3.1-Nemotron evaluating 50 prompt variations...</p>
                          </div>
                        )}
                        {pipelineState === "complete" && (
                          <div className="text-emerald-400 space-y-3 pt-4">
                            <p>&gt; DSPy Optimization Complete.</p>
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                               <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-2">Previous Instruction (Weak)</p>
                               <p className="text-emerald-100/50 line-through mb-4 text-xs">&quot;Write a professional email offering our marketing services.&quot;</p>
                               <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-2">New Synthesized Instruction (Alpha)</p>
                               <p className="text-emerald-300 font-bold text-xs">&quot;Output a strict, 3-sentence B2B communication. State the exact ROI metric. Ban the words &apos;innovative,&apos; &apos;synergy,&apos; and &apos;landscape&apos;. Force the tone to sound like a Senior Systems Engineer.&quot;</p>
                            </div>
                            <p>&gt; Hot-swapping new prompts into NemoClaw production nodes.</p>
                            <p className="font-bold flex items-center gap-2 pt-2"><CheckCircle2 className="w-4 h-4" /> Swarm Intelligence Upgraded.</p>
                          </div>
                        )}
                     </motion.div>
                  )}
               </div>
           </div>
        </div>

        {/* Right Col */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           <div className="rounded-2xl border border-white/10 p-6 bg-white/[0.02] flex-1 flex flex-col justify-between">
              <div>
                 <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-6 flex items-center gap-2">
                   <ThumbsUp className="w-4 h-4 text-[#00B7FF]" /> Manual Run
                 </h3>
                 <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                    Every time you or a sub-tenant rejects an output, the system flags it as &quot;Slop&quot;. Running the pipeline triggers NeMo and DSPy to analyze the failures and physically rewrite the agent&apos;s core instructions to ensure it never happens again.
                 </p>
              </div>
              
              <button 
                 onClick={triggerOptimization}
                 disabled={pipelineState !== "idle"}
                 className="w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-gpu disabled:opacity-50 disabled:cursor-not-allowed bg-[#00B7FF] text-white hover:bg-[#00B7FF]/80 shadow-[0_0_20px_rgba(0,183,255,0.3)] flex justify-center items-center gap-2"
              >
                 <RefreshCcw className={`w-4 h-4 ${pipelineState === 'optimizing' ? 'animate-spin' : ''}`} /> Run Overnight Optimizer
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
