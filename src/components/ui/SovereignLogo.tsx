"use client";

import Image from "next/image";

interface SovereignLogoProps {
  /** Tailwind class overrides applied to the wrapper. When set,
   * replaces the default emerald glow + rounded border so callers
   * who want a small inline logo (h-7 w-7) get exactly that. */
  className?: string;
  /** Preset wrapper size used when `className` does not specify
   * explicit h-* / w-* utilities. */
  size?: "sm" | "md" | "lg";
}

const SIZE_PX: Record<NonNullable<SovereignLogoProps["size"]>, number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

export function SovereignLogo({ size = "md", className }: SovereignLogoProps) {
  const px = SIZE_PX[size];
  const wrapperClass =
    className ??
    "relative rounded-xl overflow-hidden border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center justify-center shrink-0 animate-float";
  return (
    <div className={wrapperClass}>
      <Image
        src="/sovereign-logo.jpg"
        alt="Sovereign Matrix"
        width={px}
        height={px}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
