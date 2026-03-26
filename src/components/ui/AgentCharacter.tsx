"use client";

import { motion } from "framer-motion";

/**
 * AgentCharacter — Cute animated digital characters for each agent.
 * Inspired by Claude Code's little robot mascot above the chat.
 *
 * Each agent gets a unique character with:
 * - Distinct body shape and color
 * - Animated eyes that blink and look around
 * - Unique accessory (antenna, shield, headset, etc.)
 * - Idle animation (breathing, bobbing, glowing)
 * - Thinking state (eyes spin, body vibrates)
 * - Working state (accessory animates)
 */

type CharacterType =
  | "brain"      // God Brain — big head, neural antennas
  | "hunter"     // Lead Hunter — sharp eyes, target scope
  | "writer"     // Content Engine — quill/pen accessory
  | "coder"      // Code Agent — terminal screen face
  | "shield"     // Guardrails — shield body
  | "caller"     // Voice Closer — headset
  | "search"     // SEO Dominator — magnifier eye
  | "router"     // Smart Router — lightning bolt antennas
  | "scout"      // Competitor Scout — binocular eyes
  | "builder"    // Page Builder — hard hat
  | "memory"     // Memory Core — brain jar
  | "general";   // Default agent

interface AgentCharacterProps {
  type: CharacterType;
  size?: number;
  isThinking?: boolean;
  isWorking?: boolean;
  label?: string;
  className?: string;
}

// Color schemes per character
const COLORS: Record<CharacterType, { body: string; accent: string; eyes: string; glow: string }> = {
  brain:   { body: "#EC4899", accent: "#A855F7", eyes: "#FFFFFF", glow: "rgba(236,72,153,0.3)" },
  hunter:  { body: "#10B981", accent: "#059669", eyes: "#FFFFFF", glow: "rgba(16,185,129,0.3)" },
  writer:  { body: "#06B6D4", accent: "#0891B2", eyes: "#FFFFFF", glow: "rgba(6,182,212,0.3)" },
  coder:   { body: "#A855F7", accent: "#7C3AED", eyes: "#10B981", glow: "rgba(168,85,247,0.3)" },
  shield:  { body: "#6366F1", accent: "#4F46E5", eyes: "#FFFFFF", glow: "rgba(99,102,241,0.3)" },
  caller:  { body: "#EF4444", accent: "#DC2626", eyes: "#FFFFFF", glow: "rgba(239,68,68,0.3)" },
  search:  { body: "#F59E0B", accent: "#D97706", eyes: "#FFFFFF", glow: "rgba(245,158,11,0.3)" },
  router:  { body: "#14B8A6", accent: "#0D9488", eyes: "#FFFFFF", glow: "rgba(20,184,166,0.3)" },
  scout:   { body: "#64748B", accent: "#475569", eyes: "#10B981", glow: "rgba(100,116,139,0.3)" },
  builder: { body: "#F97316", accent: "#EA580C", eyes: "#FFFFFF", glow: "rgba(249,115,22,0.3)" },
  memory:  { body: "#06B6D4", accent: "#14B8A6", eyes: "#A855F7", glow: "rgba(6,182,212,0.3)" },
  general: { body: "#10B981", accent: "#059669", eyes: "#FFFFFF", glow: "rgba(16,185,129,0.3)" },
};

