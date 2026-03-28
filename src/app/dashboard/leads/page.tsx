"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, Target, Loader2, Database, AlertTriangle, Building2, Zap, ArrowRight, Activity, CheckCircle2, Phone } from "lucide-react";
import { useUsage } from "@/hooks/useUsage";
import { useRouter } from "next/navigation";

type ProspectReport = {
    business_name: string;
    website: string;
    phone?: string;
    detected_gap: string;
    cold_email_subject: string;
    cold_email_body: string;
};

const LOG_MESSAGES = [
    "Establishing uplink with Google Maps Builder API...",
    "Extracting spatial B2B nodes via Maps Places API...",
    "Filtering out franchise megacorps...",
    "Extracting raw DOM structure & dynamic reviews from 3 Map pins...",
    "Transmitting payload to Gemini 1.5 Pro for analysis...",
    "Detecting marketing failure points (SEO, Schema, Offer)...",
    "Synthesizing hyper-personalized cold outreach angles...",
    "Committing gap analysis reports to The AI Memory...",
];

export default function LeadsDashboard() {
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [isSweeping, setIsSweeping] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [reports, setReports] = useState<ProspectReport[]>([]);
  const [sweepTarget, setSweepTarget] = useState("");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { canGenerate, refresh: refreshUsage } = useUsage();
  const router = useRouter();

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const executeSweep = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!niche || !location || isSweeping || !canGenerate) return;

      setIsSweeping(true);
      setReports([]);
      setSweepTarget(`${niche} in ${location}`);
      
      // Simulate real-time terminal logging
      const logInterval = setInterval(() => {
          setLogs(prev => {
              if (prev.length < LOG_MESSAGES.length) {
                  return [...prev, LOG_MESSAGES[prev.length]];
              }
              clearInterval(logInterval);
              return prev;
          });
      }, 1500); // 1.5s per simulated step

      try {
          const res = await fetch("/api/agents/leads", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ action: "prospect", params: { niche, location } })
          });
          
          const data = await res.json();
          clearInterval(logInterval);
          
          if(data.success) {
               setLogs(prev => [...prev, `[SUCCESS] ${data.prospects_analyzed} targets acquired and synchronized.`]);
               setReports(data.reports);
          } else {
               setLogs(prev => [...prev, `[ERROR] Intelligence sweep failed: ${data.error}`]);
          }
          refreshUsage();
      } catch {
          clearInterval(logInterval);
          setLogs(prev => [...prev, "[FATAL] Connection to Prospector Node severed."]);
      } finally {
          setIsSweeping(false);
      }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-6rem)] flex flex-col bg-[#050505]">
      {/* Header */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-[#00B7FF] text-xs font-bold uppercase tracking-wider mb-3">
              <Search className="w-3 h-3" /> Outbound Node
           </div>
           <h1 className="text-3xl font-bold font-serif tracking-wide flex items-center gap-3 text-white">
              Target Acquisition
           </h1>
           <p className="text-text-secondary mt-1 max-w-xl text-sm">Deploy the Prospector Swarm to scrape local businesses via Google Maps Builder, analyze their marketing gaps via Gemini, and autonomously script hyper-personalized cold outreach.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          
          {/* Sweep Configuration (Left Col) */}
          <div className="lg:col-span-1 flex flex-col gap-6 h-full overflow-y-auto pr-2">
              <div className="glass-card p-6 border border-glass-border">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                      <Target className="w-4 h-4 text-electric" /> Command Sweep
                  </h2>
                  <form onSubmit={executeSweep} aria-label="Lead sweep configuration" className="space-y-4">
                       <div>
                           <label className="text-[10px] text-stone-400 uppercase tracking-widest mb-2 block font-mono">Target Niche</label>
                           <div className="relative">
                               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                   <Building2 className="w-4 h-4 text-stone-500" />
                               </div>
                               <input
                                   type="text" required
                                   value={niche} onChange={e => setNiche(e.target.value)}
                                   placeholder="e.g., Roofers, Dentists, Med Spas"
                                   aria-label="Target niche"
                                   className="w-full bg-onyx/50 border border-glass-border rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:border-electric transition-colors"
                               />
                           </div>
                       </div>
                       <div>
                           <label className="text-[10px] text-stone-400 uppercase tracking-widest mb-2 block font-mono">Target Geo-Location</label>
                           <div className="relative">
                               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                   <MapPin className="w-4 h-4 text-stone-500" />
                               </div>
                               <input
                                   type="text" required
                                   value={location} onChange={e => setLocation(e.target.value)}
                                   placeholder="e.g., Austin TX, London UK"
                                   aria-label="Target geo-location"
                                   className="w-full bg-onyx/50 border border-glass-border rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:border-electric transition-colors"
                               />
                           </div>
                       </div>
                       <button
                           type="submit" disabled={isSweeping || !niche || !location}
                           aria-label={isSweeping ? "Sweep in progress" : "Execute lead sweep"}
                           className="w-full mt-4 bg-gradient-to-r from-[#00B7FF] to-electric text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50 transition-gpu hover:shadow-[0_0_20px_rgba(0,183,255,0.3)]"
                       >
                           {isSweeping ? <><Loader2 className="w-4 h-4 animate-spin" /> Sweeping Sector...</> : <><Search className="w-4 h-4" /> Execute Sweep</>}
                       </button>
                  </form>
              </div>

              {/* Terminal Logs */}
              <div className="glass-card flex-1 border border-glass-border bg-black/60 flex flex-col overflow-hidden min-h-[300px]">
                   <div className="p-3 border-b border-glass-border/50 bg-black/40 flex items-center gap-2 shrink-0">
                        <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
                        <span className="text-[10px] uppercase font-mono text-emerald-500/80 tracking-widest">Prospector Telemetry</span>
                   </div>
                   <div className="p-4 font-mono text-xs overflow-y-auto space-y-2 text-stone-400 h-full" aria-live="polite" aria-label="Sweep telemetry logs">
                        {logs.length === 0 && <span className="text-stone-600">Awaiting sweep parameters...</span>}
                        {logs.map((log, i) => (
                             <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={i} className="flex gap-2">
                                  <span className="shrink-0 text-stone-600">{`[+${(i * 1.5).toFixed(1)}s]`}</span>
                                  <span className={log.includes("SUCCESS") ? "text-emerald-400 font-bold" : log.includes("ERROR") || log.includes("FATAL") ? "text-red-400" : "text-stone-300"}>
                                      {log.includes("SUCCESS") || log.includes("ERROR") || log.includes("FATAL") ? log : `> ${log}`}
                                  </span>
                             </motion.div>
                        ))}
                        {isSweeping && logs.length < LOG_MESSAGES.length && (
                             <div className="w-2 h-3 bg-electric/50 animate-pulse mt-1 ml-12" />
                        )}
                        <div ref={logsEndRef} />
                   </div>
              </div>
          </div>

          {/* Acquired Targets (Right Col) */}
          <div className="lg:col-span-2 glass-card border border-glass-border h-full flex flex-col overflow-hidden">
               <div className="p-5 border-b border-glass-border flex items-center justify-between shrink-0 bg-onyx/20">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-[#00B7FF]" /> Acquired Targets
                    </h2>
                    {reports.length > 0 && (
                        <div className="text-[10px] font-mono text-stone-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            {reports.length} TARGETS FOUND IN: {sweepTarget.toUpperCase()}
                        </div>
                    )}
               </div>

               <div className="flex-1 overflow-y-auto p-6 bg-onyx/10" aria-live="polite" aria-label="Acquired targets results">
                    {!isSweeping && reports.length === 0 && (
                         <div className="h-full flex flex-col items-center justify-center text-center text-stone-500 space-y-4">
                             <Search className="w-12 h-12 text-stone-700" />
                             <p className="font-mono text-xs uppercase tracking-widest">No target data. Execute a sweep.</p>
                         </div>
                    )}

                    {isSweeping && reports.length === 0 && (
                         <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                             <div className="relative">
                                  <div className="absolute inset-0 border-2 border-electric/20 rounded-full animate-ping" />
                                  <div className="w-24 h-24 rounded-full border-2 border-electric/40 flex items-center justify-center bg-electric/5 backdrop-blur-sm">
                                      <Search className="w-8 h-8 text-electric animate-pulse" />
                                  </div>
                             </div>
                             <div className="space-y-2">
                                 <h3 className="font-mono text-electric text-sm tracking-widest uppercase">Deep Spatial Crawl Initiated</h3>
                                 <p className="text-xs text-stone-500 max-w-xs mx-auto">Google Maps Builder is plotting {niche} inside {location}. Gemini 2.0 is diagnosing marketing failures...</p>
                             </div>
                         </div>
                    )}

                    <div className="space-y-6">
                        {reports.map((report, idx) => (
                             <motion.div 
                                 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                                 key={idx} className="bg-onyx/60 border border-glass-border rounded-xl p-5 hover:border-[#00B7FF]/30 transition-colors"
                             >
                                 {/* Header */}
                                 <div className="flex justify-between items-start mb-4 border-b border-glass-border/50 pb-4">
                                      <div>
                                          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                                              {report.business_name}
                                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                          </h3>
                                          <a href={report.website} target="_blank" rel="noreferrer" className="text-xs text-[#00B7FF] hover:underline font-mono">
                                              {report.website}
                                          </a>
                                      </div>
                                      <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest rounded flex items-center gap-1">
                                           <AlertTriangle className="w-3 h-3" /> Gap Detected
                                      </div>
                                 </div>

                                 {/* Enrichment Depth Waterfall */}
                                 <div className="flex items-center gap-2 mb-4 text-[10px] font-mono uppercase tracking-widest bg-black/40 border border-white/5 p-3 rounded-lg overflow-x-auto hide-scrollbar shadow-inner">
                                    <span className="text-stone-500 shrink-0 pr-2 border-r border-white/10 hidden sm:block">Enrichment Depth</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      <span className="text-emerald-400">Google Places API</span>
                                    </div>
                                    <ArrowRight className="w-2 h-2 text-stone-700 shrink-0" />
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      <span className="text-emerald-400">Domain Pinged</span>
                                    </div>
                                    <ArrowRight className="w-2 h-2 text-stone-700 shrink-0" />
                                    <div className="flex items-center gap-1.5 shrink-0 bg-[#00B7FF]/10 px-2 py-0.5 rounded border border-[#00B7FF]/20">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#00B7FF] shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                      <span className="text-[#00B7FF] glow-text">Gemini 2.5 Researched</span>
                                    </div>
                                    <ArrowRight className="w-2 h-2 text-stone-700 shrink-0" />
                                    <div className={`flex items-center gap-1.5 shrink-0 ${report.phone ? 'bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20' : ''}`}>
                                      <div className={`w-1.5 h-1.5 rounded-full ${report.phone ? 'bg-amber-500' : 'bg-stone-700'}`} />
                                      <span className={report.phone ? 'text-amber-400' : 'text-stone-600'}>Contact Discovery</span>
                                    </div>
                                 </div>

                                 {/* Body */}
                                 <div className="space-y-4">
                                      <div>
                                          <span className="text-[10px] text-stone-500 uppercase font-mono tracking-widest mb-1 block">Diagnosis Matrix:</span>
                                          <p className="text-sm text-stone-300 leading-relaxed font-serif italic border-l-2 border-red-500/50 pl-3">&quot;{report.detected_gap}&quot;</p>
                                      </div>
                                      
                                      <div className="bg-black/50 border border-glass-border rounded-lg p-4 font-mono">
                                          <div className="flex items-center justify-between mb-3 border-b border-stone-800 pb-2">
                                              <span className="text-[10px] text-electric uppercase tracking-widest flex items-center gap-1"><Zap className="w-3 h-3" /> Generated Outreach Script</span>
                                              <div className="flex gap-3">
                                                <button
                                                  onClick={() => router.push(`/dashboard/voice-assistant?phone=${encodeURIComponent(report.phone || '')}&context=${encodeURIComponent(`Offer: Free SEO Audit + Review Sweeper based on diagnosis: ${report.detected_gap}`)}`)}
                                                  aria-label={`Deploy voice swarm for ${report.business_name}`}
                                                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase transition-colors flex items-center gap-1"
                                                >
                                                  <Phone className="w-3 h-3" /> Deploy Voice Swarm
                                                </button>
                                                <button aria-label={`Push ${report.business_name} to Nexus`} className="text-[10px] text-stone-500 hover:text-white transition-colors flex items-center gap-1">Push to Nexus <ArrowRight className="w-3 h-3" /></button>
                                              </div>
                                          </div>
                                          <div className="text-xs text-stone-300 space-y-2">
                                              <p><span className="text-stone-500">Subject:</span> <span className="text-white">{report.cold_email_subject}</span></p>
                                              <p className="whitespace-pre-wrap leading-relaxed mt-2 pt-2 border-t border-stone-800/50">{report.cold_email_body}</p>
                                          </div>
                                      </div>
                                 </div>
                             </motion.div>
                        ))}
                    </div>
               </div>
          </div>
      </div>
    </div>
  );
}
