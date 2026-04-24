"use client";

import { useEffect, useRef, useState } from "react";
import { sigilPalette } from "@/lib/agent-sigil";

/**
 * Constellation — the interactive 137-node canvas at the heart of /world.
 *
 * Departs from landing's ConstellationField in three ways:
 *   1. Nodes are clickable — click hit-tests against nearest node within 18px.
 *   2. Node size encodes activity: radius = 3 + log(runs30d + 1) * 1.5.
 *   3. Nodes cluster by category — each category gets a seed center, nodes
 *      gravitate weakly toward it. This gives 8 visible "arms" without
 *      hard partitioning.
 *
 * Gracefully no-ops when the canvas context isn't available (SSR, old
 * browsers, reduced-motion preference).
 */

const CU = { r: 181, g: 83, b: 44 } as const;
const LINE_DIST = 140;
const HOVER_RADIUS = 18;

/**
 * Convert a hex color to an {r,g,b} triple. Used to paint each node in
 * its category's sigil palette color, so the constellation becomes a
 * category-taxonomy visualization instead of a monochrome copper field.
 * Falls back to copper on parse failure.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return CU;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * Memo cache for category → rgb. There are only ~17 categories; this
 * keeps the per-frame `sigilPalette` lookup from re-parsing a hex on
 * every one of 218 nodes at 60fps.
 */
const rgbCache = new Map<string, { r: number; g: number; b: number }>();
function rgbForCategory(category: string): { r: number; g: number; b: number } {
  let hit = rgbCache.get(category);
  if (!hit) {
    hit = hexToRgb(sigilPalette(category).fg);
    rgbCache.set(category, hit);
  }
  return hit;
}

/** Per-category rgba formatter — drop-in for `cu()` below. */
function catRgba(category: string, alpha: number): string {
  const c = rgbForCategory(category);
  return `rgba(${c.r},${c.g},${c.b},${alpha.toFixed(3)})`;
}
const CATEGORY_SEEDS: Record<string, [number, number]> = {
  content: [0.2, 0.25],
  leads: [0.75, 0.2],
  intelligence: [0.3, 0.6],
  voice: [0.55, 0.38],
  safety: [0.82, 0.68],
  creative: [0.15, 0.78],
  engineering: [0.62, 0.82],
  finance: [0.85, 0.42],
  social: [0.4, 0.85],
  analysis: [0.48, 0.18],
  general: [0.5, 0.5],
};

function cu(alpha: number): string {
  return `rgba(${CU.r},${CU.g},${CU.b},${alpha.toFixed(3)})`;
}

export interface ConstellationAgent {
  slug: string;
  displayName: string;
  category: string;
  runs30d: number;
  featured: boolean;
  verified: boolean;
}

interface Node extends ConstellationAgent {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
}

interface Props {
  agents: ConstellationAgent[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onHover?: (slug: string | null) => void;
}

export function Constellation({ agents, selectedSlug, onSelect, onHover }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const [cursor, setCursor] = useState<"default" | "pointer">("default");

  // Re-seed nodes whenever the agent list changes (usually once).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const W = rect.width || window.innerWidth;
    const H = rect.height || window.innerHeight;

    nodesRef.current = agents.map((a) => {
      const seed = CATEGORY_SEEDS[a.category] ?? CATEGORY_SEEDS.general;
      const jitter = 0.18;
      const cx = (seed[0] + (Math.random() - 0.5) * jitter) * W;
      const cy = (seed[1] + (Math.random() - 0.5) * jitter) * H;
      return {
        ...a,
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 3 + Math.log(a.runs30d + 1) * 1.4,
        phase: Math.random() * Math.PI * 2,
      };
    });
  }, [agents]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width || window.innerWidth;
      H = rect.height || window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      const nodes = nodesRef.current;
      // Soft drift
      for (const n of nodes) {
        if (!prefersReduced) {
          n.x += n.vx;
          n.y += n.vy;
          // Weak gravity toward category seed (keeps clusters)
          const seed = CATEGORY_SEEDS[n.category] ?? CATEGORY_SEEDS.general;
          const tx = seed[0] * W;
          const ty = seed[1] * H;
          n.vx += (tx - n.x) * 0.00004;
          n.vy += (ty - n.y) * 0.00004;
          // Damping
          n.vx *= 0.985;
          n.vy *= 0.985;
          // Bounds
          if (n.x < 0 || n.x > W) n.vx *= -1;
          if (n.y < 0 || n.y > H) n.vy *= -1;
          n.phase += 0.02;
        }
      }

      // Lines (proximity)
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINE_DIST * LINE_DIST) continue;
          const d = Math.sqrt(d2);
          const alpha = 0.18 * (1 - d / LINE_DIST);
          ctx.strokeStyle = cu(alpha);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Nodes — each painted in its category palette color so the
      // constellation reads as a taxonomy at a glance. Copper only
      // remains for the selected node (signal: "this is the chosen one")
      // and the proximity lines above.
      ctx.globalCompositeOperation = "source-over";
      for (const n of nodes) {
        const pulse = prefersReduced ? 0 : Math.sin(n.phase) * 0.15;
        const r = n.radius * (1 + pulse);
        const isSelected = n.slug === selectedSlug;
        const isFeatured = n.featured;

        // Glow — use category color, brighter on selection + featured
        if (isSelected || isFeatured) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2);
          ctx.fillStyle = catRgba(n.category, isSelected ? 0.22 : 0.1);
          ctx.fill();
        }

        // Body — category color replaces monochrome copper. Selected
        // node gets the warm cream accent (#E8DDD0) as before so it
        // still pops out of its category cluster.
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? "#E8DDD0"
          : catRgba(n.category, isFeatured ? 1.0 : 0.8);
        ctx.fill();

        // Verified ring — thin category-color halo
        if (n.verified) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = catRgba(n.category, 0.6);
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    // Hit-test on move → cursor + onHover
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const hit = hitTest(mouseRef.current.x, mouseRef.current.y, nodesRef.current);
      setCursor(hit ? "pointer" : "default");
      onHover?.(hit?.slug ?? null);
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top, nodesRef.current);
      if (hit) onSelect(hit.slug);
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
      cancelAnimationFrame(rafRef.current);
    };
  }, [selectedSlug, onSelect, onHover]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ cursor }}
      aria-hidden="true"
    />
  );
}

function hitTest(mx: number, my: number, nodes: Node[]): Node | null {
  let best: Node | null = null;
  let bestDist = HOVER_RADIUS * HOVER_RADIUS;
  for (const n of nodes) {
    const dx = n.x - mx;
    const dy = n.y - my;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      best = n;
    }
  }
  return best;
}
