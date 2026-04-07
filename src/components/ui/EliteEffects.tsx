"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/* ── Shared: detect mobile + reduced motion ── */

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768 || "ontouchstart" in window);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/**
 * FloatingParticles — Canvas-based particle system for hero sections.
 * Particles drift with zero-gravity physics and react to mouse position.
 * Auto-disables on mobile and when user prefers reduced motion.
 */
export function FloatingParticles({
  count = 40,
  color = "rgba(16, 185, 129, 0.3)",
  maxSize = 3,
  className = "",
}: {
  count?: number;
  color?: string;
  maxSize?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    size: number; opacity: number; drift: number;
  }>>([]);
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Skip on mobile or reduced motion
    if (isMobile || reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      // Reset transform before scaling (fixes cumulative scale bug)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize particles
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * maxSize + 0.5,
      opacity: Math.random() * 0.5 + 0.2,
      drift: Math.random() * Math.PI * 2,
    }));

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -999, y: -999 };
    };
    canvas.addEventListener("mousemove", handleMouse);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    let frame: number;
    const animate = () => {
      const cw = canvas.offsetWidth;
      const ch = canvas.offsetHeight;
      ctx.clearRect(0, 0, cw, ch);

      const particles = particlesRef.current;
      for (const p of particles) {
        // Zero-gravity drift
        p.drift += 0.01;
        p.vx += Math.sin(p.drift) * 0.005;
        p.vy += Math.cos(p.drift * 0.7) * 0.005;

        // Mouse repulsion (only if mouse is on canvas)
        if (mouseRef.current.x > 0) {
          const dx = p.x - mouseRef.current.x;
          const dy = p.y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 && dist > 0) {
            const force = ((120 - dist) / 120) * 0.15;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < -10) p.x = cw + 10;
        if (p.x > cw + 10) p.x = -10;
        if (p.y < -10) p.y = ch + 10;
        if (p.y > ch + 10) p.y = -10;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color.replace(/[\d.]+\)$/, `${p.opacity})`);
        ctx.fill();
      }

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = color.replace(/[\d.]+\)$/, `${0.06 * (1 - d / 100)})`);
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouse);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [count, color, maxSize, isMobile, reducedMotion]);

  // Don't render canvas at all on mobile
  if (isMobile || reducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-auto ${className}`}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/**
 * TiltCard — Card with 3D perspective tilt on hover.
 * Disabled on mobile (no hover). Works in all browsers.
 */
export function TiltCard({
  children,
  className = "",
  tiltStrength = 8,
}: {
  children: React.ReactNode;
  className?: string;
  tiltStrength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const smoothRotateX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const smoothRotateY = useSpring(rotateY, { stiffness: 200, damping: 20 });
  const isMobile = useIsMobile();

  const handleMouse = useCallback((e: React.MouseEvent) => {
    if (isMobile || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pctX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const pctY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    rotateX.set(-pctY * tiltStrength);
    rotateY.set(pctX * tiltStrength);
  }, [rotateX, rotateY, tiltStrength, isMobile]);

  const handleLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  // On mobile, render without tilt (no hover support)
  if (isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{
        rotateX: smoothRotateX,
        rotateY: smoothRotateY,
        transformPerspective: 800,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * useHideyNav — Navigation hides on scroll-down, reappears on scroll-up.
 * The signature UX pattern from Google Antigravity and Apple.
 */
export function useHideyNav(threshold = 50) {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handler = () => {
      const currentY = window.scrollY;
      if (currentY < threshold) {
        setVisible(true);
      } else if (currentY > lastScrollY.current + 5) {
        setVisible(false);
      } else if (currentY < lastScrollY.current - 5) {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);

  return visible;
}

/**
 * TextShimmer — Animated gradient shimmer across text.
 * Uses inline style animation for full browser compatibility
 * (no dependency on Tailwind arbitrary animation syntax).
 */
export function TextShimmer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: "linear-gradient(90deg, #fff 0%, #10b981 25%, #06b6d4 50%, #8b5cf6 75%, #fff 100%)",
        backgroundSize: "200% auto",
        animation: "shimmer 4s ease-in-out infinite",
      }}
    >
      {children}
    </span>
  );
}

/**
 * SectionReveal — Scroll-triggered entrance animation.
 * Works in all browsers via Framer Motion (no IntersectionObserver polyfill needed).
 */
export function SectionReveal({
  children,
  className = "",
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  direction?: "up" | "left" | "right";
}) {
  const variants = {
    up: { hidden: { opacity: 0, y: 60 }, visible: { opacity: 1, y: 0 } },
    left: { hidden: { opacity: 0, x: -60 }, visible: { opacity: 1, x: 0 } },
    right: { hidden: { opacity: 0, x: 60 }, visible: { opacity: 1, x: 0 } },
  };

  return (
    <motion.div
      initial={variants[direction].hidden}
      whileInView={variants[direction].visible}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * GradientBorder — Animated gradient border on hover.
 * Uses inline style animation for browser compatibility
 * (avoids Tailwind arbitrary animation syntax issues in v4).
 */
export function GradientBorder({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative group ${className}`}>
      <div
        className="absolute -inset-[1px] rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: "conic-gradient(from 0deg, transparent, rgba(16,185,129,0.3), transparent, rgba(6,182,212,0.3), transparent)",
          animation: "spin 4s linear infinite",
          filter: "blur(1px)",
        }}
      />
      <div className="relative rounded-[inherit] bg-[#0A0A0A]">
        {children}
      </div>
    </div>
  );
}
