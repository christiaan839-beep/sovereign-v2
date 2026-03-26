"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";

/**
 * AgentCharacter — Blocky pixel-art robot characters like Claude's mascot.
 * Each agent has a unique color, accessory, and activity animation.
 *
 * The robots move around, wave, type, scan, talk, and do their jobs.
 * They feel alive — not static icons.
 */

type CharacterType =
  | "brain" | "hunter" | "writer" | "coder" | "shield"
  | "caller" | "search" | "router" | "scout" | "builder"
  | "memory" | "general";

interface Props {
  type: CharacterType;
  size?: number;
  activity?: "idle" | "working" | "walking" | "waving" | "typing" | "scanning" | "talking" | "thinking";
  label?: string;
  className?: string;
}

const COLORS: Record<CharacterType, { body: string; dark: string; light: string; accent: string }> = {
  brain:   { body: "#EC4899", dark: "#BE185D", light: "#F9A8D4", accent: "#A855F7" },
  hunter:  { body: "#10B981", dark: "#047857", light: "#6EE7B7", accent: "#34D399" },
  writer:  { body: "#06B6D4", dark: "#0E7490", light: "#67E8F9", accent: "#22D3EE" },
  coder:   { body: "#A855F7", dark: "#7C3AED", light: "#C4B5FD", accent: "#10B981" },
  shield:  { body: "#6366F1", dark: "#4338CA", light: "#A5B4FC", accent: "#818CF8" },
  caller:  { body: "#EF4444", dark: "#B91C1C", light: "#FCA5A5", accent: "#F87171" },
  search:  { body: "#F59E0B", dark: "#B45309", light: "#FCD34D", accent: "#FBBF24" },
  router:  { body: "#14B8A6", dark: "#0F766E", light: "#5EEAD4", accent: "#2DD4BF" },
  scout:   { body: "#64748B", dark: "#334155", light: "#94A3B8", accent: "#10B981" },
  builder: { body: "#F97316", dark: "#C2410C", light: "#FDBA74", accent: "#FB923C" },
  memory:  { body: "#06B6D4", dark: "#0891B2", light: "#67E8F9", accent: "#A855F7" },
  general: { body: "#10B981", dark: "#047857", light: "#6EE7B7", accent: "#34D399" },
};

