"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Settings, Target,
  Search, ChevronDown, ChevronRight, Sparkles,
  X, Menu,
  PanelLeftOpen, PanelLeftClose, Plug, Cpu,
  BarChart3, Eye, Shield, Wrench,
  Wand2, Workflow, MessageSquare, Zap, Rocket,
  Bot, ClipboardList,
} from "lucide-react";
import { useKeyboardShortcuts } from "@/lib/keyboard-shortcuts";
import { motion, AnimatePresence } from "framer-motion";
import { UserButton } from "@clerk/nextjs";
import { useSafeUser } from "@/lib/safe-clerk";
import { TelemetryProvider } from '@/components/providers/TelemetryProvider';
import { JarvisSocket } from '@/components/JarvisSocket';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CinematicOnboarding } from '@/components/dashboard/CinematicOnboarding';
import { LiveActivityConsole } from '@/components/dashboard/LiveActivityConsole';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { SovereignAssistant } from '@/components/dashboard/SovereignAssistant';
import { NotificationCenter } from '@/components/dashboard/NotificationCenter';
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal';

/* ─── "NEW" Badge Helpers ─── */

const NEW_BADGE_ITEMS = new Set([
  "/dashboard/autopilot",
]);

const NEW_BADGE_STORAGE_PREFIX = "sovereign_new_dismissed_";

function useNewBadge(href: string) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!NEW_BADGE_ITEMS.has(href)) return false;
    return !localStorage.getItem(NEW_BADGE_STORAGE_PREFIX + href);
  });

  const dismiss = useCallback(() => {
    localStorage.setItem(NEW_BADGE_STORAGE_PREFIX + href, "true");
    setVisible(false);
  }, [href]);

  return { showNew: visible, dismissNew: dismiss };
}

/* ─── Navigation Structure ─── */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltip?: string;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultOpen?: boolean;
}

// ── Primary: The 5 things users actually do every day ──
const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, tooltip: "Dashboard overview" },
  { href: "/dashboard/mission-control", label: "Mission Control", icon: Rocket, tooltip: "One goal → watch agents execute" },
  { href: "/dashboard/playbooks", label: "Playbooks", icon: Zap, tooltip: "25 multi-agent workflows + autopilot" },
  { href: "/dashboard/leads", label: "Leads", icon: Target, tooltip: "Find and qualify prospects" },
  { href: "/chat", label: "Chat", icon: MessageSquare, tooltip: "Ask anything — AI routes to the right agent" },
];

// ── Grouped: Power tools + monitoring (collapsed by default) ──
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Tools",
    icon: Wrench,
    defaultOpen: false,
    items: [
      { href: "/dashboard/content-factory", label: "Content", icon: Sparkles, tooltip: "Blog posts, emails, social media" },
      { href: "/dashboard/seo-dominator", label: "SEO", icon: Search, tooltip: "Keyword research and site audits" },
      { href: "/dashboard/competitor", label: "Market Intel", icon: Shield, tooltip: "Competitor analysis" },
      { href: "/dashboard/build", label: "Page Builder", icon: Wand2, tooltip: "Build landing pages with AI" },
      { href: "/dashboard/workflow-builder", label: "Workflows", icon: Workflow, tooltip: "Visual multi-step automations" },
    ],
  },
  {
    label: "Monitor",
    icon: Cpu,
    items: [
      { href: "/dashboard/autopilot", label: "Autopilot", icon: Bot, tooltip: "Live playbook runs — step by step" },
      { href: "/dashboard/jobs", label: "Job Queue", icon: ClipboardList, tooltip: "Async fire-and-forget tasks" },
      { href: "/dashboard/agent-analytics", label: "Analytics", icon: BarChart3, tooltip: "Agent performance metrics" },
    ],
  },
];

// ── Bottom: Account-level items ──
const BOTTOM_NAV: NavItem[] = [
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug, tooltip: "Connect apps and services" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, tooltip: "Account, team, API keys" },
];

/* Page label lookup for breadcrumbs */
const ALL_NAV_ITEMS: NavItem[] = [
  ...PRIMARY_NAV,
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...BOTTOM_NAV,
];

