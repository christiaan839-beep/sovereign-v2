"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cuboid, Box, Layers, Download, Zap, Database, Rotate3D } from "lucide-react";

export default function EdifyForgePage() {
  const [prompt, setPrompt] = useState("");
  const [pipelineState, setPipelineState] = useState<"idle" | "generating" | "complete">("idle");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [apiResultText, setApiResultText] = useState<string | null>(null);

  const startForge = async () => {
    if (!prompt) return;
    setPipelineState("generating");
    
    try {
      const res = await fetch("/api/agents/image-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `3D mesh generation: ${prompt}`, style: "3d_asset" }),
      });
      const data = await res.json();
      if (data.success) {
        // Try to extract image URL from response; fall back to text result
        const imageUrl = data.imageUrl || data.image_url || data.url || null;
        setGeneratedImageUrl(imageUrl);
        setApiResultText(data.result || data.text || JSON.stringify(data, null, 2));
      } else {
        console.error("3D generation failed:", data.error);
        setApiResultText(`Generation failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("3D forge error:", err);
    } finally {
      setPipelineState("complete");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Cuboid className="w-3 h-3" /> Edify 3D Generative AI
        </div>
        <h1 className="text-3xl font-bold font-sans tracking-tight mb-2 flex items-center gap-3">
          3D Design Forge
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl">
          Instantly execute industrial design agencies. Prompt the Edify architect to generate highly detailed, production-ready .OBJ and .USD 3D meshes for manufacturing, rendering, or 3D printing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-white/10 p-6 bg-white/[0.02]">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-6 flex items-center gap-2">
              <Database className="w-4 h-4 text-orange-400" /> Blueprint Prompt
            </h3>
            
            <div className="space-y-4">
               <div>
                  <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2 block">Engineering Directives</label>
                  <textarea 
                    rows={6}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-orange-500/50 outline-none leading-relaxed"
                    placeholder="E.g., Generate an aggressive, matte-black carbon fiber commercial drone chassis with 4 rotors and aerodynamic payload shielding."
                  />
               </div>
            </div>

            <button 
              onClick={startForge}
              disabled={pipelineState === "generating" || !prompt}
              className="w-full mt-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-gpu disabled:opacity-50 disabled:cursor-not-allowed bg-orange-500 text-white hover:bg-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.3)] flex justify-center items-center gap-2"
            >
              <Zap className="w-4 h-4" /> Synthesize 3D Mesh
            </button>
          </div>
        </div>

        {/* Right Col: Console */}
        <div className="lg:col-span-8">
           <div className="h-full min-h-[500px] flex flex-col rounded-2xl bg-[#0a0a0a] border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(249,115,22,0.05)]">
               <div className="h-12 border-b border-white/10 bg-white/[0.02] flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-orange-400" />
                    <span className="text-[10px] font-mono text-orange-400/80 tracking-widest uppercase">NVIDIA Picasso Render Canvas</span>
                  </div>
                  {pipelineState === "generating" && (
                    <span className="text-[9px] text-orange-400 font-mono uppercase tracking-widest font-bold animate-pulse">Rendering Polygons...</span>
                  )}
               </div>

               <div className="flex-1 relative flex items-center justify-center bg-[url('/grid.svg')] bg-[size:30px_30px] opacity-90 overflow-hidden">
                  {/* Subtle 3D environment lighting fx */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-0" />
                  
                  {pipelineState === "idle" && (
                     <div className="text-center z-10">
                        <Rotate3D className="w-16 h-16 text-neutral-800 mx-auto mb-4" />
                        <p className="text-neutral-600 font-mono text-xs uppercase tracking-widest">Workspace Empty</p>
                     </div>
                  )}

                  {pipelineState === "generating" && (
                     <div className="text-center z-10">
                        <motion.div 
                          animate={{ rotateY: 360, rotateX: 360 }} 
                          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                        >
                           <Box className="w-24 h-24 text-orange-500/50 mx-auto mb-6 drop-shadow-[0_0_30px_rgba(249,115,22,0.5)] border-4 border-orange-500/20 rounded-xl" />
                        </motion.div>
                        <p className="font-mono text-xs text-orange-400 uppercase tracking-widest animate-pulse">
                          Generating Vertices & Computing Normals...
                        </p>
                     </div>
                  )}

                  {pipelineState === "complete" && (
                     <motion.div
                       initial={{ opacity: 0, scale: 0.8 }}
                       animate={{ opacity: 1, scale: 1 }}
                       transition={{ duration: 0.5, type: "spring" }}
                       className="z-10 relative flex flex-col items-center max-w-lg w-full"
                     >
                        {generatedImageUrl ? (
                          <div className="w-64 h-64 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex items-center justify-center p-4 mb-6 relative overflow-hidden group">
                             <div className="absolute inset-0 bg-orange-500/10 blur-3xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                             <img
                               src={generatedImageUrl}
                               className="w-full h-full object-contain drop-shadow-2xl relative z-10"
                               alt="Generated 3D Asset"
                             />
                          </div>
                        ) : (
                          <div className="w-full bg-neutral-900/80 border border-white/10 rounded-2xl p-6 mb-6 max-h-64 overflow-y-auto">
                            <p className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-3">Generation Result</p>
                            <pre className="text-xs text-neutral-300 whitespace-pre-wrap break-words leading-relaxed font-mono">{apiResultText || "No response received."}</pre>
                          </div>
                        )}

                        <button className="px-6 py-3 rounded-xl bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-neutral-200 transition-colors shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center gap-2">
                          <Download className="w-4 h-4" /> Export Production File
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
