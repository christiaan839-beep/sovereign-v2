"use client";

import { useEffect, useState } from "react";

interface StripStats {
  agents: number;
  models: number;
  memories: number;
  industries: number;
  uptime: string;
}

const STATIC_FALLBACK: StripStats = {
  agents: 137,
  models: 39,
  memories: 847,
  industries: 14,
  uptime: "99.9%",
};

/**
 * LiveProofStrip — Thin horizontal strip with live stats.
 * Fetches from /api/agents/dashboard-stats and /api/memory/stats in parallel.
 * JetBrains Mono, copper values, copper separator dots.
 */
export function LiveProofStrip() {
  const [stats, setStats] = useState<StripStats>(STATIC_FALLBACK);

  useEffect(() => {
    const [statsRes, memRes] = [
      fetch("/api/agents/dashboard-stats", { cache: "no-store" }),
      fetch("/api/memory/stats", { cache: "no-store" }),
    ];

    Promise.allSettled([statsRes, memRes]).then(async ([dashResult, memResult]) => {
      let agentData: Record<string, unknown> | null = null;
      let memData: Record<string, unknown> | null = null;

      if (dashResult.status === "fulfilled") {
        try { agentData = await dashResult.value.json(); } catch { /* ignore */ }
      }
      if (memResult.status === "fulfilled") {
        try { memData = await memResult.value.json(); } catch { /* ignore */ }
      }

      setStats((prev) => ({
        agents:
          agentData && typeof agentData.agentCount === "number"
            ? agentData.agentCount
            : prev.agents,
        models:
          agentData && typeof agentData.modelCount === "number"
            ? agentData.modelCount
            : prev.models,
        memories:
          memData &&
          typeof (memData as { platform?: { displayMemories?: unknown } }).platform?.displayMemories === "number"
            ? ((memData as { platform: { displayMemories: number } }).platform.displayMemories)
            : prev.memories,
        industries:
          agentData && typeof agentData.industries === "number"
            ? agentData.industries
            : prev.industries,
        uptime:
          agentData && typeof agentData.uptime === "string"
            ? agentData.uptime
            : prev.uptime,
      }));
    });
  }, []);

  const items = [
    { value: `${stats.agents} Agents`, label: "" },
    { value: `${stats.models}+ Models`, label: "" },
    { value: `${stats.memories.toLocaleString()} Memories`, label: "" },
    { value: `${stats.industries} Industries`, label: "" },
  ];

  return (
    <div
      className="py-3 border-y border-white/[0.06] bg-white/[0.02] overflow-x-auto"
      role="status"
      aria-label="Platform live stats"
    >
      <div className="flex justify-center items-center gap-6 flex-wrap min-w-max px-6">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-6">
            {i > 0 && (
              <span
                aria-hidden="true"
                className="w-1 h-1 rounded-full flex-shrink-0"
                style={{ background: "rgba(181,83,44,0.5)" }}
              />
            )}
            <span className="font-mono text-[12px] tracking-tight whitespace-nowrap text-[#B5532C] font-semibold">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
