"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

/**
 * ScrollRevealHero — Scroll-driven parallax effects for the hero section.
 *
 * As the user scrolls down, hero elements respond:
 * - Background opacity increases (darker depth)
 * - Floating orbs drift with parallax
 * - Grid perspective shifts
 * - Emerald glow intensifies then fades
 *
 * Beats Antigravity's scroll-jacking with real scroll physics.
 * No scroll hijacking — just responds to natural scroll position.
 */

export function HeroParallaxLayer({
  children,
  speed = 0.5,
  className = "",
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 300]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.8, 0]);

  return (
    <motion.div ref={ref} style={{ y, opacity }} className={className}>
      {children}
    </motion.div>
  );
}

export function ScrollFadeSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    [0.95, 1, 1, 0.95],
  );

  return (
    <motion.div ref={ref} style={{ opacity, scale }} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Floating orbs that drift with scroll — creates depth.
 * Similar to Antigravity's floating elements but with emerald theme.
 */
export function FloatingOrbs() {
  const { scrollY } = useScroll();
  const isMobile = useIsMobile();

  // Hooks must be called at the top level — pre-compute one transform per
  // orb instead of calling useTransform inside the map() callback. The
  // orb count is fixed at 5 below so the hook order stays stable.
  const y0 = useTransform(scrollY, [0, 2000], [0, 0.3 * -400]);
  const y1 = useTransform(scrollY, [0, 2000], [0, 0.5 * -400]);
  const y2 = useTransform(scrollY, [0, 2000], [0, 0.2 * -400]);
  const y3 = useTransform(scrollY, [0, 2000], [0, 0.4 * -400]);
  const y4 = useTransform(scrollY, [0, 2000], [0, 0.35 * -400]);

  if (isMobile) return null;

  const orbs = [
    { size: 300, color: "emerald", x: "10%", y: "20%", yMv: y0 },
    { size: 200, color: "cyan", x: "70%", y: "40%", yMv: y1 },
    { size: 150, color: "violet", x: "30%", y: "60%", yMv: y2 },
    { size: 250, color: "emerald", x: "80%", y: "10%", yMv: y3 },
    { size: 180, color: "amber", x: "50%", y: "70%", yMv: y4 },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: `radial-gradient(circle, rgba(${
              orb.color === "emerald"
                ? "16,185,129"
                : orb.color === "cyan"
                  ? "6,182,212"
                  : orb.color === "violet"
                    ? "139,92,246"
                    : "245,158,11"
            },0.04) 0%, transparent 70%)`,
            filter: "blur(80px)",
            y: orb.yMv,
          }}
        />
      ))}
    </div>
  );
}
