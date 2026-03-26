"use client";

import { motion } from "framer-motion";

/**
 * AgentAvatar — Unique animated digital identity for each agent.
 * Inspired by Claude's animated orb but each agent has distinct:
 * - Shape (orb, hexagon, diamond, ring, cube, wave)
 * - Color gradient
 * - Animation pattern (pulse, orbit, breathe, glitch, ripple)
 * - Size variants (sm, md, lg, xl)
 *
 * These are the "faces" of the Sovereign Matrix agents.
 */

export type AgentPersonality =
  | "strategist"    // God Brain — slow, deliberate pulse
  | "hunter"        // Lead Hunter — sharp, aggressive scan
  | "creator"       // Content Engine — flowing, creative wave
  | "coder"         // Code Agent — glitch, matrix-style
  | "defender"      // Guardrails — shield pulse, protective
  | "caller"        // Voice Closer — sound wave ripple
  | "analyst"       // SEO Dominator — radar sweep
  | "router"        // Smart Router — electric arc
  | "scout"         // Competitor Intel — stealth scan
  | "builder"       // Page Builder — construct animation
  | "memory"        // Memory Agent — neural pulse
  | "default";      // Generic agent

interface AgentAvatarProps {
  personality: AgentPersonality;
  size?: "sm" | "md" | "lg" | "xl";
  isActive?: boolean;
  isThinking?: boolean;
  className?: string;
}

const AGENT_STYLES: Record<AgentPersonality, {
  gradient: string;
  glowColor: string;
  coreColor: string;
  ringColor: string;
  secondaryColor: string;
}> = {
  strategist: {
    gradient: "from-pink-500 via-purple-500 to-indigo-500",
    glowColor: "rgba(236,72,153,0.3)",
    coreColor: "#EC4899",
    ringColor: "rgba(168,85,247,0.4)",
    secondaryColor: "rgba(99,102,241,0.3)",
  },
  hunter: {
    gradient: "from-emerald-400 via-green-500 to-teal-500",
    glowColor: "rgba(16,185,129,0.3)",
    coreColor: "#10B981",
    ringColor: "rgba(20,184,166,0.4)",
    secondaryColor: "rgba(34,197,94,0.3)",
  },
  creator: {
    gradient: "from-cyan-400 via-blue-500 to-indigo-500",
    glowColor: "rgba(6,182,212,0.3)",
    coreColor: "#06B6D4",
    ringColor: "rgba(59,130,246,0.4)",
    secondaryColor: "rgba(99,102,241,0.3)",
  },
  coder: {
    gradient: "from-violet-400 via-purple-500 to-fuchsia-500",
    glowColor: "rgba(139,92,246,0.3)",
    coreColor: "#A855F7",
    ringColor: "rgba(168,85,247,0.4)",
    secondaryColor: "rgba(217,70,239,0.3)",
  },
  defender: {
    gradient: "from-blue-400 via-indigo-500 to-violet-500",
    glowColor: "rgba(99,102,241,0.3)",
    coreColor: "#6366F1",
    ringColor: "rgba(79,70,229,0.4)",
    secondaryColor: "rgba(139,92,246,0.3)",
  },
  caller: {
    gradient: "from-red-400 via-rose-500 to-pink-500",
    glowColor: "rgba(239,68,68,0.3)",
    coreColor: "#EF4444",
    ringColor: "rgba(244,63,94,0.4)",
    secondaryColor: "rgba(236,72,153,0.3)",
  },
  analyst: {
    gradient: "from-amber-400 via-orange-500 to-red-500",
    glowColor: "rgba(245,158,11,0.3)",
    coreColor: "#F59E0B",
    ringColor: "rgba(249,115,22,0.4)",
    secondaryColor: "rgba(239,68,68,0.3)",
  },
  router: {
    gradient: "from-teal-400 via-emerald-500 to-green-500",
    glowColor: "rgba(20,184,166,0.3)",
    coreColor: "#14B8A6",
    ringColor: "rgba(16,185,129,0.4)",
    secondaryColor: "rgba(34,197,94,0.3)",
  },
  scout: {
    gradient: "from-slate-400 via-gray-500 to-zinc-500",
    glowColor: "rgba(148,163,184,0.3)",
    coreColor: "#94A3B8",
    ringColor: "rgba(107,114,128,0.4)",
    secondaryColor: "rgba(161,161,170,0.3)",
  },
  builder: {
    gradient: "from-orange-400 via-amber-500 to-yellow-500",
    glowColor: "rgba(249,115,22,0.3)",
    coreColor: "#F97316",
    ringColor: "rgba(245,158,11,0.4)",
    secondaryColor: "rgba(234,179,8,0.3)",
  },
  memory: {
    gradient: "from-cyan-400 via-teal-500 to-emerald-500",
    glowColor: "rgba(6,182,212,0.3)",
    coreColor: "#06B6D4",
    ringColor: "rgba(20,184,166,0.4)",
    secondaryColor: "rgba(16,185,129,0.3)",
  },
  default: {
    gradient: "from-emerald-400 via-teal-500 to-cyan-500",
    glowColor: "rgba(16,185,129,0.3)",
    coreColor: "#10B981",
    ringColor: "rgba(20,184,166,0.4)",
    secondaryColor: "rgba(6,182,212,0.3)",
  },
};

