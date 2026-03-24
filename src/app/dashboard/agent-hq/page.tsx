"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  PenLine, Search, UserCheck, Mail, Phone, Code2, Eye,
  FileText, ShieldCheck, GitBranch, FileSearch, Languages,
  ArrowRight, Activity, Sparkles, Shield, Target, BarChart3, MessageSquare,
} from "lucide-react";

// --- Agent Data ---

interface Agent {
  name: string;
  description: string;
  status: "Idle" | "Working" | "Listening" | "Always On";
  icon: React.ElementType;
  lastAction: string;
}

const AGENTS: Agent[] = [
  { name: "Content Writer", description: "Generates blog posts, emails, social content", status: "Idle", icon: PenLine, lastAction: "Awaiting task" },
  { name: "SEO Analyst", description: "Audits websites, finds keyword gaps", status: "Idle", icon: Search, lastAction: "Awaiting task" },
  { name: "Lead Hunter", description: "Finds and qualifies B2B prospects", status: "Idle", icon: UserCheck, lastAction: "Awaiting task" },
  { name: "Outreach Agent", description: "Writes and sends cold email sequences", status: "Idle", icon: Mail, lastAction: "Awaiting task" },
  { name: "Voice Caller", description: "Makes calls, qualifies leads, books meetings", status: "Idle", icon: Phone, lastAction: "Awaiting task" },
  { name: "Code Builder", description: "Writes, reviews, and deploys code", status: "Idle", icon: Code2, lastAction: "Awaiting task" },
  { name: "Competitor Scout", description: "Monitors competitor moves and strategy", status: "Idle", icon: Eye, lastAction: "Awaiting task" },
  { name: "Report Writer", description: "Generates campaign performance reports", status: "Idle", icon: FileText, lastAction: "Awaiting task" },
  { name: "Safety Guard", description: "Checks every output for PII, safety, quality", status: "Always On", icon: ShieldCheck, lastAction: "Active — monitoring" },
  { name: "Smart Router", description: "Routes tasks to the best AI model", status: "Always On", icon: GitBranch, lastAction: "Active — routing" },
  { name: "Document Reader", description: "Extracts insights from PDFs and contracts", status: "Idle", icon: FileSearch, lastAction: "Awaiting task" },
  { name: "Translator", description: "Translates content across 12 languages", status: "Idle", icon: Languages, lastAction: "Awaiting task" },
];

// --- Quick Actions ---

interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Write a Blog Post", href: "/dashboard/content-factory", icon: PenLine },
  { label: "Audit a Website", href: "/dashboard/cyber-audit", icon: Shield },
  { label: "Find Leads", href: "/dashboard/leads", icon: Target },
  { label: "Scan Competitor", href: "/dashboard/competitor", icon: Eye },
  { label: "Generate Report", href: "/dashboard/agent-analytics", icon: BarChart3 },
  { label: "Ask Assistant", href: "/dashboard", icon: MessageSquare },
];

// --- Activity Entry Type ---

interface ActivityEntry {
  timestamp: string;
  agent: string;
  action: string;
}

// --- Helpers ---

function statusColor(status: Agent["status"]) {
  if (status === "Always On") return "bg-emerald-500";
  if (status === "Working") return "bg-amber-400";
  if (status === "Listening") return "bg-sky-400";
  return "bg-neutral-600";
}

function statusBadge(status: Agent["status"]) {
  if (status === "Always On") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (status === "Working") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  if (status === "Listening") return "text-sky-400 bg-sky-500/10 border-sky-500/20";
  return "text-neutral-500 bg-neutral-500/10 border-neutral-500/20";
}

// --- Stagger Variants ---

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

// --- Page ---

export default function AgentHQPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch("/api/agents/analytics");
        if (res.ok) {
          const data = await res.json();
          // Expecting an array or an object with an activities/events array
          const entries: ActivityEntry[] = Array.isArray(data)
            ? data.slice(0, 10)
            : Array.isArray(data?.activities)
            ? data.activities.slice(0, 10)
            : Array.isArray(data?.events)
            ? data.events.slice(0, 10)
            : [];
          setActivities(entries);
        }
      } catch {
        // Network error — leave empty
      } finally {
        setLoadingFeed(false);
      }
    };
    fetchActivity();
  }, []);

  return (
    <div className="min-h-screen bg-[#020202] px-4 py-10 sm:px-8 lg:px-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Agent HQ
          </h1>
        </div>
        <p className="text-neutral-500 text-sm">
          Your agents. Working together.
        </p>
      </motion.div>

      {/* ========== Section 1: Agent Status Grid ========== */}
      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">
          Agent Status
        </h2>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {AGENTS.map((agent) => (
            <motion.div
              key={agent.name}
              variants={cardVariants}
              className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 hover:border-emerald-500/20 transition-colors"
            >
              {/* Top row */}
              <div className="flex items-start gap-3 mb-3">
                <div className="relative mt-0.5">
                  <span
                    className={`block w-2 h-2 rounded-full ${statusColor(agent.status)}`}
                  />
                  {agent.status === "Always On" && (
                    <span className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white truncate">
                      {agent.name}
                    </span>
                    <agent.icon className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-snug mt-0.5 line-clamp-2">
                    {agent.description}
                  </p>
                </div>
              </div>

              {/* Bottom row */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusBadge(agent.status)}`}
                >
                  {agent.status}
                </span>
                <span className="text-[10px] text-neutral-600 font-mono">
                  {agent.lastAction}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ========== Section 2: Agent Activity Feed ========== */}
      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" />
          Live Activity Feed
        </h2>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-xl border border-white/[0.06] bg-[#080808] overflow-hidden"
        >
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {loadingFeed ? (
              <div className="px-5 py-8 text-center">
                <div className="inline-block w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-neutral-600 text-xs mt-3 font-mono">
                  Loading activity feed...
                </p>
              </div>
            ) : activities.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {activities.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-[10px] text-neutral-600 font-mono whitespace-nowrap pt-0.5">
                      {entry.timestamp || "--:--"}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap">
                      {entry.agent || "System"}
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">
                      {entry.action || "Unknown action"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-10 text-center">
                <Activity className="w-5 h-5 text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500 text-xs font-mono">
                  No agent activity yet. Run an agent to see it here.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ========== Section 3: Quick Actions ========== */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">
          Quick Actions
        </h2>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {QUICK_ACTIONS.map((action) => (
            <motion.button
              key={action.label}
              variants={cardVariants}
              onClick={() => router.push(action.href)}
              className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl px-5 py-4 text-left hover:border-emerald-500/20 transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                <action.icon className="w-4 h-4 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
              </div>
              <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors flex-1">
                {action.label}
              </span>
              <ArrowRight className="w-4 h-4 text-neutral-700 group-hover:text-emerald-500 transition-colors" />
            </motion.button>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
