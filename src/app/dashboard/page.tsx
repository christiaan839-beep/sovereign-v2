"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Target, Globe2, Search, ArrowRight,
  Mic, Cpu, Swords, LayoutTemplate, BarChart3, Clock,
  Activity, Shield, Zap, TrendingUp, CheckCircle2, Eye,
  Crosshair, PenTool, Radar, Workflow, X, Plug, Users,
  ChevronDown, ChevronUp, PartyPopper, Check, MessageSquare,
  Bot,
} from "lucide-react";
import Link from "next/link";
// Chat is available via the floating widget (SovereignAssistant) in layout.tsx and /chat page

const ONBOARDING_KEY = "sovereign_onboarding";
const TOUR_KEY = "sovereign_tour_completed";
const CHECKLIST_KEY = "sovereign_checklist";
const CHECKLIST_DISMISSED_KEY = "sovereign_checklist_dismissed";
const RECENT_AGENTS_KEY = "sovereign_recent_agents";

/* ─── Live Status Rotator ─── */

const LIVE_ACTIVITIES = [
  { text: "Lead Gen agent ready", time: "now", color: "text-emerald-400" },
  { text: "Content pipeline active", time: "now", color: "text-cyan-400" },
  { text: "SEO tools online", time: "now", color: "text-violet-400" },
  { text: "Voice agents standing by", time: "now", color: "text-amber-400" },
  { text: "All systems operational", time: "now", color: "text-rose-400" },
];

function LiveStatusRotator() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % LIVE_ACTIVITIES.length), 4000);
    return () => clearInterval(timer);
  }, []);

  const activity = LIVE_ACTIVITIES[index];
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 text-[10px]"
      >
        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
        <span className={activity.color}>{activity.text}</span>
        <span className="text-neutral-500">{activity.time}</span>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Welcome Tour ─── */

const TOUR_CARDS = [
  {
    title: "Find Leads",
    description:
      "Discover and qualify B2B prospects automatically. The Leads agent scrapes the web, enriches contacts, and scores them so you focus on the hottest opportunities.",
    icon: Crosshair,
    gradient: "from-emerald-500/20 to-green-500/20",
    border: "border-emerald-500/20",
    href: "/dashboard/leads",
    section: "Sidebar",
  },
  {
    title: "Create Content",
    description:
      "Generate blog posts, social media, email sequences, and landing pages. The Content Factory chains multiple AI models for publish-ready copy.",
    icon: PenTool,
    gradient: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-500/20",
    href: "/dashboard/content-factory",
    section: "Sidebar",
  },
  {
    title: "Analyze Competitors",
    description:
      "Run multi-agent intelligence sweeps on any competitor. The War Room pits AI models against each other to surface blind spots and opportunities.",
    icon: Radar,
    gradient: "from-rose-500/20 to-orange-500/20",
    border: "border-rose-500/20",
    href: "/dashboard/war-room",
    section: "Intelligence",
  },
  {
    title: "Build Workflows",
    description:
      "Chain agents together into automated pipelines. Trigger sequences on a schedule or via webhooks — no code required.",
    icon: Workflow,
    gradient: "from-violet-500/20 to-purple-500/20",
    border: "border-violet-500/20",
    href: "/dashboard/workflow-builder",
    section: "Tools",
  },
];

function WelcomeTourModal({ onDismiss }: { onDismiss: () => void }) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={onDismiss}
          aria-label="Dismiss tour"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-40" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
              Your Command Center
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Welcome to your command center
          </h2>
          <p className="text-sm text-neutral-400 mt-2 max-w-md mx-auto">
            Pick a starting point based on what you want to accomplish. You can always explore more later.
          </p>
        </div>

        {/* Cards grid */}
        <div className="px-8 py-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TOUR_CARDS.map((card, i) => (
            <motion.button
              key={card.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
              onClick={() => {
                onDismiss();
                router.push(card.href);
              }}
              className={`group relative text-left p-4 rounded-xl border ${card.border} bg-gradient-to-br ${card.gradient} hover:scale-[1.02] transition-gpu duration-200`}
            >
              <div className="flex items-start justify-between mb-2">
                <card.icon className="w-5 h-5 text-white/80" />
                <span className="text-[9px] font-medium uppercase tracking-widest text-neutral-500">
                  {card.section}
                </span>
              </div>
              <div className="text-sm font-semibold text-white">{card.title}</div>
              <div className="text-[11px] text-neutral-400 mt-1 leading-relaxed line-clamp-2">
                {card.description}
              </div>
              <ArrowRight className="absolute bottom-4 right-4 w-3.5 h-3.5 text-neutral-500 group-hover:text-white/60 transition-colors" />
            </motion.button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex justify-center">
          <button
            onClick={onDismiss}
            className="px-8 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors"
          >
            Got it, let&apos;s go!
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

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
    title: "Run a Playbook",
    description: "25 multi-agent workflows — pick one and go",
    icon: Zap,
    gradient: "from-violet-500/20 to-emerald-500/20",
    action: "navigate",
    value: "/dashboard/playbooks",
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
    title: "Generate Content",
    description: "Blog posts, social media, email sequences",
    icon: Sparkles,
    gradient: "from-blue-500/20 to-cyan-500/20",
    action: "prompt",
    value: "Write a blog post about ",
  },
  {
    title: "Ask Anything",
    description: "AI routes your goal to the right agent",
    icon: MessageSquare,
    gradient: "from-pink-500/20 to-rose-500/20",
    action: "navigate",
    value: "/chat",
  },
];

