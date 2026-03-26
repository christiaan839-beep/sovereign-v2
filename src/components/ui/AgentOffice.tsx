"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * AgentOffice — 3D isometric digital world with Claude-exact mascots.
 *
 * THE MASCOT: A solid rounded rectangle. Two dot eyes. Two stub feet.
 * NOTHING ELSE. No ears. No mouth. No arms. No cheeks. No highlights.
 * Each agent = different color. That's the only variation.
 *
 * THE WORLD: Isometric 3D perspective with depth, shadows,
 * glowing floor tiles, holographic screens, and ambient particles.
 */

const W = 900;
const H = 420;

interface Bot {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  mode: "walk" | "sit" | "think" | "chat" | "work";
  msg: string;
  frame: number;
  faceR: boolean;
  cd: number;
}

const BOTS = [
  { id: "brain",  name: "God Brain",    color: "#D4845A" },
  { id: "hunt",   name: "Lead Hunter",  color: "#34D399" },
  { id: "write",  name: "Content",      color: "#22D3EE" },
  { id: "code",   name: "Coder",        color: "#A78BFA" },
  { id: "voice",  name: "Closer",       color: "#F87171" },
  { id: "route",  name: "Router",       color: "#2DD4BF" },
  { id: "guard",  name: "Guard",        color: "#818CF8" },
  { id: "seo",    name: "SEO",          color: "#FBBF24" },
];

const MSGS: Record<string, string[]> = {
  brain: ["thinking...", "planning", "routing"],
  hunt:  ["53 leads!", "scanning", "found!"],
  write: ["writing...", "4.2% AI", "done ✓"],
  code:  ["building", "deployed", "reviewed"],
  voice: ["calling...", "booked!", "qual'd ✓"],
  route: ["$0 cost", "routed", "nemotron"],
  guard: ["secure", "clean", "safe ✓"],
  seo:   ["312 gaps", "rank #1", "indexed"],
};

const TALKS = [
  { a: "hunt", b: "voice", mA: "leads!", mB: "calling" },
  { a: "write", b: "seo", mA: "draft", mB: "keywords" },
  { a: "brain", b: "route", mA: "nemotron", mB: "routed" },
  { a: "code", b: "guard", mA: "deploy?", mB: "clear ✓" },
];

