"use client";

import { useEffect, useRef } from "react";

/**
 * A2EGraph — Animated canvas visualization of the A2E economy.
 * Agent nodes with copper edges and traveling pulse dots.
 * Pure copper color scheme: #B5532C and rgba(181,83,44,x).
 *
 * `showLabels` defaults to true (the focal A2EEconomySection use). The hero
 * uses this as a low-opacity background and sets `showLabels={false}` so
 * agent-name labels don't bleed through the headline text on narrow viewports.
 */
export function A2EGraph({
  className = "",
  showLabels = true,
}: {
  className?: string;
  showLabels?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Node definitions (normalized 0-1 positions)
    const NODE_DEFS = [
      { id: "lead", label: "Lead Agent", nx: 0.5, ny: 0.18, isHub: true },
      { id: "seo", label: "SEO", nx: 0.15, ny: 0.5, isHub: false },
      { id: "content", label: "Content", nx: 0.38, ny: 0.78, isHub: false },
      { id: "video", label: "Video", nx: 0.62, ny: 0.78, isHub: false },
      { id: "email", label: "Email", nx: 0.85, ny: 0.5, isHub: false },
      { id: "analytics", label: "Analytics", nx: 0.27, ny: 0.38, isHub: false },
      { id: "social", label: "Social", nx: 0.73, ny: 0.38, isHub: false },
    ];

    // Edges: all outer nodes connect to the hub (index 0)
    // plus a few lateral connections for visual richness
    const EDGE_PAIRS = [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [0, 6],
      [5, 1],
      [5, 2],
      [6, 3],
      [6, 4],
    ];

    // Animated pulses: one per edge at offset phases
    const pulses = EDGE_PAIRS.map((_, i) => ({
      t: i / EDGE_PAIRS.length, // offset start so they don't all sync
      speed: 0.0028 + Math.random() * 0.001,
    }));

    let frame: number;
    let time = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      time += 0.016;

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.clearRect(0, 0, w, h);

      // Compute actual pixel positions
      const nodes = NODE_DEFS.map((n) => ({
        ...n,
        x: n.nx * w,
        y: n.ny * h,
      }));

      // Draw edges
      for (let ei = 0; ei < EDGE_PAIRS.length; ei++) {
        const [a, b] = EDGE_PAIRS[ei];
        const nA = nodes[a];
        const nB = nodes[b];

        ctx.beginPath();
        ctx.moveTo(nA.x, nA.y);
        ctx.lineTo(nB.x, nB.y);
        ctx.strokeStyle = "rgba(181,83,44,0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Traveling pulse dot
        const p = pulses[ei];
        p.t += p.speed;
        if (p.t > 1) p.t -= 1;

        const px = nA.x + (nB.x - nA.x) * p.t;
        const py = nA.y + (nB.y - nA.y) * p.t;

        // Glow halo
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 8);
        grad.addColorStop(0, "rgba(181,83,44,0.9)");
        grad.addColorStop(0.3, "rgba(181,83,44,0.35)");
        grad.addColorStop(1, "rgba(181,83,44,0)");
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Bright core
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(230,140,90,0.95)";
        ctx.fill();
      }

      // Draw nodes
      for (const node of nodes) {
        const r = node.isHub ? 20 : 14;
        const pulse = Math.sin(time * 1.4 + node.nx * 10) * 0.12 + 0.88;

        // Outer glow ring
        const outerGrad = ctx.createRadialGradient(
          node.x,
          node.y,
          r * 0.6,
          node.x,
          node.y,
          r * 2.5,
        );
        outerGrad.addColorStop(0, `rgba(181,83,44,${0.18 * pulse})`);
        outerGrad.addColorStop(1, "rgba(181,83,44,0)");
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = outerGrad;
        ctx.fill();

        // Node fill
        const fillGrad = ctx.createRadialGradient(
          node.x - r * 0.3,
          node.y - r * 0.3,
          0,
          node.x,
          node.y,
          r,
        );
        fillGrad.addColorStop(0, `rgba(181,83,44,${node.isHub ? 0.45 : 0.25})`);
        fillGrad.addColorStop(1, `rgba(60,20,5,${node.isHub ? 0.6 : 0.4})`);
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = fillGrad;
        ctx.fill();

        // Node border
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(181,83,44,${node.isHub ? 0.75 : 0.45})`;
        ctx.lineWidth = node.isHub ? 1.5 : 1;
        ctx.stroke();

        // Label — JetBrains Mono style. Suppressed when this graph is used
        // as a faint hero backdrop; bleeding agent names through the
        // headline at narrow viewports is the worst kind of "AI slop"
        // visual debt.
        if (showLabels) {
          const labelY = node.y + r + 14;
          ctx.font = `${node.isHub ? "11px" : "10px"} "JetBrains Mono", monospace`;
          ctx.textAlign = "center";
          ctx.fillStyle = node.isHub
            ? "rgba(230,140,90,0.9)"
            : "rgba(181,83,44,0.65)";
          ctx.fillText(node.label, node.x, labelY);
        }
      }
    };

    frame = requestAnimationFrame(draw);

    // Pause when tab hidden
    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else frame = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [showLabels]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden="true"
    />
  );
}
