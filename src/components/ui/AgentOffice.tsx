"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * AgentOffice — Living pixel world with Claude-style mascot robots.
 *
 * Each robot is a simple rounded rectangle with eyes and stub legs.
 * NO head separation, NO arms, NO mouth — just like Claude's mascot.
 * The charm is in the simplicity and the autonomous behavior.
 */

const WORLD_W = 800;
const WORLD_H = 350;
const PROXIMITY = 65;

interface Agent {
  id: string;
  name: string;
  color: string;
  eyeColor: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: "walking" | "idle" | "thinking" | "talking" | "working";
  msg: string;
  walkFrame: number;
  facingRight: boolean;
  timer: number;
}

const DEFS = [
  { id: "brain",   name: "God Brain",    color: "#D2691E", eyeColor: "#2d1600" },
  { id: "hunter",  name: "Lead Hunter",  color: "#10B981", eyeColor: "#022c22" },
  { id: "writer",  name: "Content",      color: "#06B6D4", eyeColor: "#042f2e" },
  { id: "coder",   name: "Coder",        color: "#A855F7", eyeColor: "#1a0536" },
  { id: "closer",  name: "Voice Closer", color: "#EF4444", eyeColor: "#2d0808" },
  { id: "router",  name: "Router",       color: "#14B8A6", eyeColor: "#022c22" },
  { id: "guard",   name: "Guardrails",   color: "#6366F1", eyeColor: "#0c0c3d" },
  { id: "seo",     name: "SEO",          color: "#F59E0B", eyeColor: "#2d1f00" },
];

const PHRASES: Record<string, string[]> = {
  brain:  ["thinking...", "planning", "routing task"],
  hunter: ["53 leads!", "scanning", "found target"],
  writer: ["writing...", "4% ai score", "draft done"],
  coder:  ["building", "deploying", "code review"],
  closer: ["calling...", "booked!", "qualifying"],
  router: ["$0 cost", "routed 1.2k", "nemotron"],
  guard:  ["0 threats", "pii clean", "safe"],
  seo:    ["312 gaps", "ranking #1", "schema ok"],
};

const TALKS = [
  { a: "hunter", b: "closer", msgA: "leads ready", msgB: "calling now" },
  { a: "writer", b: "seo",    msgA: "draft done", msgB: "adding kw" },
  { a: "brain",  b: "router", msgA: "use nemotron", msgB: "routed" },
  { a: "coder",  b: "guard",  msgA: "page ready", msgB: "pii clean" },
];

// ─── The Mascot — Claude-style creature ─────────────────
// One rounded rectangle. Two eyes. Two stub legs. That's it.