const SIZES = {
  sm: { outer: 32, inner: 16, ring: 24 },
  md: { outer: 48, inner: 24, ring: 36 },
  lg: { outer: 64, inner: 32, ring: 48 },
  xl: { outer: 96, inner: 48, ring: 72 },
};

export function AgentAvatar({
  personality,
  size = "md",
  isActive = true,
  isThinking = false,
  className = "",
}: AgentAvatarProps) {
  const style = AGENT_STYLES[personality];
  const dims = SIZES[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: dims.outer, height: dims.outer }}
    >
      {/* Outer glow */}
      {isActive && (
        <motion.div
          animate={{
            boxShadow: [
              `0 0 ${dims.outer / 3}px ${style.glowColor}`,
              `0 0 ${dims.outer / 2}px ${style.glowColor}`,
              `0 0 ${dims.outer / 3}px ${style.glowColor}`,
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full"
        />
      )}

      {/* Outer ring — slow rotation */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: isThinking ? 2 : 8, repeat: Infinity, ease: "linear" }}
        className="absolute rounded-full border"
        style={{
          width: dims.ring,
          height: dims.ring,
          borderColor: style.ringColor,
          top: (dims.outer - dims.ring) / 2,
          left: (dims.outer - dims.ring) / 2,
        }}
      />

      {/* Secondary ring — counter-rotation */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: isThinking ? 1.5 : 6, repeat: Infinity, ease: "linear" }}
        className="absolute rounded-full border border-dashed"
        style={{
          width: dims.ring - 4,
          height: dims.ring - 4,
          borderColor: style.secondaryColor,
          top: (dims.outer - dims.ring + 4) / 2,
          left: (dims.outer - dims.ring + 4) / 2,
        }}
      />

      {/* Core orb — breathing pulse */}
      <motion.div
        animate={
          isThinking
            ? {
                scale: [0.8, 1.3, 0.8],
                opacity: [0.6, 1, 0.6],
              }
            : {
                scale: [0.9, 1.05, 0.9],
                opacity: [0.7, 1, 0.7],
              }
        }
        transition={{
          duration: isThinking ? 1 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`rounded-full bg-gradient-to-br ${style.gradient}`}
        style={{
          width: dims.inner,
          height: dims.inner,
        }}
      />

      {/* Inner sparkle — tiny dot */}
      <motion.div
        animate={{
          opacity: [0, 1, 0],
          scale: [0.5, 1, 0.5],
        }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        className="absolute rounded-full bg-white"
        style={{
          width: dims.inner / 4,
          height: dims.inner / 4,
          top: dims.outer / 2 - dims.inner / 8 - 2,
          left: dims.outer / 2 - dims.inner / 8 + 2,
        }}
      />

      {/* Orbiting particle (only on lg/xl) */}
      {(size === "lg" || size === "xl") && isActive && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute"
          style={{
            width: dims.outer,
            height: dims.outer,
            top: 0,
            left: 0,
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 4,
              height: 4,
              backgroundColor: style.coreColor,
              top: 2,
              left: dims.outer / 2 - 2,
              boxShadow: `0 0 8px ${style.coreColor}`,
            }}
          />
        </motion.div>
      )}
    </div>
  );
}

