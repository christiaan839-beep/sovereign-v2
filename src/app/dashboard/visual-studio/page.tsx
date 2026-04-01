"use client";

import React, { useState } from 'react';
import { Video, Sparkles, Wand2, Terminal, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function VisualStudioNode() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [apiResult, setApiResult] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setGenerationStep(1);

    try {
      // Real API call to the Cosmos video generation NIM agent
      const res = await fetch("/api/agents/cosmos-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style: "cinematic_commercial" }),
      });
      const data = await res.json();
      setGenerationStep(2);
      setGenerationStep(3);
      setGenerationStep(4);
      if (data.success) {
        setApiResult(data.result || data.text || JSON.stringify(data, null, 2));
      } else {
        setApiResult(`Generation failed: ${data.error || "Unknown error"}`);
      }
    } catch {
      setApiResult("Connection failed. Please try again.");
    } finally {
      setIsGenerating(false);
      setGenerationStep(5);
    }
  };

  const steps = [
    "Awaiting Core Command...",
    "NVIDIA Cosmos VLM extracting visual context...",
    "Comfy_NV_Video_Prep generating spatial frames...",
    "Applying Temporal Consistency (TensorRT)...",
    "Synthesizing NeMo Audio-Voiceover Track..."
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-[#00B7FF] p-8 font-mono animate-in fade-in" role="main" aria-label="Visual studio video generation">
      <div className="max-w-6xl mx-auto space-y-12">
        
        <header className="border-b border-[#00B7FF]/30 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-[0.2em] flex items-center gap-4">
              <Video className="w-8 h-8" />
              Visual Studio [Comfy-NV-Node]
            </h1>
            <p className="text-[#00B7FF]/60 mt-2 uppercase text-xs tracking-widest">
              Synthetic Video Generation Array powered by NVIDIA Cosmos VLM
            </p>
          </div>
          <div className="text-right text-xs">
            <p>VRAM ALLOCATED: 24GB</p>
            <p>NVIDIA TENSOR CORES: ACTIVE</p>
          </div>
        </header>

        <main className="grid lg:grid-cols-2 gap-12">
          {/* Engineering Console */}
          <div className="space-y-6">
            <div className="bg-[#00B7FF]/5 border border-[#00B7FF]/20 p-6 rounded-none relative overflow-hidden">
               <div className="absolute top-0 left-0 w-2 h-full bg-[#00B7FF]" />
               <h2 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                 <Terminal className="w-4 h-4" />
                 Prompt Command Interface
               </h2>
               <textarea
                 className="w-full h-40 bg-black border border-[#00B7FF]/40 p-4 text-[#00B7FF] placeholder:text-[#00B7FF]/30 focus:outline-none focus:border-[#00B7FF] transition-colors resize-none"
                 placeholder="Initialize scene variables... e.g., 'Cinematic 30s commercial for a luxury watch, neon lighting, hyper-realistic, 4k 60fps'"
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 disabled={isGenerating}
                 aria-label="Video generation prompt"
               />
               <button
                 onClick={handleGenerate}
                 disabled={!prompt || isGenerating}
                 className="w-full mt-4 bg-[#00B7FF] text-black font-black uppercase tracking-widest py-4 hover:bg-white transition-gpu disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
               >
                 {isGenerating ? <><Zap className="w-5 h-5 animate-bounce" /> Executing Pipeline...</> : <><Sparkles className="w-5 h-5" /> Generate Commercial</>}
               </button>
            </div>

            {/* Telemetry Window */}
            <div className="bg-black border border-[#00B7FF]/20 p-6 font-mono text-xs space-y-3" aria-live="polite">
               <p className="text-white opacity-50">[SYSTEM LOG::COSMOS_VLM]</p>
               {isGenerating && (
                 <motion.div
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="text-[#00B7FF] animate-pulse space-y-2"
                 >
                   <p>&#x25B6; INITIATING RENDER SEQUENCE</p>
                   <p>&#x25B6; CURRENT THREAD: {steps[generationStep]}</p>
                   <div className="w-full h-1 bg-black border border-[#00B7FF]/50 mt-4">
                     <div 
                       className="h-full bg-[#00B7FF] transition-gpu duration-1000 ease-out"
                       style={{ width: `${(generationStep / 4) * 100}%` }}
                     />
                   </div>
                 </motion.div>
               )}
               {generationStep === 5 && (
                 <p className="text-white">&#x25B6; RENDER COMPLETE. ASSET READY FOR DEPLOYMENT.</p>
               )}
               {generationStep === 0 && <p className="opacity-50">WAITING FOR EXECUTION COMMAND.</p>}
            </div>
          </div>

          {/* Visual Output Array */}
          <div className="relative">
            <div className="absolute inset-0 bg-[#00B7FF]/5 border border-[#00B7FF]/20 flex flex-col items-center justify-center">
              {generationStep === 0 && (
                <div className="text-center opacity-40">
                  <Wand2 className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-sm uppercase tracking-widest">Visual Array Standby</p>
                </div>
              )}
              {isGenerating && (
                <div className="text-center">
                  <div className="w-24 h-24 border-t-2 border-[#00B7FF] border-solid rounded-full animate-spin mx-auto mb-6" />
                  <p className="text-sm uppercase tracking-widest animate-pulse">{steps[generationStep]}</p>
                </div>
              )}
              {generationStep === 5 && (
                <div className="w-full h-full p-4 overflow-y-auto">
                  <div className="w-full h-full bg-black/80 border border-[#00B7FF]/30 p-6">
                    <p className="font-bold uppercase tracking-widest text-[#00B7FF] mb-2">Generation Result</p>
                    <p className="text-xs text-white opacity-70 mb-4">Cosmos AI Response</p>
                    <pre className="text-xs text-[#00B7FF]/90 whitespace-pre-wrap break-words leading-relaxed font-mono">
                      {apiResult || "No response received."}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            {/* Cyberpunk corner accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00B7FF]" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00B7FF]" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#00B7FF]" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00B7FF]" />
          </div>
        </main>

      </div>
    </div>
  );
}
