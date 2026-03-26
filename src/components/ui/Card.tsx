"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

type CardVariant = "default" | "glossy" | "highlighted";

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  className?: string;
  onClick?: () => void;
  animate?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: "bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] hover:border-white/[0.12]",
  glossy: "bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] hover:border-white/[0.15] shadow-lg shadow-black/20",
  highlighted: "bg-white/[0.03] backdrop-blur-xl border border-[#00B7FF]/20 hover:border-[#00B7FF]/40 shadow-[0_0_20px_rgba(0,183,255,0.05)]",
};

export function Card({ children, variant = "default", className = "", onClick, animate = false }: CardProps) {
  const baseClasses = `rounded-2xl p-5 transition-gpu duration-300 ${variantStyles[variant]} ${onClick ? "cursor-pointer hover:scale-[1.01]" : ""} ${className}`;

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={baseClasses}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={baseClasses} onClick={onClick}>
      {children}
    </div>
  );
}
