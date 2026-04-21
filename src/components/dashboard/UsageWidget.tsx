"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * UsageWidget — Sidebar run counter with copper upgrade nudge.
 *
 * Shows: "37 / 50 runs · this month"  with a progress bar.
 * At 80%: progress bar turns amber to signal limit is near.
 * At 100%: turns copper with an "Upgrade" CTA.
 *
 * Only renders in the expanded sidebar (parent passes sidebarExpanded).
 * Polls /api/usage once on mount; intentionally lightweight.
 */

interface UsageData {
  plan: { name: string; runLimit: number };
  usage: { executions: { last30d: number } };
}

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  array: "Growth",
  node: "Node",
  enterprise: "Enterprise",
  founder: "Founder",
};

export function UsageWidget() {
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.plan) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const used = data.usage.executions.last30d;
  const limit = data.plan.runLimit;
  const planName = PLAN_NAMES[data.plan.name] ?? data.plan.name;
  const isUnlimited = limit >= 10_000;

  if (isUnlimited) return null; // Enterprise/Founder — no meter needed

  const pct = Math.min(100, Math.round((used / limit) * 100));
  const isNear = pct >= 80 && pct < 100;
  const isFull = pct >= 100;

  const barColor = isFull
    ? "rgba(181,83,44,0.9)"
    : isNear
    ? "rgba(217,119,6,0.75)"
    : "rgba(255,255,255,0.18)";

  return (
    <div className="px-3 pb-2">
      <div
        className="rounded-xl px-3 py-2.5"
        style={{
          background: isFull ? "rgba(181,83,44,0.08)" : "rgba(255,255,255,0.02)",
          border: isFull
            ? "1px solid rgba(181,83,44,0.25)"
            : "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Run counter */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-neutral-500 font-mono">
            {used.toLocaleString()} / {limit.toLocaleString()} runs
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-wider"
            style={{ color: isFull ? "#B5532C" : isNear ? "#D97706" : "#525252" }}
          >
            {planName}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden bg-white/[0.06] mb-2">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>

        {/* Upgrade CTA — only when at/near limit */}
        {isFull ? (
          <Link
            href="/pricing"
            className="flex items-center justify-center w-full py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{
              background: "linear-gradient(135deg, #B5532C 0%, #E08558 100%)",
              color: "#fff",
            }}
          >
            Upgrade plan →
          </Link>
        ) : isNear ? (
          <Link
            href="/pricing"
            className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors block text-center"
          >
            {limit - used} runs left · upgrade
          </Link>
        ) : (
          <p className="text-[10px] text-neutral-600 text-center">
            resets monthly
          </p>
        )}
      </div>
    </div>
  );
}
