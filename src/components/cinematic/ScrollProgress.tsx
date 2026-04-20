"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/**
 * Scroll progress bar at the very top of the viewport.
 *
 * Editorial-copper palette matches the landing page. A single 1px
 * line is the move — Stripe, Anthropic, Notion all use the same
 * understated indicator. Prior version used emerald→teal which read
 * as generic "SaaS marketing" and clashed with the bone-cream +
 * copper accent system the rest of the site uses.
 *
 * Spring-damped so the fill doesn't twitch on fast scrolls.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[1.5px] bg-[#B5532C] z-[9999] origin-left"
      style={{ scaleX, opacity: 0.85 }}
      aria-hidden="true"
    />
  );
}
