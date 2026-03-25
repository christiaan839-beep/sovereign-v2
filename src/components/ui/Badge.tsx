"use client";

import { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "accent" | "muted";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-white/[0.05] text-neutral-400 border border-white/[0.06]",
  success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  error: "bg-red-500/10 text-red-400 border border-red-500/20",
  accent: "bg-[#00B7FF]/10 text-[#00B7FF] border border-[#00B7FF]/20",
  muted: "bg-neutral-800/50 text-neutral-500 border border-white/[0.04]",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-neutral-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  accent: "bg-[#00B7FF]",
  muted: "bg-neutral-600",
};

export function Badge({ children, variant = "default", className = "", dot }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${variantStyles[variant]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
