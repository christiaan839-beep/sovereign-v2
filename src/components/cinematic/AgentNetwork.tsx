"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, useInView } from "framer-motion";

/**
 * AgentNetwork — Cinematic real-time visualization of agents communicating.
 * Renders a canvas with glowing nodes (agents) and animated connection lines.
 * Nodes pulse when "active" and connections light up to show data flow.
 */

interface Node {
  x: number;
  y: number;
  label: string;
  category: "sales" | "content" | "intel" | "code" | "voice" | "safety";
  radius: number;
  pulsePhase: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  sales: "16, 185, 129",    // emerald
  content: "52, 211, 153",  // green
  intel: "0, 183, 255",     // cyan
  code: "168, 85, 247",     // purple
  voice: "245, 158, 11",    // amber
  safety: "244, 63, 94",    // rose
};

const AGENTS: Array<{ label: string; category: Node["category"] }> = [
  { label: "Lead Gen", category: "sales" },
  { label: "Email Sequence", category: "sales" },
  { label: "Voice Closer", category: "voice" },
  { label: "Blog Writer", category: "content" },
  { label: "SEO Audit", category: "content" },
  { label: "Market Analyst", category: "intel" },
  { label: "Competitor Watch", category: "intel" },
  { label: "Code Agent", category: "code" },
  { label: "Smart Router", category: "safety" },
  { label: "NeMo Guard", category: "safety" },
  { label: "God Brain", category: "intel" },
  { label: "Page Builder", category: "code" },
];

export function AgentNetwork() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isInView = useInView(containerRef, { once: false, margin: "-100px" });
  const [activeConnection, setActiveConnection] = useState<number>(0);
  const animRef = useRef<number>(0);

  // Generate stable node positions using golden angle distribution
  const nodes = useMemo<Node[]>(() => {
    const centerX = 0.5;
    const centerY = 0.5;
    return AGENTS.map((agent, i) => {
      const angle = (i * 2.399963) + 0.5; // golden angle in radians
      const radius = 0.15 + (i / AGENTS.length) * 0.28;
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        label: agent.label,
        category: agent.category,
        radius: agent.label === "God Brain" || agent.label === "Smart Router" ? 6 : 4,
        pulsePhase: i * 0.5,
      };
    });
  }, []);

  // Cycle active connections
  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setActiveConnection((prev) => (prev + 1) % nodes.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isInView, nodes.length]);

  // Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !isInView) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };
    resize();

    let time = 0;
    const draw = () => {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, w, h);
      time += 0.016;

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = (a.x - b.x) * w;
          const dy = (a.y - b.y) * h;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < w * 0.35) {
            const isActive = i === activeConnection || j === activeConnection;
            const baseAlpha = isActive ? 0.15 : 0.03;
            const color = CATEGORY_COLORS[a.category];

            ctx.beginPath();
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.strokeStyle = `rgba(${color}, ${baseAlpha})`;
            ctx.lineWidth = isActive ? 1.5 : 0.5;
            ctx.stroke();

            // Animated data packet on active connections
            if (isActive) {
              const progress = (time * 0.5) % 1;
              const px = a.x * w + (b.x * w - a.x * w) * progress;
              const py = a.y * h + (b.y * h - a.y * h) * progress;
              ctx.beginPath();
              ctx.arc(px, py, 2, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(${color}, 0.8)`;
              ctx.fill();
            }
          }
        }
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isActive = i === activeConnection;
        const color = CATEGORY_COLORS[node.category];
        const pulse = Math.sin(time * 2 + node.pulsePhase) * 0.5 + 0.5;
        const r = node.radius + (isActive ? pulse * 3 : 0);

        // Glow
        if (isActive) {
          const gradient = ctx.createRadialGradient(
            node.x * w, node.y * h, 0,
            node.x * w, node.y * h, r * 6
          );
          gradient.addColorStop(0, `rgba(${color}, 0.15)`);
          gradient.addColorStop(1, `rgba(${color}, 0)`);
          ctx.beginPath();
          ctx.arc(node.x * w, node.y * h, r * 6, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Core
        ctx.beginPath();
        ctx.arc(node.x * w, node.y * h, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${isActive ? 0.9 : 0.4})`;
        ctx.fill();

        // Label
        if (isActive) {
          ctx.font = "10px system-ui, sans-serif";
          ctx.fillStyle = `rgba(255, 255, 255, 0.7)`;
          ctx.textAlign = "center";
          ctx.fillText(node.label, node.x * w, node.y * h - r - 8);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isInView, nodes, activeConnection]);

  return (
    <div ref={containerRef} className="relative w-full aspect-square max-w-lg mx-auto">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* Central label */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ delay: 0.3 }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="text-center">
          <div className="text-3xl font-black text-white/10">130+</div>
          <div className="text-[9px] text-neutral-600 uppercase tracking-widest">Agents Active</div>
        </div>
      </motion.div>
    </div>
  );
}
