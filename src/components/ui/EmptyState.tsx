"use client";

import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

/**
 * EmptyState — the component you drop into any data-fetching page
 * when the result set is empty. Replaces the ad-hoc "No items found"
 * strings that littered the codebase.
 *
 * Design philosophy:
 *   - An empty state is a missed conversion. Always offer a next step.
 *   - Icon + headline + description + primary CTA (+ optional secondary).
 *   - Fade-in animation so it doesn't flash during load.
 *   - The copy tone matches the rest of the editorial design system —
 *     concrete, specific, no generic filler.
 *
 * When to use:
 *   - First-time users: "No leads yet. Here's how to get your first one."
 *   - Filter returns nothing: "No results for 'X'. Try broadening."
 *   - Error fallback: "Couldn't load. Retry?" (prefer to error boundary)
 *
 * When NOT to use:
 *   - Actual error states with a stack trace (use an error boundary)
 *   - Loading states (use Skeleton)
 *   - Permission denied (use a dedicated 403 component)
 */

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

export interface EmptyStateProps {
  /** Lucide icon rendered at the top. Keeps visual consistency. */
  icon?: LucideIcon;
  /** Short, specific headline. "No leads yet" > "No data" */
  title: string;
  /** 1-2 sentence body — tells the user WHY this is empty + WHAT to do. */
  description?: string | ReactNode;
  /** Primary + optional secondary actions. */
  actions?: EmptyStateAction[];
  /** Render inside a bordered container (true) or bare (false). Default true. */
  framed?: boolean;
  /** Extra classes for the root. */
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions = [],
  framed = true,
  className = "",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      role="status"
      aria-live="polite"
      className={
        framed
          ? `rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center ${className}`
          : `px-6 py-16 text-center ${className}`
      }
    >
      {Icon && (
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <Icon className="h-5 w-5 text-neutral-500" aria-hidden="true" />
        </div>
      )}

      <h3 className="text-base font-semibold text-white">{title}</h3>

      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500 leading-relaxed">
          {description}
        </p>
      )}

      {actions.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {actions.map((action, idx) => {
            const styles =
              action.variant === "secondary"
                ? "bg-white/[0.04] text-neutral-300 border-white/[0.08] hover:bg-white/[0.08]"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20";

            const classes = `inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-xs font-semibold transition-colors ${styles}`;

            if (action.href) {
              return (
                <Link key={idx} href={action.href} className={classes}>
                  {action.label}
                </Link>
              );
            }
            return (
              <button key={idx} type="button" onClick={action.onClick} className={classes}>
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Pre-built presets — consistent copy across the app for common states.
 * Add new ones as patterns emerge, don't inline them.
 */

export function NoLeadsEmpty() {
  return (
    <EmptyState
      title="No leads yet"
      description={
        <>
          Run the Lead Blitz playbook or the <code className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-mono">leads</code> agent to surface your first qualified prospects.
        </>
      }
      actions={[
        { label: "Run Lead Blitz", href: "/dashboard/playbooks?auto=lead-blitz" },
        { label: "Read the guide", href: "/docs/use-cases/lead-gen", variant: "secondary" },
      ]}
    />
  );
}

export function NoRunsEmpty() {
  return (
    <EmptyState
      title="No agent runs yet"
      description="Trigger any agent from the dashboard, or wire up a webhook. Every run is logged here with its input, output, and duration."
      actions={[
        { label: "Browse agents", href: "/dashboard/agents" },
        { label: "Read the API docs", href: "/developers/docs", variant: "secondary" },
      ]}
    />
  );
}

export function NoSearchResultsEmpty({ query, onClear }: { query: string; onClear?: () => void }) {
  return (
    <EmptyState
      title={`No results for "${query}"`}
      description="Try broadening your filters or check for typos. If you expected data here, email support@sovereignmatrix.agency and we'll investigate."
      actions={
        onClear
          ? [{ label: "Clear search", onClick: onClear, variant: "secondary" }]
          : []
      }
    />
  );
}

export function FailedToLoadEmpty({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      title="Couldn't load this"
      description="Something broke on our side. Refresh, or if it keeps happening, tell us at support@sovereignmatrix.agency with the page URL."
      actions={
        onRetry
          ? [{ label: "Retry", onClick: onRetry }]
          : [{ label: "Reload page", onClick: () => location.reload() }]
      }
    />
  );
}
