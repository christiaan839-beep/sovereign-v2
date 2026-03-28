"use client";

import { useEffect, useRef } from "react";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

/**
 * CursorGlow — Emerald glow trail that follows the cursor.
 * Renders a canvas overlay with fading glow particles.
 * Zero layout impact, GPU composited via will-change.
 */
export function CursorGlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let mouseX = -200;
    let mouseY = -200;
    const trail: Array<{ x: number; y: number; alpha: number; size: number }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const move = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener("mousemove", move, { passive: true });

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Add new trail point
      trail.push({ x: mouseX, y: mouseY, alpha: 0.4, size: 120 });

      // Keep trail short (performance)
      if (trail.length > 20) trail.shift();

      // Draw trail
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        p.alpha *= 0.88; // fade
        p.size *= 0.97; // shrink

        if (p.alpha < 0.01) continue;

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gradient.addColorStop(0, `rgba(16, 185, 129, ${p.alpha * 0.15})`);
        gradient.addColorStop(0.4, `rgba(16, 185, 129, ${p.alpha * 0.06})`);
        gradient.addColorStop(1, "rgba(16, 185, 129, 0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", move);
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9990]"
      style={{ willChange: "transform" }}
    />
  );
}