function Mascot({
  color, eyeColor, walkFrame, facingRight, state,
}: {
  color: string; eyeColor: string; walkFrame: number;
  facingRight: boolean; state: Agent["state"];
}) {
  const kickL = state === "walking" && walkFrame % 2 === 0;
  const kickR = state === "walking" && walkFrame % 2 !== 0;

  return (
    <motion.div
      animate={
        state === "thinking" ? { y: [0, -3, 0] } :
        state === "working" ? { y: [0, -1, 0] } :
        { y: [0, -1.5, 0] }
      }
      transition={{
        duration: state === "thinking" ? 2 : state === "working" ? 0.5 : 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <svg
        width="32" height="36"
        viewBox="0 0 32 36"
        style={{
          imageRendering: "pixelated",
          transform: facingRight ? "" : "scaleX(-1)",
          filter: state === "working" ? `drop-shadow(0 0 4px ${color}40)` : "none",
        }}
      >
        {/* ═══ THE BODY — one solid rounded block ═══ */}
        <rect x="4" y="2" width="24" height="22" rx="6" fill={color} />

        {/* ═══ EYES — two small dark squares, high on the body ═══ */}
        {state === "thinking" ? (
          <>
            {/* Squinted — thin horizontal lines */}
            <rect x="9" y="10" width="4" height="1.5" rx="0.5" fill={eyeColor} />
            <rect x="19" y="10" width="4" height="1.5" rx="0.5" fill={eyeColor} />
          </>
        ) : (
          <>
            {/* Open — small dark rectangles */}
            <rect x="9" y="8" width="4" height="5" rx="1" fill={eyeColor} />
            <rect x="19" y="8" width="4" height="5" rx="1" fill={eyeColor} />

            {/* Tiny white pixel glint — gives life */}
            <rect x="10" y="9" width="1.5" height="1.5" rx="0.5" fill="white" opacity="0.7" />
            <rect x="20" y="9" width="1.5" height="1.5" rx="0.5" fill="white" opacity="0.7" />
          </>
        )}

        {/* ═══ LEGS — two tiny stubs at the bottom ═══ */}
        <motion.rect
          x="8" y="24" width="5" height="8" rx="2.5"
          fill={color}
          style={{ transformOrigin: "10.5px 24px" }}
          animate={
            state === "walking"
              ? { rotate: kickL ? [0, 15, 0] : kickR ? [0, -8, 0] : [0] }
              : {}
          }
          transition={{ duration: 0.2, repeat: state === "walking" ? Infinity : 0 }}
        />
        <motion.rect
          x="19" y="24" width="5" height="8" rx="2.5"
          fill={color}
          style={{ transformOrigin: "21.5px 24px" }}
          animate={
            state === "walking"
              ? { rotate: kickR ? [0, -15, 0] : kickL ? [0, 8, 0] : [0] }
              : {}
          }
          transition={{ duration: 0.2, repeat: state === "walking" ? Infinity : 0 }}
        />

        {/* ═══ FEET — tiny dark ovals ═══ */}
        <ellipse cx="10.5" cy="32" rx="3" ry="2" fill={eyeColor} opacity="0.5" />
        <ellipse cx="21.5" cy="32" rx="3" ry="2" fill={eyeColor} opacity="0.5" />
      </svg>
    </motion.div>
  );
}

// ─── Speech Bubble — minimal, flat ──────────────────────

function Bubble({ text }: { text: string }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="absolute -top-6 left-1/2 -translate-x-1/2 z-30"
    >
      <div className="px-1.5 py-0.5 bg-white text-[7px] font-mono text-black whitespace-nowrap"
        style={{ imageRendering: "pixelated" }}>
        {shown}<span className="text-neutral-300 animate-pulse">_</span>
      </div>
      <div className="w-0 h-0 mx-auto" style={{
        borderLeft: "3px solid transparent",
        borderRight: "3px solid transparent",
        borderTop: "3px solid white",
      }} />
    </motion.div>
  );
}

// ─── Main World ─────────────────────────────────────────

export function AgentOffice() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [task, setTask] = useState<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const worldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAgents(DEFS.map((d, i) => ({
      ...d,
      x: 60 + (i % 4) * 180 + Math.random() * 50,
      y: 50 + Math.floor(i / 4) * 130 + Math.random() * 50,
      targetX: Math.random() * (WORLD_W - 100) + 50,
      targetY: Math.random() * (WORLD_H - 80) + 40,
      state: "idle" as const,
      msg: "",
      walkFrame: 0,
      facingRight: Math.random() > 0.5,
      timer: 50 + Math.random() * 100,
    })));
  }, []);

  useEffect(() => {
    const loop = setInterval(() => {
      frame.current++;
      const f = frame.current;

      setAgents(prev => prev.map(a => {
        let { x, y, targetX, targetY, state, msg, walkFrame, facingRight, timer } = a;
        timer--;

        if (task && state !== "talking") {
          targetX = task.x + (Math.random() - 0.5) * 30;
          targetY = task.y + (Math.random() - 0.5) * 30;
          state = "walking";
        }

        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 12 && state === "walking") {
          const r = Math.random();
          state = r < 0.3 ? "thinking" : r < 0.6 ? "working" : "idle";
          timer = 60 + Math.random() * 80;
          if (state === "working") {
            msg = PHRASES[a.id]?.[Math.floor(Math.random() * 3)] || "";
          }
        }

        if (timer <= 0 && state !== "talking") {
          state = "walking";
          targetX = Math.random() * (WORLD_W - 100) + 50;
          targetY = Math.random() * (WORLD_H - 80) + 40;
          timer = 150 + Math.random() * 120;
          msg = "";
        }

        if (state === "walking" && dist > 4) {
          const speed = 0.8;
          x += (dx / dist) * speed;
          y += (dy / dist) * speed;
          facingRight = dx > 0;
          if (f % 6 === 0) walkFrame++;
        }

        if (f % 100 === 0 && state !== "talking") {
          const talk = TALKS.find(t =>
            (t.a === a.id || t.b === a.id) &&
            prev.some(o => o.id !== a.id && (t.a === o.id || t.b === o.id) &&
              Math.abs(o.x - x) < PROXIMITY && Math.abs(o.y - y) < PROXIMITY)
          );
          if (talk) {
            state = "talking";
            msg = talk.a === a.id ? talk.msgA : talk.msgB;
            timer = 70;
          }
        }

        x = Math.max(20, Math.min(WORLD_W - 50, x));
        y = Math.max(20, Math.min(WORLD_H - 60, y));

        return { ...a, x, y, targetX, targetY, state, msg, walkFrame, facingRight, timer };
      }));
    }, 50);
    return () => clearInterval(loop);
  }, [task]);

  useEffect(() => {
    if (task) {
      const t = setTimeout(() => setTask(null), 4000);
      return () => clearTimeout(t);
    }
  }, [task]);

  const onClick = useCallback((e: React.MouseEvent) => {
    if (!worldRef.current) return;
    const rect = worldRef.current.getBoundingClientRect();
    setTask({
      x: ((e.clientX - rect.left) / rect.width) * WORLD_W,
      y: ((e.clientY - rect.top) / rect.height) * WORLD_H,
    });
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-8"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-3">Inside the Matrix</p>
        <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-3">Your agents are working.</h2>
        <p className="text-neutral-600 text-sm">Click anywhere to drop a task. Watch them swarm.</p>
      </motion.div>

      <div
        ref={worldRef}
        onClick={onClick}
        className="relative rounded-2xl border border-white/[0.04] bg-[#0a0a0a] overflow-hidden cursor-crosshair"
        style={{ aspectRatio: `${WORLD_W}/${WORLD_H}` }}
      >
        {/* Scanlines */}
        <div className="absolute inset-0 pointer-events-none z-20 opacity-30" style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
        }} />

        {/* Subtle dot grid */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{
          backgroundImage: "radial-gradient(circle, rgba(16,185,129,0.15) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />

        {/* Task beacon */}
        <AnimatePresence>
          {task && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [1, 2, 1], opacity: [0.6, 0.1, 0.6] }}
              exit={{ scale: 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute w-3 h-3 rounded-full bg-emerald-400 z-10"
              style={{
                left: `${(task.x / WORLD_W) * 100}%`,
                top: `${(task.y / WORLD_H) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Floating particles */}
        {[0, 1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            className="absolute w-px h-px bg-emerald-500/30 rounded-full"
            animate={{
              left: [`${5 + i * 18}%`, `${80 - i * 10}%`],
              top: [`${20 + i * 12}%`, `${70 - i * 8}%`],
              opacity: [0, 0.5, 0],
            }}
            transition={{ duration: 5 + i * 2, repeat: Infinity, delay: i, ease: "linear" }}
          />
        ))}

        {/* Agents */}
        {agents.map(agent => (
          <div
            key={agent.id}
            className="absolute z-10"
            style={{
              left: `${(agent.x / WORLD_W) * 100}%`,
              top: `${(agent.y / WORLD_H) * 100}%`,
              transform: "translate(-50%, -50%)",
              transition: "left 50ms linear, top 50ms linear",
            }}
          >
            <div className="relative flex flex-col items-center">
              {/* Bubble */}
              <AnimatePresence>
                {agent.msg && (agent.state === "talking" || agent.state === "working") && (
                  <Bubble text={agent.msg} />
                )}
              </AnimatePresence>

              {/* Thinking dots */}
              {agent.state === "thinking" && (
                <motion.div
                  className="absolute -top-5 flex gap-0.5"
                  animate={{ opacity: [0.2, 0.8, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  <div className="w-1 h-1 rounded-full bg-white/40" />
                  <div className="w-1 h-1 rounded-full bg-white/25" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/15" />
                </motion.div>
              )}

              {/* The creature */}
              <Mascot
                color={agent.color}
                eyeColor={agent.eyeColor}
                walkFrame={agent.walkFrame}
                facingRight={agent.facingRight}
                state={agent.state}
              />

              {/* Name */}
              <span className="text-[6px] font-mono text-white/20 mt-0.5 uppercase tracking-widest">
                {agent.name}
              </span>
            </div>
          </div>
        ))}

        {/* Bottom status */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-1.5 bg-black/60 z-20">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[7px] text-emerald-400/60 font-mono uppercase tracking-widest">8 online</span>
          </div>
          <span className="text-[7px] text-white/10 font-mono">click to assign</span>
          <span className="text-[7px] text-white/10 font-mono">$0 cost</span>
        </div>
      </div>
    </div>
  );
}
