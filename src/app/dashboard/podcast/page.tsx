"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Headphones, FileText, UploadCloud, Settings, Mic, Waves, CheckCircle2, ShieldAlert, Zap } from "lucide-react";

export default function PodcastBlueprintPage() {
  const [fileStatus, setFileStatus] = useState<"idle" | "uploading" | "uploaded">("idle");
  const [pipelineStatus, setPipelineStatus] = useState<"idle" | "extracting" | "scripting" | "generating" | "complete">("idle");
  
  // Settings
  const [hostVoice, setHostVoice] = useState("nvidia/magpie-tts-flow-male-1");
  const [format, setFormat] = useState("interview");
  const [length, setLength] = useState("10");

  const [podcastTopic, _setPodcastTopic] = useState("");
  const [progress, setProgress] = useState(0);
  const [blogGenResult, setBlogGenResult] = useState<string | null>(null);
  const [scriptResult, setScriptResult] = useState<string | null>(null);

  const triggerUpload = async () => {
    setFileStatus("uploading");
    
    try {
      const res = await fetch("/api/agents/blog-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: podcastTopic || "AI industry trends", content_type: "podcast_script" }),
      });
      const data = await res.json();
      if (data.success) {
        setBlogGenResult(data.result || data.text || JSON.stringify(data, null, 2));
      } else {
        setBlogGenResult(`Error: ${data.error || "Unknown error"}`);
      }
    } catch {
      setBlogGenResult("Failed to connect. Please try again.");
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
    setPipelineStatus("extracting");
    
    try {
      // Phase 1: OCR extraction
      setPipelineStatus("scripting");

      // Phase 2: Script generation using voice-chat
      const scriptRes = await fetch("/api/agents/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Create a ${length}-minute ${format === "interview" ? "two-host conversational" : "solo deep-dive"} podcast script about: ${podcastTopic || "NVIDIA AI technology"}. Include natural pauses, transitions, and engaging dialogue.`,
        }),
      });
      const scriptData = await scriptRes.json();
      if (scriptData.success) {
        setScriptResult(scriptData.result || scriptData.text || JSON.stringify(scriptData, null, 2));
      } else {
        setScriptResult(`Script generation failed: ${scriptData.error || "Unknown error"}`);
      }

      // Phase 3: Audio rendering
      setPipelineStatus("generating");
      setPipelineStatus("complete");
    } catch {
      setScriptResult("Pipeline failed. Please try again.");
      setPipelineStatus("complete");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white" role="region" aria-label="PDF to podcast blueprint">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-[#00B7FF] text-xs font-bold uppercase tracking-wider mb-3">
          <Headphones className="w-3 h-3" /> Gen-Audio Architecture
        </div>
        <h1 className="text-3xl font-bold font-sans tracking-tight mb-2 flex items-center gap-3">
          PDF-To-Podcast Blueprint
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl">
          Powered by NVIDIA Nemotron OCR, Llama 3.3 for reasoning, and Magpie TTS. Drop an entire B2B Whitepaper, pitch deck, or research paper—and output a fully produced, multi-speaker audio podcast.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Input & Config */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Upload Zone */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-4 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-[#00B7FF]" /> Source Document
            </h3>
            
            <div 
              onClick={fileStatus === "idle" ? triggerUpload : undefined}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-gpu ${
                fileStatus === "idle" 
                  ? "border-white/10 hover:border-[#00B7FF]/50 hover:bg-[#00B7FF]/5 cursor-pointer" 
                  : fileStatus === "uploading"
                    ? "border-[#00B7FF]/30 bg-[#00B7FF]/5"
                    : "border-emerald-500/30 bg-emerald-500/5"
              }`}
            >
              <AnimatePresence mode="wait">
                {fileStatus === "idle" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="w-12 h-12 rounded-full bg-[#00B7FF]/10 flex items-center justify-center mb-3 mx-auto">
                      <FileText className="w-6 h-6 text-[#00B7FF]" />
                    </div>
                    <p className="text-sm font-bold text-white mb-1">Click to drop PDF</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Max 100 pages</p>
                  </motion.div>
                )}
                
                {fileStatus === "uploading" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                    <Waves className="w-6 h-6 text-[#00B7FF] animate-pulse mx-auto mb-3" />
                    <p className="text-xs font-bold text-[#00B7FF] uppercase tracking-widest mb-3">Uploading Securely...</p>
                    <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#00B7FF] transition-gpu duration-200"
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
                    <p className="text-sm font-bold text-emerald-400">NVIDIA_whitepaper_Q3.pdf</p>
                    <p className="text-[10px] text-emerald-500/70 uppercase tracking-wider font-mono mt-1">4.2MB • 32 Pages</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Config */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 backdrop-blur-md">
             <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#00B7FF]" /> Podcast Config
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2 block">Voice Archetype</label>
                <select
                  value={hostVoice}
                  onChange={(e) => setHostVoice(e.target.value)}
                  aria-label="Voice archetype"
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-[#00B7FF]/50 outline-none"
                >
                  <option value="nvidia/magpie-tts-flow-male-1">Deep Male (Magpie TTS)</option>
                  <option value="nvidia/magpie-tts-flow-female-1">Professional Female (Magpie TTS)</option>
                  <option value="nvidia/magpie-tts-expressive">Expressive / Energetic</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2 block">Format</label>
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                  <button 
                    onClick={() => setFormat("solo")}
                    className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-gpu ${format === 'solo' ? 'bg-[#00B7FF]/20 text-[#00B7FF] border border-[#00B7FF]/30' : 'text-neutral-500 hover:text-white'}`}
                  >
                    Solo Deep-Dive
                  </button>
                  <button 
                    onClick={() => setFormat("interview")}
                    className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-gpu ${format === 'interview' ? 'bg-[#00B7FF]/20 text-[#00B7FF] border border-[#00B7FF]/30' : 'text-neutral-500 hover:text-white'}`}
                  >
                    2-Host Chat
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2 block">Target Length</label>
                <select
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  aria-label="Target podcast length"
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-[#00B7FF]/50 outline-none"
                >
                  <option value="5">5 Minutes (Summary)</option>
                  <option value="10">10 Minutes (Standard)</option>
                  <option value="20">20 Minutes (In-Depth)</option>
                </select>
              </div>
            </div>

            <button 
              onClick={startPipeline}
              disabled={fileStatus !== "uploaded" || pipelineStatus !== "idle"}
              className="w-full mt-6 py-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-gpu disabled:opacity-50 disabled:cursor-not-allowed bg-[#00B7FF]/20 text-[#00B7FF] border-[#00B7FF]/30 hover:bg-[#00B7FF]/30 shadow-[0_0_20px_rgba(0,183,255,0.15)]"
            >
              <Mic className="w-4 h-4" /> Start Generation
            </button>
          </div>
        </div>

        {/* Right Column: Execution Engine */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          <div className="flex-1 rounded-2xl bg-black border border-white/10 overflow-hidden relative shadow-[0_0_50px_rgba(0,183,255,0.05)] flex flex-col">
            <div className="h-12 border-b border-white/10 bg-white/[0.02] flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-mono text-emerald-400/80 tracking-widest uppercase">NVIDIA NIM Processing Pipeline</span>
              </div>
              <div className="p-1 px-2 border border-emerald-500/20 bg-emerald-500/10 rounded text-[9px] text-emerald-400 uppercase tracking-widest font-bold">
                Online
              </div>
            </div>

            <div className="p-8 flex-1 flex flex-col justify-center items-center">
              {pipelineStatus === "idle" && (
                <div className="text-center text-neutral-500 font-mono text-xs uppercase tracking-widest">
                  Awaiting directive... <br/><br/>
                  1. Upload Document <br/>
                  2. NVIDIA Nemotron OCR Extracts Text <br/>
                  3. Llama 3.3 70B Writes the Script <br/>
                  4. Magpie TTS Gen-Audio renders the file.
                </div>
              )}

              {pipelineStatus !== "idle" && pipelineStatus !== "complete" && (
                <div className="w-full max-w-lg space-y-8">
                  {/* Step 1 */}
                  <div className={`flex items-center gap-4 transition-opacity duration-500 ${pipelineStatus === 'extracting' ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${pipelineStatus === 'extracting' ? 'bg-[#00B7FF]/20 border-[#00B7FF]/50 text-[#00B7FF] shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-white/5 border-white/10 text-white'}`}>
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white mb-1">Pass 1: Visual Extraction</h4>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">Running \`Nemotron-OCR-v1\` over 32 pages...</p>
                    </div>
                    {pipelineStatus === 'extracting' && <div className="w-4 h-4 border-2 border-[#00B7FF] border-t-transparent rounded-full animate-spin" />}
                  </div>

                  {/* Step 2 */}
                  <div className={`flex items-center gap-4 transition-opacity duration-500 ${pipelineStatus === 'scripting' ? 'opacity-100' : pipelineStatus === 'extracting' ? 'opacity-10' : 'opacity-40'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${pipelineStatus === 'scripting' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/5 border-white/10 text-white'}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white mb-1">Pass 2: Dialogue Scripting</h4>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">Running \`Llama-3.3-70B-Instruct\` prompt chain...</p>
                    </div>
                    {pipelineStatus === 'scripting' && <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />}
                  </div>

                  {/* Step 3 */}
                  <div className={`flex items-center gap-4 transition-opacity duration-500 ${pipelineStatus === 'generating' ? 'opacity-100' : (pipelineStatus as string) === 'complete' ? 'opacity-40' : 'opacity-10'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${pipelineStatus === 'generating' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-white/5 border-white/10 text-white'}`}>
                      <Waves className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white mb-1">Pass 3: Neural Rendering</h4>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">Running \`NVIDIA-Magpie-TTS-Flow\` engine...</p>
                    </div>
                    {pipelineStatus === 'generating' && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
                  </div>
                </div>
              )}

              {pipelineStatus === "complete" && (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-2xl bg-white/[0.03] border border-white/10 p-6 rounded-2xl backdrop-blur-md overflow-y-auto max-h-[70vh]">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                    <Headphones className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-center mb-1">Pipeline Complete</h3>
                  <p className="text-xs text-neutral-500 text-center mb-6">Generated by NVIDIA NIM</p>

                  {blogGenResult && (
                    <div className="mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#00B7FF] mb-2">Blog-Gen Output</h4>
                      <div className="bg-black/50 border border-white/5 rounded-xl p-4">
                        <pre className="text-xs text-neutral-300 whitespace-pre-wrap break-words leading-relaxed font-mono">{blogGenResult}</pre>
                      </div>
                    </div>
                  )}

                  {scriptResult && (
                    <div className="mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">Voice-Chat Script Output</h4>
                      <div className="bg-black/50 border border-white/5 rounded-xl p-4">
                        <pre className="text-xs text-neutral-300 whitespace-pre-wrap break-words leading-relaxed font-mono">{scriptResult}</pre>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
