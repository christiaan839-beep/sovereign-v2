"use client";

import { useEffect, useState, useCallback } from "react";
import { useReceiptPulse } from "@/lib/use-receipt-pulse";

interface StripStats {
  agents: number;
  models: number;
  industries: number;
  uptime: string;
  savedUsd: number | null;
}

const STATIC_FALLBACK: StripStats = {
  agents: 137,
  models: 39,
  industries: 14,
  uptime: "99.9%",
  savedUsd: null,
};

interface ExtendedMetricsResponse {
  costSavings?: {
    savedUsd?: number;
    savedPct?: number;
  };
}

/**
 * LiveProofStrip — Thin horizontal strip with live platform stats.
 *
 * Fetches from /api/agents/dashboard-stats (counts) + /api/status/metrics/extended
 * (live cost-saved-vs-Claude-Sonnet baseline, wave-116 M8). Falls back
 * silently to static numbers when either endpoint is unavailable.
 *
 * JetBrains Mono, copper values, copper separator dots. Cost-savings
 * cell only renders when the M8 endpoint returns a non-zero number —
 * a fresh deploy with zero runs doesn't display a fake "$0 saved" stat.
 */
function fmtUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(3)}`;
  if (n < 1) return `$${n.toFixed(2)}`;
  if (n < 1000) return `$${n.toFixed(2)}`;
  if (n < 1_000_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${(n / 1_000_000).toFixed(2)}m`;
}

export function LiveProofStrip() {
  const [stats, setStats] = useState<StripStats>(STATIC_FALLBACK);
  // Wave 123 — auto-refresh when a new receipt lands at the feed head.
  // Cheap freshness: the strip already pays the cost of two HTTP fetches
  // on mount; re-running them on the same cadence as the receipt fabric
  // surfaces live cost-savings deltas without operator intervention.
  const { pulseToken: receiptPulse } = useReceiptPulse({ intervalMs: 30_000 });

  const refresh = useCallback(async () => {
    const [dash, metrics] = await Promise.all([
      fetch("/api/agents/dashboard-stats", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/status/metrics/extended?window=30d", { cache: "no-store" })
        .then((r) => r.json() as Promise<ExtendedMetricsResponse>)
        .catch(() => null),
    ]);
    const dashOk = dash && typeof dash.agentCount === "number";
    const savedRaw = metrics?.costSavings?.savedUsd;
    const savedUsd =
      typeof savedRaw === "number" && Number.isFinite(savedRaw) && savedRaw > 0
        ? savedRaw
        : null;
    setStats((prev) => ({
      agents: dashOk
        ? (dash.agentCount ?? STATIC_FALLBACK.agents)
        : prev.agents,
      models: dashOk
        ? (dash.modelCount ?? STATIC_FALLBACK.models)
        : prev.models,
      industries: dashOk
        ? (dash.industries ?? STATIC_FALLBACK.industries)
        : prev.industries,
      uptime: dashOk ? (dash.uptime ?? STATIC_FALLBACK.uptime) : prev.uptime,
      savedUsd,
    }));
  }, []);

  // Initial mount fetch
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-fetch on receipt pulse — receiptPulse counter increments every
  // time a new receipt lands at the head of the public feed (wave 122).
  useEffect(() => {
    if (receiptPulse > 0) void refresh();
  }, [receiptPulse, refresh]);

  type Item = { value: string; label: string; title?: string };
  const items: Item[] = [
    { value: stats.agents.toString(), label: "agents live" },
    { value: stats.models.toString(), label: "models" },
    { value: stats.industries.toString(), label: "industries" },
    { value: stats.uptime, label: "uptime" },
  ];
  if (stats.savedUsd !== null) {
    items.push({
      value: fmtUsd(stats.savedUsd),
      label: "saved · 30d",
      title:
        "Cost saved vs an all-Claude-Sonnet baseline over the last 30 days. Live from /api/status/metrics/extended (M8).",
    });
  }

  return (
    <div
      className="py-3 border-y border-white/[0.06] bg-white/[0.02] overflow-x-auto"
      role="group"
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
            <span
              className="font-mono text-[12px] tracking-tight whitespace-nowrap"
              title={item.title}
            >
              <span className="text-[#B5532C] font-semibold">{item.value}</span>
              <span className="text-neutral-500 ml-1.5">{item.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
