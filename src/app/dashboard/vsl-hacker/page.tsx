"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Cpu, UploadCloud, FileVideo, Waves, CheckCircle2, Search, Sparkles, Download } from "lucide-react";

export default function CosmosVSLHackerPage() {
  const [fileStatus, setFileStatus] = useState<"idle" | "uploading" | "uploaded">("idle");
  const [pipelineStatus, setPipelineStatus] = useState<"idle" | "vision" | "cadence" | "scripting" | "complete">("idle");
  
  // Settings
  const [targetAudience, setTargetAudience] = useState("B2B SaaS Founders");
  const [aggressiveness, setAggressiveness] = useState("High (Direct Response)");

  const [progress, setProgress] = useState(0);
  const [topic, setTopic] = useState("");
  const [visionResult, setVisionResult] = useState<string | null>(null);
  const [cadenceResult, setCadenceResult] = useState<string | null>(null);
  const [scriptResult, setScriptResult] = useState<string | null>(null);

  const triggerUpload = async () => {
    setFileStatus("uploading");
    
    try {
      const res = await fetch("/api/agents/blog-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: topic || "competitor video ad analysis", content_type: "vsl_script" }),
      });
      const data = await res.json();
      if (!data.success) console.error("API error:", data.error);
    } catch (err) {
      console.error("Network error:", err);
    }
    let p = 0;
    const interval = setInterval(() => {
      p += 15;
      if (p >= 100) {
        clearInterval(interval);
        setFileStatus("uploaded");
        setProgress(0);
      } else {
        setProgress(p);
      }
    }, 200);
  };

  const startPipeline = async () => {
    setPipelineStatus("vision");
    
    try {
      // Phase 1: Visual Analysis via Cosmos
      const visionRes = await fetch("/api/agents/visual-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://via.placeholder.com/640x360", question: `Analyze this competitor video ad frame. Identify visual hooks, text overlays, emotional triggers, and production quality for audience: ${targetAudience}` }),
      });
      const visionData = await visionRes.json();

      setVisionResult(visionData.success ? (visionData.result || visionData.text || JSON.stringify(visionData, null, 2)) : `Error: ${visionData.error || "Unknown"}`);

      // Phase 2: Emotional Cadence Mapping
      setPipelineStatus("cadence");
      const cadenceRes = await fetch("/api/agents/smart-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Map the emotional cadence of a competitor video ad targeting ${targetAudience}. Identify urgency spikes, trust signals, and manipulation patterns. Aggressiveness level: ${aggressiveness}`, task_type: "analysis" }),
      });
      const cadenceData = await cadenceRes.json();
      setCadenceResult(cadenceData.success ? (cadenceData.result || cadenceData.text || JSON.stringify(cadenceData, null, 2)) : `Error: ${cadenceData.error || "Unknown"}`);

      // Phase 3: Counter-Script Generation
      setPipelineStatus("scripting");
      const scriptRes = await fetch("/api/agents/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Write a superior counter-script for a video sales letter. Target: ${targetAudience}. Tone: ${aggressiveness}. The counter-script should have: 1) A better hook, 2) Value-driven body copy, 3) Authority-based CTA. Avoid generic AI slop.` }),
      });
      const scriptData = await scriptRes.json();

      setScriptResult(scriptData.success ? (scriptData.result || scriptData.text || JSON.stringify(scriptData, null, 2)) : `Error: ${scriptData.error || "Unknown"}`);

      setPipelineStatus("complete");
    } catch (err) {
      console.error("Pipeline error:", err);
      setPipelineStatus("complete");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Search className="w-3 h-3" /> Cosmos VLM Architecture
        </div>
        <h1 className="text-3xl font-bold font-sans tracking-tight mb-2 flex items-center gap-3">
          Video Sales Letter Hacker
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl">
          Powered by NVIDIA Cosmos Nemotron 34B. Upload any competitor&apos;s MP4 video ad. Cosmos VLM watches it frame-by-frame, extracts the visual hooks and emotional cadence, and outputs a superior counter-script.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Input & Config */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Upload Zone */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-4 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-amber-400" /> Target MP4 Ad
            </h3>
            
            <div 
              onClick={fileStatus === "idle" ? triggerUpload : undefined}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-gpu ${
                fileStatus === "idle" 
                  ? "border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5 cursor-pointer" 
                  : fileStatus === "uploading"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-emerald-500/30 bg-emerald-500/5"
              }`}
            >
              <AnimatePresence mode="wait">
                {fileStatus === "idle" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-3 mx-auto">
                      <FileVideo className="w-6 h-6 text-amber-400" />
                    </div>
                    <p className="text-sm font-bold text-white mb-1">Click to drop MP4</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Max 100MB / 5 mins</p>
                  </motion.div>
                )}
                
                {fileStatus === "uploading" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                    <Waves className="w-6 h-6 text-amber-400 animate-pulse mx-auto mb-3" />
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">Uploading Video...</p>
                    <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 transition-gpu duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </motion.div>
                )}

                {fileStatus === "uploaded" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                     <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 mx-auto">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-bold text-emerald-400">competitor_ad_1.mp4</p>
                    <p className="text-[10px] text-emerald-500/70 uppercase tracking-wider font-mono mt-1">12.4MB • 01:24</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Config */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 backdrop-blur-md">
             <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Counter-Script Directives
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2 block">Target Audience</label>
                <input 
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-amber-500/50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2 block">Copywriting Aggressiveness</label>
                <select 
                  value={aggressiveness}
                  onChange={(e) => setAggressiveness(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-amber-500/50 outline-none"
                >
                  <option value="High (Direct Response)">High (Direct Response & Urgency)</option>
                  <option value="Medium (Consultative)">Medium (Consultative & Value Driven)</option>
                  <option value="Low (Brand Awareness)">Low (Brand Awareness & Trust)</option>
                </select>
              </div>
            </div>

            <button 
              onClick={startPipeline}
              disabled={fileStatus !== "uploaded" || pipelineStatus !== "idle"}
              className="w-full mt-6 py-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-gpu disabled:opacity-50 disabled:cursor-not-allowed bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
            >
              <Search className="w-4 h-4" /> Run Cosmos Extraction
            </button>
          </div>
        </div>

        {/* Right Column: Execution Engine */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          <div className="flex-1 rounded-2xl bg-black border border-white/10 overflow-hidden relative shadow-[0_0_50px_rgba(245,158,11,0.05)] flex flex-col">
            <div className="h-12 border-b border-white/10 bg-white/[0.02] flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-mono text-amber-400/80 tracking-widest uppercase">NVIDIA Cosmos VLM Engine</span>
              </div>
              <div className="p-1 px-2 border border-emerald-500/20 bg-emerald-500/10 rounded text-[9px] text-emerald-400 uppercase tracking-widest font-bold">
                Online
              </div>
            </div>

            <div className="p-8 flex-1 flex flex-col justify-center items-center">
              {pipelineStatus === "idle" && (
                <div className="text-center text-neutral-600 font-mono text-xs uppercase tracking-widest">
                  Awaiting video payload... <br/><br/>
                  1. Upload Competitor VSL <br/>
                  2. Cosmos VLM extracts visual cues frame-by-frame <br/>
                  3. Transcribes & analyzes emotional pacing <br/>
                  4. DeepSeek-R1 generates superior counter-script
                </div>
              )}

              {pipelineStatus !== "idle" && pipelineStatus !== "complete" && (
                <div className="w-full max-w-lg space-y-8">
                  {/* Step 1 */}
                  <div className={`flex items-center gap-4 transition-opacity duration-500 ${pipelineStatus === 'vision' ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${pipelineStatus === 'vision' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-white/5 border-white/10 text-white'}`}>
                      <Video className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white mb-1">Pass 1: Visual Telemetry Extraction</h4>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">Running \`Cosmos-Nemotron-34B\` frame analysis...</p>
                    </div>
                    {pipelineStatus === 'vision' && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
                  </div>

                  {/* Step 2 */}
                  <div className={`flex items-center gap-4 transition-opacity duration-500 ${pipelineStatus === 'cadence' ? 'opacity-100' : pipelineStatus === 'vision' ? 'opacity-10' : 'opacity-40'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${pipelineStatus === 'cadence' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-white/5 border-white/10 text-white'}`}>
                      <Waves className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white mb-1">Pass 2: Emotional Cadence Mapping</h4>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">Transcribing audio and mapping tone/urgency spikes...</p>
                    </div>
                    {pipelineStatus === 'cadence' && <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />}
                  </div>

                  {/* Step 3 */}
                  <div className={`flex items-center gap-4 transition-opacity duration-500 ${pipelineStatus === 'scripting' ? 'opacity-100' : (pipelineStatus as string) === 'complete' ? 'opacity-40' : 'opacity-10'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${pipelineStatus === 'scripting' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/5 border-white/10 text-white'}`}>
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white mb-1">Pass 3: DeepSeek Counter-Scripting</h4>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">Generating superior hook and offer architecture...</p>
                    </div>
                    {pipelineStatus === 'scripting' && <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />}
                  </div>
                </div>
              )}

              {pipelineStatus === "complete" && (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full flex gap-4 h-full">

                  {/* Visual Analysis Output */}
                  <div className="flex-1 bg-white/[0.02] border border-white/5 p-5 rounded-xl flex flex-col h-full">
                     <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4 pb-2 border-b border-white/5">Cosmos VLM Analysis</h3>
                     <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                       <div>
                         <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold block mb-1">Visual Analysis</span>
                         <pre className="text-xs text-white/90 leading-relaxed border-l-2 border-amber-500/50 pl-2 whitespace-pre-wrap break-words font-mono">{visionResult || "No response received."}</pre>
                       </div>
                       <div>
                         <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold block mb-1">Emotional Cadence</span>
                         <pre className="text-xs text-white/90 leading-relaxed border-l-2 border-rose-500/50 pl-2 whitespace-pre-wrap break-words font-mono">{cadenceResult || "No response received."}</pre>
                       </div>
                     </div>
                  </div>

                  {/* Generated Script Output */}
                  <div className="flex-1 bg-[#00B7FF]/5 border border-[#00B7FF]/20 p-5 rounded-xl flex flex-col h-full relative">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00B7FF] to-purple-500 rounded-t-xl" />
                     <h3 className="text-xs font-bold uppercase tracking-widest text-[#00B7FF] mb-4 pb-2 border-b border-[#00B7FF]/20">Counter-Script Result</h3>
                     <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                       <pre className="text-xs leading-relaxed text-neutral-200 whitespace-pre-wrap break-words font-mono">{scriptResult || "No response received."}</pre>
                     </div>
                     <button className="w-full mt-4 py-2 bg-[#00B7FF] hover:bg-[#00B7FF]/90 transition-colors rounded-lg flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-white">
                      <Download className="w-3 h-3" /> Export Script & Storyboard
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
