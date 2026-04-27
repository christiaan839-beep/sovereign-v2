"use client";

/**
 * <TokenBudgetMeter> — header widget showing today's per-model
 * token budget consumption.
 *
 * Reads the most recent `_meta.tokenBudget` from a run history feed
 * (or polls /api/_misc/usage if needed). Closes OWASP LLM04 (Model
 * DoS) on the SURFACE side — customers see the cap before they hit
 * it.
 *
 * UX states:
 *   - normal   (<80%): subtle bar in neutral color
 *   - soft     (80-99%): amber bar + "approaching cap" caption
 *   - blocked  (≥100%): rose bar + "today's budget exhausted"
 */

import type { ReactNode } from "react";

export interface TokenBudgetMeta {
  pctUsed: number;
  softWarning: boolean;
  limit: number;
  model: string;
  plan: string;
}

interface TokenBudgetMeterProps {
  budget: TokenBudgetMeta | undefined;
  /** Compact horizontal pill. Otherwise renders as a full card. */
  compact?: boolean;
}

export function TokenBudgetMeter({
  budget,
  compact = false,
}: TokenBudgetMeterProps): ReactNode {
  if (!budget) return null;

  const pct = Math.min(100, Math.max(0, budget.pctUsed));
  const blocked = pct >= 100;
  const soft = pct >= 80 && pct < 100;

  const fillClass = blocked
    ? "bg-rose-500"
    : soft
      ? "bg-amber-400"
      : "bg-emerald-500/70";

  const label = blocked
    ? "today's budget exhausted"
    : soft
      ? "approaching cap"
      : "ok";

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-neutral-400">
        <span className="font-mono">{budget.model}</span>
        <div className="relative h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${fillClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={blocked ? "text-rose-300" : soft ? "text-amber-300" : ""}>
          {pct}%
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Token budget
          </div>
          <div className="mt-1 flex items-baseline gap-2 text-neutral-200">
            <span className="font-mono text-sm">{budget.model}</span>
            <span className="text-xs text-neutral-500">{budget.plan} plan</span>
          </div>
        </div>
        <div
          className={`text-2xl font-bold ${
            blocked ? "text-rose-300" : soft ? "text-amber-300" : "text-emerald-300"
          }`}
        >
          {pct}%
        </div>
      </div>

      <div className="mt-3 relative h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${fillClass} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between text-xs text-neutral-500">
        <span>{label}</span>
        <span className="font-mono">
          {budget.limit === Number.POSITIVE_INFINITY
            ? "no cap"
            : `cap: ${(budget.limit / 1000).toFixed(0)}K`}
        </span>
      </div>
    </div>
  );
}
