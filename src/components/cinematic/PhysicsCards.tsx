"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Target, FileText, Search, Mic, Code2, Shield, Zap, Brain } from "lucide-react";

/**
 * PhysicsCards — Antigravity-style floating agent cards with drag physics.
 *
 * Cards float in zero-gravity, gently drifting. You can GRAB them with
 * your mouse and FLING them — they bounce off walls and each other.
 *
 * Technical:
 * - Custom 2D physics engine (no Matter.js dependency)
 * - AABB collision detection between cards
 * - Velocity-based momentum on release (grab + throw)
 * - Spring-return to original positions after 5s of no interaction
 * - Auto-disables on mobile (falls back to static grid)
 */

interface PhysicsBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rotation: number;
  rotationV: number;
  originX: number;
  originY: number;
  dragging: boolean;
  lastInteraction: number;
}

interface CardDef {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  metric: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const AGENT_CARDS: CardDef[] = [
  { icon: Target, label: "Lead Agent", metric: "47 leads found", color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20" },
  { icon: FileText, label: "Content Writer", metric: "1,487 words", color: "text-cyan-400", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/20" },
  { icon: Search, label: "SEO Analyst", metric: "Score: 94/100", color: "text-violet-400", bgColor: "bg-violet-500/10", borderColor: "border-violet-500/20" },
  { icon: Mic, label: "Voice Caller", metric: "3 meetings set", color: "text-pink-400", bgColor: "bg-pink-500/10", borderColor: "border-pink-500/20" },
  { icon: Code2, label: "Code Agent", metric: "PR merged", color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" },
  { icon: Shield, label: "Security", metric: "5-layer verified", color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20" },
  { icon: Zap, label: "Ad Optimizer", metric: "ROAS: 4.2x", color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20" },
  { icon: Brain, label: "War Room", metric: "3 models debated", color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20" },
];

// Live status messages — cards cycle through these to feel ALIVE
const LIVE_STATUSES = [
  "scanning...", "working", "analyzing", "executing", "processing", "verifying", "done ✓", "idle",
];

const CARD_W = 160;
const CARD_H = 80;

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768 || "ontouchstart" in window);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

export function PhysicsCards({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodiesRef = useRef<PhysicsBody[]>([]);
  const dragIndexRef = useRef<number>(-1);
  const mouseRef = useRef({ x: 0, y: 0, prevX: 0, prevY: 0 });
  const frameRef = useRef<number>(0);
  const [, forceRender] = useState(0);
  const isMobile = useIsMobile();
  const initializedRef = useRef(false);

  // Initialize physics bodies in a scattered layout
  const initBodies = useCallback(() => {
    const container = containerRef.current;
    if (!container || initializedRef.current) return;
    initializedRef.current = true;

    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    const padding = 20;

    // Arrange cards in a loose scatter around center
    const positions = AGENT_CARDS.map((_, i) => {
      const cols = 4;
      const rows = Math.ceil(AGENT_CARDS.length / cols);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const spacingX = (cw - padding * 2) / cols;
      const spacingY = (ch - padding * 2) / rows;
      return {
        x: padding + col * spacingX + spacingX / 2 - CARD_W / 2 + (Math.random() - 0.5) * 40,
        y: padding + row * spacingY + spacingY / 2 - CARD_H / 2 + (Math.random() - 0.5) * 30,
      };
    });

    bodiesRef.current = positions.map((pos) => ({
      x: pos.x,
      y: pos.y,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      w: CARD_W,
      h: CARD_H,
      rotation: (Math.random() - 0.5) * 6,
      rotationV: (Math.random() - 0.5) * 0.1,
      originX: pos.x,
      originY: pos.y,
      dragging: false,
      lastInteraction: 0,
    }));
  }, []);

  // Physics simulation
  useEffect(() => {
    if (isMobile) return;
    initBodies();

    const step = () => {
      const container = containerRef.current;
      if (!container) { frameRef.current = requestAnimationFrame(step); return; }

      const cw = container.offsetWidth;
      const ch = container.offsetHeight;
      const now = Date.now();
      const bodies = bodiesRef.current;

      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.dragging) continue;

        // Zero-gravity drift
        b.x += b.vx;
        b.y += b.vy;
        b.rotation += b.rotationV;

        // Damping
        b.vx *= 0.997;
        b.vy *= 0.997;
        b.rotationV *= 0.995;

        // Gentle return to origin after 5s of no interaction
        const timeSinceInteraction = now - b.lastInteraction;
        if (timeSinceInteraction > 5000) {
          const returnStrength = 0.0005 * Math.min(1, (timeSinceInteraction - 5000) / 3000);
          b.vx += (b.originX - b.x) * returnStrength;
          b.vy += (b.originY - b.y) * returnStrength;
          b.rotationV += (0 - b.rotation) * 0.001;
        }

        // Wall bounce
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * 0.6; b.rotationV += 0.3; }
        if (b.x + b.w > cw) { b.x = cw - b.w; b.vx = -Math.abs(b.vx) * 0.6; b.rotationV -= 0.3; }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * 0.6; b.rotationV -= 0.2; }
        if (b.y + b.h > ch) { b.y = ch - b.h; b.vy = -Math.abs(b.vy) * 0.6; b.rotationV += 0.2; }

        // Card-to-card collision (AABB)
        for (let j = i + 1; j < bodies.length; j++) {
          const o = bodies[j];
          if (o.dragging) continue;

          const overlapX = Math.min(b.x + b.w, o.x + o.w) - Math.max(b.x, o.x);
          const overlapY = Math.min(b.y + b.h, o.y + o.h) - Math.max(b.y, o.y);

          if (overlapX > 0 && overlapY > 0) {
            // Resolve collision
            const pushX = overlapX < overlapY;
            if (pushX) {
              const sign = b.x < o.x ? -1 : 1;
              b.x += sign * overlapX * 0.5;
              o.x -= sign * overlapX * 0.5;
              // Exchange velocities with energy loss
              const tmpVx = b.vx;
              b.vx = o.vx * 0.7;
              o.vx = tmpVx * 0.7;
              b.rotationV += (Math.random() - 0.5) * 0.5;
              o.rotationV += (Math.random() - 0.5) * 0.5;
            } else {
              const sign = b.y < o.y ? -1 : 1;
              b.y += sign * overlapY * 0.5;
              o.y -= sign * overlapY * 0.5;
              const tmpVy = b.vy;
              b.vy = o.vy * 0.7;
              o.vy = tmpVy * 0.7;
              b.rotationV += (Math.random() - 0.5) * 0.5;
              o.rotationV += (Math.random() - 0.5) * 0.5;
            }
          }
        }
      }

      forceRender((v) => v + 1);
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isMobile, initBodies]);

  // Mouse handlers
  const handleMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const b = bodiesRef.current[index];
    if (!b) return;
    b.dragging = true;
    b.lastInteraction = Date.now();
    dragIndexRef.current = index;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        prevX: e.clientX - rect.left,
        prevY: e.clientY - rect.top,
      };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const idx = dragIndexRef.current;
    if (idx < 0) return;
    const b = bodiesRef.current[idx];
    if (!b) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    mouseRef.current.prevX = mouseRef.current.x;
    mouseRef.current.prevY = mouseRef.current.y;
    mouseRef.current.x = mx;
    mouseRef.current.y = my;

    b.x = mx - b.w / 2;
    b.y = my - b.h / 2;
    b.lastInteraction = Date.now();
  }, []);

  const handleMouseUp = useCallback(() => {
    const idx = dragIndexRef.current;
    if (idx < 0) return;
    const b = bodiesRef.current[idx];
    if (!b) return;

    // Apply fling velocity from mouse movement
    b.vx = (mouseRef.current.x - mouseRef.current.prevX) * 0.8;
    b.vy = (mouseRef.current.y - mouseRef.current.prevY) * 0.8;
    b.rotationV = b.vx * 0.15;
    b.dragging = false;
    b.lastInteraction = Date.now();
    dragIndexRef.current = -1;
  }, []);

  // Mobile fallback — static grid
  if (isMobile) {
    return (
      <div className={`grid grid-cols-2 gap-2 px-4 ${className}`}>
        {AGENT_CARDS.slice(0, 4).map((card) => (
          <div key={card.label} className={`p-3 rounded-xl border ${card.borderColor} ${card.bgColor} backdrop-blur-sm`}>
            <card.icon className={`w-4 h-4 ${card.color} mb-1`} />
            <div className="text-[11px] font-semibold text-white">{card.label}</div>
            <div className="text-[9px] text-neutral-500">{card.metric}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full select-none ${className}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: dragIndexRef.current >= 0 ? "grabbing" : "default" }}
    >
      {bodiesRef.current.map((body, i) => {
        const card = AGENT_CARDS[i];
        if (!card) return null;
        // Each card gets a cycling status based on time + index offset
        const statusIdx = Math.floor(Date.now() / 3000 + i * 1.7) % LIVE_STATUSES.length;
        const status = LIVE_STATUSES[statusIdx];
        const isActive = status !== "idle" && status !== "done ✓";
        return (
          <div
            key={card.label}
            onMouseDown={(e) => handleMouseDown(i, e)}
            className={`absolute rounded-xl border ${card.borderColor} ${card.bgColor} px-4 py-3 cursor-grab active:cursor-grabbing transition-shadow duration-200 hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]`}
            style={{
              width: CARD_W,
              height: CARD_H,
              left: body.x,
              top: body.y,
              transform: `rotate(${body.rotation}deg) translateZ(0)`,
              zIndex: body.dragging ? 50 : 10,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              {/* Live status dot */}
              <span className="relative flex h-2 w-2 shrink-0">
                {isActive && <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-40" />}
                <span className={`relative rounded-full h-2 w-2 ${isActive ? "bg-emerald-400" : "bg-neutral-600"}`} />
              </span>
              <span className="text-[11px] font-semibold text-white truncate">{card.label}</span>
            </div>
            <div className="text-[10px] text-neutral-400 font-mono">{card.metric}</div>
            {body.dragging && (
              <div className="absolute -inset-[1px] rounded-xl border-2 border-emerald-400/40 pointer-events-none" />
            )}
          </div>
        );
      })}

      {/* Instruction hint */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-neutral-600 pointer-events-none animate-pulse">
        grab a card and fling it
      </div>
    </div>
  );
}
