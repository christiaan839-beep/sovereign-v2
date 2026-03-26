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
  color, dark, walkFrame, facingRight, state,
}: {
  color: string; dark: string; walkFrame: number; facingRight: boolean;
  state: Agent["state"];
}) {
  /*
   * TRUE pixel art — no gradients, no glow, no shine.
   * Drawn on a 16x16 grid using only rectangles.
   * Matches Claude Code's mascot: flat, blocky, charming.
   * Scaled up with image-rendering: pixelated for crisp edges.
   */
  const p = 2; // pixel unit size
  const legKickL = state === "walking" && walkFrame % 2 === 0;
  const legKickR = state === "walking" && walkFrame % 2 !== 0;

  return (
    <svg
      width={40} height={40}
      viewBox="0 0 32 32"
      className="select-none"
      style={{
        imageRendering: "pixelated",
        overflow: "visible",
        transform: facingRight ? "" : "scaleX(-1)",
      }}
    >
      {/* ══ BODY — one solid blocky rectangle ══ */}
      <rect x={6*p} y={3*p} width={8*p} height={7*p} rx={p} fill={color} />

      {/* ══ EYES — simple 2x2 pixel squares ══ */}
      {state === "thinking" ? (
        <>
          <rect x={8*p} y={5*p} width={2*p} height={p*0.5} fill="#111" />
          <rect x={12*p} y={5*p} width={2*p} height={p*0.5} fill="#111" />
        </>
      ) : (
        <>
          <rect x={8*p} y={4*p} width={p*1.5} height={2*p} fill="#111" />
          <rect x={12*p} y={4*p} width={p*1.5} height={2*p} fill="#111" />
          {/* Tiny white pixel highlight in each eye */}
          <rect x={8*p} y={4*p} width={p*0.5} height={p*0.5} fill="white" opacity="0.6" />
          <rect x={12*p} y={4*p} width={p*0.5} height={p*0.5} fill="white" opacity="0.6" />
        </>
      )}

      {/* ══ MOUTH ══ */}
      {state === "talking" ? (
        <motion.rect x={10*p} y={7*p} width={2*p} rx={p*0.3} fill="#111"
          animate={{ height: [p*0.5, p*1.5, p*0.5] }}
          transition={{ duration: 0.25, repeat: Infinity }}
        />
      ) : (
        <rect x={10*p} y={7*p} width={2*p} height={p*0.5} fill="#111" opacity="0.3" />
      )}

      {/* ══ ARMS — short pixel stubs ══ */}
      <motion.rect
        x={4*p} y={5*p} width={2*p} height={4*p} rx={p*0.5} fill={color}
        style={{ transformOrigin: `${5*p}px ${5*p}px` }}
        animate={
          state === "working" ? { rotate: [-12, -25, -12] } :
          state === "walking" ? { rotate: [8, -8] } :
          state === "talking" ? { rotate: [-5, -18, -5] } :
          { rotate: [0, 2, 0] }
        }
        transition={
          state === "working" ? { duration: 0.25, repeat: Infinity } :
          state === "walking" ? { duration: 0.2, repeat: Infinity, repeatType: "reverse" } :
          state === "talking" ? { duration: 0.4, repeat: Infinity } :
          { duration: 3, repeat: Infinity }
        }
      />
      <motion.rect
        x={14*p} y={5*p} width={2*p} height={4*p} rx={p*0.5} fill={color}
        style={{ transformOrigin: `${15*p}px ${5*p}px` }}
        animate={
          state === "working" ? { rotate: [12, 25, 12] } :
          state === "walking" ? { rotate: [-8, 8] } :
          { rotate: [0, -2, 0] }
        }
        transition={
          state === "working" ? { duration: 0.3, repeat: Infinity } :
          state === "walking" ? { duration: 0.2, repeat: Infinity, repeatType: "reverse" } :
          { duration: 3, repeat: Infinity, delay: 0.2 }
        }
      />

      {/* ══ LEGS — tiny pixel stubs ══ */}
      <rect
        x={8*p} y={10*p} width={p*1.5} height={3*p} rx={p*0.3} fill={dark}
        transform={legKickL ? `rotate(15, ${8.75*p}, ${10*p})` : legKickR ? `rotate(-8, ${8.75*p}, ${10*p})` : ""}
      />
      <rect
        x={12*p} y={10*p} width={p*1.5} height={3*p} rx={p*0.3} fill={dark}
        transform={legKickR ? `rotate(-15, ${12.75*p}, ${10*p})` : legKickL ? `rotate(8, ${12.75*p}, ${10*p})` : ""}
      />
    </svg>
  );
}

// ─── Speech Bubble ──────────────────────────────────────

function SpeechBubble({ text }: { text: string; color: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap z-30"
    >
      {/* Simple flat pixel bubble — no glow, no shadow */}
      <div className="px-1.5 py-0.5 bg-white text-[7px] font-mono text-black border border-black/20"
        style={{ imageRendering: "pixelated" }}
      >
        {displayed}<span className="animate-pulse text-neutral-400">_</span>
      </div>
      <div className="w-0 h-0 mx-auto"
        style={{ borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderTop: "3px solid white" }}
      />
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
