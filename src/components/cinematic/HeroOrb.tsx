"use client";

import { useRef, useEffect } from "react";

/**
 * HeroOrb — A reactive 3D energy orb that follows mouse movement.
 * Uses pure CSS transforms and gradients for performance (no WebGL overhead).
 * The orb pulsates, glows, and shifts color based on cursor proximity.
 */
export function HeroOrb() {
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;

    let animFrame: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouse = (e: MouseEvent) => {
      const rect = orb.parentElement?.getBoundingClientRect();
      if (!rect) return;
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 30;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 30;
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;
      orb.style.transform = `translate(${currentX}px, ${currentY}px) scale(1)`;
      animFrame = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouse);
    animFrame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouse);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      <div
        ref={orbRef}
        className="relative w-[500px] h-[500px] md:w-[700px] md:h-[700px]"
      >
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/[0.03] to-cyan-500/[0.02] blur-[100px] animate-pulse" />

        {/* Mid ring — rotates slowly */}
        <div
          className="absolute inset-[15%] rounded-full border border-emerald-500/[0.06]"
          style={{ animation: "spin 30s linear infinite" }}
        />

        {/* Inner ring — rotates opposite */}
        <div
          className="absolute inset-[30%] rounded-full border border-cyan-500/[0.08]"
          style={{ animation: "spin 20s linear infinite reverse" }}
        />

        {/* Core glow */}
        <div className="absolute inset-[40%] rounded-full bg-gradient-to-br from-emerald-500/[0.08] to-transparent blur-[40px]" />

        {/* Particle dots orbiting */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-emerald-400/40"
            style={{
              top: "50%",
              left: "50%",
              animation: `orbit ${8 + i * 2}s linear infinite`,
              animationDelay: `${i * -1.5}s`,
              transformOrigin: `${80 + i * 20}px 0`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
