"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AgentSigil } from "@/components/agent/AgentSigil";

/**
 * LeaderboardTable — sortable table for /leaderboard.
 *
 * Stateless: parent owns sort + window + entries. Renders rank medals
 * for top 3, numeric badges for 4-10, bare number for 11+. Each row
 * navigates to /agents/[slug] — rows are <Link>s, not <div onClick>,
 * so keyboard + middle-click behave correctly.
 *
 * Column "primary metric" is driven by the sort prop: the metric being
 * ranked is shown bigger and first, others are secondary info.
 */

export type Sort = "success" | "cost" | "speed" | "earnings";

export interface LeaderboardEntry {
  slug: string;
  displayName: string;
  category: string;
  verified: boolean;
  creatorHandle: string | null;
  runs: number;
  successRate: number;
  avgDurationMs: number | null;
  totalCostCents: number;
  costPerRun: number;
}

interface Props {
  entries: LeaderboardEntry[];
  sort: Sort;
  loading?: boolean;
}

const MEDALS: Record<number, string> = { 0: "◆", 1: "◇", 2: "◈" };

export function LeaderboardTable({ entries, sort, loading = false }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-[4px] border border-white/[0.06] bg-white/[0.015] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="font-mono text-[12px] text-neutral-600">
          No entries yet for this window. Check back after the nightly rollup.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.04] border border-white/[0.06] rounded-[6px] overflow-hidden bg-white/[0.015]">
      {entries.map((entry, i) => (
        <motion.div
          key={entry.slug}
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.4 }}
        >
          <Link
            href={`/agents/${entry.slug}`}
            className="group flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors"
          >
            {/* Rank */}
            <span
              className={`flex-shrink-0 w-8 text-center font-mono text-[13px] tabular-nums ${
                i < 3 ? "text-[#B5532C]" : "text-neutral-600"
              }`}
              aria-label={`Rank ${i + 1}`}
            >
              {i < 3 ? MEDALS[i] : i + 1}
            </span>

            {/* Agent sigil — category-palette visual identity at a glance.
             *  Makes the leaderboard scannable by industry: you can see
             *  "oh, the top 3 are all Insurance" from the palette alone. */}
            <span className="shrink-0 rounded-[4px] overflow-hidden">
              <AgentSigil
                slug={entry.slug}
                category={entry.category}
                size={36}
                detail="minimal"
              />
            </span>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-[15px] text-white group-hover:text-[#E8DDD0] transition-colors truncate">
                  {entry.displayName}
                </span>
                {entry.verified && (
                  <span
                    className="text-[#B5532C] text-[10px]"
                    aria-label="Verified"
                    title="Verified"
                  >
                    ◆
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-neutral-600 tracking-tight capitalize">
                {entry.category}
                {entry.creatorHandle && (
                  <> · by <span className="text-neutral-500">{entry.creatorHandle}</span></>
                )}
              </p>
            </div>

            {/* Primary metric (depends on sort) */}
            <div className="hidden sm:flex flex-col items-end min-w-[80px]">
              <span className="font-mono text-[14px] text-white tabular-nums">
                {formatPrimary(entry, sort)}
              </span>
              <span className="text-[9px] font-mono text-neutral-600 tracking-[0.15em] uppercase">
                {primaryLabel(sort)}
              </span>
            </div>

            {/* Secondary metric */}
            <div className="hidden md:flex flex-col items-end min-w-[70px]">
              <span className="font-mono text-[12px] text-neutral-400 tabular-nums">
                {formatRuns(entry.runs)}
              </span>
              <span className="text-[9px] font-mono text-neutral-700 tracking-[0.15em] uppercase">
                Runs
              </span>
            </div>

            <span
              aria-hidden="true"
              className="text-neutral-700 group-hover:text-[#B5532C] transition-colors font-mono text-[12px]"
            >
              →
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function formatPrimary(e: LeaderboardEntry, sort: Sort): string {
  switch (sort) {
    case "success":
      return `${Math.round(e.successRate * 100)}%`;
    case "cost":
      return e.costPerRun > 0 ? `$${(e.costPerRun / 100).toFixed(3)}` : "—";
    case "speed":
      return e.avgDurationMs != null ? formatDuration(e.avgDurationMs) : "—";
    case "earnings":
      return `$${(e.totalCostCents / 100).toFixed(2)}`;
  }
}

function primaryLabel(sort: Sort): string {
  switch (sort) {
    case "success": return "Success";
    case "cost": return "Cost/Run";
    case "speed": return "Avg Time";
    case "earnings": return "Earned";
  }
}

function formatRuns(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}
