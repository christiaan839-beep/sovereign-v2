"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

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

export function HeroParallaxLayer({ children, speed = 0.5, className = "" }: {
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
    <motion.div
      ref={ref}
      style={{ y, opacity }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScrollFadeSection({ children, className = "" }: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.95, 1, 1, 0.95]);

  return (
    <motion.div
      ref={ref}
      style={{ opacity, scale }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Floating orbs that drift with scroll — creates depth.
 * Similar to Antigravity's floating elements but with emerald theme.
 */
// Fixed orb config — declared at module scope so useTransform hooks are called
// the same number of times on every render (React rules of hooks).
const ORBS = [
  { size: 300, color: "emerald", x: "10%", y: "20%", speed: 0.3 },
  { size: 200, color: "cyan", x: "70%", y: "40%", speed: 0.5 },
  { size: 150, color: "violet", x: "30%", y: "60%", speed: 0.2 },
  { size: 250, color: "emerald", x: "80%", y: "10%", speed: 0.4 },
  { size: 180, color: "amber", x: "50%", y: "70%", speed: 0.35 },
] as const;

function FloatingOrb({ orb, scrollY }: { orb: typeof ORBS[number]; scrollY: ReturnType<typeof useScroll>["scrollY"] }) {
  const y = useTransform(scrollY, [0, 2000], [0, orb.speed * -400]);
  const rgb =
    orb.color === "emerald" ? "16,185,129" :
    orb.color === "cyan" ? "6,182,212" :
    orb.color === "violet" ? "139,92,246" :
    "245,158,11";
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: orb.size,
        height: orb.size,
        left: orb.x,
        top: orb.y,
        background: `radial-gradient(circle, rgba(${rgb},0.04) 0%, transparent 70%)`,
        filter: "blur(80px)",
        y,
      }}
    />
  );
}

export function FloatingOrbs() {
  const { scrollY } = useScroll();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // IMPORTANT: render at same hook-count on every pass. We don't call any
  // additional hooks conditionally here — each child FloatingOrb owns its
  // own useTransform. Hide via CSS on mobile instead of returning early.
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{ display: isMobile ? "none" : "block" }}
    >
      {ORBS.map((orb, i) => (
        <FloatingOrb key={i} orb={orb} scrollY={scrollY} />
      ))}
    </div>
  );
}
