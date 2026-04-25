"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/**
 * KINETIC HEADLINE — single purposeful animation moment, now with a
 * subtle copper glow on the reveal phrase.
 *
 * Sequence:
 *   - Line 1 + 2 fade up together (main statement)
 *   - Line 3 (italic copper "We ship on day one") reveals 400ms later
 *     with letterspace contraction AND a text-shadow glow that fades
 *     in during the animation — the phrase looks like it's igniting
 *     as it coalesces
 *   - An animated copper underline draws in under the phrase right
 *     after, a signature visual commitment mark
 *
 * prefers-reduced-motion: final state renders immediately, no motion.
 */

export function KineticHeadline() {
  // Intentional: single render, no loop. The animation plays ONCE.
  // useReducedMotion is the canonical shared hook (useSyncExternalStore-
  // based, correct SSR snapshot, satisfies React 19 lint).
  const reduceMotion = useReducedMotion();

  return (
    <motion.h1
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="font-serif text-[52px] sm:text-[68px] md:text-[84px] lg:text-[96px] leading-[0.93] tracking-tight mb-8"
    >
      86% of AI pilots
      <br />
      never reach production.
      <br />
      <span className="relative inline-block">
        <motion.em
          initial={
            reduceMotion
              ? false
              : { opacity: 0, letterSpacing: "0.04em", y: 6, textShadow: "0 0 0px rgba(181,83,44,0)" }
          }
          animate={{
            opacity: 1,
            letterSpacing: "-0.01em",
            y: 0,
            textShadow: "0 0 60px rgba(181,83,44,0.45)",
          }}
          transition={{
            duration: 0.9,
            delay: reduceMotion ? 0 : 0.45,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="not-italic inline-block"
          style={{
            backgroundImage: "linear-gradient(135deg, #B5532C 0%, #D4703A 40%, #B5532C 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          We ship on day one.
        </motion.em>

        {/* Copper commitment underline — draws in after the phrase lands */}
        <motion.span
          aria-hidden="true"
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{
            duration: 0.7,
            delay: reduceMotion ? 0 : 1.1,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ transformOrigin: "left" }}
          className="absolute left-0 right-[8%] -bottom-2 md:-bottom-3 h-[2px] bg-[#B5532C] rounded-full"
        />
      </span>
    </motion.h1>
  );
}
