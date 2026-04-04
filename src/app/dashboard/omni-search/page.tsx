"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Database, Layers, FileText } from "lucide-react";

export default function OmniSearchPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "searching" | "complete">("idle");
  const [result, setResult] = useState<string>("");
  const [sources, setSources] = useState<Array<{title: string; score: string}>>([]);

  const startSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setStatus("searching");
    setResult("");
    setSources([]);

    try {
      const res = await fetch("/api/agents/omni-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sources: ["web", "docs", "crm"] }),
      });
      const data = await res.json();
      if (data.answer || data.result) {
        setResult(data.answer || data.result || "No results found.");
        const resultSources = [];
        if (data.confidence) {
          resultSources.push({ title: "Confidence", score: data.confidence });
        }
        if (data.model) {
          resultSources.push({ title: `Model: ${data.model}`, score: `${data.tokens_used || 0} tokens` });
        }
        if (resultSources.length === 0) {
          resultSources.push(
            { title: "NIM Neural Retrieval", score: "Nemotron Ultra" },
            { title: "Sources", score: "web, docs, CRM" },
          );
        }
        setSources(resultSources);
      } else if (data.error) {
        setResult(`Search failed: ${data.error}`);
      } else {
        setResult("Search failed. Ensure your NVIDIA NIM key is configured in Settings.");
      }
    } catch {
      setResult("Network error. Check your connection.");
    } finally {
      setStatus("complete");
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen bg-[#050505] text-white" role="region" aria-label="Global knowledge retrieval search">
      <div className="text-center mb-12 mt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
          <Database className="w-3 h-3" /> Omni-Search RAG Architecture
        </div>
        <h1 className="text-4xl font-bold font-sans tracking-tight mb-4">
          Global Knowledge Retrieval
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl mx-auto">
          Powered by NVIDIA Nemotron Embedding & Rerank NIMs. Instantly search across your entire CRM, Lead Databases, Uploaded PDFs, and Telemetry Logs.
        </p>
      </div>

      <form onSubmit={startSearch} className="relative max-w-3xl mx-auto mb-16">
         <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
            <Search className={`w-6 h-6 ${status === 'searching' ? 'text-emerald-400 animate-pulse' : 'text-neutral-500'}`} />
         </div>
         <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={status === "searching"}
            placeholder="E.g., What objections did the Roofing lead in Austin have last week?"
            aria-label="Search query"
            className="w-full bg-black/80 border border-white/10 rounded-2xl pl-16 pr-6 py-6 text-lg text-white focus:border-emerald-500/50 outline-none shadow-[0_0_50px_rgba(16,185,129,0.05)] transition-gpu font-mono placeholder:font-sans placeholder:text-neutral-500"
         />
         <button type="submit" className="hidden" />
      </form>

      {status === "complete" && query && (
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-6 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" /> Neural Rerank Results
            </h3>
            
            <div className="space-y-4">
               {/* Synthesized Answer */}
               <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
                 <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2">Synthesized Answer (NIM Neural Retrieval)</h4>
                 <p className="text-sm leading-relaxed text-emerald-50 whitespace-pre-wrap">
                   {result}
                 </p>
               </div>

               {/* Source References */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {sources.map((src, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/30 transition-colors cursor-pointer group">
                       <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
                          <span className="text-xs font-bold text-white">{src.title}</span>
                       </div>
                       <p className="text-[10px] text-neutral-500 font-mono">{src.score}</p>
                    </div>
                  ))}
               </div>
            </div>
         </motion.div>
      )}
    </div>
  );
}
