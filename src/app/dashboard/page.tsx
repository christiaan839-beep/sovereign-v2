"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Target, Globe2, Search, ArrowRight,
  Mic, Cpu, Swords, LayoutTemplate, BarChart3, Clock,
  Activity, Shield, Zap, TrendingUp, CheckCircle2, Eye,
} from "lucide-react";
import Link from "next/link";
import { SovereignAssistantEmbed } from "@/components/dashboard/SovereignAssistant";
import { LiveExecutionStream } from "@/components/dashboard/LiveExecutionStream";

const ONBOARDING_KEY = "sovereign_onboarding";

interface QuickAction {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  action: "prompt" | "navigate";
  value: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: "Generate Content",
    description: "Blog posts, social media, email sequences",
    icon: Sparkles,
    gradient: "from-blue-500/20 to-cyan-500/20",
    action: "prompt",
    value: "Write a blog post about ",
  },
  {
    title: "Find Leads",
    description: "Discover and qualify B2B prospects",
    icon: Target,
    gradient: "from-emerald-500/20 to-green-500/20",
    action: "prompt",
    value: "Find leads for ",
  },
  {
    title: "Build a Page",
    description: "AI-powered landing page builder",
    icon: Globe2,
    gradient: "from-violet-500/20 to-purple-500/20",
    action: "navigate",
    value: "/dashboard/build",
  },
  {
    title: "Audit a Website",
    description: "SEO, performance, and security analysis",
    icon: Search,
    gradient: "from-orange-500/20 to-amber-500/20",
    action: "prompt",
    value: "Audit the website ",
  },
];

/* ─── Discover Section ─── */

const DISCOVER_CARDS = [
  {
    title: "Voice Agents",
    description: "AI makes calls for you",
    href: "/dashboard/voice-assistant",
    icon: Mic,
    accent: "from-emerald-500/20 to-teal-500/20",
    border: "hover:border-emerald-500/30",
  },
  {
    title: "NemoClaw Sandbox",
    description: "Run agents on your hardware",
    href: "/dashboard/nemo-claw",
    icon: Cpu,
    accent: "from-violet-500/20 to-purple-500/20",
    border: "hover:border-violet-500/30",
  },
  {
    title: "War Room",
    description: "Multi-agent debate arena",
    href: "/dashboard/war-room",
    icon: Swords,
    accent: "from-rose-500/20 to-orange-500/20",
    border: "hover:border-rose-500/30",
  },
  {
    title: "Templates",
    description: "Start with proven templates",
    href: "/dashboard/templates",
    icon: LayoutTemplate,
    accent: "from-blue-500/20 to-cyan-500/20",
    border: "hover:border-blue-500/30",
  },
  {
    title: "Analytics",
    description: "Track your AI ROI",
    href: "/dashboard/analytics/roi",
    icon: BarChart3,
    accent: "from-amber-500/20 to-yellow-500/20",
    border: "hover:border-amber-500/30",
  },
  {
    title: "Automations",
    description: "Set it and forget it",
    href: "/dashboard/automations",
    icon: Clock,
    accent: "from-cyan-500/20 to-sky-500/20",
    border: "hover:border-cyan-500/30",
  },
];

/* ─── Stats Dashboard — Enterprise Command Center ─── */

interface DashboardStats {
  agentExecutions: number;
  totalTokens: number;
  leadsGenerated: number;
  bookings: number;
  contentGenerated: number;
}

