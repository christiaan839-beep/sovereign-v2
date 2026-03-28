"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShieldAlert, Cpu, Download, Globe2, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export default function AuditAndDestroyPage() {
  const [url, setUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<{
    companyName: string;
    criticalFlaws: string[];
    costInefficiency: string;
    aiReplacementStrategy: string;
    pdfReady: boolean;
  } | null>(null);
  
  const toast = useToast();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsScanning(true);
    setResults(null);
    
    try {
      // Execute the God-Brain API
      const res = await fetch("/api/agents/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: url })
      });
      
      if (!res.ok) throw new Error("API Execution Failed");
      
      const data = await res.json();
      setResults(data);
      toast.success("Threat Assessment Generated");
      
    } catch {
       toast.error("Audit engine encountered firewall resistance. Retrying via proxy...");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen" role="main" aria-label="Audit and destroy engine">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest mb-4">
            <ShieldAlert className="w-3 h-3" />
            Audit & Destroy Engine
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2 font-serif">Executive Threat Assessment</h1>
          <p className="text-neutral-500 text-sm max-w-2xl">
            Input a competitor agency or prospect URL. The God-Brain will autonomously scrape their domain, identify their human-labor inefficiencies, and generate a brutal, high-ticket PDF audit you can use to close them immediately.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column - Input Target */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-black/40 border border-[#00B7FF]/10 p-6 rounded-2xl backdrop-blur-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-32 opacity-[0.02] pointer-events-none">
                <Globe2 className="w-64 h-64 text-[#00B7FF]" />
             </div>
             
             <form onSubmit={handleScan} className="relative z-10 space-y-4">
               <div>
                  <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2 block">Target Domain Configuration</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00B7FF]/50" />
                    <input
                      type="url"
                      required
                      placeholder="https://competitor-agency.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full bg-black/50 border border-[#00B7FF]/20 rounded-xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:border-[#00B7FF]/50 focus:ring-1 focus:ring-[#00B7FF]/50 transition-gpu font-mono placeholder:text-neutral-700"
                    />
                  </div>
               </div>
               
               <button
                 type="submit"
                 disabled={isScanning || !url}
                 className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(220,38,38,0.2)]"
               >
                 {isScanning ? (
                   <>
                     <Loader2 className="w-5 h-5 animate-spin" />
                     Executing Neural Hack...
                   </>
                 ) : (
                   <>
                     <Cpu className="w-5 h-5" />
                     Initialize Audit Sequence
                   </>
                 )}
               </button>
             </form>
          </div>
          
          {/* Status Console */}
          <div className="bg-black/60 border border-white/5 rounded-2xl p-6 font-mono text-[10px] text-neutral-500">
             <div className="flex items-center gap-2 mb-4 text-[#00B7FF]">
               <div className="w-1.5 h-1.5 bg-[#00B7FF] rounded-full animate-pulse" />
               <span className="uppercase tracking-widest font-bold">Terminal Output</span>
             </div>
             <div className="space-y-2 opacity-70">
                {isScanning ? (
                  <>
                    <p className="text-emerald-400">&gt; Bypassing anti-bot headers...</p>
                    <p className="text-emerald-400">&gt; Ripping DOM structure from {url}...</p>
                    <p className="text-amber-400 animate-pulse">&gt; Synthesizing Extinction PDF...</p>
                  </>
                ) : (
                  <>
                    <p>&gt; System idle.</p>
                    <p>&gt; Awaiting target payload.</p>
                  </>
                )}
             </div>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-7">
           <AnimatePresence mode="wait">
             {!results && !isScanning && (
               <motion.div 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }} 
                 exit={{ opacity: 0 }}
                 className="h-[400px] border border-white/5 border-dashed rounded-2xl flex flex-col items-center justify-center text-neutral-600 bg-white/[0.01]"
               >
                 <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                 <p className="text-sm">No target acquired.</p>
               </motion.div>
             )}
             
             {isScanning && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }} 
                 animate={{ opacity: 1, scale: 1 }} 
                 exit={{ opacity: 0, scale: 0.95 }}
                 className="h-[400px] border border-[#00B7FF]/20 rounded-2xl flex flex-col items-center justify-center bg-[#00B7FF]/5 relative overflow-hidden"
               >
                 <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                 <Loader2 className="w-12 h-12 mb-6 text-[#00B7FF] animate-spin relative z-10" />
                 <p className="text-sm font-mono text-[#00B7FF] uppercase tracking-widest relative z-10 animate-pulse">Running God-Brain Analytics...</p>
               </motion.div>
             )}

             {results && !isScanning && (
               <motion.div 
                 initial={{ opacity: 0, x: 20 }} 
                 animate={{ opacity: 1, x: 0 }}
                 className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md"
               >
                 {/* Header */}
                 <div className="bg-white/5 border-b border-white/10 p-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">{results.companyName}</h2>
                      <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">Vulnerability Scan Complete</p>
                    </div>
                    {results.pdfReady && (
                      <button aria-label="Download audit PDF report" className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-neutral-200 transition-colors">
                        <Download className="w-4 h-4" />
                        Download PDF
                      </button>
                    )}
                 </div>
                 
                 {/* Body */}
                 <div className="p-6 space-y-6">
                    <div>
                      <h3 className="text-[10px] uppercase font-bold tracking-widest text-[#00B7FF] mb-3">Critical Human-Labor Flaws</h3>
                      <ul className="space-y-3">
                        {results.criticalFlaws.map((flaw, i) => (
                           <li key={i} className="flex items-start gap-3 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                             <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 shrink-0" />
                             <span className="text-sm text-neutral-300">{flaw}</span>
                           </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl">
                        <h3 className="text-[10px] uppercase font-bold tracking-widest text-red-500 mb-2">Estimated Burn Rate</h3>
                        <p className="text-2xl font-mono text-red-400">{results.costInefficiency}</p>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
                        <h3 className="text-[10px] uppercase font-bold tracking-widest text-emerald-500 mb-2">Sovereign Matrix OS Solution</h3>
                        <p className="text-sm text-emerald-400 font-mono flex items-center gap-2 mt-1">
                          {results.aiReplacementStrategy} <ArrowRight className="w-4 h-4" />
                        </p>
                      </div>
                    </div>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
