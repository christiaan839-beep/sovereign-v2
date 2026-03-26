"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

/**
 * AgentOffice — A living, breathing digital workspace where robot agents
 * work, move around, interact with objects, and collaborate.
 *
 * NOT a static grid. This is an animated SCENE with:
 * - Desks, monitors, phones, servers
 * - Robots sitting at desks typing
 * - Robots walking between stations
 * - Robots handing files to each other
 * - A phone ringing and a robot answering
 * - Live status updates in speech bubbles
 */

// ─── Tiny Robot Component (Claude-style) ─────────────────

function Robot({
  color,
  darkColor,
  x,
  y,
  activity,
  accessory,
  label,
  speech,
  flip,
}: {
  color: string;
  darkColor: string;
  x: number;
  y: number;
  activity: "sitting" | "typing" | "walking" | "calling" | "scanning" | "thinking" | "handing" | "waving";
  accessory?: "headset" | "antenna" | "hat" | "scope" | "glasses";
  label: string;
  speech?: string;
  flip?: boolean;
}) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 120);
    }, 2500 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  // Walking animation — actually moves the robot
  const positionAnim = activity === "walking"
    ? { x: [x, x + 30, x + 30, x], y: [y, y, y - 5, y], transition: { duration: 6, repeat: Infinity, ease: "linear" } }
    : {};

  return (
    <motion.g
      style={{ transform: `translate(${x}px, ${y}px)${flip ? " scaleX(-1)" : ""}` }}
      animate={positionAnim}
    >
      {/* Speech bubble */}
      {speech && (
        <motion.g
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: [0, 1, 1, 0], y: [0, -2, -2, -5] }}
          transition={{ duration: 4, repeat: Infinity, repeatDelay: 3 }}
        >
          <rect x={flip ? -70 : -5} y="-22" width={speech.length * 3.8 + 10} height="14" rx="4" fill="white" opacity="0.9" />
          <polygon points={flip ? "-15,-8 -10,-8 -12,-3" : "5,-8 10,-8 8,-3"} fill="white" opacity="0.9" />
          <text x={flip ? -65 : 0} y="-12" fontSize="5" fill="#111" fontFamily="monospace">{speech}</text>
        </motion.g>
      )}

      {/* Shadow */}
      <ellipse cx="10" cy="35" rx="7" ry="2" fill="rgba(0,0,0,0.2)" />

      {/* Left arm */}
      <motion.rect
        x="-2" y="14" width="4" height="10" rx="2" fill={color}
        style={{ transformOrigin: "0px 14px" }}
        animate={
          activity === "typing" ? { rotate: [-15, -30, -15], transition: { duration: 0.25, repeat: Infinity } } :
          activity === "calling" ? { rotate: [-60], transition: { duration: 0.5 } } :
          activity === "waving" || activity === "handing" ? { rotate: [-40, -70, -40], transition: { duration: 0.6, repeat: Infinity } } :
          activity === "walking" ? { rotate: [10, -10], transition: { duration: 0.3, repeat: Infinity, repeatType: "reverse" } } :
          { rotate: [0, 3, 0], transition: { duration: 2, repeat: Infinity } }
        }
      />

      {/* Right arm */}
      <motion.rect
        x="18" y="14" width="4" height="10" rx="2" fill={color}
        style={{ transformOrigin: "20px 14px" }}
        animate={
          activity === "typing" ? { rotate: [15, 30, 15], transition: { duration: 0.3, repeat: Infinity } } :
          activity === "calling" ? { rotate: [0, 5, 0], transition: { duration: 1, repeat: Infinity } } :
          activity === "handing" ? { rotate: [30, 60, 30], transition: { duration: 0.8, repeat: Infinity } } :
          activity === "walking" ? { rotate: [-10, 10], transition: { duration: 0.3, repeat: Infinity, repeatType: "reverse" } } :
          { rotate: [0, -3, 0], transition: { duration: 2, repeat: Infinity, delay: 0.3 } }
        }
      />

      {/* Body */}
      <rect x="3" y="12" width="14" height="16" rx="3" fill={color} />
      <rect x="4" y="13" width="12" height="5" rx="2" fill="white" opacity="0.1" />

      {/* Legs */}
      <motion.g animate={
        activity === "walking"
          ? { rotate: [5, -5], transition: { duration: 0.3, repeat: Infinity, repeatType: "reverse" } }
          : {}
      } style={{ transformOrigin: "7px 28px" }}>
        <rect x="4" y="28" width="4" height="6" rx="1.5" fill={darkColor} />
      </motion.g>
      <motion.g animate={
        activity === "walking"
          ? { rotate: [-5, 5], transition: { duration: 0.3, repeat: Infinity, repeatType: "reverse" } }
          : {}
      } style={{ transformOrigin: "13px 28px" }}>
        <rect x="12" y="28" width="4" height="6" rx="1.5" fill={darkColor} />
      </motion.g>

      {/* Head */}
      <motion.g animate={
        activity === "thinking"
          ? { y: [0, -1, 0], transition: { duration: 2, repeat: Infinity } }
          : activity === "scanning"
          ? { rotate: [-3, 3, -3], transition: { duration: 1.5, repeat: Infinity } }
          : { y: [0, -0.5, 0], transition: { duration: 3, repeat: Infinity } }
      } style={{ transformOrigin: "10px 6px" }}>
        <rect x="3" y="0" width="14" height="12" rx="4" fill={color} />

        {/* Eyes */}
        <rect x="6" y={blink ? "5" : "4"} width="3" height={blink ? "1" : "3"} rx="1" fill="white" />
        <rect x="11" y={blink ? "5" : "4"} width="3" height={blink ? "1" : "3"} rx="1" fill="white" />
        {!blink && (
          <>
            <rect x="7" y="5" width="1.5" height="1.5" rx="0.5" fill={darkColor} />
            <rect x="12" y="5" width="1.5" height="1.5" rx="0.5" fill={darkColor} />
          </>
        )}

        {/* Mouth */}
        {activity === "calling" || activity === "waving" ? (
          <motion.ellipse cx="10" cy="9" rx="2" fill={darkColor}
            animate={{ ry: [0.5, 1.5, 0.5] }}
            transition={{ duration: 0.4, repeat: Infinity }}
          />
        ) : (
          <rect x="7" y="9" width="6" height="1" rx="0.5" fill={darkColor} opacity="0.4" />
        )}

        {/* Accessories */}
        {accessory === "headset" && (
          <>
            <path d="M2 5 Q2 -2 10 -2 Q18 -2 18 5" stroke={darkColor} strokeWidth="1.5" fill="none" />
            <rect x="0" y="4" width="3" height="4" rx="1" fill={darkColor} />
            <rect x="17" y="4" width="3" height="4" rx="1" fill={darkColor} />
          </>
        )}
        {accessory === "antenna" && (
          <motion.g animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 1.5, repeat: Infinity }}
            style={{ transformOrigin: "10px 0px" }}>
            <line x1="10" y1="0" x2="10" y2="-5" stroke={darkColor} strokeWidth="1.5" />
            <motion.circle cx="10" cy="-6" r="2" fill={color}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </motion.g>
        )}
        {accessory === "hat" && (
          <>
            <rect x="1" y="-1" width="18" height="3" rx="1" fill={darkColor} />
            <rect x="4" y="-3" width="12" height="3" rx="2" fill={color} />
          </>
        )}
        {accessory === "scope" && (
          <motion.g animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "16px -2px" }}>
            <circle cx="16" cy="-2" r="3" stroke={color} strokeWidth="1" fill="none" />
            <circle cx="16" cy="-2" r="1" fill={color} />
          </motion.g>
        )}
        {accessory === "glasses" && (
          <>
            <circle cx="7" cy="5" r="2.5" stroke={darkColor} strokeWidth="0.8" fill="none" />
            <circle cx="13" cy="5" r="2.5" stroke={darkColor} strokeWidth="0.8" fill="none" />
            <line x1="9.5" y1="5" x2="10.5" y2="5" stroke={darkColor} strokeWidth="0.8" />
          </>
        )}
      </motion.g>

      {/* Thinking dots */}
      {activity === "thinking" && (
        <motion.g animate={{ opacity: [0, 1, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <circle cx="22" cy="-2" r="1" fill="white" opacity="0.4" />
          <circle cx="25" cy="-5" r="1.5" fill="white" opacity="0.3" />
          <circle cx="29" cy="-8" r="2" fill="white" opacity="0.2" />
        </motion.g>
      )}

      {/* Label */}
      <text x="10" y="42" textAnchor="middle" fontSize="4" fill="rgba(255,255,255,0.4)" fontFamily="monospace" fontWeight="bold">
        {label}
      </text>
    </motion.g>
  );
}

// ─── Office Furniture ─────────────────────────────────────

function Desk({ x, y, width = 30 }: { x: number; y: number; width?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height="3" rx="1" fill="#1a1a2e" stroke="rgba(16,185,129,0.1)" strokeWidth="0.5" />
      <rect x={x + 2} y={y + 3} width="2" height="8" fill="#0f0f1a" />
      <rect x={x + width - 4} y={y + 3} width="2" height="8" fill="#0f0f1a" />
    </g>
  );
}

function Monitor({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="12" height="8" rx="1" fill="#111122" stroke="rgba(16,185,129,0.15)" strokeWidth="0.5" />
      <motion.rect x={x + 1} y={y + 1} width="10" height="6" rx="0.5" fill="#0a0a15"
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      {/* Screen glow lines */}
      <motion.rect x={x + 2} y={y + 2} width="6" height="0.5" rx="0.25" fill="rgba(16,185,129,0.3)"
        animate={{ width: [4, 8, 4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <rect x={x + 2} y={y + 3.5} width="4" height="0.5" rx="0.25" fill="rgba(16,185,129,0.15)" />
      <rect x={x + 2} y={y + 5} width="5" height="0.5" rx="0.25" fill="rgba(16,185,129,0.1)" />
      {/* Stand */}
      <rect x={x + 5} y={y + 8} width="2" height="3" fill="#111122" />
      <rect x={x + 3} y={y + 11} width="6" height="1" rx="0.5" fill="#111122" />
    </g>
  );
}

function ServerRack({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="15" height="25" rx="2" fill="#0a0a15" stroke="rgba(16,185,129,0.1)" strokeWidth="0.5" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={x + 1} y={y + 2 + i * 4.5} width="13" height="3.5" rx="0.5" fill="#111122" />
          <motion.circle cx={x + 12} cy={y + 3.5 + i * 4.5} r="0.8" fill="#10B981"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        </g>
      ))}
    </g>
  );
}

// ─── Main Scene ──────────────────────────────────────────

export function AgentOffice() {
  const [activeAgent, setActiveAgent] = useState<string | null>(null);

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
        <p className="text-neutral-500 max-w-lg mx-auto text-sm">Right now. Autonomously. No prompts needed.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="relative rounded-3xl border border-white/[0.06] bg-[#050508] overflow-hidden"
        style={{ aspectRatio: "16/7" }}
      >
        {/* Floor grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(16,185,129,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
          transform: "perspective(400px) rotateX(15deg)",
          transformOrigin: "center bottom",
        }} />

        <svg viewBox="0 0 400 175" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Office furniture */}
          <Desk x={30} y={90} width={35} />
          <Monitor x={38} y={78} />
          <Desk x={100} y={80} width={35} />
          <Monitor x={108} y={68} />
          <Desk x={220} y={85} width={35} />
          <Monitor x={228} y={73} />
          <ServerRack x={340} y={55} />
          <Desk x={280} y={100} width={30} />

          {/* Phone on desk */}
          <rect x={290} y={97} width="8" height="5" rx="1" fill="#1a1a2e" />
          <motion.circle cx={294} cy={96} r="1" fill="#EF4444"
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />

          {/* Coffee mug on desk */}
          <rect x={55} y={88} width="4" height="5" rx="1" fill="#2a2a3e" />
          <rect x={54} y={87} width="6" height="2" rx="1" fill="#2a2a3e" />

          {/* ═══ THE AGENTS ═══ */}

          {/* God Brain — sitting at desk, thinking, antenna glowing */}
          <Robot
            color="#EC4899" darkColor="#9D174D"
            x={40} y={55}
            activity="thinking"
            accessory="antenna"
            label="GOD BRAIN"
            speech="Synthesizing strategy..."
          />

          {/* Content Engine — typing at desk */}
          <Robot
            color="#06B6D4" darkColor="#0E7490"
            x={110} y={45}
            activity="typing"
            accessory="glasses"
            label="CONTENT"
            speech="4.2% AI score ✓"
          />

          {/* Lead Hunter — scanning, walking between desks */}
          <Robot
            color="#10B981" darkColor="#047857"
            x={170} y={65}
            activity="walking"
            accessory="scope"
            label="HUNTER"
            speech="53 leads found!"
          />

          {/* Voice Closer — on the phone at desk */}
          <Robot
            color="#EF4444" darkColor="#991B1B"
            x={285} y={65}
            activity="calling"
            accessory="headset"
            label="CLOSER"
            speech="Booking meeting..."
          />

          {/* Code Agent — typing code at desk */}
          <Robot
            color="#A855F7" darkColor="#6B21A8"
            x={230} y={50}
            activity="typing"
            label="CODER"
            speech="Building page..."
          />

          {/* Smart Router — standing by server rack */}
          <Robot
            color="#14B8A6" darkColor="#0F766E"
            x={350} y={40}
            activity="scanning"
            label="ROUTER"
            speech="1,247 routed ($0)"
            flip
          />

          {/* SEO Dominator — walking with data */}
          <Robot
            color="#F59E0B" darkColor="#92400E"
            x={80} y={110}
            activity="walking"
            accessory="scope"
            label="SEO"
          />

          {/* Guardrails — standing guard near server */}
          <Robot
            color="#6366F1" darkColor="#3730A3"
            x={310} y={80}
            activity="sitting"
            label="GUARD"
            speech="0 threats"
          />

          {/* File being handed between agents — floating document */}
          <motion.g
            animate={{
              x: [180, 250, 250, 180],
              y: [80, 65, 65, 80],
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: 5, repeat: Infinity, repeatDelay: 2 }}
          >
            <rect x="0" y="0" width="8" height="10" rx="1" fill="white" opacity="0.15" />
            <rect x="1" y="2" width="6" height="0.5" fill="rgba(16,185,129,0.3)" />
            <rect x="1" y="3.5" width="4" height="0.5" fill="rgba(16,185,129,0.2)" />
            <rect x="1" y="5" width="5" height="0.5" fill="rgba(16,185,129,0.15)" />
          </motion.g>

          {/* Data stream particles — flowing between desks */}
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.circle
              key={`particle-${i}`}
              r="1"
              fill="#10B981"
              opacity="0.3"
              animate={{
                cx: [50 + i * 20, 350],
                cy: [100 - i * 5, 60 + i * 3],
                opacity: [0, 0.4, 0],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.8,
                ease: "linear",
              }}
            />
          ))}
        </svg>

        {/* Status bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 py-2.5 bg-[#050508]/90 backdrop-blur-sm border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[9px] text-emerald-400/70 font-mono uppercase tracking-wider">8 Agents Active</span>
          </div>
          <span className="text-[9px] text-neutral-600 font-mono">sovereign-matrix.agency/office</span>
          <span className="text-[9px] text-neutral-600 font-mono">$0 inference cost</span>
        </div>
      </motion.div>
    </div>
  );
}
