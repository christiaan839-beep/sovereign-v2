"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Search,
  ShieldAlert,
  X,
  Check,
} from "lucide-react";

/* ─── Types ─── */

type NotificationType =
  | "playbook_completed"
  | "agent_failed"
  | "new_lead"
  | "approval_required";

interface BellNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

/* ─── Config ─── */

const STORAGE_KEY = "sovereign_bell_notifications";
const MAX_STORED = 50;

const TYPE_CONFIG: Record<
  NotificationType,
  {
    label: string;
    dotColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  playbook_completed: {
    label: "Playbook completed",
    dotColor: "bg-emerald-400",
    icon: CheckCircle2,
  },
  agent_failed: {
    label: "Agent failed",
    dotColor: "bg-red-400",
    icon: XCircle,
  },
  new_lead: {
    label: "New lead found",
    dotColor: "bg-cyan-400",
    icon: Search,
  },
  approval_required: {
    label: "Approval required",
    dotColor: "bg-amber-400",
    icon: ShieldAlert,
  },
};

/* ─── localStorage helpers ─── */

function readBellStore(): BellNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BellNotification[];
  } catch {
    return [];
  }
}

function writeBellStore(items: BellNotification[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_STORED)),
    );
  } catch {
    // localStorage may be full
  }
}

/* ─── Time formatting ─── */

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ─── Component ─── */

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<BellNotification[]>(() =>
    typeof window !== "undefined" ? readBellStore() : [],
  );
  const [lastPollKey, setLastPollKey] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Sync to localStorage whenever notifications change
  useEffect(() => {
    if (notifications.length > 0) {
      writeBellStore(notifications);
    }
  }, [notifications]);

  // Poll /api/agents/dashboard-stats for new events
  const pollForEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/dashboard-stats");
      if (!res.ok) return;
      const data = await res.json();
      const stats = data.stats ?? data;

      // Build a fingerprint to detect changes
      const key = JSON.stringify({
        e: stats.agentExecutions ?? 0,
        l: stats.leadsGenerated ?? 0,
        p: stats.playbookRuns ?? stats.playbooks?.total ?? 0,
        f: stats.failedRuns ?? stats.playbooks?.failed ?? 0,
      });

      if (lastPollKey && key !== lastPollKey) {
        // Something changed -- determine which type of notification to create
        const prev = JSON.parse(lastPollKey);
        const curr = JSON.parse(key);
        const newNotifs: BellNotification[] = [];
        const now = new Date().toISOString();

        if (curr.p > prev.p) {
          newNotifs.push({
            id: `bell_${Date.now()}_pb`,
            type: "playbook_completed",
            title: "Playbook completed",
            body: `A playbook run has finished. Total runs: ${curr.p}.`,
            timestamp: now,
            read: false,
          });
        }

        if (curr.f > prev.f) {
          newNotifs.push({
            id: `bell_${Date.now()}_fail`,
            type: "agent_failed",
            title: "Agent failed",
            body: `An agent execution encountered an error. Failed: ${curr.f}.`,
            timestamp: now,
            read: false,
          });
        }

        if (curr.l > prev.l) {
          newNotifs.push({
            id: `bell_${Date.now()}_lead`,
            type: "new_lead",
            title: "New lead found",
            body: `${curr.l - prev.l} new lead${curr.l - prev.l > 1 ? "s" : ""} discovered by your agents.`,
            timestamp: now,
            read: false,
          });
        }

        if (newNotifs.length > 0) {
          setNotifications((prev) =>
            [...newNotifs, ...prev].slice(0, MAX_STORED),
          );
        }
      }

      setLastPollKey(key);
    } catch {
      // Network error — skip this poll cycle
    }
  }, [lastPollKey]);

  // Poll every 30 seconds. The first poll runs synchronously to seed
  // lastPollKey before the interval; the resulting setLastPollKey in
  // pollForEvents is intentional, not a cascading-render bug.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    pollForEvents();
    const interval = setInterval(pollForEvents, 30_000);
    return () => clearInterval(interval);
  }, [pollForEvents]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        className="relative p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        <Bell className="w-4.5 h-4.5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-[360px] max-h-[440px] bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium uppercase tracking-wider transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-14 text-center px-6">
                  <Bell className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    No notifications yet. Run a playbook to get started.
                  </p>
                </div>
              ) : (
                notifications.slice(0, MAX_STORED).map((n) => {
                  const config = TYPE_CONFIG[n.type];
                  const Icon = config.icon;
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className={`group flex gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                        !n.read ? "bg-white/[0.02]" : ""
                      }`}
                    >
                      {/* Status dot + Icon */}
                      <div className="relative shrink-0 mt-0.5">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                          <Icon className="w-4 h-4 text-neutral-400" />
                        </div>
                        <span
                          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${config.dotColor} border-2 border-[#0A0A0A]`}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm leading-tight ${
                              n.read
                                ? "text-neutral-400"
                                : "text-white font-medium"
                            }`}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <span className="text-[10px] text-neutral-600 mt-1 block">
                          {timeAgo(n.timestamp)}
                        </span>
                      </div>

                      {/* Hover Actions */}
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                        {!n.read && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            aria-label="Mark as read"
                            className="p-1 rounded text-neutral-500 hover:text-emerald-400 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDismiss(n.id)}
                          aria-label="Dismiss notification"
                          className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
