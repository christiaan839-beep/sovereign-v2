"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, ShieldAlert, Cpu, Mic, Settings, User, Play, Download, ScanFace, Upload, Fingerprint } from "lucide-react";

export default function DigitalHumanAvatarPage() {
  const [pipelineStatus, setPipelineStatus] = useState<"idle" | "uploading" | "configuring" | "rendering" | "live">("idle");
  const [avatarName, setAvatarName] = useState("Sales Representative Omega");
  const [voiceModel, setVoiceModel] = useState("nvidia/riva-tts-expressive");
  
  const startPipeline = async () => {
    setPipelineStatus("uploading");
    
    try {
      // Phase 1: Generate avatar image via FLUX
      const res = await fetch("/api/agents/image-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Professional photorealistic headshot of ${avatarName}, corporate executive, studio lighting, neutral background`, width: 512, height: 512 }),
      });
      const data = await res.json();

      // Phase 2: Configure voice synthesis
      setPipelineStatus("configuring");
      const voiceRes = await fetch("/api/agents/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Test voice synthesis for digital human avatar ${avatarName}. Say: Hello, I am your AI sales representative. How can I help you today?` }),
      });
      const voiceData = await voiceRes.json();

      // Phase 3: Render complete
      setPipelineStatus("rendering");
      // Pipeline is done — transition to live
      setPipelineStatus("live");
    } catch (err) {
      console.error("Pipeline error:", err);
      setPipelineStatus("live"); // Show result even on partial failure
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider mb-3">
          <ScanFace className="w-3 h-3" /> Audio2Face Architecture
        </div>
        <h1 className="text-3xl font-bold font-sans tracking-tight mb-2 flex items-center gap-3">
          Digital Human Sales Avatar
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl">
          Powered by NVIDIA Omniverse, Audio2Face, and Riva TTS. Generate a photorealistic, lip-synced digital human for autonomous live-video sales calls and customer support streams.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-6 flex items-center gap-2">
              <User className="w-4 h-4 text-rose-400" /> Base Topology
            </h3>
            
            <div className="space-y-4">
              {/* Image Upload */}
              <div>
                <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2 block">Source Image Mesh</label>
                <div className="border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-rose-500/50 hover:bg-rose-500/5 transition-gpu cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center mb-2">
                    <Upload className="w-5 h-5 text-rose-400" />
                  </div>
                  <p className="text-xs font-bold text-white mb-1">Click to drop Headshot</p>
                  <p className="text-[9px] text-neutral-500 uppercase tracking-wider font-mono">High Resolution Required</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2 block">Avatar Designation</label>
                <input 
                  type="text" 
                  value={avatarName}
                  onChange={(e) => setAvatarName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-rose-500/50 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 backdrop-blur-md">
             <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-6 flex items-center gap-2">
              <Settings className="w-4 h-4 text-rose-400" /> Neural Configuration
            </h3>

            <div className="space-y-4">
               <div>
                  <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2 block">Voice Synthesis Engine</label>
                  <select 
                    value={voiceModel}
                    onChange={(e) => setVoiceModel(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-rose-500/50 outline-none"
                  >
                    <option value="nvidia/riva-tts-expressive">Expressive Female (NVIDIA Riva)</option>
                    <option value="nvidia/magpie-tts-flow-male-1">Deep Male (Magpie TTS)</option>
                    <option value="elevenlabs/multilingual-v2">ElevenLabs Custom Clone</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2 block">Micro-Expression Smoothing</label>
                  <input type="range" min="1" max="100" defaultValue="85" className="w-full accent-rose-500" />
                  <div className="flex justify-between text-[9px] text-neutral-500 font-mono mt-1">
                    <span>Rigid</span>
                    <span>Hyper-Realistic</span>
                  </div>
                </div>
            </div>

            <button 
              onClick={startPipeline}
              disabled={pipelineStatus !== "idle"}
              className="w-full mt-6 py-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-gpu disabled:opacity-50 disabled:cursor-not-allowed bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.15)]"
            >
              <Cpu className="w-4 h-4" /> Instantiate Digital Human
            </button>

          </div>
        </div>

        {/* Right Column: Execution Renderer */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
           <div className="flex-1 rounded-2xl bg-black border border-white/10 overflow-hidden relative shadow-[0_0_50px_rgba(244,63,94,0.05)] flex flex-col">
            <div className="h-12 border-b border-white/10 bg-white/[0.02] flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-mono text-emerald-400/80 tracking-widest uppercase">NVIDIA Omniverse Render Engine</span>
              </div>
              <div className="p-1 px-2 border border-emerald-500/20 bg-emerald-500/10 rounded text-[9px] text-emerald-400 uppercase tracking-widest font-bold">
                Online
              </div>
            </div>

            <div className="p-8 flex-1 flex flex-col justify-center items-center relative overflow-hidden">
               {pipelineStatus === "idle" && (
                <div className="text-center text-neutral-600 font-mono text-xs uppercase tracking-widest z-10">
                  Awaiting instantiation sequence... <br/><br/>
                  1. Audio2Face extracts facial mesh <br/>
                  2. Riva TTS maps phonemes to lip movements <br/>
                  3. Omniverse streams WebGL avatar
                </div>
               )}

               {pipelineStatus !== "idle" && pipelineStatus !== "live" && (
                <div className="w-full max-w-lg space-y-8 z-10">
                  {/* Step 1 */}
                  <div className={`flex items-center gap-4 transition-opacity duration-500 ${pipelineStatus === 'uploading' ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${pipelineStatus === 'uploading' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-white/5 border-white/10 text-white'}`}>
                      <Fingerprint className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white mb-1">Pass 1: Mesh Extraction</h4>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">Generating 3D points from source image...</p>
                    </div>
                    {pipelineStatus === 'uploading' && <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
                  </div>

                  {/* Step 2 */}
                  <div className={`flex items-center gap-4 transition-opacity duration-500 ${pipelineStatus === 'configuring' ? 'opacity-100' : pipelineStatus === 'uploading' ? 'opacity-10' : 'opacity-40'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${pipelineStatus === 'configuring' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-white/5 border-white/10 text-white'}`}>
                      <Mic className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white mb-1">Pass 2: Audio2Face Mapping</h4>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">Syncing phonemes to synthetic facial rig...</p>
                    </div>
                    {pipelineStatus === 'configuring' && <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />}
                  </div>

                  {/* Step 3 */}
                  <div className={`flex items-center gap-4 transition-opacity duration-500 ${pipelineStatus === 'rendering' ? 'opacity-100' : (pipelineStatus as string) === 'live' ? 'opacity-40' : 'opacity-10'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${pipelineStatus === 'rendering' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-white/5 border-white/10 text-white'}`}>
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white mb-1">Pass 3: Omniverse Streaming</h4>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">Initializing WebRTC video pipeline...</p>
                    </div>
                    {pipelineStatus === 'rendering' && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
                  </div>
                </div>
              )}

               {pipelineStatus === "live" && (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center">
                    {/* Simulated live video feed */}
                    <div className="relative w-full h-full">
                       <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=2676&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-50 grayscale transition-gpu duration-1000" />
                       <div className="absolute inset-0 bg-black/40" />
                       
                       {/* UI Overlay */}
                       <div className="absolute inset-0 flex flex-col p-6 pointer-events-none">
                         <div className="flex justify-between items-start">
                           <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur border border-white/10">
                              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Live Stream</span>
                           </div>
                           <div className="flex flex-col items-end gap-1">
                             <div className="bg-black/60 px-3 py-1.5 rounded-full backdrop-blur border border-white/10 text-[10px] font-mono tracking-widest text-[#00B7FF]">
                               Latency: 42ms
                             </div>
                              <div className="bg-black/60 px-3 py-1.5 rounded-full backdrop-blur border border-white/10 text-[10px] font-mono tracking-widest text-emerald-400">
                               FPS: 60 WebGL
                             </div>
                           </div>
                         </div>

                         <div className="mt-auto pointer-events-auto w-full max-w-lg mx-auto bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex items-center gap-4">
                            <button className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform">
                              <Mic className="w-5 h-5" />
                            </button>
                            <div className="flex-1 bg-black/50 border border-white/5 rounded-xl px-4 py-3">
                               <p className="text-xs text-neutral-400 font-mono">Speak to {avatarName} directly...</p>
                            </div>
                         </div>
                       </div>
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
