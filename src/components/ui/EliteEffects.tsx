"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring, useScroll, useTransform } from "framer-motion";

/**
 * FloatingParticles — Canvas-based particle system for hero sections.
 * Particles drift with zero-gravity physics and react to mouse position.
 * Inspired by Google Antigravity's particle drift system.
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
  const mouseRef = useRef({ x: 0, y: 0 });
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    size: number; opacity: number; drift: number;
  }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
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
    canvas.addEventListener("mousemove", handleMouse);

    let frame: number;
    const animate = () => {
      const cw = canvas.offsetWidth;
      const ch = canvas.offsetHeight;
      ctx.clearRect(0, 0, cw, ch);

      for (const p of particlesRef.current) {
        // Random drift (zero-gravity feel)
        p.drift += 0.01;
        p.vx += Math.sin(p.drift) * 0.005;
        p.vy += Math.cos(p.drift * 0.7) * 0.005;

        // Mouse repulsion
        const dx = p.x - mouseRef.current.x;
        const dy = p.y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          const force = (120 - dist) / 120 * 0.15;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
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

        // Draw
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color.replace(/[\d.]+\)$/, `${p.opacity})`);
        ctx.fill();
      }

      // Draw subtle connections between nearby particles
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const a = particlesRef.current[i];
          const b = particlesRef.current[j];
          const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
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
    };
  }, [count, color, maxSize]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-auto ${className}`}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/**
 * CursorGlow — Gradient orb that follows the cursor.
 * Creates ambient lighting effect like premium design sites.
 */
export function CursorGlow({
  size = 400,
  color = "emerald",
  opacity = 0.07,
}: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const smoothX = useSpring(x, { stiffness: 50, damping: 20 });
  const smoothY = useSpring(y, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      x.set(e.clientX - size / 2);
      y.set(e.clientY - size / 2);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [x, y, size]);

  const colorMap: Record<string, string> = {
    emerald: `rgba(16, 185, 129, ${opacity})`,
    cyan: `rgba(6, 182, 212, ${opacity})`,
    violet: `rgba(139, 92, 246, ${opacity})`,
    white: `rgba(255, 255, 255, ${opacity})`,
  };

  return (
    <motion.div
      style={{
        x: smoothX,
        y: smoothY,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${colorMap[color] || colorMap.emerald}, transparent 70%)`,
      }}
      className="fixed top-0 left-0 pointer-events-none z-[1] rounded-full blur-3xl"
    />
  );
}

/**
 * TiltCard — Card with 3D perspective tilt on hover.
 * Inspired by premium product pages (Apple, Linear).
 */
export function TiltCard({
  children,
  className = "",
  tiltStrength = 8,
  glareEnabled = true,
}: {
  children: React.ReactNode;
  className?: string;
  tiltStrength?: number;
  glareEnabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const smoothRotateX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const smoothRotateY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const handleMouse = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const pctX = (e.clientX - centerX) / (rect.width / 2);
    const pctY = (e.clientY - centerY) / (rect.height / 2);
    rotateX.set(-pctY * tiltStrength);
    rotateY.set(pctX * tiltStrength);
    glareX.set(((e.clientX - rect.left) / rect.width) * 100);
    glareY.set(((e.clientY - rect.top) / rect.height) * 100);
  }, [rotateX, rotateY, glareX, glareY, tiltStrength]);

  const handleLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{
        rotateX: smoothRotateX,
        rotateY: smoothRotateY,
        transformPerspective: 800,
        transformStyle: "preserve-3d",
      }}
      className={`relative transition-shadow duration-300 ${className}`}
    >
      {children}
      {glareEnabled && (
        <motion.div
          className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glareX.get()}% ${glareY.get()}%, rgba(255,255,255,0.06), transparent 60%)`,
          }}
        />
      )}
    </motion.div>
  );
}

/**
 * HideyNav — Navigation that hides on scroll-down, reappears on scroll-up.
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
        setVisible(false); // scrolling down
      } else if (currentY < lastScrollY.current - 5) {
        setVisible(true); // scrolling up
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);

  return visible;
}

/**
 * TextShimmer — Text with a subtle animated gradient shimmer.
 * Used for hero headlines to create a premium, alive feel.
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
      className={`bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite] ${className}`}
      style={{
        backgroundImage: "linear-gradient(90deg, #fff 0%, #10b981 25%, #06b6d4 50%, #8b5cf6 75%, #fff 100%)",
      }}
    >
      {children}
    </span>
  );
}

/**
 * SectionReveal — Section wrapper that fades/slides in on scroll with clip-path reveal.
 * More dramatic than simple opacity transitions.
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
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * GradientBorder — Animated gradient border on hover.
 * Creates a living border effect that rotates around the element.
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
      {/* Rotating gradient border */}
      <div className="absolute -inset-[1px] rounded-[inherit] bg-gradient-to-r from-emerald-500/0 via-emerald-500/30 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-[spin_4s_linear_infinite] blur-[1px]" />
      {/* Content */}
      <div className="relative rounded-[inherit] bg-[#0A0A0A]">
        {children}
      </div>
    </div>
  );
}
