"use client";

import { useEffect, useRef } from "react";

// ─── Tokens flowing left → right as a canvas stream ─────────────────────────
// Renders a horizontal rail of glowing token fragments at 2200+ tok/s
// GPU-composited, zero layout impact.

const TOKEN_SAMPLES = [
  "JSON", "{", "\"role\"", ":", "\"agent\"", "}", "→", "classify",
  "0x4F", "PLAN", "ACK", "█", "EXEC", "verified", "97.2%",
  "▶", "NIM", "context:", "4096", "tokens", "ROUTE", "→",
  "deepseek", "v3.2", "←", "nemotron", "253B", "critique",
  "PASS", "score:", "0.892", "delta:", "+0.228", "SYNC",
  "lead", "hunter", "→", "content", "agent", "CHAIN",
  "HITL", "pending", "APPROVE", "✓", "deploy", "NOW",
  "2,247", "tok/s", "◆", "latency:", "142ms", "▲",
  "consensus", "MERGE", "finalized", "→", "output", "ready",
];

const COLORS = [
  "rgba(16,185,129,0.9)",  // emerald — main
  "rgba(16,185,129,0.5)",  // emerald dim
  "rgba(6,182,212,0.7)",   // cyan
  "rgba(139,92,246,0.5)",  // violet
  "rgba(255,255,255,0.25)", // white dim
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  text: string;
  color: string;
  alpha: number;
  size: number;
  glow: boolean;
}

export function TokenStream() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    const particles: Particle[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * Math.min(window.devicePixelRatio, 2);
      canvas.height = canvas.offsetHeight * Math.min(window.devicePixelRatio, 2);
      ctx.setTransform(Math.min(window.devicePixelRatio, 2), 0, 0, Math.min(window.devicePixelRatio, 2), 0, 0);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    let frameCount = 0;

    const spawn = () => {
      const glow = Math.random() < 0.15;
      particles.push({
        x: -100,
        y: canvas.offsetHeight * (0.3 + Math.random() * 0.4),
        vx: 1.2 + Math.random() * 2.2,
        text: TOKEN_SAMPLES[Math.floor(Math.random() * TOKEN_SAMPLES.length)],
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 0.3 + Math.random() * 0.6,
        size: 8 + Math.random() * 4,
        glow,
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      frameCount++;

      // Spawn rate ≈ 2200 tok/s feel (one every 1–2 frames at 60fps)
      if (frameCount % 2 === 0) spawn();
      if (frameCount % 7 === 0) spawn();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;

        // Fade in / fade out
        if (p.x < 60) p.alpha = Math.min(p.alpha, p.x / 60);
        if (p.x > canvas.offsetWidth - 100) p.alpha *= 0.96;

        if (p.x > canvas.offsetWidth + 20 || p.alpha < 0.02) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.font = `${p.glow ? "bold " : ""}${p.size}px "SF Mono", ui-monospace, monospace`;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        if (p.glow) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
        }

        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative h-16 overflow-hidden bg-[#020202] border-y border-emerald-500/[0.06]">
      {/* Left mask */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#020202] to-transparent z-10 pointer-events-none" />
      {/* Right mask */}
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#020202] to-transparent z-10 pointer-events-none" />

      {/* Left label */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2">
        <div className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </div>
        <span className="text-[9px] font-mono font-bold text-emerald-500/70 uppercase tracking-widest whitespace-nowrap">
          LIVE · 2,200+ tok/s
        </span>
      </div>

      {/* Right label */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
        <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">Cerebras WSE-3</span>
      </div>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ willChange: "transform" }}
      />
    </div>
  );
}
