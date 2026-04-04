"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";

/**
 * RevealText — Text clips in from below with a mask effect.
 * Used by premium sites like Apple, Linear, and Vercel.
 */
export function RevealText({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "div" | "span";
}) {
  return (
    <div className="overflow-hidden">
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        whileInView={{ y: "0%", opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{
          duration: 0.8,
          delay,
          ease: [0.16, 1, 0.3, 1], // custom spring-like ease
        }}
      >
        <Tag className={className}>{children}</Tag>
      </motion.div>
    </div>
  );
}

/**
 * ParallaxSection — Content moves at different speed than scroll.
 * Creates depth without being distracting.
 */
export function ParallaxSection({
  children,
  className = "",
  speed = 0.15,
}: {
  children: React.ReactNode;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [speed * 100, -speed * 100]);
  const smoothY = useSpring(y, { stiffness: 100, damping: 30 });

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div style={{ y: smoothY }}>
        {children}
      </motion.div>
    </div>
  );
}

/**
 * ScaleOnScroll — Section scales up slightly as it enters viewport.
 * Subtle but creates a "breathing" feel to the page.
 */
export function ScaleOnScroll({
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
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.95, 1, 1, 0.98]);
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0.6]);

  return (
    <motion.div ref={ref} style={{ scale, opacity }} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * MagneticButton — Button subtly pulls toward cursor on hover.
 * The signature micro-interaction of premium web design.
 */
export function MagneticButton({
  children,
  className = "",
  strength = 0.3,
  href,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  href?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const smoothX = useSpring(x, { stiffness: 150, damping: 15 });
  const smoothY = useSpring(y, { stiffness: 150, damping: 15 });

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * strength);
    y.set((e.clientY - centerY) * strength);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  const content = (
    <motion.div
      ref={ref}
      style={{ x: smoothX, y: smoothY }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  );

  if (href) {
    return <a href={href} className="inline-block">{content}</a>;
  }
  if (onClick) {
    return <div onClick={onClick} className="inline-block">{content}</div>;
  }
  return content;
}

/**
 * StaggerChildren — Children animate in one by one.
 * Clean, professional, not overwhelming.
 */
export function StaggerChildren({
  children,
  className = "",
  staggerDelay = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={{
        visible: {
          transition: { staggerChildren: staggerDelay },
        },
      }}
      className={className}
    >
      {React.Children.map(children, (child) => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

/**
 * GlowDivider — Animated gradient line between sections.
 * Pulses subtly to create a living, breathing feel.
 */
export function GlowDivider() {
  return (
    <div className="relative h-px overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"
        animate={{
          x: ["-100%", "100%"],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}

/**
 * ScrollProgress — Thin progress bar at top of page.
 * Shows how far through the page the user has scrolled.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      style={{ scaleX, transformOrigin: "left" }}
      className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-cyan-400 z-[100]"
    />
  );
}

/**
 * CountUp — Number counts up when it enters viewport.
 * More polished than the current AnimatedNumber.
 */
export function CountUp({
  target,
  prefix = "",
  suffix = "",
  duration = 2,
  className = "",
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (started || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / (duration * 1000), 1);
            const eased = 1 - Math.pow(1 - progress, 4); // quartic ease-out
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration, started]);

  return (
    <span ref={ref} className={className}>
      {prefix}{count}{suffix}
    </span>
  );
}
