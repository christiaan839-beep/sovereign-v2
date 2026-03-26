"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * AgentOffice — A living pixel-art digital world where Claude-style robots
 * wander, think, talk, work, and interact autonomously.
 *
 * Inspired by: Claude Code's pixel mascot + Tamagotchi + terminal aesthetic
 *
 * Features:
 * - 8 pixel-art robots that wander autonomously
 * - Proximity detection — agents talk when near each other
 * - Walking animation (2-frame leg cycle)
 * - Thinking state with thought bubbles
 * - Speech bubbles with typewriter text
 * - Retro CRT scanline overlay
 * - Desks, monitors, server racks as landmarks
 * - Data particles flowing between agents
 * - Click to drop a "task" that agents swarm toward
 */

// ─── Constants ──────────────────────────────────────────

const WORLD_W = 800;
const WORLD_H = 340;
const PROXIMITY = 60;
const MOVE_SPEED = 0.4;
const PX = 3; // pixel scale

// ─── Agent Data ─────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  dark: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: "walking" | "idle" | "thinking" | "talking" | "working";
  msg: string;
  walkFrame: number;
  facingRight: boolean;
  stateTimer: number;
}

const AGENT_DEFS = [
  { id: "brain",   name: "God Brain",      role: "Strategy",      color: "#EC4899", dark: "#9D174D" },
  { id: "hunter",  name: "Lead Hunter",    role: "Sales",         color: "#10B981", dark: "#047857" },
  { id: "writer",  name: "Content",        role: "Marketing",     color: "#06B6D4", dark: "#0E7490" },
  { id: "coder",   name: "Code Agent",     role: "Engineering",   color: "#A855F7", dark: "#6B21A8" },
  { id: "closer",  name: "Voice Closer",   role: "Sales Calls",   color: "#EF4444", dark: "#991B1B" },
  { id: "router",  name: "Smart Router",   role: "Infrastructure",color: "#14B8A6", dark: "#0F766E" },
  { id: "guard",   name: "Guardrails",     role: "Security",      color: "#6366F1", dark: "#3730A3" },
  { id: "seo",     name: "SEO Dom",        role: "Growth",        color: "#F59E0B", dark: "#92400E" },
];

const PHRASES: Record<string, string[]> = {
  brain:  ["Synthesizing...", "Planning strategy", "Routing to Nemotron"],
  hunter: ["53 leads found!", "Scanning LinkedIn", "Hot lead detected"],
  writer: ["4.2% AI score ✓", "Blog draft done", "Anti-slop: passed"],
  coder:  ["Building page...", "Code review done", "Deploying now"],
  closer: ["Booking meeting", "Call connected", "Lead qualified"],
  router: ["1,247 routed", "$0 cost today", "Model: Nemotron"],
  guard:  ["0 threats", "PII scan clean", "Jailbreak blocked"],
  seo:    ["312 gaps found", "Rank #1 target", "Schema added"],
};

const CONVOS = [
  { a: "hunter", b: "closer", msgA: "53 leads ready", msgB: "Starting calls" },
  { a: "writer", b: "seo",    msgA: "Draft done", msgB: "Adding keywords" },
  { a: "brain",  b: "router", msgA: "Use Nemotron", msgB: "Routing now" },
  { a: "coder",  b: "guard",  msgA: "Page ready", msgB: "PII scan clean" },
];

// ─── Pixel Bot SVG ──────────────────────────────────────