/* ─── Discover Section ─── */

const DISCOVER_CARDS = [
  {
    title: "Autopilot",
    description: "Watch playbooks run live",
    href: "/dashboard/autopilot",
    icon: Bot,
    accent: "from-violet-500/20 to-fuchsia-500/20",
    border: "hover:border-violet-500/30",
  },
  {
    title: "Competitor Intel",
    description: "Analyze any competitor's strategy",
    href: "/dashboard/competitor",
    icon: Swords,
    accent: "from-rose-500/20 to-orange-500/20",
    border: "hover:border-rose-500/30",
  },
  {
    title: "SEO Audit",
    description: "Full site analysis + keyword gaps",
    href: "/dashboard/seo-dominator",
    icon: Search,
    accent: "from-amber-500/20 to-yellow-500/20",
    border: "hover:border-amber-500/30",
  },
  {
    title: "Security",
    description: "5-layer pipeline + HITL approvals",
    href: "/dashboard/nemo-claw",
    icon: Shield,
    accent: "from-emerald-500/20 to-teal-500/20",
    border: "hover:border-emerald-500/30",
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
  const [error, setError] = useState(false);

  const fetchStats = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/agents/dashboard-stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats ?? data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
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
        {/* Error Banner */}
        {error && !stats && (
          <div className="text-center py-3 text-xs text-amber-400/70 bg-amber-500/5 border border-amber-500/10 rounded-xl mb-3">
            Unable to load live stats. <button onClick={fetchStats} className="underline hover:text-amber-300">Retry</button>
          </div>
        )}

        {/* Header Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-30" />
              <span className="relative rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-400">Command Center</span>
          </div>
          <Link href="/dashboard/god-eye" className="text-[10px] text-neutral-400 hover:text-emerald-400 transition-colors flex items-center gap-1">
            <Eye className="w-3 h-3" /> Agent Monitor
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
                  <stat.icon className="w-3.5 h-3.5 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
                  <TrendingUp className="w-3 h-3 text-neutral-500 group-hover:text-emerald-500/40 transition-colors" />
                </div>
                <div className="text-lg font-bold text-white">
                  {loading ? <span className="inline-block w-8 h-5 rounded bg-white/[0.04] animate-pulse" /> : stat.value.toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-400 uppercase tracking-widest">{stat.label}</div>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Quick Status Bar */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/[0.04] bg-white/[0.01] mb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] text-neutral-400">5-Layer Safety</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-cyan-500" />
              <span className="text-[10px] text-neutral-400">130+ Agents</span>
            </div>
            <div className="hidden sm:block">
              <LiveStatusRotator />
            </div>
          </div>
          <Link href="/dashboard/nim-arsenal" className="text-[10px] text-neutral-400 hover:text-white transition-colors">
            View Models →
          </Link>
        </div>

        {/* Quick Access — recently used agents */}
        <QuickAccessRow />
      </div>
    </div>
  );
}

function DiscoverSection() {
  const router = useRouter();
  const [visible] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  });

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
        <div className="grid grid-cols-2 gap-2.5">
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
                <ArrowRight className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
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

/* ─── Getting Started Checklist ─── */

const CHECKLIST_ITEMS = [
  { id: "first_playbook", label: "Run a Playbook", description: "1-click multi-agent workflows", href: "/dashboard/playbooks", icon: Zap },
  { id: "first_agent", label: "Run your first agent", description: "Try Lead Gen, Content, or SEO", href: "/dashboard/leads", icon: Target },
  { id: "first_workflow", label: "Build a workflow", description: "Chain agents together", href: "/dashboard/workflow-builder", icon: Workflow },
  { id: "add_integration", label: "Connect an integration", description: "Slack, Sheets, Notion", href: "/dashboard/integrations", icon: Plug },
  { id: "invite_team", label: "Invite a team member", description: "Collaborate with your team", href: "/dashboard/settings/team", icon: Users },
];

