"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import {
  getNotifications,
  markAsRead,
  markAllRead,
  getUnreadCount,
  removeNotification,
  type Notification,
  type NotificationType,
} from "@/lib/notifications";

/* ─── Type → Icon/Color mapping ─── */

const TYPE_CONFIG: Record<
  NotificationType,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    border: string;
  }
> = {
  workflow_complete: {
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  usage_warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  agent_error: {
    icon: XCircle,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  system_update: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
};

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

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    typeof window !== "undefined" ? getNotifications() : [],
  );
  const [unreadCount, setUnreadCount] = useState(() =>
    typeof window !== "undefined" ? getUnreadCount() : 0,
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshNotifications = useCallback(() => {
    setNotifications(getNotifications());
    setUnreadCount(getUnreadCount());
  }, []);

  // Listen for new notifications + poll for cross-tab changes
  useEffect(() => {
    const handler = () => refreshNotifications();
    window.addEventListener("sovereign:notification", handler);
    const interval = setInterval(refreshNotifications, 5000);

    return () => {
      window.removeEventListener("sovereign:notification", handler);
      clearInterval(interval);
    };
  }, [refreshNotifications]);

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
    markAllRead();
    refreshNotifications();
  };

  const handleMarkRead = (id: string) => {
    markAsRead(id);
    refreshNotifications();
  };

  const handleRemove = (id: string) => {
    removeNotification(id);
    refreshNotifications();
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
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-[#00B7FF] hover:text-[#00B7FF]/80 font-medium uppercase tracking-wider transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                  <p className="text-xs text-neutral-500">
                    No notifications yet
                  </p>
                </div>
              ) : (
                notifications.slice(0, 50).map((n) => {
                  const config = TYPE_CONFIG[n.type];
                  const Icon = config.icon;
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`group flex gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                        !n.read ? "bg-white/[0.02]" : ""
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`w-8 h-8 rounded-lg ${config.bg} ${config.border} border flex items-center justify-center shrink-0 mt-0.5`}
                      >
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm leading-tight ${n.read ? "text-neutral-300" : "text-white font-medium"}`}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-[#00B7FF] shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-neutral-600">
                            {timeAgo(n.timestamp)}
                          </span>
                          {n.href && (
                            <Link
                              href={n.href}
                              onClick={() => {
                                handleMarkRead(n.id);
                                setOpen(false);
                              }}
                              className="text-[10px] text-[#00B7FF] hover:underline inline-flex items-center gap-0.5"
                            >
                              View <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Actions (visible on hover) */}
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                        {!n.read && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            aria-label="Mark as read"
                            className="p-1 rounded text-neutral-500 hover:text-emerald-400 hover:bg-emerald-500/10 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-[#00B7FF] transition-colors"
                          >
                            <Check className="w-3 h-3" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(n.id)}
                          aria-label="Dismiss notification"
                          className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-[#00B7FF] transition-colors"
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
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
