"use client";

import { motion } from "framer-motion";

/**
 * InfiniteMarquee — Auto-scrolling horizontal strip.
 * Uses CSS animation for smooth 60fps infinite scroll.
 * Duplicates children to create seamless loop.
 */

interface InfiniteMarqueeProps {
  children: React.ReactNode;
  speed?: number; // seconds per full cycle
  direction?: "left" | "right";
  pauseOnHover?: boolean;
  className?: string;
}

export function InfiniteMarquee({
  children,
  speed = 30,
  direction = "left",
  pauseOnHover = true,
  className = "",
}: InfiniteMarqueeProps) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        className={`flex gap-8 w-max ${pauseOnHover ? "hover:[animation-play-state:paused]" : ""}`}
        style={{
          animation: `marquee-scroll ${speed}s linear infinite ${direction === "right" ? "reverse" : ""}`,
        }}
      >
        {/* Render twice for seamless loop */}
        <div className="flex gap-8 shrink-0">{children}</div>
        <div className="flex gap-8 shrink-0" aria-hidden="true">{children}</div>
      </motion.div>

      <style jsx>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

/**
 * LogoMarquee — Pre-styled trust strip with tech partner logos (text-only).
 */
export function LogoMarquee() {
  const logos = [
    { name: "NVIDIA NIM", highlight: true },
    { name: "Google Gemini", highlight: false },
    { name: "Anthropic Claude", highlight: false },
    { name: "Meta Llama", highlight: false },
    { name: "DeepSeek", highlight: false },
    { name: "Mistral AI", highlight: false },
    { name: "NeMo Guardrails", highlight: true },
    { name: "Ollama", highlight: false },
    { name: "Qwen 3", highlight: false },
    { name: "FLUX.1", highlight: false },
    { name: "Vercel", highlight: false },
    { name: "Neon Postgres", highlight: false },
  ];

  return (
    <InfiniteMarquee speed={40} className="py-6 border-y border-white/[0.04]">
      {logos.map((logo) => (
        <span
          key={logo.name}
          className={`text-sm font-medium tracking-wide whitespace-nowrap transition-colors ${
            logo.highlight
              ? "text-emerald-500/50 hover:text-emerald-400"
              : "text-neutral-600 hover:text-neutral-400"
          }`}
        >
          {logo.name}
        </span>
      ))}
    </InfiniteMarquee>
  );
}
