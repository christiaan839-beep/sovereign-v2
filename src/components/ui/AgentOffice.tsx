"use client";
"use no memo"; // Animation component uses Math.random() intentionally for visual effects

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * AgentOffice — A miniature isometric digital city.
 * Each agent has their own workspace/station.
 * They move between stations, interact, and produce visible output.
 * The whole thing feels like looking inside a living machine.
 */

const W = 950;
const H = 450;

// ─── Agent definitions ──────────────────────────────────

interface Bot {
  id: string; name: string; color: string;
  homeX: number; homeY: number; // their workstation position
  x: number; y: number; tx: number; ty: number;
  mode: "walk" | "home" | "think" | "chat" | "work";
  msg: string; frame: number; faceR: boolean; cd: number;
}

const DEFS = [
  { id: "brain", name: "God Brain",    color: "#D4845A", homeX: 120, homeY: 80 },
  { id: "hunt",  name: "Lead Hunter",  color: "#34D399", homeX: 350, homeY: 70 },
  { id: "write", name: "Content",      color: "#22D3EE", homeX: 580, homeY: 80 },
  { id: "code",  name: "Coder",        color: "#A78BFA", homeX: 800, homeY: 70 },
  { id: "voice", name: "Closer",       color: "#F87171", homeX: 120, homeY: 280 },
  { id: "route", name: "Router",       color: "#2DD4BF", homeX: 350, homeY: 290 },
  { id: "guard", name: "Guard",        color: "#818CF8", homeX: 580, homeY: 280 },
  { id: "seo",   name: "SEO",          color: "#FBBF24", homeX: 800, homeY: 290 },
];

const STATUS: Record<string, string[]> = {
  brain: ["synthesizing strategy", "routing to nemotron", "planning campaign"],
  hunt:  ["53 leads enriched", "scanning linkedin", "scoring prospects"],
  write: ["blog: 4.2% AI score", "email sequence done", "landing copy ready"],
  code:  ["page deployed ✓", "code review passed", "component built"],
  voice: ["call #23 connected", "meeting booked!", "lead qualified ✓"],
  route: ["1,247 tasks routed", "$0 inference today", "nemotron selected"],
  guard: ["0 threats detected", "pii scan: clean", "jailbreak blocked"],
  seo:   ["312 keyword gaps", "ranking improved", "schema validated"],
};

// ─── Claude-style Mascot ────────────────────────────────

function Bot({ color, frame, faceR, mode }: {
  color: string; frame: number; faceR: boolean; mode: Bot["mode"];
}) {
  const walk = mode === "walk";
  const f1 = walk && frame % 2 === 0;
  const f2 = walk && frame % 2 !== 0;

  return (
    <svg width="24" height="28" viewBox="0 0 24 28"
      style={{ imageRendering: "pixelated", transform: faceR ? "" : "scaleX(-1)" }}>
      <ellipse cx="12" cy="27" rx="7" ry="1.5" fill="rgba(0,0,0,0.25)" />
      <rect x="3" y="2" width="18" height="17" rx="4" fill={color} />
      {mode === "think" ? (
        <>
          <rect x="7" y="9" width="3" height="1.5" rx="0.5" fill="#000" opacity="0.5" />
          <rect x="14" y="9" width="3" height="1.5" rx="0.5" fill="#000" opacity="0.5" />
        </>
      ) : (
        <>
          <circle cx="9" cy="10" r="1.8" fill="#000" opacity="0.6" />
          <circle cx="15" cy="10" r="1.8" fill="#000" opacity="0.6" />
        </>
      )}
      <motion.ellipse cx="8" cy="21" rx="3.5" ry="3" fill={color}
        style={{ transformOrigin: "8px 19px" }}
        animate={walk ? { rotate: f1 ? [0, 12] : f2 ? [0, -8] : [0] } : {}}
        transition={{ duration: 0.15, repeat: walk ? Infinity : 0 }}
      />
      <motion.ellipse cx="16" cy="21" rx="3.5" ry="3" fill={color}
        style={{ transformOrigin: "16px 19px" }}
        animate={walk ? { rotate: f2 ? [0, -12] : f1 ? [0, 8] : [0] } : {}}
        transition={{ duration: 0.15, repeat: walk ? Infinity : 0 }}
      />
    </svg>
  );
}