export function AgentCharacter({ type, size = 48, activity = "idle", label, className = "" }: Props) {
  const c = COLORS[type];
  const [blink, setBlink] = useState(false);

  // Random blinking
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 2000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  // Activity-based animations
  const bodyAnim = {
    idle: { y: [0, -2, 0], transition: { duration: 2, repeat: Infinity, ease: "easeInOut" } },
    working: { y: [0, -1, 0], transition: { duration: 0.8, repeat: Infinity } },
    walking: { y: [0, -3, 0], x: [0, 1, 0, -1, 0], transition: { duration: 0.6, repeat: Infinity } },
    waving: { y: [0, -2, 0], transition: { duration: 1.5, repeat: Infinity } },
    typing: { y: [0, -1, 0], transition: { duration: 0.3, repeat: Infinity } },
    scanning: { y: [0, -1, 0], rotate: [-2, 2, -2], transition: { duration: 1, repeat: Infinity } },
    talking: { y: [0, -1, 0], scaleY: [1, 1.02, 1], transition: { duration: 0.5, repeat: Infinity } },
    thinking: { y: [0, -3, 0], transition: { duration: 3, repeat: Infinity } },
  };

  const leftArmAnim = {
    idle: { rotate: [0, 5, 0], transition: { duration: 2, repeat: Infinity } },
    working: { rotate: [0, -15, 0], transition: { duration: 0.6, repeat: Infinity } },
    walking: { rotate: [15, -15], transition: { duration: 0.3, repeat: Infinity, repeatType: "reverse" as const } },
    waving: { rotate: [0, 5, 0], transition: { duration: 2, repeat: Infinity } },
    typing: { rotate: [-10, -20, -10], transition: { duration: 0.2, repeat: Infinity } },
    scanning: { rotate: [0, -10, 0], transition: { duration: 1, repeat: Infinity } },
    talking: { rotate: [0, 5, 0], transition: { duration: 1, repeat: Infinity } },
    thinking: { rotate: [0, 5, 0], transition: { duration: 3, repeat: Infinity } },
  };

  const rightArmAnim = {
    idle: { rotate: [0, -5, 0], transition: { duration: 2, repeat: Infinity, delay: 0.5 } },
    working: { rotate: [0, 15, 0], transition: { duration: 0.6, repeat: Infinity } },
    walking: { rotate: [-15, 15], transition: { duration: 0.3, repeat: Infinity, repeatType: "reverse" as const } },
    waving: { rotate: [-30, -60, -30], transition: { duration: 0.5, repeat: Infinity } },
    typing: { rotate: [10, 20, 10], transition: { duration: 0.25, repeat: Infinity } },
    scanning: { rotate: [0, 10, 0], transition: { duration: 1, repeat: Infinity } },
    talking: { rotate: [-5, -15, -5], transition: { duration: 0.8, repeat: Infinity } },
    thinking: { rotate: [0, -30, 0], transition: { duration: 3, repeat: Infinity } },
  };

  const leftLegAnim = {
    idle: {},
    working: {},
    walking: { rotate: [10, -10], transition: { duration: 0.3, repeat: Infinity, repeatType: "reverse" as const } },
    waving: {},
    typing: {},
    scanning: {},
    talking: {},
    thinking: {},
  };

  const rightLegAnim = {
    idle: {},
    working: {},
    walking: { rotate: [-10, 10], transition: { duration: 0.3, repeat: Infinity, repeatType: "reverse" as const } },
    waving: {},
    typing: {},
    scanning: {},
    talking: {},
    thinking: {},
  };

  return (
    <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
      <motion.svg
        viewBox="0 0 40 52"
        width={size}
        height={size * 1.3}
        fill="none"
        animate={bodyAnim[activity]}
      >
        {/* Shadow */}
        <ellipse cx="20" cy="50" rx="10" ry="2" fill="rgba(0,0,0,0.3)" />

        {/* Left leg */}
        <motion.g style={{ transformOrigin: "14px 38px" }} animate={leftLegAnim[activity]}>
          <rect x="11" y="38" width="6" height="8" rx="2" fill={c.dark} />
          <rect x="10" y="44" width="8" height="4" rx="2" fill={c.dark} />
        </motion.g>

        {/* Right leg */}
        <motion.g style={{ transformOrigin: "26px 38px" }} animate={rightLegAnim[activity]}>
          <rect x="23" y="38" width="6" height="8" rx="2" fill={c.dark} />
          <rect x="22" y="44" width="8" height="4" rx="2" fill={c.dark} />
        </motion.g>

        {/* Left arm */}
        <motion.g style={{ transformOrigin: "8px 22px" }} animate={leftArmAnim[activity]}>
          <rect x="2" y="22" width="6" height="14" rx="3" fill={c.body} />
          <rect x="2" y="33" width="6" height="5" rx="3" fill={c.dark} />
        </motion.g>

        {/* Right arm */}
        <motion.g style={{ transformOrigin: "32px 22px" }} animate={rightArmAnim[activity]}>
          <rect x="32" y="22" width="6" height="14" rx="3" fill={c.body} />
          <rect x="32" y="33" width="6" height="5" rx="3" fill={c.dark} />

          {/* Waving hand sparkle */}
          {activity === "waving" && (
            <motion.circle cx="35" cy="33" r="2" fill={c.accent}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}
        </motion.g>

        {/* Body */}
        <rect x="8" y="18" width="24" height="22" rx="4" fill={c.body} />
        <rect x="10" y="20" width="20" height="8" rx="3" fill={c.light} opacity="0.2" />

        {/* Chest emblem per type */}
        {type === "shield" && (
          <path d="M20 28 L25 30 L25 34 Q25 37 20 38 Q15 37 15 34 L15 30 Z" fill={c.light} opacity="0.3" />
        )}
        {type === "coder" && (
          <text x="13" y="34" fill={c.accent} fontSize="6" fontFamily="monospace" fontWeight="bold">&lt;/&gt;</text>
        )}
        {type === "router" && (
          <motion.circle cx="20" cy="32" r="3" fill={c.accent} opacity="0.5"
            animate={{ r: [3, 5, 3], opacity: [0.5, 0.2, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}

        {/* Head */}
        <rect x="10" y="4" width="20" height="16" rx="5" fill={c.body} />
        <rect x="12" y="6" width="16" height="6" rx="3" fill={c.light} opacity="0.15" />

        {/* Eyes */}
        <rect x="14" y={blink ? "11" : "9"} width="4" height={blink ? "1" : "4"} rx="1" fill="white" />
        <rect x="22" y={blink ? "11" : "9"} width="4" height={blink ? "1" : "4"} rx="1" fill="white" />

        {/* Pupils — look in activity direction */}
        {!blink && (
          <>
            <rect x={activity === "scanning" ? "15" : "15"} y="10" width="2" height="2" rx="0.5" fill={c.dark} />
            <rect x={activity === "scanning" ? "23" : "23"} y="10" width="2" height="2" rx="0.5" fill={c.dark} />
          </>
        )}

        {/* Mouth */}
        {activity === "talking" ? (
          <motion.rect x="16" y="14" width="8" rx="1" fill={c.dark}
            animate={{ height: [2, 4, 2] }}
            transition={{ duration: 0.3, repeat: Infinity }}
          />
        ) : activity === "thinking" ? (
          <circle cx="22" cy="15" r="1.5" fill={c.dark} opacity="0.5" />
        ) : (
          <rect x="16" y="14" width="8" height="2" rx="1" fill={c.dark} opacity="0.5" />
        )}

        {/* Accessories per type */}
        {/* Brain — antenna */}
        {type === "brain" && (
          <motion.g animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 2, repeat: Infinity }}
            style={{ transformOrigin: "20px 4px" }}>
            <line x1="20" y1="4" x2="20" y2="-2" stroke={c.accent} strokeWidth="2" />
            <motion.circle cx="20" cy="-3" r="2.5" fill={c.accent}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.g>
        )}

        {/* Hunter — target scope above head */}
        {type === "hunter" && (
          <motion.g animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "20px 0px" }}>
            <circle cx="20" cy="0" r="4" stroke={c.accent} strokeWidth="1" fill="none" />
            <circle cx="20" cy="0" r="1" fill={c.accent} />
          </motion.g>
        )}

        {/* Writer — floating pencil */}
        {type === "writer" && (
          <motion.g animate={{ rotate: [-10, 10, -10], y: [-1, 1, -1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ transformOrigin: "34px 10px" }}>
            <rect x="33" y="6" width="2" height="10" rx="1" fill={c.accent} transform="rotate(20, 34, 11)" />
          </motion.g>
        )}

        {/* Caller — headset */}
        {type === "caller" && (
          <>
            <path d="M9 10 Q9 2 20 2 Q31 2 31 10" stroke={c.dark} strokeWidth="2" fill="none" />
            <rect x="6" y="8" width="4" height="6" rx="2" fill={c.dark} />
            <rect x="30" y="8" width="4" height="6" rx="2" fill={c.dark} />
          </>
        )}

        {/* Search — magnifier */}
        {type === "search" && (
          <motion.g animate={{ x: [-1, 1, -1] }} transition={{ duration: 2, repeat: Infinity }}>
            <circle cx="32" cy="4" r="4" stroke={c.accent} strokeWidth="1.5" fill="none" />
            <line x1="35" y1="7" x2="38" y2="10" stroke={c.accent} strokeWidth="1.5" />
          </motion.g>
        )}

        {/* Builder — hard hat */}
        {type === "builder" && (
          <>
            <rect x="8" y="2" width="24" height="4" rx="2" fill={c.accent} />
            <rect x="12" y="0" width="16" height="4" rx="3" fill={c.body} />
          </>
        )}

        {/* Scout — binoculars */}
        {type === "scout" && (
          <>
            <circle cx="15" cy="2" r="3" fill={c.dark} />
            <circle cx="25" cy="2" r="3" fill={c.dark} />
            <rect x="18" y="1" width="4" height="3" rx="1" fill={c.dark} />
          </>
        )}

        {/* Memory — brain glow */}
        {type === "memory" && (
          <motion.circle cx="20" cy="2" r="4" fill={c.accent} opacity="0.4"
            animate={{ r: [4, 6, 4], opacity: [0.4, 0.2, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Thinking bubble */}
        {activity === "thinking" && (
          <motion.g animate={{ opacity: [0, 1, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <circle cx="30" cy="2" r="1.5" fill="white" opacity="0.4" />
            <circle cx="33" cy="-1" r="2" fill="white" opacity="0.3" />
            <circle cx="37" cy="-4" r="3" fill="white" opacity="0.2" />
          </motion.g>
        )}

        {/* Working sparkles */}
        {activity === "working" && (
          <>
            <motion.circle cx="5" cy="15" r="1" fill={c.accent}
              animate={{ opacity: [0, 1, 0], y: [-2, -8] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <motion.circle cx="35" cy="12" r="1" fill={c.accent}
              animate={{ opacity: [0, 1, 0], y: [-2, -8] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
            />
            <motion.circle cx="20" cy="2" r="1" fill={c.accent}
              animate={{ opacity: [0, 1, 0], y: [-2, -6] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.6 }}
            />
          </>
        )}
      </motion.svg>

      {label && (
        <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider text-center leading-tight max-w-[70px] truncate">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * AgentCharacterGrid — All agents in a row, each doing something different.
 */
export function AgentCharacterGrid({ size = 48 }: { size?: number }) {
  const characters: { type: CharacterType; label: string; activity: Props["activity"] }[] = [
    { type: "brain", label: "God Brain", activity: "thinking" },
    { type: "hunter", label: "Lead Hunter", activity: "scanning" },
    { type: "writer", label: "Content Engine", activity: "typing" },
    { type: "coder", label: "Code Agent", activity: "working" },
    { type: "shield", label: "Guardrails", activity: "idle" },
    { type: "caller", label: "Voice Closer", activity: "talking" },
    { type: "search", label: "SEO Dominator", activity: "scanning" },
    { type: "router", label: "Smart Router", activity: "working" },
    { type: "scout", label: "Scout", activity: "scanning" },
    { type: "builder", label: "Page Builder", activity: "working" },
    { type: "memory", label: "Memory Core", activity: "thinking" },
  ];

  return (
    <div className="flex flex-wrap items-end justify-center gap-5 md:gap-7">
      {characters.map((char, i) => (
        <motion.div
          key={char.type}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06, duration: 0.4 }}
          whileHover={{ scale: 1.15, y: -8 }}
          className="cursor-pointer"
        >
          <AgentCharacter
            type={char.type}
            size={size}
            activity={char.activity}
            label={char.label}
          />
        </motion.div>
      ))}
    </div>
  );
}