function PixelBot({
  color, dark, walkFrame, facingRight, state, size = 1,
}: {
  color: string; dark: string; walkFrame: number; facingRight: boolean;
  state: Agent["state"]; size?: number;
}) {
  const s = PX * size;
  const w = 8 * s;
  const h = 11 * s;
  const flip = facingRight ? "" : `translate(${w}, 0) scale(-1, 1)`;
  const legOffset = walkFrame % 2 === 0;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${8 * s} ${11 * s}`}
      style={{ imageRendering: "pixelated", overflow: "visible" }}>
      <g transform={flip}>
        {/* Head */}
        <rect x={1*s} y={0} width={6*s} height={5*s} rx={s/2} fill={color} />
        {/* Head highlight */}
        <rect x={2*s} y={s*0.5} width={4*s} height={s} fill="white" opacity="0.15" rx={s/3} />
        {/* Eyes */}
        <rect x={2*s} y={2*s} width={s} height={state === "thinking" ? s*0.3 : s*1.2} fill="white" rx={s/4} />
        <rect x={5*s} y={2*s} width={s} height={state === "thinking" ? s*0.3 : s*1.2} fill="white" rx={s/4} />
        {/* Pupils */}
        {state !== "thinking" && (
          <>
            <rect x={2.3*s} y={2.4*s} width={s*0.5} height={s*0.5} fill={dark} rx={s/6} />
            <rect x={5.3*s} y={2.4*s} width={s*0.5} height={s*0.5} fill={dark} rx={s/6} />
          </>
        )}
        {/* Mouth */}
        {state === "talking" ? (
          <rect x={3*s} y={3.8*s} width={2*s} height={s*0.8} rx={s/4} fill={dark} />
        ) : (
          <rect x={3*s} y={3.8*s} width={2*s} height={s*0.4} rx={s/4} fill={dark} opacity="0.4" />
        )}

        {/* Body */}
        <rect x={1*s} y={5*s} width={6*s} height={4*s} rx={s/2} fill={color} />
        <rect x={2*s} y={5.5*s} width={4*s} height={s} fill="white" opacity="0.08" rx={s/3} />

        {/* Left arm */}
        <motion.rect
          x={0} y={5.5*s} width={s} height={3*s} rx={s/3} fill={color}
          style={{ transformOrigin: `${s/2}px ${5.5*s}px` }}
          animate={
            state === "working" ? { rotate: [-20, -35, -20] } :
            state === "walking" ? { rotate: [10, -10] } :
            state === "talking" ? { rotate: [-10, -25, -10] } :
            { rotate: [0, 3, 0] }
          }
          transition={
            state === "working" ? { duration: 0.3, repeat: Infinity } :
            state === "walking" ? { duration: 0.25, repeat: Infinity, repeatType: "reverse" } :
            state === "talking" ? { duration: 0.6, repeat: Infinity } :
            { duration: 2, repeat: Infinity }
          }
        />
        {/* Right arm */}
        <motion.rect
          x={7*s} y={5.5*s} width={s} height={3*s} rx={s/3} fill={color}
          style={{ transformOrigin: `${7*s + s/2}px ${5.5*s}px` }}
          animate={
            state === "working" ? { rotate: [20, 35, 20] } :
            state === "walking" ? { rotate: [-10, 10] } :
            { rotate: [0, -3, 0] }
          }
          transition={
            state === "working" ? { duration: 0.35, repeat: Infinity } :
            state === "walking" ? { duration: 0.25, repeat: Infinity, repeatType: "reverse" } :
            { duration: 2, repeat: Infinity, delay: 0.3 }
          }
        />

        {/* Legs — 2-frame walk cycle */}
        <rect x={2*s} y={9*s} width={s*1.2} height={2*s} rx={s/3}
          fill={dark} transform={state === "walking" && legOffset ? `rotate(10, ${2.6*s}, ${9*s})` : ""} />
        <rect x={5*s} y={9*s} width={s*1.2} height={2*s} rx={s/3}
          fill={dark} transform={state === "walking" && !legOffset ? `rotate(-10, ${5.6*s}, ${9*s})` : ""} />
      </g>
    </svg>
  );
}

// ─── Speech Bubble ──────────────────────────────────────

function SpeechBubble({ text, color }: { text: string; color: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-30"
    >
      <div className="px-2 py-1 rounded text-[8px] font-mono font-bold border shadow-lg"
        style={{
          backgroundColor: "#0a0a0f",
          borderColor: color + "40",
          color: color,
          boxShadow: `0 0 10px ${color}20`,
        }}
      >
        {displayed}<span className="animate-pulse">▋</span>
      </div>
      {/* Bubble tail */}
      <div className="w-0 h-0 mx-auto" style={{
        borderLeft: "4px solid transparent",
        borderRight: "4px solid transparent",
        borderTop: `4px solid ${color}40`,
      }} />
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function AgentOffice() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [clickTask, setClickTask] = useState<{ x: number; y: number } | null>(null);
  const frameRef = useRef(0);
  const worldRef = useRef<HTMLDivElement>(null);

  // Initialize agents at random positions
  useEffect(() => {
    const initial: Agent[] = AGENT_DEFS.map((def, i) => ({
      ...def,
      x: 80 + (i % 4) * 170 + Math.random() * 40,
      y: 60 + Math.floor(i / 4) * 120 + Math.random() * 40,
      targetX: Math.random() * (WORLD_W - 100) + 50,
      targetY: Math.random() * (WORLD_H - 100) + 50,
      state: "idle" as const,
      msg: "",
      walkFrame: 0,
      facingRight: Math.random() > 0.5,
      stateTimer: Math.random() * 100,
    }));
    setAgents(initial);
  }, []);

  // Game loop — move agents, check proximity, trigger conversations
  useEffect(() => {
    const loop = setInterval(() => {
      frameRef.current++;
      const frame = frameRef.current;

      setAgents(prev => prev.map(agent => {
        let { x, y, targetX, targetY, state, msg, walkFrame, facingRight, stateTimer } = agent;
        stateTimer--;

        // Handle click task — swarm toward it
        if (clickTask && state !== "talking") {
          targetX = clickTask.x + (Math.random() - 0.5) * 40;
          targetY = clickTask.y + (Math.random() - 0.5) * 40;
        }

        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // At target — pick new state
        if (dist < 15 && state === "walking") {
          const roll = Math.random();
          if (roll < 0.3) {
            state = "thinking";
            stateTimer = 80 + Math.random() * 60;
          } else if (roll < 0.5) {
            state = "working";
            stateTimer = 100 + Math.random() * 80;
            msg = PHRASES[agent.id]?.[Math.floor(Math.random() * 3)] || "";
          } else {
            state = "idle";
            stateTimer = 40 + Math.random() * 30;
          }
        }

        // Timer expired — go somewhere new
        if (stateTimer <= 0 && state !== "talking") {
          state = "walking";
          targetX = Math.random() * (WORLD_W - 120) + 60;
          targetY = Math.random() * (WORLD_H - 80) + 40;
          stateTimer = 200 + Math.random() * 100;
          msg = "";
        }

        // Move toward target
        if (state === "walking" && dist > 5) {
          x += dx * MOVE_SPEED / Math.max(dist, 1) * 2;
          y += dy * MOVE_SPEED / Math.max(dist, 1) * 2;
          facingRight = dx > 0;
          if (frame % 8 === 0) walkFrame++;
        }

        // Proximity conversations
        if (frame % 120 === 0 && state !== "talking") {
          const convo = CONVOS.find(c =>
            (c.a === agent.id || c.b === agent.id) &&
            prev.some(other =>
              other.id !== agent.id &&
              (c.a === other.id || c.b === other.id) &&
              Math.abs(other.x - x) < PROXIMITY &&
              Math.abs(other.y - y) < PROXIMITY
            )
          );
          if (convo) {
            state = "talking";
            msg = convo.a === agent.id ? convo.msgA : convo.msgB;
            stateTimer = 80;
          }
        }

        // Boundary clamp
        x = Math.max(20, Math.min(WORLD_W - 40, x));
        y = Math.max(20, Math.min(WORLD_H - 60, y));

        return { ...agent, x, y, targetX, targetY, state, msg, walkFrame, facingRight, stateTimer };
      }));
    }, 50);

    return () => clearInterval(loop);
  }, [clickTask]);

  // Clear click task after agents reach it
  useEffect(() => {
    if (clickTask) {
      const timer = setTimeout(() => setClickTask(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [clickTask]);

  const handleWorldClick = useCallback((e: React.MouseEvent) => {
    if (!worldRef.current) return;
    const rect = worldRef.current.getBoundingClientRect();
    const scaleX = WORLD_W / rect.width;
    const scaleY = WORLD_H / rect.height;
    setClickTask({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
  }, []);

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-8"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-3">Inside the Matrix</p>
        <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-3">Your agents are working.</h2>
        <p className="text-neutral-500 max-w-md mx-auto text-sm">Click anywhere to assign a task. Watch them swarm.</p>
      </motion.div>

      <div
        ref={worldRef}
        onClick={handleWorldClick}
        className="relative rounded-3xl border border-white/[0.06] bg-[#08080f] overflow-hidden cursor-crosshair"
        style={{ aspectRatio: `${WORLD_W}/${WORLD_H}` }}
      >
        {/* CRT Scanline overlay */}
        <div className="absolute inset-0 pointer-events-none z-20" style={{
          background: "linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.15) 50%)",
          backgroundSize: "100% 4px",
        }} />

        {/* Grid floor */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `
            linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "30px 30px",
        }} />

        {/* Click task beacon */}
        <AnimatePresence>
          {clickTask && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0.3, 0.8] }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute w-4 h-4 rounded-full bg-emerald-500/30 border border-emerald-500/50 z-10"
              style={{
                left: `${(clickTask.x / WORLD_W) * 100}%`,
                top: `${(clickTask.y / WORLD_H) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Data particles */}
        {[0, 1, 2].map(i => (
          <motion.div
            key={`p-${i}`}
            className="absolute w-1 h-1 rounded-full bg-emerald-500/40 z-10"
            animate={{
              left: [`${10 + i * 20}%`, `${70 + i * 10}%`],
              top: [`${30 + i * 15}%`, `${60 - i * 10}%`],
              opacity: [0, 0.6, 0],
            }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: i * 1.5, ease: "linear" }}
          />
        ))}

        {/* Agents */}
        {agents.map(agent => (
          <div
            key={agent.id}
            className="absolute z-10 transition-none"
            style={{
              left: `${(agent.x / WORLD_W) * 100}%`,
              top: `${(agent.y / WORLD_H) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {/* Speech bubble */}
            <AnimatePresence>
              {agent.msg && (agent.state === "talking" || agent.state === "working") && (
                <SpeechBubble text={agent.msg} color={agent.color} />
              )}
            </AnimatePresence>

            {/* Thinking dots */}
            {agent.state === "thinking" && (
              <motion.div
                className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-1 z-30"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: agent.color }} />
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: agent.color, opacity: 0.6 }} />
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color, opacity: 0.3 }} />
              </motion.div>
            )}

            {/* The robot */}
            <PixelBot
              color={agent.color}
              dark={agent.dark}
              walkFrame={agent.walkFrame}
              facingRight={agent.facingRight}
              state={agent.state}
            />

            {/* Name tag */}
            <div className="text-center mt-0.5">
              <span className="text-[7px] font-mono font-bold uppercase tracking-wider" style={{ color: agent.color + "80" }}>
                {agent.name}
              </span>
            </div>
          </div>
        ))}

        {/* Status bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-[#08080f]/80 backdrop-blur-sm border-t border-white/[0.04] z-20">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[8px] text-emerald-400/70 font-mono uppercase tracking-widest">8 agents online</span>
          </div>
          <span className="text-[8px] text-neutral-600 font-mono">click to assign task</span>
          <span className="text-[8px] text-neutral-600 font-mono">$0 inference</span>
        </div>
      </div>
    </div>
  );
}