function getPageLabel(pathname: string): string | null {
  if (pathname === "/dashboard") return null;
  const match = ALL_NAV_ITEMS.find(
    (item) => item.href !== "/dashboard" && pathname.startsWith(item.href)
  );
  if (match) return match.label;
  // Fallback: derive from pathname
  const segment = pathname.split("/").pop();
  if (!segment) return null;
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ─── Layout Component ─── */

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSafeUser();
  const [isConnected, setIsConnected] = useState(false);
  const [_ping, setPing] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("sidebar-expanded");
    return saved !== null ? saved === "true" : true;
  });
  const isHome = pathname === "/dashboard";
  const pageLabel = getPageLabel(pathname);

  // Collapsible group state — all start collapsed
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    // Auto-expand group containing the active page
    for (const group of NAV_GROUPS) {
      if (group.items.some((i) => pathname.startsWith(i.href))) {
        return new Set([group.label]);
      }
    }
    return new Set<string>();
  });

  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  // Persist sidebar preference to localStorage
  useEffect(() => {
    localStorage.setItem("sidebar-expanded", String(sidebarExpanded));
  }, [sidebarExpanded]);

  // Track page visits for Quick Access
  useEffect(() => {
    if (pathname === "/dashboard") return;
    try {
      const RECENT_KEY = "sovereign_recent_agents";
      const PAGE_MAP: Record<string, { name: string; iconName: string }> = {
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
        "/dashboard/competitor": { name: "Competitor Intel", iconName: "Shield" },
        "/dashboard/build": { name: "Page Builder", iconName: "Sparkles" },
        "/dashboard/settings/team": { name: "Team Settings", iconName: "Users" },
        "/dashboard/ghost-protocol": { name: "Ghost Protocol", iconName: "Shield" },
        "/dashboard/arsenal": { name: "Arsenal", iconName: "Zap" },
        "/dashboard/nim-arsenal": { name: "NIM Models", iconName: "Cpu" },
        "/dashboard/canvas": { name: "Canvas", iconName: "Palette" },
        "/dashboard/designer": { name: "Designer", iconName: "Palette" },
        "/dashboard/flywheel": { name: "Flywheel", iconName: "CircuitBoard" },
        "/dashboard/omni-search": { name: "Omni Search", iconName: "Search" },
        "/dashboard/billing": { name: "Billing", iconName: "DollarSign" },
        "/dashboard/agent-hq": { name: "Agent HQ", iconName: "Users" },
        "/dashboard/settings": { name: "Settings", iconName: "Settings" },
      };
      const pageInfo = PAGE_MAP[pathname];
      if (!pageInfo) return;
      const raw = localStorage.getItem(RECENT_KEY);
      let recent: { id: string; name: string; href: string; iconName: string; visitedAt: number }[] = raw ? JSON.parse(raw) : [];
      recent = recent.filter((r) => r.href !== pathname);
      recent.unshift({ id: pathname, name: pageInfo.name, href: pathname, iconName: pageInfo.iconName, visitedAt: Date.now() });
      recent = recent.slice(0, 10);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch { /* ignore */ }
  }, [pathname]);

  // Health check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const start = performance.now();
        const res = await fetch("/api/health");
        const elapsed = Math.round(performance.now() - start);
        setIsConnected(res.ok);
        setPing(elapsed);
      } catch { setIsConnected(false); }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 120_000);
    return () => clearInterval(interval);
  }, []);

  // Build the Cmd+1-9 navigation targets (top 9 sidebar items)
  const numNavTargets = useMemo(() => {
    const allItems = [...PRIMARY_NAV, ...NAV_GROUPS.flatMap((g) => g.items)];
    return allItems.slice(0, 9);
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: "/", meta: true, handler: () => setSidebarExpanded((v) => !v), label: "Toggle sidebar" },
    { key: "escape", handler: () => setMobileMenuOpen(false), label: "Close panel" },
    // Cmd+\ to focus chat input
    {
      key: "\\",
      meta: true,
      handler: () => {
        const chatInput = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          '[data-chat-input="true"], .chat-input, textarea[placeholder*="message"], input[placeholder*="message"]'
        );
        if (chatInput) chatInput.focus();
      },
      label: "Focus chat input",
    },
    // Cmd+Enter to submit current form
    {
      key: "enter",
      meta: true,
      handler: () => {
        const focused = document.activeElement as HTMLElement | null;
        if (focused) {
          const form = focused.closest("form");
          if (form) {
            form.requestSubmit();
          } else {
            // Try to find a nearby submit button
            const btn = document.querySelector<HTMLButtonElement>('button[type="submit"], button.submit-btn');
            if (btn) btn.click();
          }
        }
      },
      label: "Submit form",
    },
    // Cmd+1 through Cmd+9
    ...numNavTargets.map((item, i) => ({
      key: String(i + 1),
      meta: true,
      handler: () => router.push(item.href),
      label: `Go to ${item.label}`,
    })),
  ]);

  /* ── Active state helper ── */
  const isActive = useCallback(
    (href: string) =>
      pathname === href || (href !== "/dashboard" && pathname.startsWith(href)),
    [pathname]
  );

  /* ── Nav link component ── */
  const NavLink = useMemo(() => {
    const Component = ({
      item,
      collapsed,
      onNavigate,
    }: {
      item: NavItem;
      collapsed?: boolean;
      onNavigate?: () => void;
    }) => {
      const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
      const { showNew, dismissNew } = useNewBadge(item.href);

      const handleClick = () => {
        if (showNew) dismissNew();
        onNavigate?.();
      };

      if (collapsed) {
        return (
          <Link
            href={item.href}
            title={item.tooltip || item.label}
            aria-label={item.label}
            onClick={handleClick}
            className={`relative flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-gpu duration-150 ${
              active
                ? "bg-white/10 text-white border-l-2 border-emerald-500 shadow-[inset_3px_0_8px_rgba(16,185,129,0.1)]"
                : "text-neutral-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <item.icon className={`w-4 h-4 ${active ? "animate-pulse" : ""}`} />
            {showNew && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </Link>
        );
      }
      return (
        <Link
          href={item.href}
          title={item.tooltip || item.label}
          onClick={handleClick}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-gpu duration-150 ${
            active
              ? "bg-white/10 text-white border-l-2 border-emerald-500 shadow-[inset_3px_0_8px_rgba(16,185,129,0.1)]"
              : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <item.icon className={`w-4 h-4 shrink-0 ${active ? "animate-pulse" : ""}`} />
          <span className="flex-1">{item.label}</span>
          {showNew && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              NEW
            </span>
          )}
        </Link>
      );
    };
    Component.displayName = "NavLink";
    return Component;
  }, [pathname]);

  /* ── Expanded sidebar content ── */
  const renderExpandedNav = (isMobile: boolean) => {
    const onNavigate = isMobile ? () => setMobileMenuOpen(false) : undefined;
    return (
      <>
        {/* Primary nav */}
        <div className="px-3 pt-4 pb-2 space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        <div className="mx-4 border-b border-white/[0.04]" />

        {/* Collapsible groups */}
        <div className="px-3 pt-3 pb-2 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
          {NAV_GROUPS.map((group) => {
            const isOpen = openGroups.has(group.label);
            const hasActive = group.items.some((i) => isActive(i.href));

            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${group.label} section`}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] rounded-md transition-colors ${
                    hasActive
                      ? "text-neutral-300"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  <group.icon className="w-3.5 h-3.5" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <motion.div
                    animate={{ rotate: isOpen ? 0 : -90 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pt-1 pb-1 space-y-0.5">
                        {group.items.map((item) => (
                          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="mx-4 border-b border-white/[0.04]" />

        {/* Bottom settings nav */}
        <div className="px-3 pt-2 pb-3 space-y-0.5">
          {BOTTOM_NAV.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </>
    );
  };

  /* ── Collapsed sidebar (icons only) ── */
  const renderCollapsedNav = () => (
    <nav className="flex-1 overflow-y-auto py-3 space-y-1 custom-scrollbar">
      {PRIMARY_NAV.map((item) => (
        <NavLink key={item.href} item={item} collapsed />
      ))}
      <div className="mx-3 my-2 border-b border-white/[0.04]" />
      {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
        <NavLink key={item.href} item={item} collapsed />
      ))}
      <div className="mx-3 my-2 border-b border-white/[0.04]" />
      {BOTTOM_NAV.map((item) => (
        <NavLink key={item.href} item={item} collapsed />
      ))}
    </nav>
  );

  return (
    <TelemetryProvider>
      <div className="flex h-screen bg-[#000000] text-white overflow-hidden font-sans">

        {/* === DESKTOP SIDEBAR === */}
        <aside
          role="navigation"
          aria-label="Main sidebar"
          className={`hidden ${isHome ? "lg:hidden" : "lg:flex"} ${
            sidebarExpanded ? "w-[240px]" : "w-16"
          } border-r border-[#111111] bg-[#050505] flex-col shrink-0 overflow-hidden relative z-10 transition-gpu duration-300`}
        >
          {/* Logo Header */}
          <div
            className={`border-b border-white/5 z-10 flex items-center ${
              sidebarExpanded ? "px-5 py-4 justify-between" : "p-4 justify-center"
            }`}
          >
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Sovereign"
                width={22}
                height={22}
                className="rounded-md opacity-90 grayscale hover:grayscale-0 transition-gpu duration-500"
              />
              {sidebarExpanded && (
                <span className="text-sm font-semibold tracking-wide text-white">
                  Sovereign
                </span>
              )}
            </Link>
            {sidebarExpanded && (
              <button
                onClick={() => setSidebarExpanded(false)}
                className="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>

          {sidebarExpanded ? renderExpandedNav(false) : renderCollapsedNav()}

          {/* User Footer */}
          <div
            className={`border-t border-white/5 bg-[#0A0A0A] ${
              sidebarExpanded
                ? "px-4 py-3 flex items-center justify-between"
                : "p-3 flex flex-col items-center gap-3"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox:
                      "w-7 h-7 rounded-lg outline outline-1 outline-white/10",
                  },
                }}
              />
              {sidebarExpanded && (
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white truncate max-w-[120px]">
                    {user?.fullName || "User"}
                  </span>
                  <span className="text-[10px] text-neutral-500 flex items-center gap-1.5">
                    {isConnected ? (
                      <>
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Online
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 bg-neutral-600 rounded-full" />
                        Offline
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
            {sidebarExpanded && <NotificationCenter />}
            {!sidebarExpanded && (
              <button
                onClick={() => setSidebarExpanded(true)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
          </div>
        </aside>

        {/* === MAIN CONTENT === */}
        <main role="main" className="flex-1 overflow-y-auto bg-[#000000] relative z-10 custom-scrollbar">
          <div className="relative z-10 w-full min-h-full max-w-[1600px] mx-auto">
            {/* Breadcrumb Bar */}
            {!isHome && pageLabel && (
              <div className="px-6 lg:px-8 pt-3 pb-1 flex items-center gap-1.5">
                <Link
                  href="/dashboard"
                  className="text-[11px] text-neutral-500 hover:text-neutral-400 transition-colors"
                >
                  Dashboard
                </Link>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
                <span className="text-[11px] text-neutral-400 font-medium">
                  {pageLabel}
                </span>
              </div>
            )}
            <ErrorBoundary>
              <ToastProvider>
                <CinematicOnboarding>
                  <motion.div
                    key={pathname}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    {children}
                  </motion.div>
                </CinematicOnboarding>
              </ToastProvider>
            </ErrorBoundary>
          </div>
          <JarvisSocket />
          <CommandPalette />
        </main>

        {!isHome && <LiveActivityConsole />}
        {!isHome && <SovereignAssistant />}
        <KeyboardShortcutsModal />

        {/* === MOBILE BOTTOM NAV === */}
        <nav
          aria-label="Mobile navigation"
          className={`${
            isHome ? "hidden" : "lg:hidden"
          } fixed bottom-6 left-6 right-6 z-50 bg-[#0A0A0A] border border-white/10 rounded-2xl flex items-center justify-around p-3 shadow-2xl`}
        >
          <Link
            href="/dashboard"
            className={`flex flex-col items-center gap-1.5 ${
              pathname === "/dashboard" ? "text-white" : "text-neutral-500"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[9px] font-medium tracking-wide">Home</span>
          </Link>
          <Link
            href="/dashboard/build"
            className={`flex flex-col items-center gap-1.5 ${
              pathname.startsWith("/dashboard/build")
                ? "text-white"
                : "text-neutral-500"
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[9px] font-medium tracking-wide">Build</span>
          </Link>
          <Link
            href="/dashboard/leads"
            className={`flex flex-col items-center gap-1.5 ${
              pathname.startsWith("/dashboard/leads")
                ? "text-white"
                : "text-neutral-500"
            }`}
          >
            <Target className="w-5 h-5" />
            <span className="text-[9px] font-medium tracking-wide">Leads</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
            className="flex flex-col items-center gap-1.5 text-neutral-500"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[9px] font-medium tracking-wide">More</span>
          </button>
        </nav>

        {/* === MOBILE FULL MENU OVERLAY === */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              role="dialog"
              aria-label="Navigation menu"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="lg:hidden fixed inset-0 z-[100] bg-[#000000] flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <span className="text-sm font-semibold tracking-wide text-white">
                  Sovereign
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-2 text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderExpandedNav(true)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TelemetryProvider>
  );
}
