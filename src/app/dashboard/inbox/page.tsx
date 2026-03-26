"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  Users,
  FileText,
  Settings,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Bot,
  Sparkles,
  Target,
} from "lucide-react";

type InboxItemType = "leads" | "content" | "system";
type InboxStatus = "new" | "reviewed";

interface InboxItem {
  id: string;
  agent: string;
  type: InboxItemType;
  action: string;
  details: string;
  timestamp: string;
  relativeTime: string;
  status: InboxStatus;
}

const TYPE_CONFIG: Record<
  InboxItemType,
  { color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  leads: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: Target,
  },
  content: {
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: FileText,
  },
  system: {
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    icon: Settings,
  },
};

const DEMO_ITEMS: InboxItem[] = [
  {
    id: "1",
    agent: "Lead Prospector",
    type: "leads",
    action: "Found 12 new leads in fintech",
    details:
      "Scanned 340 companies matching your ICP filters. 12 high-intent prospects identified with buying signals: recent funding rounds, job postings for relevant roles, and technology stack changes. Top prospect: Meridian Finance (Series B, $24M raised last week).",
    timestamp: "2026-03-26T14:32:00Z",
    relativeTime: "2 min ago",
    status: "new",
  },
  {
    id: "2",
    agent: "Content Engine",
    type: "content",
    action: "Generated 3 LinkedIn posts for next week",
    details:
      "Created a 3-post sequence targeting your SaaS founder audience. Post 1: Industry trend analysis (estimated reach: 2.4K). Post 2: Case study breakdown with metrics. Post 3: Contrarian take on AI agents in sales. All posts optimized for engagement and scheduled for Tuesday, Thursday, Saturday.",
    timestamp: "2026-03-26T14:15:00Z",
    relativeTime: "19 min ago",
    status: "new",
  },
  {
    id: "3",
    agent: "SEO Dominator",
    type: "content",
    action: "Keyword rankings updated — 4 positions gained",
    details:
      'Your primary keyword "AI agency platform" moved from position 14 to position 10. Secondary keywords "autonomous agents for business" and "AI workflow automation" each gained 2 positions. Recommended action: publish the draft blog post targeting the long-tail variant "best AI agent platform for agencies".',
    timestamp: "2026-03-26T13:45:00Z",
    relativeTime: "49 min ago",
    status: "new",
  },
  {
    id: "4",
    agent: "System Monitor",
    type: "system",
    action: "API rate limit threshold at 78%",
    details:
      "Your Gemini API usage is approaching the rate limit. Current consumption: 78% of your hourly quota (936/1200 requests). Projected to hit ceiling in approximately 45 minutes at current pace. Consider upgrading your plan or implementing request batching.",
    timestamp: "2026-03-26T13:20:00Z",
    relativeTime: "1 hr ago",
    status: "reviewed",
  },
  {
    id: "5",
    agent: "Competitor Intel",
    type: "leads",
    action: "Competitor pricing change detected",
    details:
      'AgentForce.io dropped their Pro plan pricing from $299/mo to $199/mo. This undercuts your mid-tier offering by $50. Their changelog mentions "new AI routing engine" launching next week. Recommend reviewing your positioning and considering a value-add bundle response.',
    timestamp: "2026-03-26T12:00:00Z",
    relativeTime: "2 hrs ago",
    status: "reviewed",
  },
  {
    id: "6",
    agent: "Content Engine",
    type: "content",
    action: "Blog draft ready for review: AI Agents in 2026",
    details:
      "2,400-word deep dive on the state of autonomous AI agents. Includes original research data, 3 expert quotes sourced from recent interviews, and 2 custom diagrams. SEO score: 92/100. Readability: Grade 8. Estimated organic traffic potential: 1,200 visits/month after 90 days.",
    timestamp: "2026-03-26T10:30:00Z",
    relativeTime: "4 hrs ago",
    status: "reviewed",
  },
  {
    id: "7",
    agent: "System Monitor",
    type: "system",
    action: "Agent deployment successful — Ghost Protocol v2.1",
    details:
      "Ghost Protocol agent updated to v2.1. Changes: improved stealth browsing engine, 40% faster page parsing, new anti-detection fingerprinting. All 14 integration tests passed. Rollback checkpoint saved.",
    timestamp: "2026-03-26T09:00:00Z",
    relativeTime: "5 hrs ago",
    status: "reviewed",
  },
];

type TabKey = "all" | "leads" | "content" | "system";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all", label: "All", icon: Inbox },
  { key: "leads", label: "Leads", icon: Users },
  { key: "content", label: "Content", icon: FileText },
  { key: "system", label: "System", icon: Settings },
];

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [items, setItems] = useState<InboxItem[]>(DEMO_ITEMS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredItems =
    activeTab === "all" ? items : items.filter((item) => item.type === activeTab);

  const newCount = items.filter((i) => i.status === "new").length;

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, status: "reviewed" as InboxStatus })));
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    // Auto-mark as reviewed on expand
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "reviewed" as InboxStatus } : item
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#000000] p-6 md:p-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <Inbox className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Smart Inbox</h1>
              <p className="text-sm text-neutral-500">
                Unified feed of all agent activity and notifications
              </p>
            </div>
          </div>
          {newCount > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={markAllRead}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-neutral-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              Mark All Read
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-2 mb-6"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count =
            tab.key === "all"
              ? items.length
              : items.filter((i) => i.type === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-white/10 text-white border border-white/15"
                  : "bg-white/[0.03] text-neutral-500 border border-transparent hover:bg-white/5 hover:text-neutral-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-md ${
                  isActive ? "bg-white/10 text-neutral-300" : "bg-white/5 text-neutral-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Inbox Items */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredItems.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-5">
                <Bot className="w-8 h-8 text-neutral-600" />
              </div>
              <p className="text-neutral-400 text-sm max-w-md">
                Your agents haven&apos;t started working yet. Deploy your first agent to see
                activity here.
              </p>
            </motion.div>
          ) : (
            filteredItems.map((item, index) => {
              const config = TYPE_CONFIG[item.type];
              const IconComponent = config.icon;
              const isExpanded = expandedId === item.id;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                >
                  <div
                    onClick={() => toggleExpand(item.id)}
                    className={`group rounded-2xl border backdrop-blur-xl transition-all cursor-pointer ${
                      item.status === "new"
                        ? "bg-white/[0.04] border-white/10 shadow-lg"
                        : "bg-white/[0.02] border-white/[0.06]"
                    } hover:bg-white/[0.06] hover:border-white/15`}
                  >
                    <div className="flex items-center gap-4 p-4 md:p-5">
                      {/* Agent Icon */}
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-xl ${config.bg} border ${config.border} flex items-center justify-center`}
                      >
                        <IconComponent className={`w-5 h-5 ${config.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-medium ${config.color}`}>
                            {item.agent}
                          </span>
                          <span className="text-neutral-600 text-xs">·</span>
                          <span className="text-neutral-600 text-xs">{item.relativeTime}</span>
                        </div>
                        <p className="text-sm text-neutral-200 truncate">{item.action}</p>
                      </div>

                      {/* Status + Expand */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {item.status === "new" ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                            New
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/[0.06] text-neutral-500 text-xs font-medium">
                            Reviewed
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-neutral-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-0">
                            <div className="pl-14">
                              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <p className="text-sm text-neutral-400 leading-relaxed">
                                  {item.details}
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Footer summary */}
      {filteredItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-600"
        >
          <Sparkles className="w-3 h-3" />
          <span>
            {newCount} unread · {items.length} total notifications
          </span>
        </motion.div>
      )}
    </div>
  );
}
