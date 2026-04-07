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
 * FloatingParticles — Antigravity-level particle system.
 *
 * Uses Canvas 2D with additive blending for real glow/bloom effect.
 * Three depth layers with different physics behaviors.
 * Mouse interaction: attract/orbit/scatter depending on particle layer.
 *
 * NEW in this version:
 * - Additive blending (globalCompositeOperation = "lighter") for bloom
 * - Trail effect via semi-transparent clear (particles leave ghost trails)
 * - Scroll-reactive: particles drift faster when page is being scrolled
 * - Brighter, more vivid colors with proper glow halos
 * - Mouse cursor creates a visible light cone
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
  const scrollSpeedRef = useRef(0);
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
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Track scroll speed for reactive particles
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      scrollSpeedRef.current = Math.abs(window.scrollY - lastScrollY);
      lastScrollY = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const palette = colors || [color];

    const rgbPalette = palette.map(c => {
      const m = c.match(/(\d+),\s*(\d+),\s*(\d+)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 16, g: 185, b: 129 };
    });

    const particles: typeof particlesRef.current = [];

    // Layer 1: Large glowing orbs
    const orbCount = Math.max(6, Math.floor(count * 0.1));
    for (let i = 0; i < orbCount; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 20 + 12,
        opacity: Math.random() * 0.2 + 0.1,
        drift: Math.random() * Math.PI * 2,
        colorIdx: Math.floor(Math.random() * palette.length),
        layer: 1, glowSize: Math.random() * 80 + 50,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Layer 2: Medium particles
    const medCount = Math.floor(count * 0.25);
    for (let i = 0; i < medCount; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 6 + 3,
        opacity: Math.random() * 0.5 + 0.2,
        drift: Math.random() * Math.PI * 2,
        colorIdx: Math.floor(Math.random() * palette.length),
        layer: 2, glowSize: Math.random() * 25 + 12,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Layer 3: Tiny sharp stars
    const starCount = count - orbCount - medCount;
    for (let i = 0; i < starCount; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * maxSize + 0.8,
        opacity: Math.random() * 0.7 + 0.3,
        drift: Math.random() * Math.PI * 2,
        colorIdx: Math.floor(Math.random() * palette.length),
        layer: 3, glowSize: 0,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    particlesRef.current = particles;

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => { mouseRef.current = { x: -999, y: -999 }; };
    canvas.addEventListener("mousemove", handleMouse);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    let frame: number;
    let time = 0;

    const animate = () => {
      const cw = canvas.offsetWidth;
      const ch = canvas.offsetHeight;
      time += 0.016;

      // Trail effect: semi-transparent clear (ghosts linger)
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(1, 1, 1, 0.15)";
      ctx.fillRect(0, 0, cw, ch);

      // Additive blending for bloom/glow
      ctx.globalCompositeOperation = "lighter";

      // Scroll reactivity: particles drift faster during scroll
      const scrollBoost = 1 + Math.min(scrollSpeedRef.current * 0.02, 2);
      scrollSpeedRef.current *= 0.9; // decay

      const all = particlesRef.current;

      for (const p of all) {
        const driftSpeed = (p.layer === 1 ? 0.004 : p.layer === 2 ? 0.01 : 0.018) * scrollBoost;
        p.drift += driftSpeed;
        p.vx += Math.sin(p.drift) * (driftSpeed * 0.6);
        p.vy += Math.cos(p.drift * 0.7) * (driftSpeed * 0.4);

        // Mouse interaction
        if (mouseRef.current.x > 0) {
          const dx = mouseRef.current.x - p.x;
          const dy = mouseRef.current.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const range = p.layer === 1 ? 300 : p.layer === 2 ? 200 : 130;

          if (dist < range && dist > 1) {
            const str = (range - dist) / range;
            if (p.layer === 1) {
              p.vx += (dx / dist) * str * 0.1;
              p.vy += (dy / dist) * str * 0.1;
            } else if (p.layer === 2) {
              p.vx += (dx / dist) * str * 0.05 + (-dy / dist) * str * 0.03;
              p.vy += (dy / dist) * str * 0.05 + (dx / dist) * str * 0.03;
            } else {
              p.vx -= (dx / dist) * str * 0.25;
              p.vy -= (dy / dist) * str * 0.25;
            }
          }
        }

        const damp = p.layer === 1 ? 0.994 : p.layer === 2 ? 0.988 : 0.982;
        p.vx *= damp;
        p.vy *= damp;

        const maxSpd = (p.layer === 1 ? 1 : p.layer === 2 ? 2 : 3) * scrollBoost;
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > maxSpd) { p.vx = (p.vx / spd) * maxSpd; p.vy = (p.vy / spd) * maxSpd; }

        p.x += p.vx;
        p.y += p.vy;

        const pad = p.glowSize + 30;
        if (p.x < -pad) p.x = cw + pad;
        if (p.x > cw + pad) p.x = -pad;
        if (p.y < -pad) p.y = ch + pad;
        if (p.y > ch + pad) p.y = -pad;

        const pulse = p.layer <= 2 ? Math.sin(time * 0.6 + p.pulsePhase) * 0.04 : 0;
        const op = Math.max(0.03, p.opacity + pulse);
        const rgb = rgbPalette[p.colorIdx] || rgbPalette[0];

        if (p.layer === 1) {
          // Large orbs: multi-stop radial glow with bright core
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.glowSize);
          grad.addColorStop(0, `rgba(${Math.min(255, rgb.r + 100)}, ${Math.min(255, rgb.g + 100)}, ${Math.min(255, rgb.b + 100)}, ${op * 0.8})`);
          grad.addColorStop(0.15, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${op * 0.5})`);
          grad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${op * 0.12})`);
          grad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.glowSize, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        } else if (p.layer === 2) {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.glowSize);
          grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${op * 0.7})`);
          grad.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${op * 0.2})`);
          grad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.glowSize, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        } else {
          // Stars: tiny bright dots with micro-glow
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
          grad.addColorStop(0, `rgba(${Math.min(255, rgb.r + 60)}, ${Math.min(255, rgb.g + 60)}, ${Math.min(255, rgb.b + 60)}, ${op})`);
          grad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${op * 0.2})`);
          grad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      // Connection lines (additive blend makes them glow)
      for (let i = 0; i < all.length; i++) {
        if (all[i].layer === 3) continue;
        for (let j = i + 1; j < all.length; j++) {
          if (all[j].layer === 3) continue;
          const a = all[i], b = all[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 220) {
            const alpha = 0.04 * (1 - d / 220);
            const rgb1 = rgbPalette[a.colorIdx] || rgbPalette[0];
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Mouse light cone
      if (mouseRef.current.x > 0) {
        const mx = mouseRef.current.x, my = mouseRef.current.y;
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 200);
        mg.addColorStop(0, "rgba(16, 185, 129, 0.06)");
        mg.addColorStop(0.3, "rgba(6, 182, 212, 0.03)");
        mg.addColorStop(0.6, "rgba(139, 92, 246, 0.015)");
        mg.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.beginPath();
        ctx.arc(mx, my, 200, 0, Math.PI * 2);
        ctx.fillStyle = mg;
        ctx.fill();
      }

      // Reset composite for next frame
      ctx.globalCompositeOperation = "source-over";

      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      canvas.removeEventListener("mousemove", handleMouse);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
