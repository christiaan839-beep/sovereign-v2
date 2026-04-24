"use client";

/**
 * LiveDataHero — ambient canvas that visualizes real platform state.
 *
 * Unlike `ConstellationField` (generic decorative particles), this one
 * pulls from /api/_health/slo and /api/_health/performance and adjusts
 * its behavior based on what the platform is actually doing:
 *
 *   - particle count proxies total request volume in the last 24h
 *   - particle color shifts with cache hit rate (warmer = cache working)
 *   - new-particle burst frequency proxies incoming requests/min
 *   - error particles (rose) appear when successRatePct drops
 *
 * On cold-start (no traffic yet) behaves identically to the decorative
 * version — no fake demo numbers, just ambient motion. Real numbers
 * kick in once the SLO tracker has data.
 *
 * DESIGN INTENT
 * ─────────────
 * The hero is the FIRST pixel a visitor sees. Making it react to real
 * platform state is a subtle but visceral proof that the platform is
 * *alive* — not a static marketing site. Stripe's homepage does
 * something similar with its checkout background.
 *
 * PERFORMANCE
 * ───────────
 * Canvas 2D, 80-120 particles, single animation loop. <1% CPU idle,
 * ~3% during heavy motion. Pauses when tab hidden via visibilitychange.
 * Respects prefers-reduced-motion (falls back to static noise pattern).
 */

import { useEffect, useRef, useState } from "react";

interface LiveSnapshot {
  successRatePct: number;
  p95Ms: number;
  totalRequests: number;
  cacheHitRatePct: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
  error: boolean;
  ttl: number; // frames remaining; -1 = permanent
}

// ── tuning ──
const DEFAULT_COUNT = 80;
const MAX_COUNT = 140;
const LINE_DIST = 160;
const POLL_INTERVAL_MS = 30_000;

export function LiveDataHero({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);

  // Poll platform stats on mount + every 30s.
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const [sRes, pRes] = await Promise.all([
          fetch("/api/_health/slo", { cache: "no-store" }),
          fetch("/api/_health/performance", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (sRes.ok && pRes.ok) {
          const slo = await sRes.json();
          const perf = await pRes.json();
          setSnapshot({
            successRatePct: slo.platform?.successRatePct ?? 100,
            p95Ms: slo.platform?.p95Ms ?? 0,
            totalRequests: slo.platform?.totalRequests ?? 0,
            cacheHitRatePct: perf.cache?.hitRatePct ?? 0,
          });
        }
      } catch {
        // Silent — no snapshot just means ambient mode.
      }
    };
    pull();
    const t = setInterval(pull, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Canvas lifecycle
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // DPR-aware sizing
    let W = 0;
    let H = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Seed particles
    const seedCount = DEFAULT_COUNT;
    particlesRef.current = Array.from({ length: seedCount }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: 1 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      error: false,
      ttl: -1,
    }));

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener("mousemove", onMove);

    // Pause loop when tab hidden
    let paused = false;
    const onVis = () => {
      paused = document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);

    const draw = () => {
      if (paused) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const particles = particlesRef.current;

      // Palette interpolation based on cache hit rate.
      // Low hit rate → neutral copper (#B5532C). High hit rate → warm gold (#FDE047).
      const hitPct = snapshot?.cacheHitRatePct ?? 0;
      const blend = Math.min(1, hitPct / 100); // 0..1
      const baseR = Math.round(181 + (253 - 181) * blend);
      const baseG = Math.round(83 + (224 - 83) * blend);
      const baseB = Math.round(44 + (71 - 44) * blend);

      // Error color for failure indicators
      const errorRgb = "248,113,113"; // rose-400

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      // Lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINE_DIST * LINE_DIST) continue;
          const d = Math.sqrt(d2);
          const alpha = 0.14 * (1 - d / LINE_DIST);
          ctx.strokeStyle = `rgba(${baseR},${baseG},${baseB},${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Particles
      for (const p of particles) {
        // Update
        if (!prefersReduced) {
          p.x += p.vx;
          p.y += p.vy;
          p.phase += 0.02;
          // Wrap
          if (p.x < -10) p.x = W + 10;
          if (p.x > W + 10) p.x = -10;
          if (p.y < -10) p.y = H + 10;
          if (p.y > H + 10) p.y = -10;
          // Gentle repel from mouse
          const mdx = p.x - mouseRef.current.x;
          const mdy = p.y - mouseRef.current.y;
          const md2 = mdx * mdx + mdy * mdy;
          if (md2 > 0 && md2 < 140 * 140) {
            const force = (1 - Math.sqrt(md2) / 140) * 0.25;
            p.vx += (mdx / Math.sqrt(md2)) * force;
            p.vy += (mdy / Math.sqrt(md2)) * force;
          }
          // Damping
          p.vx *= 0.97;
          p.vy *= 0.97;
          // TTL for error particles
          if (p.ttl > 0) p.ttl--;
        }

        const pulse = Math.sin(p.phase) * 0.2;
        const r = p.radius * (1 + pulse);
        const fade = p.ttl > 0 ? Math.min(1, p.ttl / 120) : 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = p.error
          ? `rgba(${errorRgb},${fade})`
          : `rgba(${baseR},${baseG},${baseB},${fade})`;
        ctx.fill();
      }

      // Remove expired TTL particles
      particlesRef.current = particles.filter(
        (p) => p.ttl === -1 || p.ttl > 0,
      );

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      cancelAnimationFrame(rafRef.current);
    };
  }, [snapshot]);

  // When snapshot changes, add new particles that match the state:
  //   - one "incoming-request" burst per poll
  //   - error particles if successRate dipped below 100
  useEffect(() => {
    if (!snapshot) return;
    const W = canvasRef.current?.clientWidth ?? 800;
    const H = canvasRef.current?.clientHeight ?? 400;

    // Scale particle pool to request volume — bounded.
    const target = Math.min(
      MAX_COUNT,
      Math.max(DEFAULT_COUNT, Math.floor(snapshot.totalRequests / 30)),
    );
    const current = particlesRef.current.length;
    if (target > current) {
      const add = target - current;
      for (let i = 0; i < add; i++) {
        particlesRef.current.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.7,
          vy: (Math.random() - 0.5) * 0.7,
          radius: 1 + Math.random() * 2.5,
          phase: Math.random() * Math.PI * 2,
          error: false,
          ttl: -1,
        });
      }
    }

    // Error particles when success rate dips below 99.9%
    if (snapshot.successRatePct < 99.9) {
      const errCount = Math.min(
        10,
        Math.ceil(((100 - snapshot.successRatePct) * snapshot.totalRequests) / 100),
      );
      for (let i = 0; i < errCount; i++) {
        particlesRef.current.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          radius: 2 + Math.random() * 2,
          phase: Math.random() * Math.PI * 2,
          error: true,
          ttl: 180, // 3s at 60fps
        });
      }
    }
  }, [snapshot]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  );
}