/**
 * AgentIdentityCard — Full agent identity with avatar, name, role, and status.
 */
export function AgentIdentityCard({
  name,
  role,
  personality,
  status,
  currentTask,
  successRate,
  tasksCompleted,
  onClick,
}: {
  name: string;
  role: string;
  personality: AgentPersonality;
  status: "working" | "thinking" | "idle" | "collaborating";
  currentTask?: string;
  successRate?: number;
  tasksCompleted?: number;
  onClick?: () => void;
}) {
  const statusColors = {
    working: "text-emerald-400",
    thinking: "text-amber-400",
    idle: "text-neutral-500",
    collaborating: "text-cyan-400",
  };

  const statusLabels = {
    working: "Working",
    thinking: "Thinking",
    idle: "Standby",
    collaborating: "Collaborating",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      onClick={onClick}
      className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-emerald-500/20 transition-gpu duration-300 cursor-pointer group"
    >
      <div className="flex items-center gap-4">
        <AgentAvatar
          personality={personality}
          size="md"
          isActive={status !== "idle"}
          isThinking={status === "thinking"}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">{name}</h3>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{role}</p>
          <div className={`flex items-center gap-1.5 mt-1 text-[10px] font-medium ${statusColors[status]}`}>
            <span className="relative flex h-1.5 w-1.5">
              {status !== "idle" && (
                <span className={`animate-ping absolute h-full w-full rounded-full opacity-50 ${status === "working" ? "bg-emerald-400" : status === "thinking" ? "bg-amber-400" : "bg-cyan-400"}`} />
              )}
              <span className={`relative rounded-full h-1.5 w-1.5 ${status === "working" ? "bg-emerald-400" : status === "thinking" ? "bg-amber-400" : status === "collaborating" ? "bg-cyan-400" : "bg-neutral-500"}`} />
            </span>
            {statusLabels[status]}
          </div>
        </div>
      </div>

      {currentTask && (
        <p className="text-[11px] text-neutral-400 mt-3 leading-relaxed truncate">{currentTask}</p>
      )}

      {(successRate !== undefined || tasksCompleted !== undefined) && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04]">
          {successRate !== undefined && (
            <span className="text-[10px] text-neutral-500">
              <span className="text-emerald-400 font-bold">{successRate}%</span> success
            </span>
          )}
          {tasksCompleted !== undefined && (
            <span className="text-[10px] text-neutral-500">
              <span className="text-white font-bold">{tasksCompleted.toLocaleString()}</span> tasks
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Full agent roster with all 12 agent identities.
 */
export const AGENT_ROSTER: {
  id: string;
  name: string;
  role: string;
  personality: AgentPersonality;
  description: string;
  model: string;
  capabilities: string[];
}[] = [
  {
    id: "god-brain",
    name: "God Brain",
    role: "Chief Strategist",
    personality: "strategist",
    description: "Master meta-prompter and architect. Synthesizes multi-agent outputs into strategic insights.",
    model: "Nemotron Ultra 253B",
    capabilities: ["Strategic planning", "Agent orchestration", "Synthesis", "Decision-making"],
  },
  {
    id: "lead-hunter",
    name: "Lead Hunter",
    role: "Sales Intelligence",
    personality: "hunter",
    description: "Finds, qualifies, and scores leads across LinkedIn, company registries, and industry databases.",
    model: "Nemotron Ultra 253B",
    capabilities: ["Lead generation", "Company research", "Email enrichment", "Lead scoring"],
  },
  {
    id: "content-engine",
    name: "Content Engine",
    role: "Content Director",
    personality: "creator",
    description: "Writes blog posts, emails, social content, and case studies with anti-slop refinement.",
    model: "DeepSeek V3.2",
    capabilities: ["Blog writing", "Email copy", "Social media", "Anti-AI detection"],
  },
  {
    id: "code-agent",
    name: "Code Agent",
    role: "Engineering Lead",
    personality: "coder",
    description: "Writes, reviews, and deploys production code from plain English descriptions.",
    model: "Devstral 2 123B",
    capabilities: ["Code generation", "Bug fixing", "Code review", "Deployment"],
  },
  {
    id: "guardrails",
    name: "Guardrails",
    role: "Security Chief",
    personality: "defender",
    description: "5-layer NeMo safety pipeline. Jailbreak detection, PII scanning, content safety, quality scoring.",
    model: "Content Safety 4B",
    capabilities: ["Jailbreak detection", "PII scanning", "Content safety", "Quality scoring"],
  },
  {
    id: "voice-closer",
    name: "Voice Closer",
    role: "Sales Caller",
    personality: "caller",
    description: "Makes outbound calls, qualifies leads, handles objections, books meetings. Sub-200ms latency.",
    model: "ElevenLabs + NIM",
    capabilities: ["Cold calling", "Lead qualification", "Objection handling", "Meeting booking"],
  },
  {
    id: "seo-dominator",
    name: "SEO Dominator",
    role: "Growth Hacker",
    personality: "analyst",
    description: "Finds keyword gaps, audits technical SEO, monitors rankings, builds topical authority.",
    model: "Qwen 3 235B",
    capabilities: ["Keyword research", "Technical audit", "Rank tracking", "Competitor gaps"],
  },
  {
    id: "smart-router",
    name: "Smart Router",
    role: "Infrastructure",
    personality: "router",
    description: "Automatically routes every task to the optimal model from 51+ options. Zero vendor lock-in.",
    model: "All 51+ models",
    capabilities: ["Model selection", "Failover", "Load balancing", "Cost optimization"],
  },
  {
    id: "site-assassin",
    name: "Competitor Scout",
    role: "Intelligence",
    personality: "scout",
    description: "Reverse-engineers competitor websites — tech stack, SEO gaps, content strategy, counter-moves.",
    model: "Nemotron Ultra 253B",
    capabilities: ["Tech stack detection", "SEO gap analysis", "Strategy reverse-engineering"],
  },
  {
    id: "page-builder",
    name: "Page Builder",
    role: "Design Engineer",
    personality: "builder",
    description: "Generates complete landing pages from text descriptions with live preview.",
    model: "Devstral 2 123B",
    capabilities: ["HTML generation", "Responsive design", "Live preview", "Deployment"],
  },
  {
    id: "memory-agent",
    name: "Memory Core",
    role: "Knowledge Base",
    personality: "memory",
    description: "Persistent vector memory via Pinecone. Remembers past interactions, learns from results.",
    model: "NV EmbedQA 1B",
    capabilities: ["Vector storage", "Semantic search", "Context recall", "Dream consolidation"],
  },
  {
    id: "war-room",
    name: "War Room",
    role: "Red Team Lead",
    personality: "strategist",
    description: "Multi-agent debate arena. Stress-tests strategies from adversarial perspectives.",
    model: "Multiple (debate)",
    capabilities: ["Red teaming", "Strategy stress-test", "Multi-perspective analysis"],
  },
];
