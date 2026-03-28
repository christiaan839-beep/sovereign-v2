"use client";

import { useCallback, useRef, useEffect } from "react";

/**
 * ParticleBurst — Wrap any clickable element.
 * On click, emerald particles explode outward from the click point.
 * Pure canvas, zero DOM overhead, cleans up automatically.
 */
export function ParticleBurst({
  children,
  className = "",
  color = "16, 185, 129", // emerald RGB
  particleCount = 24,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
  particleCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const burst = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Create temporary canvas
      const canvas = document.createElement("canvas");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.cssText =
        "position:fixed;inset:0;pointer-events:none;z-index:99999;";
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Particle state
      const particles = Array.from({ length: particleCount }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        return {
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          size: 2 + Math.random() * 3,
          decay: 0.92 + Math.random() * 0.04,
        };
      });

      let frame = 0;
      const maxFrames = 60;

      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.08; // gravity
          p.alpha *= p.decay;
          p.vx *= 0.98; // friction

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color}, ${p.alpha})`;
          ctx.fill();

          // Glow
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.alpha * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color}, ${p.alpha * 0.1})`;
          ctx.fill();
        }

        frame++;
        if (frame < maxFrames && particles.some((p) => p.alpha > 0.02)) {
          requestAnimationFrame(animate);
        } else {
          canvas.remove();
        }
      };
      requestAnimationFrame(animate);
    },
    [color, particleCount]
  );

  return (
    <div ref={containerRef} className={className} onClick={burst}>
      {children}
    </div>
  );
}
