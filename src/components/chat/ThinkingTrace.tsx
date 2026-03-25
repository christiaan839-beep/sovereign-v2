"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface ThinkingTraceProps {
  thinking: string;
}

export function ThinkingTrace({ thinking }: ThinkingTraceProps) {
  const [expanded, setExpanded] = useState(false);
  if (!thinking) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-[#00B7FF]/60 hover:text-[#00B7FF] transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#00B7FF]/40" />
        {expanded ? "Hide Reasoning" : "Show Reasoning"}
        <ChevronDown className={`w-2.5 h-2.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="mt-2 pl-3 border-l-2 border-[#00B7FF]/10 text-[11px] text-neutral-500 leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
          {thinking}
        </div>
      )}
    </div>
  );
}
