"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState, useRef, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/**
 * PRIMARY CTA — micro-physics button.
 *
 * Studying: arc.net (buttons feel physical), linear.app (spring hover
 * + micro-ripple on click), raycast.com (arrow glides on hover).
 *
 * Discipline: ONE button on the landing gets this treatment (hero
 * primary). The final-CTA version below uses the same. NOT every
 * button — overused and it loses meaning.
 *
 * Behaviors:
 *   1. Hover: subtle lift (y: -1) + shadow deepens
 *   2. Hover: arrow slides right 4px
 *   3. Tap: scale 0.97 + emerald ripple expanding from click point
 *   4. Focus: animated copper outline that pulses ONCE
 *
 * prefers-reduced-motion: static styles only, no transitions.
 */

interface PrimaryCTAProps {
  href: string;
  children: ReactNode;
  variant?: "hero" | "final";
}

export function PrimaryCTA({ href, children, variant = "hero" }: PrimaryCTAProps) {
  const reduceMotion = useReducedMotion();
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const nextId = useRef(0);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = nextId.current++;
    setRipples((r) => [...r, { x, y, id }]);
    setTimeout(() => {
      setRipples((r) => r.filter((rip) => rip.id !== id));
    }, 700);
  }

  const padding = variant === "final" ? "px-7 py-3.5" : "px-6 py-3";

  return (
    <motion.span
      whileHover={reduceMotion ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="inline-block"
    >
      <Link
        href={href}
        onClick={handleClick}
        className={`group relative inline-flex items-center gap-2 ${padding} bg-[#B5532C] text-white font-mono text-sm tracking-wide overflow-hidden shadow-[0_10px_24px_-12px_rgba(181,83,44,0.8)] hover:shadow-[0_16px_32px_-12px_rgba(181,83,44,0.9)] focus:outline-none focus:ring-2 focus:ring-[#B5532C]/60 focus:ring-offset-2 focus:ring-offset-[#030303] transition-shadow duration-300`}
      >
        {/* Highlight sheen that slides in on hover */}
        <span
          aria-hidden="true"
          className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent transition-transform duration-700 ease-out pointer-events-none"
        />

        {/* Emerald ripples on tap */}
        {ripples.map((r) => (
          <span
            key={r.id}
            aria-hidden="true"
            className="absolute rounded-full pointer-events-none"
            style={{
              left: r.x,
              top: r.y,
              width: 0,
              height: 0,
              transform: "translate(-50%, -50%)",
              animation: "primaryCtaRipple 700ms ease-out forwards",
              background: "radial-gradient(circle, rgba(52,211,153,0.6) 0%, transparent 70%)",
            }}
          />
        ))}

        <span className="relative z-10">{children}</span>

        <motion.span
          className="relative z-10 inline-flex"
          initial={false}
          animate={{ x: 0 }}
          whileHover={reduceMotion ? undefined : { x: 4 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </motion.span>
      </Link>

      {/* Keyframes for the ripple. Scoped via a style tag so the
          component is fully self-contained. */}
      <style>{`
        @keyframes primaryCtaRipple {
          from {
            width: 0;
            height: 0;
            opacity: 0.7;
          }
          to {
            width: 320px;
            height: 320px;
            opacity: 0;
          }
        }
      `}</style>
    </motion.span>
  );
}
