"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * GlowCard — Mouse-tracking gradient glow border effect.
 * The glow follows the cursor position on the card, creating
 * a spotlight effect on the border. Used on pricing, feature,
 * and comparison cards for elite-tier interactivity.
 *
 * Inspired by: Linear.app, Stripe, Vercel dashboard cards.
 */

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string; // e.g., "16,185,129" (emerald RGB)
  glowIntensity?: number; // 0-1
}

export function GlowCard({
  children,
  className = "",
  glowColor = "16,185,129",
  glowIntensity = 0.15,
}: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden ${className}`}
      style={{
        background: isHovered
          ? `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(${glowColor},${glowIntensity}), transparent 40%)`
          : undefined,
      }}
    >
      {/* Border glow */}
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(${glowColor},0.15), transparent 40%)`,
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
            WebkitMaskComposite: "xor",
            padding: "1px",
          }}
        />
      )}
      {children}
    </motion.div>
  );
}