export function AgentCharacter({
  type,
  size = 48,
  isThinking = false,
  isWorking = false,
  label,
  className = "",
}: AgentCharacterProps) {
  const c = COLORS[type];
  const scale = size / 48;

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <motion.div
        animate={
          isThinking
            ? { y: [0, -2, 0], rotate: [-1, 1, -1] }
            : { y: [0, -3, 0] }
        }
        transition={{
          duration: isThinking ? 0.4 : 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ width: size, height: size }}
        className="relative"
      >
        <svg
          viewBox="0 0 48 48"
          width={size}
          height={size}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Glow */}
          <defs>
            <filter id={`glow-${type}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Body */}
          <motion.rect
            x="8" y="14" width="32" height="26" rx="8"
            fill={c.body}
            filter={`url(#glow-${type})`}
            animate={isWorking ? { opacity: [0.8, 1, 0.8] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          />

          {/* Body highlight */}
          <rect x="10" y="16" width="28" height="10" rx="5" fill="white" opacity="0.15" />

          {/* Eyes */}
          <motion.g
            animate={
              isThinking
                ? { scaleY: [1, 0.1, 1] }
                : { scaleY: [1, 0.1, 1, 1, 1, 1, 1, 1] }
            }
            transition={{
              duration: isThinking ? 0.3 : 4,
              repeat: Infinity,
              times: isThinking ? [0, 0.5, 1] : [0, 0.02, 0.04, 0.06, 0.5, 0.52, 0.54, 1],
            }}
            style={{ transformOrigin: "24px 24px" }}
          >
            {/* Left eye */}
            <circle cx="18" cy="25" r="3.5" fill={c.eyes} />
            <circle cx="19" cy="24" r="1.5" fill={c.accent} />

            {/* Right eye */}
            <circle cx="30" cy="25" r="3.5" fill={c.eyes} />
            <circle cx="31" cy="24" r="1.5" fill={c.accent} />
          </motion.g>

          {/* Mouth — small smile */}
          <path
            d="M20 32 Q24 35 28 32"
            stroke={c.eyes}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />

          {/* Feet */}
          <rect x="13" y="38" width="8" height="4" rx="2" fill={c.accent} />
          <rect x="27" y="38" width="8" height="4" rx="2" fill={c.accent} />

          {/* === Character-specific accessories === */}

          {/* Brain — neural antennas */}
          {type === "brain" && (
            <>
              <motion.line
                x1="18" y1="14" x2="14" y2="6"
                stroke={c.accent} strokeWidth="2" strokeLinecap="round"
                animate={{ x2: [14, 16, 14] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.circle cx="14" cy="5" r="2.5" fill={c.body}
                animate={{ r: [2.5, 3, 2.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.line
                x1="30" y1="14" x2="34" y2="6"
                stroke={c.accent} strokeWidth="2" strokeLinecap="round"
                animate={{ x2: [34, 32, 34] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              />
              <motion.circle cx="34" cy="5" r="2.5" fill={c.body}
                animate={{ r: [2.5, 3, 2.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              />
            </>
          )}

          {/* Hunter — target scope on head */}
          {type === "hunter" && (
            <motion.g animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "24px 8px" }}>
              <circle cx="24" cy="8" r="5" stroke={c.body} strokeWidth="1.5" fill="none" />
              <line x1="24" y1="3" x2="24" y2="5" stroke={c.body} strokeWidth="1.5" />
              <line x1="24" y1="11" x2="24" y2="13" stroke={c.body} strokeWidth="1.5" />
              <line x1="19" y1="8" x2="21" y2="8" stroke={c.body} strokeWidth="1.5" />
              <line x1="27" y1="8" x2="29" y2="8" stroke={c.body} strokeWidth="1.5" />
              <circle cx="24" cy="8" r="1.5" fill={c.body} />
            </motion.g>
          )}

          {/* Writer — quill/pen */}
          {type === "writer" && (
            <motion.g animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 1.5, repeat: Infinity }}
              style={{ transformOrigin: "36px 10px" }}>
              <line x1="36" y1="10" x2="40" y2="2" stroke={c.body} strokeWidth="2" strokeLinecap="round" />
              <circle cx="40" cy="2" r="1.5" fill={c.accent} />
            </motion.g>
          )}

          {/* Coder — terminal brackets */}
          {type === "coder" && (
            <>
              <text x="12" y="12" fill={c.body} fontSize="8" fontFamily="monospace" fontWeight="bold">&lt;/&gt;</text>
            </>
          )}

          {/* Shield — shield icon on chest */}
          {type === "shield" && (
            <path d="M24 18 L30 21 L30 27 Q30 32 24 34 Q18 32 18 27 L18 21 Z"
              fill="none" stroke={c.eyes} strokeWidth="1.5" opacity="0.4" />
          )}

          {/* Caller — headset */}
          {type === "caller" && (
            <>
              <path d="M10 22 Q10 10 24 10 Q38 10 38 22" stroke={c.accent} strokeWidth="2" fill="none" />
              <rect x="7" y="20" width="5" height="8" rx="2" fill={c.accent} />
              <rect x="36" y="20" width="5" height="8" rx="2" fill={c.accent} />
              <motion.circle cx="9" cy="30" r="2" fill={c.body}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </>
          )}

          {/* Search — magnifier on eye */}
          {type === "search" && (
            <motion.g animate={{ x: [0, 2, 0] }} transition={{ duration: 3, repeat: Infinity }}>
              <circle cx="32" cy="8" r="5" stroke={c.body} strokeWidth="2" fill="none" />
              <line x1="36" y1="12" x2="40" y2="16" stroke={c.body} strokeWidth="2" strokeLinecap="round" />
            </motion.g>
          )}

          {/* Router — lightning antennas */}
          {type === "router" && (
            <>
              <motion.path d="M16 14 L14 8 L18 10 L16 4" stroke="#FACC15" strokeWidth="1.5" fill="none" strokeLinecap="round"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <motion.path d="M32 14 L34 8 L30 10 L32 4" stroke="#FACC15" strokeWidth="1.5" fill="none" strokeLinecap="round"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
              />
            </>
          )}

          {/* Scout — binoculars */}
          {type === "scout" && (
            <>
              <circle cx="17" cy="8" r="4" stroke={c.body} strokeWidth="1.5" fill={c.accent} />
              <circle cx="31" cy="8" r="4" stroke={c.body} strokeWidth="1.5" fill={c.accent} />
              <rect x="21" y="6" width="6" height="4" rx="1" fill={c.accent} />
            </>
          )}

          {/* Builder — hard hat */}
          {type === "builder" && (
            <>
              <rect x="10" y="10" width="28" height="5" rx="2" fill={c.accent} />
              <rect x="14" y="7" width="20" height="5" rx="3" fill={c.body} />
            </>
          )}

          {/* Memory — brain jar lid */}
          {type === "memory" && (
            <>
              <rect x="12" y="10" width="24" height="4" rx="2" fill={c.accent} />
              <motion.circle cx="24" cy="7" r="3" fill={c.body}
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </>
          )}

          {/* General — simple antenna */}
          {type === "general" && (
            <>
              <line x1="24" y1="14" x2="24" y2="6" stroke={c.accent} strokeWidth="2" />
              <circle cx="24" cy="5" r="2.5" fill={c.body} />
            </>
          )}
        </svg>
      </motion.div>

      {/* Label */}
      {label && (
        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider text-center leading-tight max-w-[80px] truncate">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * AgentCharacterGrid — Shows all agent characters in a grid.
 * Used for the "Meet the Team" section on the landing page.
 */
export function AgentCharacterGrid({ size = 56 }: { size?: number }) {
  const characters: { type: CharacterType; label: string }[] = [
    { type: "brain", label: "God Brain" },
    { type: "hunter", label: "Lead Hunter" },
    { type: "writer", label: "Content Engine" },
    { type: "coder", label: "Code Agent" },
    { type: "shield", label: "Guardrails" },
    { type: "caller", label: "Voice Closer" },
    { type: "search", label: "SEO Dominator" },
    { type: "router", label: "Smart Router" },
    { type: "scout", label: "Scout" },
    { type: "builder", label: "Page Builder" },
    { type: "memory", label: "Memory Core" },
  ];

  return (
    <div className="flex flex-wrap items-end justify-center gap-6">
      {characters.map((char, i) => (
        <motion.div
          key={char.type}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08, duration: 0.5 }}
          whileHover={{ scale: 1.1, y: -5 }}
          className="cursor-pointer"
        >
          <AgentCharacter
            type={char.type}
            size={size}
            label={char.label}
            isWorking={i % 3 === 0}
          />
        </motion.div>
      ))}
    </div>
  );
}
