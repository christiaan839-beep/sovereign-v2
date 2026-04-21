"use client";

import { useEffect, useState } from "react";

interface StripStats {
  agents: number;
  models: number;
  industries: number;
  uptime: string;
}

const STATIC_FALLBACK: StripStats = {
  agents: 137,
  models: 39,
  industries: 14,
  uptime: "99.9%",
};

/**
 * LiveProofStrip — Thin horizontal strip with 4 live stats.
 * Fetches from /api/agents/dashboard-stats with static fallback.
 * JetBrains Mono, copper values, copper separator dots.
 */
export function LiveProofStrip() {
  const [stats, setStats] = useState<StripStats>(STATIC_FALLBACK);

  useEffect(() => {
    fetch("/api/agents/dashboard-stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.agentCount === "number") {
          setStats({
            agents: data.agentCount ?? STATIC_FALLBACK.agents,
            models: data.modelCount ?? STATIC_FALLBACK.models,
            industries: data.industries ?? STATIC_FALLBACK.industries,
            uptime: data.uptime ?? STATIC_FALLBACK.uptime,
          });
        }
      })
      .catch(() => {
        // silently keep static fallback
      });
  }, []);

  const items = [
    { value: stats.agents.toString(), label: "agents live" },
    { value: stats.models.toString(), label: "models" },
    { value: stats.industries.toString(), label: "industries" },
    { value: stats.uptime, label: "uptime" },
  ];

  return (
    <div
      className="py-3 border-y border-white/[0.06] bg-white/[0.02] overflow-x-auto"
      role="status"
      aria-label="Platform live stats"
    >
      <div className="flex justify-center items-center gap-6 flex-wrap min-w-max px-6">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-6">
            {i > 0 && (
              <span
                aria-hidden="true"
                className="w-1 h-1 rounded-full flex-shrink-0"
                style={{ background: "rgba(181,83,44,0.5)" }}
              />
            )}
            <span className="font-mono text-[12px] tracking-tight whitespace-nowrap">
              <span className="text-[#B5532C] font-semibold">{item.value}</span>
              <span className="text-neutral-500 ml-1.5">{item.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
