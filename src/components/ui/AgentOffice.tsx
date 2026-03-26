"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * AgentOffice — Living digital world with Claude-mascot-style creatures.
 *
 * Each agent is a unique variation of Claude's mascot design:
 * - Two-tone body (lighter top, darker bottom)
 * - Small ear/antenna nubs on top (unique per agent)
 * - Wide dot eyes
 * - Stubby feet at the bottom
 * - Warm, friendly, GameBoy-era pixel sprite feel
 *
 * The world has furniture, workstations, and agents interact.
 */

const WORLD_W = 900;
const WORLD_H = 380;
const TALK_DIST = 70;

interface Agent {
  id: string;
  name: string;
  top: string;     // lighter body color
  bottom: string;  // darker body color
  ear: string;     // ear/nub color
  eye: string;     // eye color
  x: number;
  y: number;
  tx: number;
  ty: number;
  state: "walk" | "idle" | "think" | "talk" | "work";
  msg: string;
  step: number;
  right: boolean;
  t: number;
}

const AGENTS_DEF = [
  { id: "brain",  name: "God Brain",    top: "#E8845C", bottom: "#C4633B", ear: "#D4714A", eye: "#3D1E0E" },
  { id: "hunt",   name: "Lead Hunter",  top: "#4ADE80", bottom: "#22C55E", ear: "#16A34A", eye: "#052E16" },
  { id: "write",  name: "Content",      top: "#67E8F9", bottom: "#22D3EE", ear: "#06B6D4", eye: "#083344" },
  { id: "code",   name: "Coder",        top: "#C084FC", bottom: "#A855F7", ear: "#9333EA", eye: "#1E0A3E" },
  { id: "close",  name: "Closer",       top: "#FCA5A5", bottom: "#EF4444", ear: "#DC2626", eye: "#3B0A0A" },
  { id: "route",  name: "Router",       top: "#5EEAD4", bottom: "#14B8A6", ear: "#0D9488", eye: "#042F2E" },
  { id: "guard",  name: "Guard",        top: "#A5B4FC", bottom: "#6366F1", ear: "#4F46E5", eye: "#1E1B4B" },
  { id: "seo",    name: "SEO",          top: "#FDE68A", bottom: "#F59E0B", ear: "#D97706", eye: "#451A03" },
];

const WORDS: Record<string, string[]> = {
  brain: ["routing...", "nemotron 253b", "planning"],
  hunt:  ["53 leads!", "scanning...", "target found"],
  write: ["4.2% score", "writing...", "anti-slop ✓"],
  code:  ["deploying", "code review", "building..."],
  close: ["booking...", "call done!", "qualified ✓"],
  route: ["$0 today", "1.2k routed", "auto-select"],
  guard: ["0 threats", "pii clean", "all safe"],
  seo:   ["312 gaps", "#1 ranking", "schema ✓"],
};

const CHATS = [
  { a: "hunt", b: "close", mA: "leads ready!", mB: "on it" },
  { a: "write", b: "seo", mA: "draft done", mB: "optimizing" },
  { a: "brain", b: "route", mA: "nemotron", mB: "routed ✓" },
  { a: "code", b: "guard", mA: "ship it?", mB: "pii clear" },
];

// ─── The Mascot — Claude-style with unique variations ───