function StatsPanel() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/dashboard-stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch {
      // Graceful fallback — show zeros
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const interval = setInterval(fetchStats, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchStats]);

  const statCards = [
    { label: "Agent Runs", value: stats?.agentExecutions ?? 0, icon: Activity, color: "emerald", href: "/dashboard/god-eye" },
    { label: "Leads Found", value: stats?.leadsGenerated ?? 0, icon: Target, color: "cyan", href: "/dashboard/leads" },
    { label: "Content Made", value: stats?.contentGenerated ?? 0, icon: Sparkles, color: "violet", href: "/dashboard/content-factory" },
    { label: "Meetings", value: stats?.bookings ?? 0, icon: CheckCircle2, color: "amber", href: "/dashboard/scheduled" },
  ];

  return (
    <div className="px-6 pt-6 pb-2">
      <div className="max-w-3xl mx-auto">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-30" />
              <span className="relative rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-400">Command Center</span>
          </div>
          <Link href="/dashboard/god-eye" className="text-[10px] text-neutral-600 hover:text-emerald-400 transition-colors flex items-center gap-1">
            <Eye className="w-3 h-3" /> God Eye
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
          {statCards.map((stat, i) => (
            <Link key={stat.label} href={stat.href}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/20 hover:bg-white/[0.03] transition-gpu duration-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className="w-3.5 h-3.5 text-neutral-600 group-hover:text-emerald-400 transition-colors" />
                  <TrendingUp className="w-3 h-3 text-neutral-800 group-hover:text-emerald-500/40 transition-colors" />
                </div>
                <div className="text-lg font-bold text-white">
                  {loading ? <span className="inline-block w-8 h-5 rounded bg-white/[0.04] animate-pulse" /> : stat.value.toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-600 uppercase tracking-widest">{stat.label}</div>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Quick Status Bar */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/[0.04] bg-white/[0.01] mb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] text-neutral-500">5-Layer Safety</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-cyan-500" />
              <span className="text-[10px] text-neutral-500">119 Agents</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] text-neutral-500">51+ Models</span>
            </div>
          </div>
          <Link href="/dashboard/nim-arsenal" className="text-[10px] text-neutral-600 hover:text-white transition-colors">
            View Models →
          </Link>
        </div>
      </div>
    </div>
  );
}

function DiscoverSection() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY) === "true";
    if (done) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="px-6 pt-4 pb-2"
    >
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-3">
          Discover More
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {DISCOVER_CARDS.map((card, i) => (
            <motion.button
              key={card.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06, ease: "easeOut" }}
              onClick={() => router.push(card.href)}
              aria-label={`${card.title}: ${card.description}`}
              className={`group relative bg-gradient-to-br ${card.accent} border border-white/[0.06] ${card.border} rounded-xl p-3.5 text-left transition-gpu duration-200 hover:scale-[1.02] backdrop-blur-sm`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <card.icon className="w-4 h-4 text-white/70" />
                <ArrowRight className="w-3 h-3 text-neutral-700 group-hover:text-neutral-400 transition-colors" />
              </div>
              <div className="text-[13px] font-medium text-white">{card.title}</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">{card.description}</div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardHome() {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      setShowWelcome(true);
    }
    setLoaded(true);
  }, []);

  const dismissWelcome = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShowWelcome(false);
  };

  const handleQuickAction = (action: QuickAction) => {
    if (action.action === "navigate") {
      router.push(action.value);
    } else {
      // Dismiss welcome and let the chat handle the prompt
      dismissWelcome();
      // Dispatch a custom event that the chat can listen for
      window.dispatchEvent(
        new CustomEvent("sovereign:prompt", { detail: action.value })
      );
    }
  };

  if (!loaded) return null;

  return (
    <div className="flex flex-col h-full" role="main" aria-label="Dashboard home">
      {/* Stats — always visible */}
      {!showWelcome && <StatsPanel />}

      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="px-6 pt-8 pb-4"
          >
            <div className="max-w-2xl mx-auto text-center mb-6">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Welcome to Sovereign
              </h1>
              <p className="text-sm text-neutral-400 mt-2">
                Your AI-powered business command center. Pick a starting point
                or just start typing below.
              </p>
            </div>

            <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3 mb-4">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.title}
                  onClick={() => handleQuickAction(action)}
                  aria-label={`${action.title}: ${action.description}`}
                  className={`group relative bg-gradient-to-br ${action.gradient} border border-white/[0.06] rounded-xl p-4 text-left transition-gpu duration-200 hover:border-white/[0.15] hover:scale-[1.02]`}
                >
                  <div className="flex items-start justify-between">
                    <action.icon className="w-5 h-5 text-white/80 mb-2" />
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                  </div>
                  <div className="text-sm font-medium text-white">
                    {action.title}
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    {action.description}
                  </div>
                </button>
              ))}
            </div>

            <div className="max-w-2xl mx-auto flex justify-center">
              <button
                onClick={dismissWelcome}
                aria-label="Skip welcome introduction"
                className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
              >
                Skip intro
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discover Section — shown after onboarding */}
      {!showWelcome && <DiscoverSection />}

      {/* Live Agent Execution — try an agent right from the dashboard */}
      {!showWelcome && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="px-6 py-4"
        >
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-3">
              Try an Agent
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <LiveExecutionStream
                agentType="lead-gen"
                goal="Find 10 qualified leads in SaaS"
                apiEndpoint="/api/agents/leads"
                compact
              />
              <LiveExecutionStream
                agentType="competitor-intel"
                goal="Analyze competitor website"
                apiEndpoint="/api/agents/site-assassin"
                compact
              />
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex-1 min-h-0">
        <SovereignAssistantEmbed />
      </div>
    </div>
  );
}
