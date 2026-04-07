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
 * FloatingParticles — Antigravity-inspired particle system.
 *
 * Three layers of depth:
 *   1. Large glowing orbs (8-40px) — slow drift, dramatic glow, few of them
 *   2. Medium particles (3-8px) — moderate speed, some glow
 *   3. Tiny stars (1-2px) — fast, sharp, many of them
 *
 * Mouse interaction: orbs are ATTRACTED to cursor (not repelled),
 * creating a magnetic pull effect like Google Antigravity.
 * On mouse leave, they drift back to original trajectory.
 *
 * Uses radial gradients for glow (not flat circles).
 * Auto-disables on mobile and prefers-reduced-motion.
 */
export function FloatingParticles({
  count = 40,
  color = "rgba(16, 185, 129, 0.3)",
  colors,
  maxSize = 3,
  className = "",
}: {
  count?: number;
  color?: string;
  colors?: string[];
  maxSize?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    size: number; opacity: number; drift: number; colorIdx: number;
    layer: number; glowSize: number; pulsePhase: number;
  }>>([]);
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
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
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const palette = colors || [color];

    // Parse RGB values from palette for gradient creation
    const rgbPalette = palette.map(c => {
      const m = c.match(/(\d+),\s*(\d+),\s*(\d+)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 16, g: 185, b: 129 };
    });

    // Create 3 layers of particles
    const particles: typeof particlesRef.current = [];

    // Layer 1: Large glowing orbs (5-8 of them, 15-40px, dramatic)
    const orbCount = Math.max(5, Math.floor(count * 0.12));
    for (let i = 0; i < orbCount; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        size: Math.random() * 25 + 15,
        opacity: Math.random() * 0.15 + 0.08,
        drift: Math.random() * Math.PI * 2,
        colorIdx: Math.floor(Math.random() * palette.length),
        layer: 1,
        glowSize: Math.random() * 60 + 40,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Layer 2: Medium particles (20-30% of count, 4-12px)
    const medCount = Math.floor(count * 0.25);
    for (let i = 0; i < medCount; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 8 + 4,
        opacity: Math.random() * 0.4 + 0.15,
        drift: Math.random() * Math.PI * 2,
        colorIdx: Math.floor(Math.random() * palette.length),
        layer: 2,
        glowSize: Math.random() * 20 + 10,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Layer 3: Tiny stars (rest, 1-3px, sharp)
    const starCount = count - orbCount - medCount;
    for (let i = 0; i < starCount; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * maxSize + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
        drift: Math.random() * Math.PI * 2,
        colorIdx: Math.floor(Math.random() * palette.length),
        layer: 3,
        glowSize: 0,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    particlesRef.current = particles;

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
    let time = 0;

    const animate = () => {
      const cw = canvas.offsetWidth;
      const ch = canvas.offsetHeight;
      ctx.clearRect(0, 0, cw, ch);
      time += 0.016; // ~60fps

      const allParticles = particlesRef.current;

      for (const p of allParticles) {
        // Zero-gravity drift (different speeds per layer)
        const driftSpeed = p.layer === 1 ? 0.003 : p.layer === 2 ? 0.008 : 0.015;
        p.drift += driftSpeed;
        p.vx += Math.sin(p.drift) * (driftSpeed * 0.5);
        p.vy += Math.cos(p.drift * 0.7) * (driftSpeed * 0.5);

        // Mouse interaction — ATTRACTION for orbs, repulsion for small
        if (mouseRef.current.x > 0) {
          const dx = mouseRef.current.x - p.x;
          const dy = mouseRef.current.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const range = p.layer === 1 ? 250 : p.layer === 2 ? 180 : 120;

          if (dist < range && dist > 0) {
            const strength = ((range - dist) / range);
            if (p.layer === 1) {
              // Large orbs: gentle ATTRACTION (Antigravity magnetic effect)
              p.vx += (dx / dist) * strength * 0.08;
              p.vy += (dy / dist) * strength * 0.08;
            } else if (p.layer === 2) {
              // Medium: orbit around cursor
              p.vx += (dx / dist) * strength * 0.04 + (-dy / dist) * strength * 0.02;
              p.vy += (dy / dist) * strength * 0.04 + (dx / dist) * strength * 0.02;
            } else {
              // Tiny: scatter away (repulsion)
              p.vx -= (dx / dist) * strength * 0.2;
              p.vy -= (dy / dist) * strength * 0.2;
            }
          }
        }

        // Damping (heavier for large orbs = more floaty)
        const damping = p.layer === 1 ? 0.995 : p.layer === 2 ? 0.99 : 0.985;
        p.vx *= damping;
        p.vy *= damping;

        // Speed limit
        const maxSpeed = p.layer === 1 ? 0.8 : p.layer === 2 ? 1.5 : 2.5;
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Soft edge wrapping
        const pad = p.glowSize + 20;
        if (p.x < -pad) p.x = cw + pad;
        if (p.x > cw + pad) p.x = -pad;
        if (p.y < -pad) p.y = ch + pad;
        if (p.y > ch + pad) p.y = -pad;

        // Pulsing opacity for orbs
        const pulse = p.layer <= 2 ? Math.sin(time * 0.8 + p.pulsePhase) * 0.03 : 0;
        const currentOpacity = Math.max(0.02, p.opacity + pulse);

        const rgb = rgbPalette[p.colorIdx] || rgbPalette[0];

        if (p.layer === 1) {
          // Large orbs: radial gradient glow
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.glowSize);
          grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${currentOpacity * 1.5})`);
          grad.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${currentOpacity * 0.6})`);
          grad.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${currentOpacity * 0.15})`);
          grad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.glowSize, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          // Bright core
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${Math.min(255, rgb.r + 80)}, ${Math.min(255, rgb.g + 80)}, ${Math.min(255, rgb.b + 80)}, ${currentOpacity * 2})`;
          ctx.fill();
        } else if (p.layer === 2) {
          // Medium: soft glow circle
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.glowSize);
          grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${currentOpacity})`);
          grad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${currentOpacity * 0.3})`);
          grad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.glowSize, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        } else {
          // Tiny stars: sharp bright dots
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${currentOpacity})`;
          ctx.fill();
        }
      }

      // Connection lines between nearby medium/large particles
      for (let i = 0; i < allParticles.length; i++) {
        if (allParticles[i].layer === 3) continue; // Skip tiny stars
        for (let j = i + 1; j < allParticles.length; j++) {
          if (allParticles[j].layer === 3) continue;
          const a = allParticles[i];
          const b = allParticles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 200) {
            const lineAlpha = 0.06 * (1 - d / 200);
            const rgb1 = rgbPalette[a.colorIdx] || rgbPalette[0];
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${lineAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Mouse glow — subtle radial light that follows cursor
      if (mouseRef.current.x > 0) {
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const mouseGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 150);
        mouseGlow.addColorStop(0, "rgba(16, 185, 129, 0.04)");
        mouseGlow.addColorStop(0.5, "rgba(6, 182, 212, 0.02)");
        mouseGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.beginPath();
        ctx.arc(mx, my, 150, 0, Math.PI * 2);
        ctx.fillStyle = mouseGlow;
        ctx.fill();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- colors array ref changes but content is stable
  }, [count, color, maxSize, isMobile, reducedMotion]);

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