function Creature({
  top, bottom, ear, eye, step, right, state, variant,
}: {
  top: string; bottom: string; ear: string; eye: string;
  step: number; right: boolean; state: Agent["state"];
  variant: number;
}) {
  const kick = state === "walk";
  const f1 = kick && step % 2 === 0;
  const f2 = kick && step % 2 !== 0;

  // Ear variations based on agent
  const earType = variant % 4; // 0=round nubs, 1=pointy, 2=antenna, 3=flat

  return (
    <motion.div
      animate={
        state === "think" ? { y: [0, -4, 0] } :
        state === "work" ? { y: [0, -1, 0] } :
        { y: [0, -2, 0] }
      }
      transition={{
        duration: state === "think" ? 2.5 : state === "work" ? 0.6 : 3,
        repeat: Infinity, ease: "easeInOut",
      }}
    >
      <svg width="38" height="42" viewBox="0 0 38 42"
        style={{ imageRendering: "pixelated", transform: right ? "" : "scaleX(-1)", overflow: "visible" }}>

        {/* ═══ EARS/NUBS — unique per agent ═══ */}
        {earType === 0 && (
          <>
            {/* Round nubs (like Claude's) */}
            <rect x="8" y="1" width="6" height="6" rx="3" fill={ear} />
            <rect x="24" y="1" width="6" height="6" rx="3" fill={ear} />
          </>
        )}
        {earType === 1 && (
          <>
            {/* Pointy ears */}
            <polygon points="10,6 13,0 16,6" fill={ear} />
            <polygon points="22,6 25,0 28,6" fill={ear} />
          </>
        )}
        {earType === 2 && (
          <>
            {/* Antenna nubs */}
            <rect x="11" y="0" width="3" height="7" rx="1.5" fill={ear} />
            <rect x="24" y="0" width="3" height="7" rx="1.5" fill={ear} />
            <circle cx="12.5" cy="0" r="2" fill={top} />
            <circle cx="25.5" cy="0" r="2" fill={top} />
          </>
        )}
        {earType === 3 && (
          <>
            {/* Flat wide nubs */}
            <rect x="7" y="3" width="7" height="4" rx="2" fill={ear} />
            <rect x="24" y="3" width="7" height="4" rx="2" fill={ear} />
          </>
        )}

        {/* ═══ BODY — two-tone like Claude's mascot ═══ */}
        {/* Top half — lighter */}
        <rect x="5" y="6" width="28" height="14" rx="5" fill={top} />
        {/* Bottom half — darker */}
        <rect x="5" y="16" width="28" height="10" rx="5" fill={bottom} />
        {/* Blend rectangle to connect the halves */}
        <rect x="5" y="14" width="28" height="6" fill={top} />
        <rect x="5" y="17" width="28" height="4" fill={bottom} />

        {/* Body highlight — subtle lighter strip */}
        <rect x="9" y="8" width="20" height="3" rx="1.5" fill="white" opacity="0.1" />

        {/* ═══ EYES — wide friendly dots ═══ */}
        {state === "think" ? (
          <>
            <rect x="11" y="13" width="5" height="2" rx="1" fill={eye} />
            <rect x="22" y="13" width="5" height="2" rx="1" fill={eye} />
          </>
        ) : (
          <>
            {/* Eye whites */}
            <circle cx="14" cy="13" r="3.5" fill="white" opacity="0.9" />
            <circle cx="24" cy="13" r="3.5" fill="white" opacity="0.9" />
            {/* Pupils */}
            <circle cx={right ? "15" : "13"} cy="13.5" r="2" fill={eye} />
            <circle cx={right ? "25" : "23"} cy="13.5" r="2" fill={eye} />
            {/* Glint */}
            <circle cx="13" cy="12" r="1" fill="white" />
            <circle cx="23" cy="12" r="1" fill="white" />
          </>
        )}

        {/* ═══ CHEEKS — subtle blush ═══ */}
        <circle cx="9" cy="17" r="2.5" fill="#FF6B6B" opacity="0.15" />
        <circle cx="29" cy="17" r="2.5" fill="#FF6B6B" opacity="0.15" />

        {/* ═══ MOUTH — tiny, subtle ═══ */}
        {state === "talk" ? (
          <motion.ellipse cx="19" cy="20" rx="2.5" fill={eye}
            animate={{ ry: [1, 2.5, 1] }}
            transition={{ duration: 0.3, repeat: Infinity }}
          />
        ) : (
          <rect x="16" y="20" width="6" height="1" rx="0.5" fill={eye} opacity="0.25" />
        )}

        {/* ═══ LEGS — stubby with feet ═══ */}
        <motion.g
          style={{ transformOrigin: "12px 26px" }}
          animate={kick ? { rotate: f1 ? [0, 12, 0] : f2 ? [0, -6, 0] : [0] } : {}}
          transition={{ duration: 0.2, repeat: kick ? Infinity : 0 }}
        >
          <rect x="9" y="26" width="6" height="9" rx="3" fill={bottom} />
          <ellipse cx="12" cy="35.5" rx="4" ry="2.5" fill={ear} />
        </motion.g>
        <motion.g
          style={{ transformOrigin: "26px 26px" }}
          animate={kick ? { rotate: f2 ? [0, -12, 0] : f1 ? [0, 6, 0] : [0] } : {}}
          transition={{ duration: 0.2, repeat: kick ? Infinity : 0 }}
        >
          <rect x="23" y="26" width="6" height="9" rx="3" fill={bottom} />
          <ellipse cx="26" cy="35.5" rx="4" ry="2.5" fill={ear} />
        </motion.g>

        {/* Working sparkles */}
        {state === "work" && (
          <>
            <motion.circle r="1.5" fill={top} animate={{ cx: [4, 2], cy: [4, -2], opacity: [0, 1, 0] }}
              transition={{ duration: 0.7, repeat: Infinity }} />
            <motion.circle r="1.5" fill={top} animate={{ cx: [34, 36], cy: [4, -2], opacity: [0, 1, 0] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: 0.3 }} />
          </>
        )}
      </svg>
    </motion.div>
  );
}

