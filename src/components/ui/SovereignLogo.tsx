"use client";

import Image from "next/image";

export function SovereignLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 64,
  };
  
  return (
    <div className={`relative rounded-xl overflow-hidden border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center justify-center shrink-0 animate-float`}>
      <Image 
        src="/sovereign-logo.jpg"
        alt="Sovereign Matrix"
        width={sizeMap[size]}
        height={sizeMap[size]}
        className="object-cover"
      />
    </div>
  );
}