// ─── Workstation Components ─────────────────────────────

function CommandCenter({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <g transform={`translate(${x - 30}, ${y - 20})`}>
      {/* Platform */}
      <rect x="0" y="30" width="60" height="15" rx="3" fill="#111118" stroke="rgba(16,185,129,0.08)" strokeWidth="0.5" />
      {/* Main screen */}
      <rect x="10" y="5" width="40" height="25" rx="2" fill="#0a0a12" stroke="rgba(16,185,129,0.12)" strokeWidth="0.5" />
      {active && <>
        <motion.rect x="14" y="9" width="15" rx="1" fill="rgba(16,185,129,0.2)"
          animate={{ width: [10, 32, 10] }} transition={{ duration: 2, repeat: Infinity }} height="2" />
        <rect x="14" y="13" width="20" height="1.5" rx="0.5" fill="rgba(16,185,129,0.1)" />
        <rect x="14" y="16" width="12" height="1.5" rx="0.5" fill="rgba(16,185,129,0.08)" />
        <motion.rect x="14" y="19" width="8" height="1.5" rx="0.5" fill="rgba(236,72,153,0.15)"
          animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />
        <motion.circle cx="44" cy="10" r="2" fill="rgba(16,185,129,0.3)"
          animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
      </>}
      <text x="30" y="48" textAnchor="middle" fontSize="3.5" fill="rgba(255,255,255,0.12)" fontFamily="monospace">COMMAND</text>
    </g>
  );
}

