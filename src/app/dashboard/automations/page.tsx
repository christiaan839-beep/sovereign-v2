"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Zap,
  Search,
  FileText,
  Users,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Play,
  Pause,
} from "lucide-react";

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  agent: string;
  endpoint: string;
  schedule: string;
  cron: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const TEMPLATES: AutomationTemplate[] = [
  {
    id: "daily-seo",
    name: "Daily SEO Check",
    description:
      "Runs a full SEO audit every morning at 7 AM. Checks rankings, backlinks, and on-page issues.",
    agent: "SEO Dominator",
    endpoint: "/api/agents/seo-dominator",
    schedule: "Every day at 7:00 AM",
    cron: "0 7 * * *",
    icon: Search,
    color: "emerald",
  },
  {
    id: "weekly-report",
    name: "Weekly Performance Report",
    description:
      "Generates a comprehensive client performance report every Monday morning with KPIs and insights.",
    agent: "Client Report",
    endpoint: "/api/agents/client-report",
    schedule: "Every Monday at 8:00 AM",
    cron: "0 8 * * 1",
    icon: FileText,
    color: "blue",
  },
  {
    id: "hourly-leads",
    name: "Hourly Lead Monitor",
    description:
      "Scans for new inbound leads every hour and routes them to your CRM pipeline automatically.",
    agent: "Lead Prospector",
    endpoint: "/api/agents/leads",
    schedule: "Every hour",
    cron: "0 * * * *",
    icon: Users,
    color: "violet",
  },
  {
    id: "daily-competitor",
    name: "Daily Competitor Watch",
    description:
      "Monitors competitor websites, pricing, and content changes. Alerts you to significant movements.",
    agent: "Competitor Intel",
    endpoint: "/api/agents/competitor-scan",
    schedule: "Every day at 6:00 AM",
    cron: "0 6 * * *",
    icon: Zap,
    color: "amber",
  },
  {
    id: "weekly-calendar",
    name: "Weekly Content Calendar",
    description:
      "Auto-generates a content calendar every Sunday evening based on trends and audience data.",
    agent: "Content Calendar",
    endpoint: "/api/agents/calendar",
    schedule: "Every Sunday at 6:00 PM",
    cron: "0 18 * * 0",
    icon: Calendar,
    color: "rose",
  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    glow: "shadow-emerald-500/5",
  },
  blue: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
    glow: "shadow-blue-500/5",
  },
  violet: {
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    border: "border-violet-500/20",
    glow: "shadow-violet-500/5",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    glow: "shadow-amber-500/5",
  },
  rose: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    glow: "shadow-rose-500/5",
  },
};

export default function AutomationsPage() {
  const [activeAutomations, setActiveAutomations] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const toggleAutomation = async (template: AutomationTemplate) => {
    const isActive = activeAutomations.has(template.id);
    setLoadingId(template.id);

    try {
      if (isActive) {
        // Disable automation
        await fetch("/api/agents/scheduler", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ automationId: template.id }),
        });
        setActiveAutomations((prev) => {
          const next = new Set(prev);
          next.delete(template.id);
          return next;
        });
      } else {
        // Enable automation
        await fetch("/api/agents/scheduler", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            automationId: template.id,
            name: template.name,
            endpoint: template.endpoint,
            cron: template.cron,
          }),
        });
        setActiveAutomations((prev) => {
          const next = new Set(prev);
          next.add(template.id);
          return next;
        });
      }
    } catch {
      // Toggle locally even if API fails (optimistic UI)
      setActiveAutomations((prev) => {
        const next = new Set(prev);
        if (isActive) {
          next.delete(template.id);
        } else {
          next.add(template.id);
        }
        return next;
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] p-6 md:p-10" role="main" aria-label="Automations scheduling">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-[#00B7FF]/10 border border-[#00B7FF]/20">
            <Clock className="w-5 h-5 text-[#00B7FF]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Automations
          </h1>
        </div>
        <p className="text-sm text-neutral-500 ml-12">
          Schedule agents to run automatically. Set it and forget it.
        </p>
      </motion.div>

      {/* Active count */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mb-6 flex items-center gap-4"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/[0.06]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-neutral-400">
            {activeAutomations.size} active
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/[0.06]">
          <Pause className="w-3 h-3 text-neutral-500" />
          <span className="text-xs font-mono text-neutral-400">
            {TEMPLATES.length - activeAutomations.size} paused
          </span>
        </div>
      </motion.div>

      {/* Automation Cards */}
      <div className="grid gap-4">
        {TEMPLATES.map((template, index) => {
          const isActive = activeAutomations.has(template.id);
          const isLoading = loadingId === template.id;
          const colors = COLOR_MAP[template.color];
          const Icon = template.icon;

          return (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: index * 0.07,
                ease: "easeOut",
              }}
              className={`relative rounded-xl border bg-[#0A0A0A] p-5 transition-gpu duration-300 ${
                isActive
                  ? `${colors.border} shadow-lg ${colors.glow}`
                  : "border-white/[0.06] hover:border-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Icon + Info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div
                    className={`shrink-0 p-2.5 rounded-lg ${colors.bg} border ${colors.border}`}
                  >
                    {React.createElement(Icon, { className: `w-5 h-5 ${colors.text}` })}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white truncate">
                        {template.name}
                      </h3>
                      {isActive && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                        >
                          <Play className="w-2.5 h-2.5 text-emerald-400" />
                          <span className="text-[10px] font-mono text-emerald-400">
                            LIVE
                          </span>
                        </motion.span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
                      {template.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/[0.06] text-[10px] font-mono text-neutral-400">
                        <Zap className="w-3 h-3" />
                        {template.agent}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/[0.06] text-[10px] font-mono text-neutral-400">
                        <Clock className="w-3 h-3" />
                        {template.schedule}
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/[0.06] text-[10px] font-mono text-neutral-500">
                        {template.cron}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Toggle */}
                <button
                  onClick={() => toggleAutomation(template)}
                  disabled={isLoading}
                  className={`shrink-0 p-1 rounded-lg transition-gpu duration-200 ${
                    isLoading ? "opacity-50 cursor-wait" : "cursor-pointer hover:bg-white/5"
                  }`}
                  aria-label={isActive ? `Disable ${template.name}` : `Enable ${template.name}`}
                >
                  {isActive ? (
                    <ToggleRight className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-neutral-500" />
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 text-center text-xs text-neutral-500 font-mono"
      >
        Automations run on Sovereign Matrix infrastructure. Configure custom schedules in Settings.
      </motion.p>
    </div>
  );
}