function GettingStartedChecklist() {
  const [completed, setCompleted] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(CHECKLIST_KEY);
      const base: string[] = stored ? JSON.parse(stored) : [];
      // Also auto-check items based on recent page visits
      const recentRaw = localStorage.getItem(RECENT_AGENTS_KEY);
      if (recentRaw) {
        const recent: { href: string }[] = JSON.parse(recentRaw);
        const visitedPaths = recent.map((r) => r.href);
        let changed = false;
        for (const item of CHECKLIST_ITEMS) {
          if (!base.includes(item.id) && visitedPaths.includes(item.href)) {
            base.push(item.id);
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem(CHECKLIST_KEY, JSON.stringify(base));
        }
      }
      return base;
    } catch { return []; }
  });
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    const wasDismissed = localStorage.getItem(CHECKLIST_DISMISSED_KEY);
    const onboardingDone = localStorage.getItem(ONBOARDING_KEY);
    return !(onboardingDone && !wasDismissed);
  });
  const celebratedRef = useRef(false);

  const toggleItem = (id: string) => {
    setCompleted((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
      return next;
    });
  };

  const dismiss = () => {
    localStorage.setItem(CHECKLIST_DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const progress = completed.length;
  const total = CHECKLIST_ITEMS.length;
  const allDone = progress === total;

  // Show celebration briefly then auto-dismiss
  useEffect(() => {
    if (allDone && !celebratedRef.current) {
      celebratedRef.current = true;
      const timer = setTimeout(() => dismiss(), 8000);
      return () => clearTimeout(timer);
    }
  }, [allDone]);  

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, height: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="px-6 pt-4 pb-2"
    >
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-2 text-left flex-1"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-400">
                Getting Started
              </span>
              <span className="text-[10px] text-emerald-400 font-medium">
                {progress}/{total} complete
              </span>
              {collapsed ? (
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-neutral-500" />
              )}
            </button>
            <button
              onClick={dismiss}
              className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Dismiss
            </button>
          </div>

          {/* Progress bar */}
          <div className="px-4 pb-2">
            <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                initial={{ width: 0 }}
                animate={{ width: `${(progress / total) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Items */}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden"
              >
                {allDone ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-4 py-6 text-center"
                  >
                    <PartyPopper className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-white">You&apos;re all set!</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      You&apos;ve completed the getting started checklist. Time to build something great.
                    </p>
                  </motion.div>
                ) : (
                  <div className="px-4 pb-3 space-y-1">
                    {CHECKLIST_ITEMS.map((item, i) => {
                      const done = completed.includes(item.id);
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.25 }}
                          className="flex items-center gap-3 group"
                        >
                          <button
                            onClick={() => toggleItem(item.id)}
                            className={`flex-shrink-0 w-5 h-5 rounded-md border transition-all duration-200 flex items-center justify-center ${
                              done
                                ? "bg-emerald-500/20 border-emerald-500/40"
                                : "border-white/10 hover:border-emerald-500/30 bg-white/[0.02]"
                            }`}
                            aria-label={done ? `Mark "${item.label}" incomplete` : `Mark "${item.label}" complete`}
                          >
                            <AnimatePresence>
                              {done && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                >
                                  <Check className="w-3 h-3 text-emerald-400" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </button>
                          <Link
                            href={item.href}
                            className={`flex-1 flex items-center gap-3 py-2 rounded-lg transition-colors ${
                              done ? "opacity-50" : "hover:bg-white/[0.02]"
                            }`}
                          >
                            <item.icon className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className={`text-xs font-medium ${done ? "text-neutral-500 line-through" : "text-neutral-200"}`}>
                                {item.label}
                              </div>
                              <div className="text-[10px] text-neutral-500">{item.description}</div>
                            </div>
                            <ArrowRight className="w-3 h-3 text-neutral-500 group-hover:text-neutral-400 transition-colors ml-auto flex-shrink-0" />
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Quick Access — Recently Used Agents ─── */

interface RecentAgent {
  id: string;
  name: string;
  href: string;
  iconName: string;
  visitedAt: number;
}

const _DASHBOARD_PAGE_MAP: Record<string, { name: string; iconName: string }> = {
  "/dashboard/leads": { name: "Lead Gen", iconName: "Target" },
  "/dashboard/content-factory": { name: "Content Factory", iconName: "Sparkles" },
  "/dashboard/war-room": { name: "War Room", iconName: "Swords" },
  "/dashboard/seo-dominator": { name: "SEO Dominator", iconName: "Search" },
  "/dashboard/voice-assistant": { name: "Voice Agent", iconName: "Mic" },
  "/dashboard/nemo-claw": { name: "NemoClaw", iconName: "Cpu" },
  "/dashboard/templates": { name: "Templates", iconName: "LayoutTemplate" },
  "/dashboard/workflow-builder": { name: "Workflows", iconName: "Workflow" },
  "/dashboard/integrations": { name: "Integrations", iconName: "Plug" },
  "/dashboard/automations": { name: "Automations", iconName: "Clock" },
  "/dashboard/analytics/roi": { name: "Analytics", iconName: "BarChart3" },
  "/dashboard/god-eye": { name: "Agent Monitor", iconName: "Eye" },
  "/dashboard/competitor": { name: "Competitor Intel", iconName: "Radar" },
  "/dashboard/build": { name: "Page Builder", iconName: "Globe2" },
  "/dashboard/settings/team": { name: "Team Settings", iconName: "Users" },
  "/dashboard/ghost-protocol": { name: "Ghost Protocol", iconName: "Shield" },
  "/dashboard/arsenal": { name: "Arsenal", iconName: "Zap" },
  "/dashboard/nim-arsenal": { name: "NIM Models", iconName: "Cpu" },
  "/dashboard/canvas": { name: "Canvas", iconName: "PenTool" },
  "/dashboard/designer": { name: "Designer", iconName: "PenTool" },
  "/dashboard/flywheel": { name: "Flywheel", iconName: "Activity" },
  "/dashboard/omni-search": { name: "Omni Search", iconName: "Search" },
  "/dashboard/podcast": { name: "Podcast", iconName: "Mic" },
  "/dashboard/billing": { name: "Billing", iconName: "BarChart3" },
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Sparkles, Swords, Search, Mic, Cpu, LayoutTemplate, Workflow,
  Plug, Clock, BarChart3, Eye, Radar, Globe2, Users, Shield, Zap,
  PenTool, Activity,
};

function QuickAccessRow() {
  const [recentAgents] = useState<RecentAgent[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(RECENT_AGENTS_KEY);
      if (raw) {
        const parsed: RecentAgent[] = JSON.parse(raw);
        return parsed.slice(0, 6);
      }
    } catch { /* ignore */ }
    return [];
  });

  if (recentAgents.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mt-4"
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-2">
        Quick Access
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {recentAgents.map((agent) => {
          const IconComp = ICON_MAP[agent.iconName] || Zap;
          return (
            <Link
              key={agent.id}
              href={agent.href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/20 transition-colors shrink-0"
            >
              <IconComp className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-xs text-neutral-300">{agent.name}</span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ─── Recent Playbook Runs (Real Data) ─── */

interface PlaybookRunSummary {
  id: string;
  playbookName: string;
  status: string;
  stepCount: number;
  stepsSucceeded: number;
  stepsFailed: number;
  durationMs: number | null;
  createdAt: string;
  steps: Array<{ agentName: string; status: string; durationMs: number | null }>;
}

function RecentRunsFeed() {
  const [runs, setRuns] = useState<PlaybookRunSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/playbooks/runs")
      .then(r => r.json())
      .then(data => { setRuns((data.runs || []).slice(0, 5)); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="px-6 py-4"
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
            Recent Runs
          </h2>
          {runs.length > 0 && (
            <Link href="/dashboard/autopilot" className="text-[10px] text-emerald-500/60 hover:text-emerald-400 transition-colors">
              View all →
            </Link>
          )}
        </div>

        {runs.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
            <Zap className="w-6 h-6 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">No playbook runs yet</p>
            <Link href="/dashboard/playbooks" className="text-xs text-emerald-500/60 hover:text-emerald-400 mt-1 inline-block transition-colors">
              Run your first playbook →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => {
              const isRunning = run.status === "running";
              const isDone = run.status === "done";
              const isFailed = run.status === "failed";
              const progress = run.stepCount > 0 ? Math.round((run.stepsSucceeded / run.stepCount) * 100) : 0;
              const duration = run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—";
              const timeAgo = (() => {
                const ms = Date.now() - new Date(run.createdAt).getTime();
                if (ms < 60000) return "just now";
                if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
                if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
                return `${Math.floor(ms / 86400000)}d ago`;
              })();

              return (
                <Link key={run.id} href="/dashboard/autopilot">
                  <div className={`rounded-xl border p-3.5 transition-all hover:border-white/15 cursor-pointer ${
                    isRunning ? "bg-cyan-500/5 border-cyan-500/15" :
                    isDone ? "bg-white/[0.02] border-white/[0.06]" :
                    "bg-red-500/5 border-red-500/15"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          isRunning ? "bg-cyan-400 animate-pulse" :
                          isDone ? "bg-emerald-400" :
                          "bg-red-400"
                        }`} />
                        <span className="text-sm font-medium text-white">{run.playbookName}</span>
                        <span className="text-[10px] text-neutral-600 font-mono">{timeAgo}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {isRunning && (
                          <span className="text-[10px] text-cyan-400 font-mono animate-pulse">
                            {run.stepsSucceeded}/{run.stepCount} steps
                          </span>
                        )}
                        {isDone && (
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {run.stepsSucceeded}/{run.stepCount} · {duration}
                          </span>
                        )}
                        {isFailed && (
                          <span className="text-[10px] text-red-400 font-mono">
                            {run.stepsFailed} failed
                          </span>
                        )}
                        {/* Mini progress bar */}
                        <div className="w-12 h-1 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isRunning ? "bg-cyan-400" : isDone ? "bg-emerald-400" : "bg-red-400"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function DashboardHome() {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(ONBOARDING_KEY);
  });
  const [showTour, setShowTour] = useState(() => {
    if (typeof window === "undefined") return false;
    const seen = localStorage.getItem(ONBOARDING_KEY);
    const tourDone = localStorage.getItem(TOUR_KEY);
    return !!seen && !tourDone;
  });
  const [loaded] = useState(() => typeof window !== "undefined");

  const dismissWelcome = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShowWelcome(false);
    // After onboarding, show the tour if not already completed
    const tourDone = localStorage.getItem(TOUR_KEY);
    if (!tourDone) {
      setShowTour(true);
    }
  };

  const dismissTour = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setShowTour(false);
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

  if (!loaded) {
    return (
      <div className="flex flex-col h-full p-6" aria-busy="true" aria-label="Loading dashboard">
        <div className="max-w-3xl mx-auto w-full space-y-6 pt-6">
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse">
                <div className="h-3 w-8 bg-white/[0.04] rounded mb-3" />
                <div className="h-6 w-12 bg-white/[0.04] rounded mb-2" />
                <div className="h-2 w-16 bg-white/[0.04] rounded" />
              </div>
            ))}
          </div>
          {/* Discover skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" role="region" aria-label="Dashboard home">
      {/* Welcome Tour Modal — shows once after onboarding */}
      <AnimatePresence>
        {showTour && <WelcomeTourModal onDismiss={dismissTour} />}
      </AnimatePresence>

      {/* Stats — always visible */}
      {!showWelcome && <StatsPanel />}

      {/* Getting Started Checklist — shows after tour */}
      {!showWelcome && <GettingStartedChecklist />}

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
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
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
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Skip intro
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discover Section — shown after onboarding */}
      {!showWelcome && <DiscoverSection />}

      {/* ─── Solution Templates — One-Click Workflows ─── */}
      {!showWelcome && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="px-6 py-4"
        >
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-3">
              Quick Launch
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { id: "lead-pipeline", name: "Lead Pipeline", desc: "Find leads + draft outreach", icon: "🎯", color: "emerald", href: "/dashboard/leads" },
                { id: "content-engine", name: "Content Engine", desc: "Blog + social + newsletter", icon: "📝", color: "cyan", href: "/dashboard/blog-gen" },
                { id: "competitor-monitor", name: "Competitor Intel", desc: "Deep-scan any competitor", icon: "🛡️", color: "violet", href: "/dashboard/competitor-scan" },
                { id: "client-onboard", name: "Client Onboard", desc: "Proposal + audit + plan", icon: "💼", color: "blue", href: "/dashboard/proposal-generator" },
                { id: "seo-autopilot", name: "SEO Autopilot", desc: "Audit + gaps + content", icon: "📊", color: "amber", href: "/dashboard/seo-dominator" },
              ].map((sol) => (
                <Link key={sol.id} href={sol.href}>
                  <div className={`p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-${sol.color}-500/20 transition-all cursor-pointer group`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{sol.icon}</span>
                      <span className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">{sol.name}</span>
                    </div>
                    <p className="text-[11px] text-neutral-500">{sol.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Playbook Runs — real data from /api/playbooks/runs */}
      {!showWelcome && <RecentRunsFeed />}

      {/* Chat available via floating widget (bottom-right) or /chat page */}
    </div>
  );
}
