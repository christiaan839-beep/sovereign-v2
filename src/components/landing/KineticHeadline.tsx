"use client";

import { motion } from "framer-motion";

/**
 * KINETIC HEADLINE — one purposeful animation moment.
 *
 * Studying anthropic.com's hero: headline has exactly ONE kinetic
 * moment — the italic serif phrase reveals AFTER the main line with
 * slight letterspace contraction. Not scrolljacking, not continuous.
 * One intentional gesture that says "typography matters here."
 *
 * We apply the same pattern:
 *   - Line 1 + 2 fade up together (main statement)
 *   - Line 3 (italic copper "We ship on day one") reveals 400ms later
 *     with letterspace contraction: from `tracking-wider` to tight
 *     — like the phrase is coalescing into a commitment
 *
 * prefers-reduced-motion: the final state renders immediately, no
 * transitions.
 */

export function KineticHeadline() {
  // Intentional: single render, no loop. The animation plays ONCE.
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <motion.h1
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-[84px] leading-[0.95] tracking-tight mb-8"
    >
      86% of AI pilots
      <br />
      never reach production.
      <br />
      <motion.em
        initial={reduceMotion ? false : { opacity: 0, letterSpacing: "0.04em", y: 6 }}
        animate={{ opacity: 1, letterSpacing: "-0.01em", y: 0 }}
        transition={{
          duration: 0.9,
          delay: reduceMotion ? 0 : 0.45,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="not-italic inline-block text-[#B5532C]"
      >
        We ship on day one.
      </motion.em>
    </motion.h1>
  );
}
