"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Globe2, Sparkles, Code, Eye, Copy, CheckCircle2, Terminal, MonitorPlay, Activity } from "lucide-react";
import { useUsage } from "@/hooks/useUsage";

interface ProgressStep {
  step: number;
  message: string;
}

export default function PageBuilderPage() {
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [offer, setOffer] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  
  // Streaming state
  const [generating, setGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const { canGenerate, refresh: refreshUsage } = useUsage();
  
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, steps]);

  const handleGenerate = async () => {
    if (!businessName || !offer || !canGenerate) return;
    
    setGenerating(true);
    setGeneratedHtml(null);
    setLogs(["[SYSTEM] Initializing Autonomous Engine pipeline..."]);
    setSteps([]);
    setActiveStep(0);
    setViewMode("code"); // Show code/logs during generation

    try {
      const res = await fetch("/api/agents/page-builder-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, industry, offer, targetAudience }),
      });

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch { /* response may not be JSON */ }
        throw new Error(`Pipeline Authorization/Network Error: ${errMsg}`);
      }

      if (!res.body) throw new Error("No response stream from API.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || ""; // keep incomplete chunk in buffer

        for (const part of parts) {
          if (!part.trim()) continue;
          try {
            const parsed = JSON.parse(part);
            
            if (parsed.type === "progress") {
              setSteps(prev => [...prev, parsed.data]);
              setActiveStep(parsed.data.step);
              setLogs(prev => [...prev, `[INFO] ${parsed.data.message}`]);
            } else if (parsed.type === "log") {
              setLogs(prev => [...prev, parsed.data.message]);
            } else if (parsed.type === "complete") {
              setGeneratedHtml(parsed.data.code);
              setViewMode("preview");
              refreshUsage();
            } else if (parsed.type === "error") {
              setLogs(prev => [...prev, `[ERROR] ${parsed.data.message}`]);
            }
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    } catch {
      setLogs(prev => [...prev, "[ERROR] Pipeline halted unexpectedly. Please retry."]);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedHtml) {
      navigator.clipboard.writeText(generatedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-[#00B7FF] text-[10px] font-bold uppercase tracking-wider mb-4">
            <Globe2 className="w-3 h-3" /> Autonomous Page Builder v2
          </div>
          <h1 className="text-3xl font-bold font-mono text-white tracking-tight">Framer-Killer Engine</h1>
          <p className="text-sm text-[#8A95A5] mt-2 font-mono uppercase tracking-widest">
            X-Ray Competitors → Write Copy → Code React in 45 Seconds
          </p>
        </div>
        
        {/* Run CTA (only shows if NOT generating and no results yet) */}
        {!generating && !generatedHtml && (
          <button
            onClick={handleGenerate}
            disabled={!businessName || !offer || generating}
            className="px-8 py-4 bg-[#00B7FF] hover:bg-[#00B7FF]/90 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-[0.15em] rounded-xl flex items-center gap-3 transition-gpu shadow-[0_0_30px_rgba(0,183,255,0.3)] group"
          >
            <MonitorPlay className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Launch Pipeline
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[75vh] min-h-[600px]">
        
        {/* Left Pane: Config & Live Terminal */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          
          {/* Config Card */}
          <div className="glass-card border border-glass-border p-6 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#5C667A] mb-5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00B7FF]" /> Pipeline Configuration
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-[#5C667A] mb-2">Business *</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="NeuroStack"
                    disabled={generating}
                    className="w-full bg-black/60 border border-glass-border rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:border-[#00B7FF]/50 outline-none transition-gpu disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-[#5C667A] mb-2">Industry</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="SaaS"
                    disabled={generating}
                    className="w-full bg-black/60 border border-glass-border rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:border-[#00B7FF]/50 outline-none transition-gpu disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-[#5C667A] mb-2">Offer / CTA *</label>
                <textarea
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  placeholder="Free 30-min strategy session for CTOs"
                  rows={2}
                  disabled={generating}
                  className="w-full bg-black/60 border border-glass-border rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:border-[#00B7FF]/50 outline-none transition-gpu resize-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-[#5C667A] mb-2">Target Audience</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. CMOs of hyper-growth SaaS"
                  disabled={generating}
                  className="w-full bg-black/60 border border-glass-border rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:border-[#00B7FF]/50 outline-none transition-gpu disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Terminal / Status Card */}
          <div className="glass-card border border-glass-border p-1 flex-1 flex flex-col min-h-0 bg-black/80">
            <div className="px-4 py-3 border-b border-glass-border flex items-center gap-2 bg-white/[0.02]">
              <Terminal className="w-4 h-4 text-[#00B7FF]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A95A5]">Command Center</span>
              {generating && (
                <span className="ml-auto flex items-center gap-2 text-[10px] text-emerald-400 font-mono">
                  <Activity className="w-3 h-3 animate-pulse" /> Running
                </span>
              )}
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2">
              {!generating && logs.length === 0 ? (
                <div className="text-[#5C667A] mt-4 flex flex-col items-center justify-center h-full gap-3">
                  <Activity className="w-8 h-8 opacity-20" />
                  <span>SYSTEM STANDBY</span>
                  <span className="text-[10px]">Awaiting configuration payload...</span>
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`
                    ${log.includes('[ERROR]') ? 'text-red-400' : ''}
                    ${log.includes('[SYS]') ? 'text-amber-400/80' : ''}
                    ${log.includes('[INFO]') ? 'text-[#00B7FF]/80' : ''}
                    ${!log.match(/\[(ERROR|SYS|INFO)\]/) ? 'text-emerald-400/70' : ''}
                  `}>
                    <span className="opacity-50 mr-2">{new Date().toLocaleTimeString([], {hour12: false, second: '2-digit'})}</span>
                    {log}
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
          
        </div>

        {/* Right Pane: Live View */}
        <div className="xl:col-span-8 glass-card border border-glass-border flex flex-col overflow-hidden bg-black relative">
          
          {/* Tabs */}
          <div className="px-4 py-3 border-b border-glass-border bg-[#0a0a0a] flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-lg border border-white/[0.05]">
              <button
                onClick={() => setViewMode("preview")}
                className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-gpu flex items-center gap-2 ${
                  viewMode === "preview" ? "bg-[#00B7FF] text-white shadow-lg" : "text-[#5C667A] hover:text-white"
                }`}
              >
                <Eye className="w-3 h-3" /> Anthropic Artifacts Engine
              </button>
              <button
                onClick={() => setViewMode("code")}
                className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-gpu flex items-center gap-2 ${
                  viewMode === "code" ? "bg-[#00B7FF] text-white shadow-lg" : "text-[#5C667A] hover:text-white"
                }`}
              >
                <Code className="w-3 h-3" /> Raw Source
              </button>
            </div>
            
            {generatedHtml && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20 transition-gpu"
              >
                {copied ? <><CheckCircle2 className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Export HTML</>}
              </button>
            )}
          </div>

          {/* Viewport */}
          <div className="flex-1 relative bg-white overflow-hidden">
            {!generatedHtml && !generating && (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center text-center p-8 border-t border-glass-border">
                <Globe2 className="w-16 h-16 text-[#2A2D35] mb-4" />
                <p className="text-sm text-[#5C667A] font-mono tracking-widest uppercase mb-2">Workspace Empty</p>
                <p className="text-xs text-[#3A3D45]">Launch the pipeline to generate your architecture.</p>
              </div>
            )}

            {generating && !generatedHtml && (
              <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-12">
                
                {/* Visual Pipeline Progress */}
                <div className="max-w-md w-full space-y-6">
                  {[
                    { s: 1, label: "Initializing" },
                    { s: 2, label: "Competitor X-Ray (Tavily)" },
                    { s: 3, label: "Architecture Mapping" },
                    { s: 4, label: "Copywriting Generation" },
                    { s: 5, label: "React/Tailwind Compilation" },
                    { s: 8, label: "Final Build" },
                  ].map((s) => (
                    <div key={s.s} className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-gpu duration-500 ${
                        activeStep >= s.s ? "border-[#00B7FF] bg-[#00B7FF] text-white shadow-[0_0_15px_rgba(0,183,255,0.5)]" : "border-glass-border text-[#5C667A] bg-transparent"
                      }`}>
                        {activeStep > s.s ? "✓" : s.s}
                      </div>
                      <div className="flex-1">
                        <div className={`text-xs font-bold uppercase tracking-widest transition-colors duration-500 ${activeStep >= s.s ? "text-white" : "text-[#5C667A]"}`}>
                          {s.label}
                        </div>
                        {activeStep === s.s && (
                          <div className="h-0.5 w-full bg-glass-border mt-2 overflow-hidden rounded-full">
                            <motion.div 
                              className="h-full bg-[#00B7FF]" 
                              initial={{ width: "0%" }} 
                              animate={{ width: "100%" }} 
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}

            {generatedHtml && viewMode === "preview" && (
              <iframe
                srcDoc={generatedHtml}
                className="w-full h-full border-0 absolute inset-0"
                title="Generated UI Preview"
                sandbox="allow-scripts allow-same-origin"
              />
            )}

            {generatedHtml && viewMode === "code" && (
              <div className="absolute inset-0 bg-[#0a0a0a] overflow-auto">
                <pre className="p-6 text-[11px] text-emerald-400/80 font-mono leading-relaxed whitespace-pre w-full">
                  {generatedHtml}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
