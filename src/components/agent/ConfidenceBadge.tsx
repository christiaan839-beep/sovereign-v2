/**
 * <ConfidenceBadge> — renders the agent-confidence score from the
 * response envelope's _meta.confidence field.
 *
 * Customers see a 0..1 score + a recommended action band:
 *   high     ≥0.85  emerald  "trust outright"
 *   moderate ≥0.65  amber    "spot-check details"
 *   review   ≥0.45  orange   "human review"
 *   draft    <0.45  rose     "treat as draft"
 *
 * Closes OWASP LLM09 (Overreliance) on the SURFACE side. The
 * computation is in src/lib/agent-confidence.ts; this component
 * just renders it. Rendering it inline next to the agent answer is
 * what turns "we computed a score" into "users see it before they
 * trust the answer".
 */

import type { ReactNode } from "react";

export interface ConfidenceMeta {
  score: number;
  band: "high" | "moderate" | "review" | "draft";
  recommendedAction: string;
}

const BAND_STYLES: Record<ConfidenceMeta["band"], { bg: string; text: string; ring: string; emoji: string }> = {
  high:     { bg: "bg-emerald-500/10",  text: "text-emerald-300", ring: "ring-emerald-500/30",  emoji: "●" },
  moderate: { bg: "bg-amber-500/10",    text: "text-amber-200",   ring: "ring-amber-500/30",    emoji: "●" },
  review:   { bg: "bg-orange-500/10",   text: "text-orange-300",  ring: "ring-orange-500/30",   emoji: "●" },
  draft:    { bg: "bg-rose-500/10",     text: "text-rose-300",    ring: "ring-rose-500/30",     emoji: "●" },
};

const BAND_LABEL: Record<ConfidenceMeta["band"], string> = {
  high: "high confidence",
  moderate: "moderate",
  review: "review",
  draft: "draft only",
};

interface ConfidenceBadgeProps {
  confidence: ConfidenceMeta | undefined;
  /** Show the recommended-action sentence below the badge. */
  showAction?: boolean;
  /** Compact pill mode (just emoji + percent + band). */
  compact?: boolean;
}

export function ConfidenceBadge({
  confidence,
  showAction = false,
  compact = false,
}: ConfidenceBadgeProps): ReactNode {
  if (!confidence) return null;
  const style = BAND_STYLES[confidence.band];
  const pct = Math.round(confidence.score * 100);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] ring-1 ${style.bg} ${style.text} ${style.ring}`}
        title={confidence.recommendedAction}
      >
        <span aria-hidden>{style.emoji}</span>
        {pct}% · {BAND_LABEL[confidence.band]}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex flex-col gap-1 rounded-md border px-3 py-2 ${style.bg} ${style.ring}`}
    >
      <div className={`flex items-baseline gap-2 ${style.text}`}>
        <span className="text-xs uppercase tracking-wide opacity-80">
          confidence
        </span>
        <span className="text-lg font-semibold">{pct}%</span>
        <span className="text-[10px] uppercase tracking-wider opacity-70">
          {BAND_LABEL[confidence.band]}
        </span>
      </div>
      {showAction && (
        <p className="text-xs text-neutral-400 max-w-md">
          {confidence.recommendedAction}
        </p>
      )}
    </div>
  );
}
