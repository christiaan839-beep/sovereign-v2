"use client";

/**
 * Badge — Reusable pill/badge component.
 * Eliminates 78+ duplicate className patterns across the codebase.
 */

type BadgeColor = "emerald" | "cyan" | "violet" | "amber" | "red" | "neutral";
type BadgeSize = "xs" | "sm" | "md";

const COLORS: Record<BadgeColor, string> = {
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
  violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  red: "bg-red-500/10 border-red-500/20 text-red-400",
  neutral: "bg-white/[0.04] border-white/[0.06] text-neutral-400",
};

const SIZES: Record<BadgeSize, string> = {
  xs: "text-[8px] px-2 py-0.5",
  sm: "text-[10px] px-2.5 py-0.5",
  md: "text-[11px] px-3 py-1",
};

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  size?: BadgeSize;
  icon?: React.ReactNode;
  className?: string;
}

export function Badge({ children, color = "emerald", size = "sm", icon, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-widest ${COLORS[color]} ${SIZES[size]} ${className}`}>
      {icon}{children}
    </span>
  );
}