function RadarStation({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <g transform={`translate(${x - 25}, ${y - 20})`}>
      <rect x="0" y="30" width="50" height="12" rx="3" fill="#111118" stroke="rgba(52,211,153,0.08)" strokeWidth="0.5" />
      <circle cx="25" cy="20" r="15" fill="#0a0a12" stroke="rgba(52,211,153,0.1)" strokeWidth="0.5" />
      {active && <>
        <motion.line x1="25" y1="20" x2="25" y2="6" stroke="rgba(52,211,153,0.3)" strokeWidth="0.8"
          style={{ transformOrigin: "25px 20px" }}
          animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
        <motion.circle cx="32" cy="14" r="1.5" fill="rgba(52,211,153,0.5)"
          animate={{ opacity: [0, 1, 0] }} transition={{ duration: 2, repeat: Infinity }} />
        <motion.circle cx="18" cy="25" r="1" fill="rgba(52,211,153,0.4)"
          animate={{ opacity: [0, 1, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.7 }} />
      </>}
      <text x="25" y="46" textAnchor="middle" fontSize="3.5" fill="rgba(255,255,255,0.12)" fontFamily="monospace">RADAR</text>
    </g>
  );
}

function Terminal({ x, y, active, label }: { x: number; y: number; active: boolean; label: string }) {
  return (
    <g transform={`translate(${x - 20}, ${y - 15})`}>
      <rect x="0" y="25" width="40" height="10" rx="2" fill="#111118" stroke="rgba(167,139,250,0.08)" strokeWidth="0.5" />
      <rect x="5" y="3" width="30" height="22" rx="2" fill="#0a0a12" stroke="rgba(167,139,250,0.1)" strokeWidth="0.5" />
      {active && <>
        <motion.rect x="8" y="7" width="12" height="1" fill="rgba(167,139,250,0.2)" rx="0.5"
          animate={{ width: [8, 24, 8] }} transition={{ duration: 1.5, repeat: Infinity }} />
        <rect x="8" y="10" width="18" height="1" fill="rgba(167,139,250,0.1)" rx="0.5" />
        <rect x="8" y="13" width="10" height="1" fill="rgba(52,211,153,0.12)" rx="0.5" />
        <motion.rect x="8" y="16" width="6" height="1" fill="rgba(167,139,250,0.15)" rx="0.5"
          animate={{ width: [4, 20, 4] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} />
        <motion.rect x="8" y="19" width="14" height="1" fill="rgba(167,139,250,0.08)" rx="0.5"
          animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
      </>}
      <text x="20" y="38" textAnchor="middle" fontSize="3.5" fill="rgba(255,255,255,0.12)" fontFamily="monospace">{label}</text>
    </g>
  );
}

function PhoneBooth({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <g transform={`translate(${x - 15}, ${y - 20})`}>
      <rect x="0" y="5" width="30" height="35" rx="3" fill="#111118" stroke="rgba(248,113,113,0.08)" strokeWidth="0.5" />
      <rect x="3" y="8" width="24" height="15" rx="2" fill="#0a0a12" />
      {active && <>
        <motion.circle cx="15" cy="15" r="4" fill="none" stroke="rgba(248,113,113,0.2)" strokeWidth="0.8"
          animate={{ r: [4, 8, 4], opacity: [0.5, 0, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
        <circle cx="15" cy="15" r="2" fill="rgba(248,113,113,0.3)" />
      </>}
      <rect x="8" y="26" width="14" height="3" rx="1" fill="#1a1a22" />
      <text x="15" y="44" textAnchor="middle" fontSize="3.5" fill="rgba(255,255,255,0.12)" fontFamily="monospace">VOICE</text>
    </g>
  );
}

function ServerRack({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <g transform={`translate(${x - 15}, ${y - 20})`}>
      <rect x="0" y="0" width="30" height="38" rx="2" fill="#0a0a12" stroke="rgba(45,212,191,0.08)" strokeWidth="0.5" />
      {[0, 1, 2, 3, 4].map(i => (
        <g key={i}>
          <rect x="2" y={3 + i * 6.5} width="26" height="5" rx="1" fill="#111118" />
          {active && <motion.circle cx="25" cy={5.5 + i * 6.5} r="1.2"
            fill={i % 2 === 0 ? "rgba(45,212,191,0.6)" : "rgba(16,185,129,0.4)"}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />}
        </g>
      ))}
      <text x="15" y="44" textAnchor="middle" fontSize="3.5" fill="rgba(255,255,255,0.12)" fontFamily="monospace">SERVERS</text>
    </g>
  );
}

// ─── Main Component ─────────────────────────────────────

export function AgentOffice() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [task, setTask] = useState<{ x: number; y: number } | null>(null);
  const [log, setLog] = useState<string[]>(["system online", "8 agents initialized", "nemotron connected"]);
  const fr = useRef(0);
  const wRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBots(DEFS.map(d => ({
      ...d, x: d.homeX, y: d.homeY,
      tx: d.homeX, ty: d.homeY,
      mode: "home" as const, msg: "", frame: 0,
      faceR: true, cd: 30 + Math.random() * 60,
    })));
  }, []);

  // Activity log updater
  useEffect(() => {
    const interval = setInterval(() => {
      const agent = DEFS[Math.floor(Math.random() * DEFS.length)];
      const msgs = STATUS[agent.id] || ["working..."];
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      setLog(prev => [`${agent.name}: ${msg}`, ...prev.slice(0, 4)]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loop = setInterval(() => {
      fr.current++;
      const f = fr.current;
      setBots(prev => prev.map(b => {
        let { x, y, tx, ty, mode, msg, frame, faceR, cd } = b;
        const { homeX, homeY } = b;
        cd--;

        if (task) { tx = task.x + (Math.random() - 0.5) * 50; ty = task.y + (Math.random() - 0.5) * 50; mode = "walk"; }

        const dx = tx - x, dy = ty - y, d = Math.sqrt(dx * dx + dy * dy);

        // Arrived
        if (d < 8 && mode === "walk") {
          if (Math.abs(x - homeX) < 20 && Math.abs(y - homeY) < 20) {
            mode = "home"; cd = 60 + Math.random() * 80;
            msg = STATUS[b.id]?.[Math.floor(Math.random() * 3)] || "";
          } else {
            mode = "think"; cd = 30 + Math.random() * 40; msg = "";
          }
        }

        // Timer up — decide next action
        if (cd <= 0) {
          const r = Math.random();
          if (r < 0.4) {
            // Go visit another agent's station
            const other = DEFS[Math.floor(Math.random() * DEFS.length)];
            tx = other.homeX + (Math.random() - 0.5) * 30;
            ty = other.homeY + (Math.random() - 0.5) * 20;
            mode = "walk"; cd = 150;
          } else if (r < 0.7) {
            // Go home
            tx = homeX; ty = homeY; mode = "walk"; cd = 100;
          } else {
            // Work at current spot
            mode = "work";
            msg = STATUS[b.id]?.[Math.floor(Math.random() * 3)] || "";
            cd = 60 + Math.random() * 50;
          }
        }

        // Movement
        if (mode === "walk" && d > 4) {
          x += (dx / d) * 0.8; y += (dy / d) * 0.8;
          faceR = dx > 0;
          if (f % 5 === 0) frame++;
        }

        // Proximity chat
        if (f % 100 === 0 && mode !== "chat" && mode !== "walk") {
          const near = prev.find(o => o.id !== b.id &&
            Math.abs(o.x - x) < 50 && Math.abs(o.y - y) < 50 && o.mode !== "walk");
          if (near) {
            mode = "chat"; msg = STATUS[b.id]?.[Math.floor(Math.random() * 3)] || "syncing"; cd = 50;
          }
        }

        x = Math.max(25, Math.min(W - 40, x));
        y = Math.max(25, Math.min(H - 50, y));
        return { ...b, x, y, tx, ty, mode, msg, frame, faceR, cd };
      }));
    }, 50);
    return () => clearInterval(loop);
  }, [task]);

  useEffect(() => { if (task) { const t = setTimeout(() => setTask(null), 3500); return () => clearTimeout(t); } }, [task]);

  const click = useCallback((e: React.MouseEvent) => {
    if (!wRef.current) return;
    const r = wRef.current.getBoundingClientRect();
    setTask({ x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H });
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="text-center mb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-3">Inside the Matrix</p>
        <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-3">Your agents are working.</h2>
        <p className="text-neutral-600 text-sm">Click anywhere to assign a task. Watch them respond.</p>
      </motion.div>

      <div ref={wRef} onClick={click}
        className="relative rounded-2xl overflow-hidden cursor-crosshair group"
        style={{ aspectRatio: `${W}/${H}` }}>

        {/* Outer glow border — neon emerald */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-emerald-500/20 via-emerald-500/5 to-cyan-500/10 pointer-events-none z-0" />
        <div className="absolute inset-0 rounded-2xl ring-1 ring-emerald-500/10 pointer-events-none z-0" />

        {/* Background with depth */}
        <div className="absolute inset-0 bg-[#06060a] rounded-2xl" />

        {/* Grid floor — perspective transform for 3D depth */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `
            linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "35px 35px",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
        }} />

        {/* Multi-layer ambient lighting */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_15%_20%,rgba(16,185,129,0.06)_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_85%_80%,rgba(6,182,212,0.04)_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_50%,rgba(16,185,129,0.03)_0%,transparent_70%)]" />
        </div>

        {/* Animated pulse ring — like a heartbeat for the matrix */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/10 pointer-events-none"
          animate={{ width: [100, 600, 100], height: [60, 350, 60], opacity: [0.15, 0, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Matrix rain — falling characters */}
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={`rain-${i}`}
            className="absolute text-[6px] font-mono text-emerald-500/10 pointer-events-none select-none"
            style={{ left: `${5 + i * 6.5}%` }}
            animate={{ top: ["-5%", "105%"], opacity: [0, 0.15, 0] }}
            transition={{ duration: 6 + Math.random() * 8, repeat: Infinity, delay: i * 0.4, ease: "linear" }}
          >
            {String.fromCharCode(0x30A0 + Math.random() * 96)}
          </motion.div>
        ))}

        {/* Scanlines — CRT effect */}
        <div className="absolute inset-0 pointer-events-none z-30 opacity-10" style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 3px)",
        }} />

        {/* ═══ WORKSTATIONS (SVG layer) ═══ */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {/* Connection paths — glowing energy lines */}
          <defs>
            <linearGradient id="pathGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(16,185,129,0.15)" />
              <stop offset="50%" stopColor="rgba(6,182,212,0.08)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.15)" />
            </linearGradient>
            <filter id="pathGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Horizontal paths */}
          <path d="M120,100 Q235,115 350,90" stroke="url(#pathGlow)" strokeWidth="1" fill="none" />
          <path d="M350,90 Q465,100 580,100" stroke="url(#pathGlow)" strokeWidth="1" fill="none" />
          <path d="M580,100 Q690,95 800,90" stroke="url(#pathGlow)" strokeWidth="1" fill="none" />
          <path d="M120,300 Q235,310 350,310" stroke="url(#pathGlow)" strokeWidth="1" fill="none" />
          <path d="M350,310 Q465,300 580,300" stroke="url(#pathGlow)" strokeWidth="1" fill="none" />
          <path d="M580,300 Q690,305 800,310" stroke="url(#pathGlow)" strokeWidth="1" fill="none" />
          {/* Vertical paths */}
          <path d="M120,100 L120,300" stroke="rgba(16,185,129,0.06)" strokeWidth="0.5" fill="none" strokeDasharray="3 6" />
          <path d="M350,90 L350,310" stroke="rgba(16,185,129,0.06)" strokeWidth="0.5" fill="none" strokeDasharray="3 6" />
          <path d="M580,100 L580,300" stroke="rgba(16,185,129,0.06)" strokeWidth="0.5" fill="none" strokeDasharray="3 6" />
          <path d="M800,90 L800,310" stroke="rgba(16,185,129,0.06)" strokeWidth="0.5" fill="none" strokeDasharray="3 6" />
          {/* Cross connections */}
          <path d="M120,100 Q460,200 800,310" stroke="rgba(16,185,129,0.03)" strokeWidth="0.5" fill="none" />
          <path d="M800,90 Q460,200 120,300" stroke="rgba(6,182,212,0.03)" strokeWidth="0.5" fill="none" />

          {/* Energy pulses along paths — glowing data packets */}
          {[0, 1, 2, 3, 4].map(i => (
            <motion.circle key={`data-${i}`} r={1.5 + (i % 2)} fill={i % 2 === 0 ? "rgba(16,185,129,0.5)" : "rgba(6,182,212,0.4)"}
              filter="url(#pathGlowFilter)"
              animate={{
                cx: i < 3 ? [120, 350, 580, 800, 580, 350, 120] : [800, 580, 350, 120, 350, 580, 800],
                cy: i < 3 ? [100, 90, 100, 90, 300, 310, 300] : [310, 300, 310, 300, 90, 100, 90],
                opacity: [0, 0.7, 0.4, 0.7, 0.4, 0.7, 0],
              }}
              transition={{ duration: 10 + i * 2, repeat: Infinity, delay: i * 2.5, ease: "linear" }}
            />
          ))}

          {/* Workstations */}
          <CommandCenter x={120} y={80} active={bots.some(b => b.id === "brain" && (b.mode === "home" || b.mode === "work"))} />
          <RadarStation x={350} y={70} active={bots.some(b => b.id === "hunt" && (b.mode === "home" || b.mode === "work"))} />
          <Terminal x={580} y={80} active={bots.some(b => b.id === "write" && (b.mode === "home" || b.mode === "work"))} label="CONTENT" />
          <Terminal x={800} y={70} active={bots.some(b => b.id === "code" && (b.mode === "home" || b.mode === "work"))} label="CODE" />
          <PhoneBooth x={120} y={280} active={bots.some(b => b.id === "voice" && (b.mode === "home" || b.mode === "work"))} />
          <ServerRack x={350} y={290} active={bots.some(b => b.id === "route" && (b.mode === "home" || b.mode === "work"))} />
          <Terminal x={580} y={280} active={bots.some(b => b.id === "guard" && (b.mode === "home" || b.mode === "work"))} label="SHIELD" />
          <Terminal x={800} y={290} active={bots.some(b => b.id === "seo" && (b.mode === "home" || b.mode === "work"))} label="SEO" />
        </svg>

        {/* Task beacon — dramatic pulsing target */}
        <AnimatePresence>
          {task && (
            <div className="absolute z-10" style={{ left: `${(task.x / W) * 100}%`, top: `${(task.y / H) * 100}%`, transform: "translate(-50%,-50%)" }}>
              {/* Outer ring */}
              <motion.div initial={{ scale: 0 }}
                animate={{ scale: [1, 4, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute w-3 h-3 rounded-full border border-emerald-400/40 -translate-x-1/2 -translate-y-1/2"
              />
              {/* Middle ring */}
              <motion.div
                animate={{ scale: [1, 2.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                className="absolute w-2 h-2 rounded-full border border-emerald-400/50 -translate-x-1/2 -translate-y-1/2"
              />
              {/* Core dot */}
              <motion.div
                animate={{ opacity: [0.8, 0.4, 0.8] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                exit={{ scale: 0 }}
                className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 -translate-x-1/2 -translate-y-1/2"
                style={{ boxShadow: "0 0 8px rgba(16,185,129,0.5), 0 0 20px rgba(16,185,129,0.2)" }}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Ambient particles */}
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div key={i} className="absolute rounded-full"
            style={{ width: 1 + Math.random(), height: 1 + Math.random(), backgroundColor: `rgba(16,185,129,${0.08 + Math.random() * 0.12})` }}
            animate={{
              left: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
              top: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
              opacity: [0, 0.3, 0],
            }}
            transition={{ duration: 10 + Math.random() * 8, repeat: Infinity, delay: i * 0.8, ease: "linear" }}
          />
        ))}

        {/* ═══ THE BOTS ═══ */}
        {bots.map(b => (
          <div key={b.id} className="absolute z-10"
            style={{
              left: `${(b.x / W) * 100}%`, top: `${(b.y / H) * 100}%`,
              transform: "translate(-50%,-50%)", transition: "left 50ms linear, top 50ms linear",
              zIndex: Math.round(b.y),
            }}>
            <div className="relative flex flex-col items-center">
              {/* Speech */}
              <AnimatePresence>
                {b.msg && (b.mode === "chat" || b.mode === "work" || b.mode === "home") && (
                  <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute -top-5 left-1/2 -translate-x-1/2 z-30">
                    <div className="px-1.5 py-0.5 rounded bg-white text-[5px] font-mono text-neutral-700 whitespace-nowrap">
                      {b.msg}
                    </div>
                    <div className="w-0 h-0 mx-auto" style={{
                      borderLeft: "2px solid transparent", borderRight: "2px solid transparent", borderTop: "2px solid white"
                    }} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Think dots */}
              {b.mode === "think" && (
                <motion.div className="absolute -top-4 flex gap-[2px]"
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity }}>
                  <div className="w-[2px] h-[2px] rounded-full bg-white/30" />
                  <div className="w-[2px] h-[2px] rounded-full bg-white/20" />
                  <div className="w-[3px] h-[3px] rounded-full bg-white/10" />
                </motion.div>
              )}

              <motion.div
                animate={
                  b.mode === "home" || b.mode === "work" ? { y: [0, -1, 0] } :
                  b.mode === "think" ? { y: [0, -2, 0] } : {}
                }
                transition={{ duration: b.mode === "think" ? 2 : 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <Bot color={b.color} frame={b.frame} faceR={b.faceR} mode={b.mode} />
              </motion.div>

              <span className="text-[4px] font-mono text-white/10 uppercase tracking-[0.1em] mt-[-1px]">{b.name}</span>
            </div>
          </div>
        ))}

        {/* ═══ ACTIVITY LOG — scrolling ticker ═══ */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="flex items-center h-6 bg-black/70 backdrop-blur-sm border-t border-white/[0.04] px-3 gap-3 overflow-hidden">
            <div className="flex items-center gap-1 shrink-0">
              <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[6px] text-emerald-400/50 font-mono uppercase tracking-[0.15em]">live</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <motion.div
                key={log[0]}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-[6px] text-white/25 font-mono truncate"
              >
                {log[0]}
              </motion.div>
            </div>
            <span className="text-[6px] text-white/10 font-mono shrink-0">117 agents · $0 cost</span>
          </div>
        </div>

        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-[#08080d] to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}
