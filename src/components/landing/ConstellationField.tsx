"use client";

import { useEffect, useRef } from "react";

/**
 * ConstellationField — copper particle constellation for the hero background.
 *
 * 75 particles (7 "hub" nodes) float with slow brownian motion.
 * Nearby particles draw copper proximity lines that fade with distance.
 * Mouse cursor creates a smooth repulsion field.
 * Additive blending (globalCompositeOperation="lighter") gives real glow.
 *
 * Hub nodes are larger, brighter, and connect with a wider proximity radius —
 * visually they anchor the constellation like named stars.
 *
 * Disabled automatically on mobile (< 768px) and prefers-reduced-motion.
 * Animation pauses when the tab is hidden (visibilitychange).
 */

const CU = { r: 181, g: 83, b: 44 } as const; // #B5532C copper

const TOTAL = 75;
const HUB_COUNT = 7;      // first HUB_COUNT particles are hub nodes
const LINE_DIST = 160;    // px — regular proximity threshold
const HUB_LINE_DIST = 230; // px — hub-to-any proximity threshold
const REPEL_DIST = 135;   // px — mouse repulsion radius
const REPEL_STRENGTH = 0.28;
const MAX_SPEED = 0.9;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;    // base opacity
  phase: number;    // pulse oscillation phase
  pSpeed: number;   // pulse speed
  isHub: boolean;
}

function cu(a: number) {
  return `rgba(${CU.r},${CU.g},${CU.b},${a.toFixed(3)})`;
}

export function ConstellationField({ className = "" }: { className?: string }) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const pts = useRef<Particle[]>([]);
  const raf = useRef(0);
  const paused = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;

    /* ── Canvas resize + particle remap ── */
    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const prevW = W;
      const prevH = H;
      W = rect.width || window.innerWidth;
      H = rect.height || window.innerHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Scale existing particles proportionally so they stay in view
      if (prevW > 0 && pts.current.length) {
        for (const p of pts.current) {
          p.x = (p.x / prevW) * W;
          p.y = (p.y / prevH) * H;
        }
      }
    }

    /* ── Spawn particles ── */
    function spawn() {
      pts.current = Array.from({ length: TOTAL }, (_, i) => {
        const hub = i < HUB_COUNT;
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * (hub ? 0.22 : 0.40),
          vy: (Math.random() - 0.5) * (hub ? 0.22 : 0.40),
          radius: hub ? 2.0 + Math.random() * 1.8 : 0.5 + Math.random() * 1.6,
          alpha: hub ? 0.70 + Math.random() * 0.25 : 0.22 + Math.random() * 0.50,
          phase: Math.random() * Math.PI * 2,
          pSpeed: hub ? 0.005 + Math.random() * 0.008 : 0.008 + Math.random() * 0.016,
          isHub: hub,
        };
      });
    }

    resize();
    spawn();

    /* ── Event listeners ── */
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const onMove = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    const onVis = () => { paused.current = document.hidden; };
    document.addEventListener("visibilitychange", onVis);

    /* ── Animation loop ── */
    function frame() {
      if (paused.current) {
        raf.current = requestAnimationFrame(frame);
        return;
      }

      ctx!.clearRect(0, 0, W, H);
      const ps = pts.current;
      const mx = mouse.current.x;
      const my = mouse.current.y;

      /* Update physics */
      for (const p of ps) {
        p.phase += p.pSpeed;

        // Mouse repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < REPEL_DIST * REPEL_DIST && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = (1 - d / REPEL_DIST) * REPEL_STRENGTH;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }

        // Damping
        p.vx *= 0.982;
        p.vy *= 0.982;

        // Speed cap
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > MAX_SPEED) {
          const inv = MAX_SPEED / spd;
          p.vx *= inv;
          p.vy *= inv;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -24) p.x = W + 24;
        else if (p.x > W + 24) p.x = -24;
        if (p.y < -24) p.y = H + 24;
        else if (p.y > H + 24) p.y = -24;
      }

      /* Draw proximity lines (additive blending) */
      ctx!.globalCompositeOperation = "lighter";
      ctx!.lineWidth = 0.55;

      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];

        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j];
          // Hubs connect further; hub↔regular uses hub radius; regular↔regular uses standard
          const dist = (a.isHub || b.isHub) ? HUB_LINE_DIST : LINE_DIST;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;

          if (d2 > dist * dist) continue;
          const d = Math.sqrt(d2);

          // Line alpha: stronger for hub-to-hub connections, fades with distance
          const baseAlpha = (a.isHub && b.isHub) ? 0.22 : (a.isHub || b.isHub) ? 0.16 : 0.10;
          const lineAlpha = baseAlpha * (1 - d / dist);

          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.strokeStyle = cu(lineAlpha);
          ctx!.stroke();
        }
      }

      /* Draw particle glows + cores */
      for (const p of ps) {
        const pulse = 0.84 + 0.16 * Math.sin(p.phase);
        const a = p.alpha * pulse;

        // Soft glow halo (radial gradient, additive)
        const glowR = p.radius * (p.isHub ? 9 : 5.5);
        const grd = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        grd.addColorStop(0,   cu(a * (p.isHub ? 0.55 : 0.38)));
        grd.addColorStop(0.4, cu(a * 0.09));
        grd.addColorStop(1,   cu(0));
        ctx!.fillStyle = grd;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx!.fill();

        // Crisp core dot
        ctx!.fillStyle = cu(Math.min(a * 1.25, 1));
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.globalCompositeOperation = "source-over";
      raf.current = requestAnimationFrame(frame);
    }

    raf.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={cvs}
      className={className}
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}
