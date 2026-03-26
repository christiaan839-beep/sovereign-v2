"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { AgentAvatar, type AgentPersonality } from "@/components/ui/AgentAvatar";

/**
 * AgentWorld — An animated digital workspace visualization showing
 * AI agents collaborating in real-time. Each agent has a role,
 * workspace, and active conversation/task.
 *
 * Used on the landing page to demonstrate what "132 autonomous agents"
 * actually looks like in practice.
 */

interface AgentNode {
  id: string;
  name: string;
  role: string;
  personality: AgentPersonality;
  x: number;
  y: number;
  status: "working" | "thinking" | "collaborating" | "idle";
  currentTask: string;
}

const AGENTS: AgentNode[] = [
  { id: "lead", name: "Lead Hunter", role: "Sales", personality: "hunter", x: 15, y: 20, status: "working", currentTask: "Scanning 847 fintech companies..." },
  { id: "content", name: "Content Engine", role: "Marketing", personality: "creator", x: 55, y: 15, status: "working", currentTask: "Writing blog post (4.2% AI score)" },
  { id: "code", name: "Code Agent", role: "Engineering", personality: "coder", x: 80, y: 30, status: "thinking", currentTask: "Building landing page component..." },
  { id: "seo", name: "SEO Dominator", role: "Growth", personality: "analyst", x: 25, y: 55, status: "collaborating", currentTask: "Found 312 keyword gaps" },
  { id: "voice", name: "Voice Closer", role: "Sales", personality: "caller", x: 65, y: 50, status: "working", currentTask: "Cold-calling lead #23 (booking)" },
  { id: "guard", name: "Guardrails", role: "Security", personality: "defender", x: 45, y: 75, status: "idle", currentTask: "5-layer pipeline active. 0 threats." },
  { id: "brain", name: "God Brain", role: "Strategy", personality: "strategist", x: 10, y: 80, status: "thinking", currentTask: "Synthesizing War Room debate..." },
  { id: "router", name: "Smart Router", role: "Infrastructure", personality: "router", x: 85, y: 70, status: "working", currentTask: "Routed 1,247 tasks today ($0 cost)" },
];

const CONVERSATIONS = [
  { from: "Lead Hunter", to: "Voice Closer", message: "53 qualified leads ready. Starting outbound sequence." },
  { from: "Content Engine", to: "SEO Dominator", message: "Blog draft complete. Needs keyword optimization." },
  { from: "God Brain", to: "Smart Router", message: "Route competitor analysis to Nemotron Ultra 253B." },
  { from: "Code Agent", to: "Guardrails", message: "Landing page ready. Running PII scan before deploy." },
  { from: "Voice Closer", to: "Lead Hunter", message: "2 meetings booked. Need 20 more fintech leads." },
  { from: "SEO Dominator", to: "Content Engine", message: "Insert keywords: 'AI agency automation', 'autonomous agents'." },
  { from: "Smart Router", to: "God Brain", message: "Nemotron Ultra responded in 2.1s. Quality: 9.8/10." },
  { from: "Guardrails", to: "Code Agent", message: "PII scan passed. Zero sensitive data detected. Clear to deploy." },
];

export function AgentWorld() {
  const [activeConvo, setActiveConvo] = useState(0);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<"online" | "offline" | "checking">("checking");
  const [agentCount, setAgentCount] = useState(132);

  // Check real system health
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          setSystemStatus("online");
          // Try to get real agent count
          try {
            const agentRes = await fetch("/api/agents/smart-router");
            if (agentRes.ok) {
              const data = await agentRes.json();
              if (data.agents?.length) setAgentCount(data.agents.length);
            }
          } catch { /* use default */ }
        } else {
          setSystemStatus("offline");
        }
      } catch {
        setSystemStatus("offline");
      }
    };
    check();
  }, []);

  // Cycle through conversations
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveConvo((prev) => (prev + 1) % CONVERSATIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const convo = CONVERSATIONS[activeConvo];

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.04] mb-4">
          <span className="relative flex h-1.5 w-1.5">
            {systemStatus === "online" && <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-50" />}
            <span className={`relative rounded-full h-1.5 w-1.5 ${systemStatus === "online" ? "bg-emerald-400" : systemStatus === "checking" ? "bg-amber-400" : "bg-neutral-500"}`} />
          </span>
          <span className="text-[10px] text-emerald-400/80 font-medium">
            {systemStatus === "online" ? `${agentCount} Agents Active` : systemStatus === "checking" ? "Connecting..." : "Offline Mode"}
          </span>
        </div>
        <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Your agents are working.</h2>
        <p className="text-neutral-500 max-w-lg mx-auto">Right now. Autonomously. No prompts needed.</p>
      </motion.div>

      {/* Agent workspace grid */}
      <div className="relative aspect-[16/9] rounded-3xl border border-white/[0.06] bg-[#050505] overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }} />

        {/* Connection lines between collaborating agents */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          {/* Lead → Voice */}
          <line x1="15%" y1="20%" x2="65%" y2="50%" stroke="rgba(16,185,129,0.08)" strokeWidth="1" strokeDasharray="4 4" />
          {/* Content → SEO */}
          <line x1="55%" y1="15%" x2="25%" y2="55%" stroke="rgba(6,182,212,0.08)" strokeWidth="1" strokeDasharray="4 4" />
          {/* Brain → Router */}
          <line x1="10%" y1="80%" x2="85%" y2="70%" stroke="rgba(236,72,153,0.08)" strokeWidth="1" strokeDasharray="4 4" />
          {/* Code → Guard */}
          <line x1="80%" y1="30%" x2="45%" y2="75%" stroke="rgba(168,85,247,0.08)" strokeWidth="1" strokeDasharray="4 4" />
        </svg>

        {/* Agent nodes */}
        {AGENTS.map((agent, i) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            style={{ left: `${agent.x}%`, top: `${agent.y}%` }}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            onMouseEnter={() => setHoveredAgent(agent.id)}
            onMouseLeave={() => setHoveredAgent(null)}
          >
            {/* Agent avatar */}
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative group cursor-pointer"
            >
              <AgentAvatar
                personality={agent.personality}
                size="md"
                isActive={agent.status !== "idle"}
                isThinking={agent.status === "thinking"}
              />

              {/* Name label */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap">
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{agent.name}</span>
              </div>

              {/* Hover tooltip */}
              <AnimatePresence>
                {hoveredAgent === agent.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 p-3 rounded-xl bg-[#0A0A0A]/95 backdrop-blur-xl border border-white/[0.1] shadow-2xl z-50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${agent.status === "working" ? "bg-green-400" : agent.status === "thinking" ? "bg-yellow-400" : agent.status === "collaborating" ? "bg-blue-400" : "bg-neutral-500"}`} />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">{agent.role}</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-relaxed">{agent.currentTask}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ))}

        {/* Live conversation feed */}
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeConvo}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/[0.06]"
            >
              <MessageSquare className="w-4 h-4 text-emerald-500/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">{convo.from}</span>
                  <span className="text-[9px] text-neutral-600">→</span>
                  <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">{convo.to}</span>
                </div>
                <p className="text-[11px] text-neutral-400 truncate">{convo.message}</p>
              </div>
              <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