// ─── Bubble ─────────────────────────────────────────────

function Bub({ text }: { text: string }) {
  const [s, setS] = useState("");
  useEffect(() => {
    setS(""); let i = 0;
    const id = setInterval(() => { i++; setS(text.slice(0, i)); if (i >= text.length) clearInterval(id); }, 35);
    return () => clearInterval(id);
  }, [text]);
  return (
    <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="absolute -top-7 left-1/2 -translate-x-1/2 z-30">
      <div className="px-2 py-0.5 rounded-md bg-white text-[7px] font-mono text-neutral-800 whitespace-nowrap shadow-sm">
        {s}<span className="text-neutral-300 animate-pulse">_</span>
      </div>
      <div className="w-0 h-0 mx-auto" style={{
        borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderTop: "3px solid white"
      }} />
    </motion.div>
  );
}

// ─── Furniture ──────────────────────────────────────────

function Desk({ x, y }: { x: number; y: number }) {
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className="w-10 h-2 bg-neutral-800/60 rounded-sm border border-white/[0.03]" />
      <div className="w-1 h-3 bg-neutral-800/40 ml-1 mt-0" />
      <div className="w-1 h-3 bg-neutral-800/40 ml-8 -mt-3" />
    </div>
  );
}

function Monitor({ x, y }: { x: number; y: number }) {
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className="w-6 h-4 bg-neutral-900 border border-emerald-500/10 rounded-sm overflow-hidden">
        <motion.div className="w-3 h-0.5 bg-emerald-500/20 mt-1 ml-0.5 rounded-full"
          animate={{ width: ["30%", "70%", "30%"] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="w-2 h-0.5 bg-emerald-500/10 mt-0.5 ml-0.5 rounded-full" />
      </div>
      <div className="w-1 h-1.5 bg-neutral-800 mx-auto" />
      <div className="w-3 h-0.5 bg-neutral-800 mx-auto rounded-full" />
    </div>
  );
}

// ─── Main World ─────────────────────────────────────────

export function AgentOffice() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [task, setTask] = useState<{ x: number; y: number } | null>(null);
  const fr = useRef(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAgents(AGENTS_DEF.map((d, i) => ({
      ...d,
      x: 70 + (i % 4) * 200 + Math.random() * 60,
      y: 50 + Math.floor(i / 4) * 140 + Math.random() * 40,
      tx: Math.random() * (WORLD_W - 120) + 60,
      ty: Math.random() * (WORLD_H - 100) + 50,
      state: "idle" as const,
      msg: "", step: 0, right: Math.random() > 0.5,
      t: 40 + Math.random() * 80,
    })));
  }, []);

  useEffect(() => {
    const loop = setInterval(() => {
      fr.current++;
      const f = fr.current;
      setAgents(prev => prev.map(a => {
        let { x, y, tx, ty, state, msg, step, right, t } = a;
        t--;
        if (task && state !== "talk") { tx = task.x + (Math.random() - 0.5) * 40; ty = task.y + (Math.random() - 0.5) * 40; state = "walk"; }
        const dx = tx - x, dy = ty - y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 10 && state === "walk") {
          const r = Math.random();
          state = r < 0.25 ? "think" : r < 0.5 ? "work" : "idle";
          t = 50 + Math.random() * 70;
          msg = state === "work" ? (WORDS[a.id]?.[Math.floor(Math.random() * 3)] || "") : "";
        }
        if (t <= 0 && state !== "talk") {
          state = "walk"; tx = Math.random() * (WORLD_W - 120) + 60; ty = Math.random() * (WORLD_H - 100) + 50;
          t = 120 + Math.random() * 100; msg = "";
        }
        if (state === "walk" && d > 3) {
          x += (dx / d) * 0.9; y += (dy / d) * 0.9; right = dx > 0;
          if (f % 5 === 0) step++;
        }
        if (f % 90 === 0 && state !== "talk") {
          const c = CHATS.find(c => (c.a === a.id || c.b === a.id) &&
            prev.some(o => o.id !== a.id && (c.a === o.id || c.b === o.id) &&
              Math.abs(o.x - x) < TALK_DIST && Math.abs(o.y - y) < TALK_DIST));
          if (c) { state = "talk"; msg = c.a === a.id ? c.mA : c.mB; t = 60; }
        }
        x = Math.max(30, Math.min(WORLD_W - 60, x));
        y = Math.max(25, Math.min(WORLD_H - 70, y));
        return { ...a, x, y, tx, ty, state, msg, step, right, t };
      }));
    }, 50);
    return () => clearInterval(loop);
  }, [task]);

  useEffect(() => { if (task) { const t = setTimeout(() => setTask(null), 4000); return () => clearTimeout(t); } }, [task]);

  const click = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setTask({ x: ((e.clientX - r.left) / r.width) * WORLD_W, y: ((e.clientY - r.top) / r.height) * WORLD_H });
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="text-center mb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-3">Inside the Matrix</p>
        <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-3">Your agents are working.</h2>
        <p className="text-neutral-600 text-sm">Click anywhere to drop a task. Watch them swarm.</p>
      </motion.div>

      <div ref={ref} onClick={click}
        className="relative rounded-2xl border border-white/[0.04] bg-[#0c0c10] overflow-hidden cursor-crosshair"
        style={{ aspectRatio: `${WORLD_W}/${WORLD_H}` }}>

        {/* Scanlines */}
        <div className="absolute inset-0 pointer-events-none z-20 opacity-20" style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)",
        }} />

        {/* Dot grid floor */}
        <div className="absolute inset-0 pointer-events-none opacity-15" style={{
          backgroundImage: "radial-gradient(circle, rgba(16,185,129,0.12) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }} />

        {/* Office furniture */}
        <Desk x={8} y={35} />
        <Monitor x={9} y={28} />
        <Desk x={30} y={30} />
        <Monitor x={31} y={23} />
        <Desk x={55} y={55} />
        <Monitor x={56} y={48} />
        <Desk x={78} y={40} />
        <Monitor x={79} y={33} />

        {/* Task beacon */}
        <AnimatePresence>
          {task && (
            <motion.div initial={{ scale: 0 }}
              animate={{ scale: [1, 2.5, 1], opacity: [0.5, 0.1, 0.5] }}
              exit={{ scale: 0 }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="absolute w-2 h-2 rounded-full bg-emerald-400 z-10"
              style={{ left: `${(task.x / WORLD_W) * 100}%`, top: `${(task.y / WORLD_H) * 100}%`, transform: "translate(-50%,-50%)" }}
            />
          )}
        </AnimatePresence>

        {/* Floating data particles */}
        {[0, 1, 2, 3].map(i => (
          <motion.div key={i} className="absolute w-0.5 h-0.5 bg-emerald-500/25 rounded-full"
            animate={{
              left: [`${10 + i * 20}%`, `${75 - i * 12}%`],
              top: [`${15 + i * 15}%`, `${65 - i * 10}%`],
              opacity: [0, 0.4, 0],
            }}
            transition={{ duration: 6 + i * 2, repeat: Infinity, delay: i * 1.5, ease: "linear" }}
          />
        ))}

        {/* Agents */}
        {agents.map((a, i) => (
          <div key={a.id} className="absolute z-10"
            style={{
              left: `${(a.x / WORLD_W) * 100}%`, top: `${(a.y / WORLD_H) * 100}%`,
              transform: "translate(-50%,-50%)", transition: "left 50ms linear, top 50ms linear",
            }}>
            <div className="relative flex flex-col items-center">
              <AnimatePresence>
                {a.msg && (a.state === "talk" || a.state === "work") && <Bub text={a.msg} />}
              </AnimatePresence>

              {a.state === "think" && (
                <motion.div className="absolute -top-5 flex gap-0.5"
                  animate={{ opacity: [0.2, 0.7, 0.2] }}
                  transition={{ duration: 1.5, repeat: Infinity }}>
                  <div className="w-1 h-1 rounded-full bg-white/30" />
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                </motion.div>
              )}

              <Creature
                top={a.top} bottom={a.bottom} ear={a.ear} eye={a.eye}
                step={a.step} right={a.right} state={a.state} variant={i}
              />

              <span className="text-[5px] font-mono text-white/15 mt-0 uppercase tracking-[0.15em]">{a.name}</span>
            </div>
          </div>
        ))}

        {/* Status bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-1 bg-black/50 z-20 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[6px] text-emerald-400/50 font-mono uppercase tracking-[0.2em]">8 online</span>
          </div>
          <span className="text-[6px] text-white/10 font-mono tracking-wider">click to assign task</span>
          <span className="text-[6px] text-white/10 font-mono tracking-wider">$0 inference</span>
        </div>
      </div>
    </div>
  );
}
