"use client";

import { useState, useEffect } from "react";
import { Zap } from "lucide-react";

interface UsageData {
  today: {
    used: number;
    limit: number | string;
    remaining: number | string;
    percentUsed: number;
  };
  totalAllTime: number;
}

/**
 * UsageBar — Displays current AI generation usage in the dashboard sidebar.
 * Fetches from /api/usage/track and shows a visual progress bar.
 */
export function UsageBar({ userId, plan = "node" }: { userId?: string; plan?: string }) {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchUsage = async () => {
      try {
        const res = await fetch(`/api/usage/track?userId=${userId}&plan=${plan}`);
        if (res.ok) setUsage(await res.json());
      } catch { /* silent fail */ }
    };
    fetchUsage();
    // Refresh every 60s
    const interval = setInterval(fetchUsage, 60000);
    return () => clearInterval(interval);
  }, [userId, plan]);

  if (!usage) return null;

  const isUnlimited = usage.today.limit === "unlimited";
  const percent = isUnlimited ? 0 : usage.today.percentUsed;
  const barColor = percent > 80 ? "bg-red-500" : percent > 50 ? "bg-yellow-500" : "bg-emerald-500";

  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Usage Today</span>
        </div>
        <span className="text-[10px] font-mono text-neutral-500">
          {usage.today.used}/{isUnlimited ? "∞" : usage.today.limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-gpu duration-500`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="text-[10px] text-emerald-400 font-mono">Unlimited generations</div>
      )}
    </div>
  );
}
