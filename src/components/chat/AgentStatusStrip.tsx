"use client";

import type { AgentHistoryEntry } from "./types";

interface AgentStatusStripProps {
  history: AgentHistoryEntry[];
  activeAgent: { label: string; startTime: number } | null;
}

export function AgentStatusStrip({ history, activeAgent }: AgentStatusStripProps) {
  const recent = history.slice(-3);
  if (recent.length === 0 && !activeAgent) return null;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/[0.04] bg-white/[0.01]">
      <div className="flex items-center gap-4">
        {recent.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                i === recent.length - 1 ? "bg-emerald-500 animate-pulse" : "bg-neutral-700"
              }`}
            />
            <span className="text-[10px] text-neutral-500">{entry.label}</span>
            <span className="text-[10px] text-neutral-600 font-mono">{(entry.responseTimeMs / 1000).toFixed(1)}s</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {activeAgent && (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-400">{activeAgent.label}</span>
          </div>
        )}
        <a href="/dashboard/agent-analytics" className="text-[9px] text-neutral-600 hover:text-emerald-400 transition-colors">
          All Agents &rarr;
        </a>
      </div>
    </div>
  );
}
