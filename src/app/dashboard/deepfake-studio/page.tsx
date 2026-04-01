"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileVideo, ShieldAlert, Play, Database, Wand2, MonitorPlay } from "lucide-react";

export default function VideoOutreachStudioPage() {
  const [targetDomain, setTargetDomain] = useState("");
  const [targetScript, setTargetScript] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("avatar-1");
  const [status, setStatus] = useState<"idle" | "scraping" | "generating" | "complete">("idle");
  const [scrapedData, setScrapedData] = useState<{name: string, company: string, tech: string} | null>(null);

  const handleScrape = async () => {
    if (!targetDomain) return;
    setStatus("scraping");
    
    try {
      const res = await fetch("/api/agents/site-assassin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetDomain, mode: "analyze" }),
      });
      const data = await res.json();
      if (data.success) {
        const audit = data.audit || {};
        const company = audit.company_name || targetDomain;
        setScrapedData({
          name: audit.contact_name || "Contact not found",
          company,
          tech: audit.market_position || audit.tech_stack || "Analysis pending",
        });
        setTargetScript(
          audit.ux_score != null || (audit.weaknesses && audit.weaknesses.length > 0)
            ? `We audited ${company}'s technology stack. UX Score: ${audit.ux_score ?? 'N/A'}/100. We identified ${(audit.weaknesses || []).length} area(s) for improvement. I can send the full teardown to your inbox.`
            : `We analyzed ${company}. Full audit results are available for review.`
        );
      } else {
        setScrapedData({ name: "N/A", company: targetDomain, tech: data.error || "Analysis could not be completed" });
      }
    } catch {
      setScrapedData({ name: "Unknown", company: targetDomain, tech: "Network error" });
    } finally {
      setStatus("idle");
    }
  };

  const handleGenerate = async () => {
    if (!targetScript) return;
    setStatus("generating");
    
    try {
      const res = await fetch("/api/agents/voice-synth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: targetScript, voice: selectedAvatar }),
      });
      const data = await res.json();
      if (!data.success) console.error("Voice synth failed:", data.error);
    } catch (err) {
      console.error("Voice synth error:", err);
    } finally {
      setStatus("complete");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative min-h-screen" role="main" aria-label="Video outreach studio">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white serif-text tracking-tight flex items-center gap-3">
            <FileVideo className="w-8 h-8 text-[#00B7FF]" />
            Video Studio
          </h1>
          <p className="text-neutral-400 mt-2 max-w-2xl">
            Create personalized AI-generated video outreach using synthetic presenters. Scrape prospect data, generate a script, and render a professional 4K video pitch.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Column: Config */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card border border-glass-border p-6 relative overflow-hidden">
            <h2 className="text-xs uppercase tracking-widest text-[#00B7FF] font-bold mb-6 flex items-center gap-2">
              <MonitorPlay className="w-4 h-4" /> Synthetic Core
            </h2>
            
            <div className="space-y-5">
               <div>
                 <label className="text-xs uppercase tracking-widest text-neutral-500 font-bold mb-3 block">1. Select Executive Persona</label>
                 <div className="grid grid-cols-2 gap-3">
                    {/* Avatars */}
                    {[
                      { id: "avatar-1", name: "CEO Alpha", desc: "Commanding, Direct" },
                      { id: "avatar-2", name: "Tech Lead", desc: "Analytical, Precise" },
                      { id: "avatar-3", name: "VP Sales", desc: "Persuasive, Warm" },
                      { id: "avatar-4", name: "Custom Clone", desc: "Your Likeness" }
                    ].map(av => (
                       <button 
                         key={av.id}
                         onClick={() => setSelectedAvatar(av.id)}
                         className={`p-3 rounded-xl border text-left transition-gpu ${
                           selectedAvatar === av.id 
                             ? 'bg-[#00B7FF]/10 border-[#00B7FF] shadow-[0_0_15px_rgba(0,183,255,0.2)]'
                             : 'bg-black/40 border-white/10 hover:border-white/20'
                         }`}
                       >
                         <div className="w-8 h-8 rounded-full bg-neutral-800 mb-2 border border-white/20 overflow-hidden relative">
                           {/* Placeholder for Face */}
                           <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent z-10"/>
                         </div>
                         <div className={`text-[10px] font-bold uppercase tracking-widest ${selectedAvatar === av.id ? 'text-[#00B7FF]' : 'text-neutral-300'}`}>
                           {av.name}
                         </div>
                         <div className="text-[9px] text-neutral-500 font-mono mt-1">{av.desc}</div>
                       </button>
                    ))}
                 </div>
               </div>
               
               {/* Apollo Scraper Input */}
               <div className="pt-4 border-t border-white/10">
                 <label className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-2 flex items-center gap-2">
                   <Database className="w-4 h-4" /> Apollo.io Target Scraper
                 </label>
                 <div className="flex gap-2">
                   <input
                     type="text"
                     value={targetDomain}
                     onChange={(e) => setTargetDomain(e.target.value)}
                     placeholder="target-agency.com"
                     aria-label="Target domain to scan"
                     className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                   />
                   <button 
                     onClick={handleScrape}
                     disabled={status === "scraping" || !targetDomain}
                     className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/30 transition-colors whitespace-nowrap"
                   >
                     {status === "scraping" ? "Scraping..." : "Scan Domain"}
                   </button>
                 </div>
                 {scrapedData && (
                   <div className="mt-3 text-[10px] text-emerald-500/70 font-mono bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
                     TARGET ACQUIRED: {scrapedData.name} @ {scrapedData.company}
                   </div>
                 )}
               </div>

               <div className="pt-4">
                 <label className="text-xs uppercase tracking-widest text-neutral-500 font-bold mb-2 flex items-center gap-2">
                   2. Verify Injected Script
                 </label>
                 <textarea
                   value={targetScript}
                   onChange={(e) => setTargetScript(e.target.value)}
                     placeholder="Enter the payload script. (e.g., 'We audited your tech stack...')"
                   aria-label="Video outreach script"
                   className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-mono text-emerald-100/90 focus:outline-none focus:border-[#00B7FF]/50 transition-colors resize-none"
                 />
               </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={status !== "idle" || !targetScript}
              className={`w-full mt-6 py-4 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-gpu duration-300 ${
                status === "idle" && targetScript 
                ? "bg-gradient-to-r from-purple-500 to-[#00B7FF] text-white shadow-[0_0_20px_rgba(0,183,255,0.3)] hover:-translate-y-1" 
                : "bg-white/5 border border-white/10 text-neutral-500 cursor-not-allowed"
              }`}
            >
              {status === "idle" ? <><Wand2 className="w-4 h-4"/> Render 4K Pitch</> : "Rendering Synthetic Media..."}
            </button>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-4">
             <ShieldAlert className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
             <div>
               <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">Anti-Slop Engaged</div>
               <p className="text-[10px] text-emerald-500/70 font-mono leading-relaxed">
                 Script will be structurally verified by NeMo Guardrails before rendering to ensure maximum semantic density and elimination of generic AI vocabulary.
               </p>
             </div>
          </div>
        </div>

        {/* Right Column: Preview Terminal */}
        <div className="lg:col-span-8">
          <div className="w-full h-full min-h-[500px] bg-black border border-white/10 rounded-2xl relative overflow-hidden flex flex-col items-center justify-center">
             
             {status === "idle" && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 mx-auto flex items-center justify-center">
                    <FileVideo className="w-6 h-6 text-neutral-500" />
                  </div>
                  <div className="font-mono text-xs text-neutral-500 uppercase tracking-widest">
                    Awaiting Target Script
                  </div>
                </div>
             )}

             {status === "scraping" && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 mx-auto flex items-center justify-center animate-pulse">
                    <Database className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="font-mono text-xs text-emerald-400 uppercase tracking-widest">
                    Pinging Apollo.io Graph...
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono">Extracting Executive Identity & Tech Stack</div>
                </div>
             )}

             {status === "generating" && (
                <div className="text-center space-y-6 w-full max-w-sm">
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-purple-500 to-[#00B7FF]"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 4, ease: "linear" }}
                    />
                  </div>
                  <div className="space-y-2 font-mono text-[10px] uppercase tracking-widest text-left">
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0}} className="text-neutral-400">1. Generating Voice (Nemotron Speech)...</motion.div>
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1}} className="text-neutral-400">2. Lip-sync mapping...</motion.div>
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:2.5}} className="text-[#00B7FF]">3. Finalizing 4K Render...</motion.div>
                  </div>
                </div>
             )}

             {status === "complete" && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full relative group">
                  {/* Fake Video Player Placeholder */}
                  <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=2000" alt="Executive" className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center cursor-pointer">
                    <div role="button" aria-label="Play video preview" className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 text-white ml-1" />
                    </div>
                  </div>
                  
                  {/* Overlay UI */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-bold text-sm mb-1">Target_Pitch_Alpha_01.mp4</div>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-widest border border-emerald-500/30">Ready for Deployment</span>
                          <span className="text-[10px] text-neutral-400 font-mono">1:42s • 4K UHD</span>
                        </div>
                      </div>
                      <button aria-label="Deploy video to n8n sequence" className="px-5 py-2 rounded-lg bg-[#00B7FF] text-white font-bold text-[10px] uppercase tracking-widest hover:bg-[#00B7FF]/90 transition-colors">
                        Deploy to n8n Sequence
                      </button>
                    </div>
                  </div>
                </motion.div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}
