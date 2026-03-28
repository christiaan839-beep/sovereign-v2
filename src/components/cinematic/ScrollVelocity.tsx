"use client";

import { useRef } from "react";
import { motion, useScroll, useVelocity, useTransform, useSpring } from "framer-motion";

/**
 * ScrollVelocitySkew — Content subtly skews based on scroll speed.
 * Fast scrolling = slight perspective shift. Stops = settles back.
 * Creates a feeling of momentum and weight.
 */
export function ScrollVelocitySkew({
  children,
  className = "",
  intensity = 1,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);

  // Map velocity to a small skew angle (-3 to 3 degrees)
  const skewRaw = useTransform(velocity, [-2000, 0, 2000], [3 * intensity, 0, -3 * intensity]);
  const skew = useSpring(skewRaw, { stiffness: 100, damping: 30 });

  // Map velocity to subtle scale (scrolling fast = slightly compressed)
  const scaleRaw = useTransform(velocity, [-2000, 0, 2000], [0.998, 1, 0.998]);
  const scale = useSpring(scaleRaw, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      ref={ref}
      style={{
        skewY: skew,
        scale,
        transformOrigin: "center center",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * SmoothReveal — Section fades in with a clip-path wipe from bottom.
 * More cinematic than a simple opacity fade.
 */
export function ClipReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ clipPath: "inset(100% 0% 0% 0%)", opacity: 0 }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0%)", opacity: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
