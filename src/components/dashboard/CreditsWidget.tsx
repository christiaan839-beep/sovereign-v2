"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Coins } from "lucide-react";

/**
 * CreditsWidget — Sidebar balance display.
 *
 * Polls /api/credits/balance every 30s. Shows the balance in dollars
 * with a copper "Top up" CTA when below $1 (lowBalance flag from the
 * API). Only renders in the expanded sidebar (parent gates on
 * sidebarExpanded state).
 *
 * Deliberately similar to UsageWidget — same bounding box, so the two
 * stack cleanly with no visual jank. Pairs: usage (runs/month) on top,
 * credits (dollars) below.
 */

interface BalanceResponse {
  balanceCents: number;
  plan: string;
  monthlyAllocationCents: number;
  lowBalance: boolean;
}

export function CreditsWidget() {
  const [data, setData] = useState<BalanceResponse | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/credits/balance");
        if (!res.ok) return;
        const body = (await res.json()) as BalanceResponse;
        if (alive) setData(body);
      } catch { /* ignore — next tick will try again */ }
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!data) return null;

  const dollars = (data.balanceCents / 100).toFixed(2);
  const allocation = (data.monthlyAllocationCents / 100).toFixed(0);

  return (
    <div className="px-3 pb-2">
      <div
        className="rounded-xl px-3 py-2.5 border transition-colors"
        style={{
          background: data.lowBalance ? "rgba(181,83,44,0.08)" : "rgba(255,255,255,0.02)",
          borderColor: data.lowBalance ? "rgba(181,83,44,0.25)" : "rgba(255,255,255,0.05)",
        }}
      >
        {/* Balance line */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
            Credits
          </span>
          <span className="flex items-center gap-1 text-xs font-mono text-white">
            <Coins className="w-3 h-3" style={{ color: "#B5532C" }} />
            ${dollars}
          </span>
        </div>

        {/* Bottom row: low-balance CTA OR monthly allocation hint */}
        {data.lowBalance ? (
          <Link
            href="/dashboard/billing?topup=true"
            className="flex items-center gap-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider transition-colors hover:text-white"
            style={{ color: "#E08558" }}
          >
            <AlertCircle className="w-3 h-3" /> Top up credits
          </Link>
        ) : data.monthlyAllocationCents > 0 ? (
          <p className="text-[10px] text-neutral-600 text-center">
            ${allocation}/mo allocation
          </p>
        ) : (
          <p className="text-[10px] text-neutral-600 text-center">pay-as-you-go</p>
        )}
      </div>
    </div>
  );
}