// Real LLM conversation fetcher
async function fetchRealChat(agentA: string, agentB: string): Promise<{ a: string; b: string } | null> {
  try {
    const res = await fetch("/api/agents/smart-router", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `You are two AI agents meeting in a digital office. Agent "${agentA}" meets Agent "${agentB}". Write a 2-line exchange (max 4 words each). Format: A: [message]\nB: [message]. Be specific to their roles. No generic greetings.`,
        task_type: "creative",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.result || data.response || "";
    const lines = text.split("\n").filter((l: string) => l.trim());
    const lineA = lines[0]?.replace(/^[AB]:\s*/i, "").trim().slice(0, 20) || "";
    const lineB = lines[1]?.replace(/^[AB]:\s*/i, "").trim().slice(0, 20) || "";
    return lineA && lineB ? { a: lineA, b: lineB } : null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// THE MASCOT — Claude exact. Solid block. Dot eyes. Feet.
// ═══════════════════════════════════════════════════════

function Mascot({ color, frame, faceR, mode }: {
  color: string; frame: number; faceR: boolean; mode: Bot["mode"];
}) {
  const walking = mode === "walk";
  const f1 = walking && frame % 2 === 0;
  const f2 = walking && frame % 2 !== 0;

  return (
    <svg width="28" height="32" viewBox="0 0 28 32"
      style={{ imageRendering: "pixelated", transform: faceR ? "" : "scaleX(-1)" }}>

      {/* Shadow on ground */}
      <ellipse cx="14" cy="31" rx="9" ry="2" fill="rgba(0,0,0,0.3)" />

      {/* BODY — one solid rounded rectangle. That's it. */}
      <rect x="3" y="3" width="22" height="20" rx="5" ry="5" fill={color} />

      {/* EYES — two tiny dark dots. Nothing else. */}
      {mode === "think" ? (
        <>
          <line x1="8" y1="12" x2="12" y2="12" stroke="#000" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="16" y1="12" x2="20" y2="12" stroke="#000" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        </>
      ) : (
        <>
          <circle cx="10" cy="12" r="2" fill="#000" opacity="0.7" />
          <circle cx="18" cy="12" r="2" fill="#000" opacity="0.7" />
        </>
      )}

      {/* FEET — two stubby ovals at the bottom. Same color, slightly darker. */}
      <motion.ellipse
        cx="9" cy="25" rx="4" ry="3.5"
        fill={color}
        stroke="rgba(0,0,0,0.1)" strokeWidth="0.5"
        style={{ transformOrigin: "9px 23px" }}
        animate={walking ? { rotate: f1 ? [0, 15, 0] : f2 ? [0, -8, 0] : [0] } : {}}
        transition={{ duration: 0.15, repeat: walking ? Infinity : 0 }}
      />
      <motion.ellipse
        cx="19" cy="25" rx="4" ry="3.5"
        fill={color}
        stroke="rgba(0,0,0,0.1)" strokeWidth="0.5"
        style={{ transformOrigin: "19px 23px" }}
        animate={walking ? { rotate: f2 ? [0, -15, 0] : f1 ? [0, 8, 0] : [0] } : {}}
        transition={{ duration: 0.15, repeat: walking ? Infinity : 0 }}
      />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
// THE WORLD
// ═══════════════════════════════════════════════════════

export function AgentOffice() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [task, setTask] = useState<{ x: number; y: number } | null>(null);
  const [realChat, setRealChat] = useState<{ pair: string; a: string; b: string } | null>(null);
  const chatCooldown = useRef(false);
  const fr = useRef(0);
  const wRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBots(BOTS.map((b, i) => ({
      ...b,
      x: 80 + (i % 4) * 190 + Math.random() * 50,
      y: 70 + Math.floor(i / 4) * 140 + Math.random() * 40,
      tx: Math.random() * (W - 120) + 60,
      ty: Math.random() * (H - 120) + 60,
      mode: "sit" as const, msg: "", frame: 0,
      faceR: Math.random() > 0.5, cd: 30 + Math.random() * 80,
    })));
  }, []);

  useEffect(() => {
    const loop = setInterval(() => {
      fr.current++;
      const f = fr.current;
      setBots(prev => prev.map(b => {
        let { x, y, tx, ty, mode, msg, frame, faceR, cd } = b;
        cd--;
        if (task && mode !== "chat") { tx = task.x + (Math.random() - 0.5) * 50; ty = task.y + (Math.random() - 0.5) * 50; mode = "walk"; }
        const dx = tx - x, dy = ty - y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 10 && mode === "walk") {
          const r = Math.random();
          mode = r < 0.3 ? "think" : r < 0.55 ? "work" : "sit";
          cd = 50 + Math.random() * 60;
          msg = mode === "work" ? (MSGS[b.id]?.[Math.floor(Math.random() * 3)] || "") : "";
        }
        if (cd <= 0 && mode !== "chat") {
          mode = "walk"; tx = Math.random() * (W - 120) + 60; ty = Math.random() * (H - 120) + 60;
          cd = 100 + Math.random() * 80; msg = "";
        }
        if (mode === "walk" && d > 3) {
          x += (dx / d) * 0.7; y += (dy / d) * 0.7; faceR = dx > 0;
          if (f % 5 === 0) frame++;
        }
        if (f % 80 === 0 && mode !== "chat") {
          // Check proximity with any other agent
          const nearby = prev.find(o => o.id !== b.id &&
            Math.abs(o.x - x) < 65 && Math.abs(o.y - y) < 65 && o.mode !== "chat");
          if (nearby) {
            // Try canned message first (instant)
            const c = TALKS.find(t => (t.a === b.id || t.b === b.id) &&
              (t.a === nearby.id || t.b === nearby.id));
            if (c) {
              mode = "chat"; msg = c.a === b.id ? c.mA : c.mB; cd = 55;
            } else {
              // Fallback: random status message
              mode = "chat"; msg = MSGS[b.id]?.[Math.floor(Math.random() * 3)] || "hey"; cd = 55;
            }

            // Fire real LLM chat in background (updates bubble async)
            if (!chatCooldown.current) {
              chatCooldown.current = true;
              const pairKey = [b.id, nearby.id].sort().join("-");
              fetchRealChat(b.name, nearby.name).then(result => {
                if (result) {
                  setRealChat({ pair: pairKey, a: result.a, b: result.b });
                  // Update the speaking agent's message with the real response
                  setBots(p => p.map(bot => {
                    if (bot.id === b.id) return { ...bot, msg: result.a };
                    if (bot.id === nearby.id) return { ...bot, msg: result.b, mode: "chat" as const, cd: 55 };
                    return bot;
                  }));
                }
                setTimeout(() => { chatCooldown.current = false; }, 15000); // 15s cooldown
              });
            }
          }
        }
        x = Math.max(30, Math.min(W - 50, x)); y = Math.max(30, Math.min(H - 70, y));
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
        <p className="text-neutral-600 text-sm">Click anywhere to drop a task. Watch them swarm.</p>
      </motion.div>

      <div ref={wRef} onClick={click}
        className="relative rounded-2xl overflow-hidden cursor-crosshair"
        style={{ aspectRatio: `${W}/${H}`, perspective: "800px" }}>

        {/* 3D isometric floor */}
        <div className="absolute inset-0" style={{
          background: "#0a0a0f",
          transform: "rotateX(5deg)",
          transformOrigin: "center bottom",
        }}>
          {/* Glowing grid lines */}
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(16,185,129,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(16,185,129,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }} />

          {/* Radial glow from center */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_80%,rgba(16,185,129,0.08)_0%,transparent_70%)]" />
        </div>

        {/* Ambient floating particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div key={i}
            className="absolute rounded-full"
            style={{
              width: 1 + Math.random() * 2,
              height: 1 + Math.random() * 2,
              backgroundColor: `rgba(16,185,129,${0.1 + Math.random() * 0.2})`,
            }}
            animate={{
              left: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
              top: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
              opacity: [0, 0.4, 0],
            }}
            transition={{ duration: 8 + Math.random() * 10, repeat: Infinity, delay: i * 0.7, ease: "linear" }}
          />
        ))}

        {/* Holographic screen panels in the background */}
        {[
          { x: 5, y: 10, w: 50, h: 35 },
          { x: 75, y: 8, w: 55, h: 30 },
          { x: 40, y: 65, w: 45, h: 28 },
        ].map((panel, i) => (
          <div key={i} className="absolute rounded border border-emerald-500/[0.06] bg-emerald-500/[0.015] backdrop-blur-sm"
            style={{ left: `${panel.x}px`, top: `${panel.y}px`, width: `${panel.w}px`, height: `${panel.h}px` }}>
            <motion.div className="w-3/4 h-1 bg-emerald-500/10 rounded-full m-1.5"
              animate={{ width: ["40%", "80%", "40%"] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
            />
            <div className="w-1/2 h-0.5 bg-emerald-500/5 rounded-full m-1.5" />
            <div className="w-2/3 h-0.5 bg-emerald-500/5 rounded-full m-1.5" />
          </div>
        ))}

        {/* Task beacon */}
        <AnimatePresence>
          {task && (
            <motion.div initial={{ scale: 0 }}
              animate={{ scale: [1, 3, 1], opacity: [0.6, 0, 0.6] }}
              exit={{ scale: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute w-2 h-2 rounded-full bg-emerald-400 z-10"
              style={{ left: `${(task.x / W) * 100}%`, top: `${(task.y / H) * 100}%`, transform: "translate(-50%,-50%)" }}
            />
          )}
        </AnimatePresence>

        {/* ═══ THE BOTS ═══ */}
        {bots.map(b => (
          <div key={b.id} className="absolute z-10"
            style={{
              left: `${(b.x / W) * 100}%`, top: `${(b.y / H) * 100}%`,
              transform: "translate(-50%,-50%)",
              transition: "left 50ms linear, top 50ms linear",
              zIndex: Math.round(b.y), // depth sorting!
            }}>
            <div className="relative flex flex-col items-center">

              {/* Speech bubble */}
              <AnimatePresence>
                {b.msg && (b.mode === "chat" || b.mode === "work") && (
                  <motion.div
                    initial={{ opacity: 0, y: 3, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute -top-6 left-1/2 -translate-x-1/2 z-30"
                  >
                    <div className="px-1.5 py-0.5 rounded bg-white text-[6px] font-mono text-neutral-700 whitespace-nowrap">
                      {b.msg}
                    </div>
                    <div className="w-0 h-0 mx-auto" style={{
                      borderLeft: "2px solid transparent", borderRight: "2px solid transparent", borderTop: "2px solid white"
                    }} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Thinking dots */}
              {b.mode === "think" && (
                <motion.div className="absolute -top-4 flex gap-[2px]"
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity }}>
                  <div className="w-[3px] h-[3px] rounded-full bg-white/30" />
                  <div className="w-[3px] h-[3px] rounded-full bg-white/20" />
                  <div className="w-[4px] h-[4px] rounded-full bg-white/10" />
                </motion.div>
              )}

              {/* The mascot */}
              <motion.div
                animate={
                  b.mode === "think" ? { y: [0, -3, 0] } :
                  b.mode === "work" ? { y: [0, -1, 0] } :
                  b.mode === "sit" ? { y: [0, -1, 0] } :
                  {}
                }
                transition={{
                  duration: b.mode === "think" ? 2 : 3,
                  repeat: Infinity, ease: "easeInOut",
                }}
              >
                <Mascot color={b.color} frame={b.frame} faceR={b.faceR} mode={b.mode} />
              </motion.div>

              {/* Name */}
              <span className="text-[5px] font-mono text-white/15 uppercase tracking-[0.12em] mt-[-2px]">
                {b.name}
              </span>
            </div>
          </div>
        ))}

        {/* Bottom status bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-1.5 bg-gradient-to-t from-black/60 to-transparent z-20">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[7px] text-emerald-400/50 font-mono uppercase tracking-[0.2em]">8 agents live</span>
          </div>
          <span className="text-[7px] text-white/10 font-mono">click to assign task</span>
          <span className="text-[7px] text-white/10 font-mono">$0 inference</span>
        </div>

        {/* Top vignette for depth */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#0a0a0f] to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}
