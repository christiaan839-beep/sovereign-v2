"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, ChevronDown, BookOpen, Shield } from "lucide-react";

/**
 * CITATION PANEL — Renders inline citations and source panel.
 *
 * Takes AI output with [1], [2], [3] markers and a citations array.
 * Renders clickable citation badges inline and an expandable source panel.
 * Beats Perplexity's trust UI with grounding score visualization.
 *
 * Usage:
 *   <CitationPanel
 *     output="According to recent data [1], AI agents are growing 40% YoY [2]."
 *     citations={[{ index: 1, url: "https://...", title: "Source", snippet: "..." }]}
 *     groundingScore={0.85}
 *   />
 */

interface Citation {
  index: number;
  url: string;
  title: string;
  snippet: string;
}

interface CitationPanelProps {
  output: string;
  citations: Citation[];
  groundingScore: number;
  researchAvailable?: boolean;
}

export function CitationPanel({ output, citations, groundingScore, researchAvailable = true }: CitationPanelProps) {
  const [showSources, setShowSources] = useState(false);
  const [hoveredCitation, setHoveredCitation] = useState<number | null>(null);

  // Replace [N] markers with interactive citation badges
  const renderOutput = () => {
    const parts = output.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const citIndex = parseInt(match[1]);
        const citation = citations.find(c => c.index === citIndex);
        if (!citation) return <span key={i}>{part}</span>;

        return (
          <span key={i} className="relative inline-block">
            <button
              onMouseEnter={() => setHoveredCitation(citIndex)}
              onMouseLeave={() => setHoveredCitation(null)}
              onClick={() => window.open(citation.url, "_blank", "noopener")}
              className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 rounded-sm hover:bg-emerald-500/30 transition-colors cursor-pointer align-super mx-0.5"
              title={citation.title}
            >
              {citIndex}
            </button>
            {/* Tooltip */}
            <AnimatePresence>
              {hoveredCitation === citIndex && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg border border-white/[0.08] bg-[#0A0A0A] shadow-xl z-50"
                >
                  <div className="text-xs font-semibold text-white truncate mb-1">{citation.title}</div>
                  <div className="text-[10px] text-neutral-500 truncate mb-1">{citation.url}</div>
                  <div className="text-[10px] text-neutral-400 line-clamp-2">{citation.snippet}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="space-y-3">
      {/* Grounding Score Bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Shield className={`w-3.5 h-3.5 ${groundingScore > 0.6 ? "text-emerald-400" : groundingScore > 0.3 ? "text-amber-400" : "text-red-400"}`} />
          <span className="text-[10px] text-neutral-500">
            {Math.round(groundingScore * 100)}% source-grounded
          </span>
        </div>
        <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${groundingScore * 100}%` }}
            className={`h-full rounded-full ${
              groundingScore > 0.6 ? "bg-emerald-500/60" : groundingScore > 0.3 ? "bg-amber-500/60" : "bg-red-500/60"
            }`}
          />
        </div>
        {!researchAvailable && (
          <span className="text-[9px] text-amber-500/70 px-1.5 py-0.5 rounded bg-amber-500/10">No live sources</span>
        )}
      </div>

      {/* Output with inline citations */}
      <div className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
        {renderOutput()}
      </div>

      {/* Sources Panel */}
      {citations.length > 0 && (
        <div className="border-t border-white/[0.06] pt-3">
          <button
            onClick={() => setShowSources(!showSources)}
            className="flex items-center gap-2 text-xs text-neutral-500 hover:text-white transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            {citations.length} source{citations.length !== 1 ? "s" : ""}
            <ChevronDown className={`w-3 h-3 transition-transform ${showSources ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {showSources && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2 space-y-2"
              >
                {citations.map((c) => (
                  <a
                    key={c.index}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 p-2.5 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors group"
                  >
                    <span className="flex items-center justify-center w-5 h-5 rounded-sm bg-emerald-500/10 text-emerald-400 text-[10px] font-bold shrink-0 mt-0.5">
                      {c.index}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-neutral-300 group-hover:text-white truncate">
                        {c.title}
                      </div>
                      <div className="text-[10px] text-neutral-600 truncate">{c.url}</div>
                      <div className="text-[10px] text-neutral-500 line-clamp-1 mt-0.5">{c.snippet}</div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400 shrink-0 mt-0.5" />
                  </a>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
