"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Settings, DollarSign, Target,
  Layers, Search, ChevronDown, ChevronRight, Sparkles, Factory,
  X, Menu, Mic, Swords, Database, Inbox, CalendarClock,
  PanelLeftOpen, PanelLeftClose, Clock, Plug, Cpu,
  BarChart3, CircuitBoard, Eye, Palette, Globe2, Shield, Wrench, LayoutTemplate,
  Wand2
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

/* ─── Navigation Structure ─── */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultOpen?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard/build", label: "Build", icon: Sparkles },
  { href: "/dashboard/leads", label: "Leads", icon: Target },
  { href: "/dashboard/content-factory", label: "Content", icon: Factory },
  { href: "/dashboard/canvas", label: "Canvas", icon: Layers },
  { href: "/dashboard/templates", label: "Templates", icon: LayoutTemplate },
];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Tools",
    icon: Wrench,
    items: [
      { href: "/dashboard/seo-dominator", label: "SEO Dominator", icon: Search },
      { href: "/dashboard/competitor", label: "Competitor Intel", icon: Shield },
      { href: "/dashboard/voice-assistant", label: "Voice Assistant", icon: Mic },
      { href: "/dashboard/visual-studio", label: "Code Studio", icon: Palette },
      { href: "/dashboard/workflows", label: "Workflows", icon: CircuitBoard },
      { href: "/dashboard/automations", label: "Automations", icon: Clock },
      { href: "/dashboard/scheduled", label: "Scheduled Runs", icon: CalendarClock },
      { href: "/dashboard/agent-builder", label: "Agent Builder", icon: Wand2 },
    ],
  },
  {
    label: "Intelligence",
    icon: Cpu,
    items: [
      { href: "/dashboard/agent-hq", label: "Agent HQ", icon: Users },
      { href: "/dashboard/agent-analytics", label: "Analytics", icon: BarChart3 },
      { href: "/dashboard/war-room", label: "War Room", icon: Swords },
      { href: "/dashboard/god-eye", label: "God Eye", icon: Eye },
      { href: "/dashboard/nim-arsenal", label: "NIM Arsenal", icon: Database },
    ],
  },
];

const BOTTOM_NAV: NavItem[] = [
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
  { href: "/dashboard/billing", label: "Billing", icon: DollarSign },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
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
  const { user } = useSafeUser();
  const [isConnected, setIsConnected] = useState(false);
  const [ping, setPing] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
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

  // Persist sidebar preference
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-expanded");
    if (saved !== null) setSidebarExpanded(saved === "true");
  }, []);
  useEffect(() => {
    localStorage.setItem("sidebar-expanded", String(sidebarExpanded));
  }, [sidebarExpanded]);

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

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: "/", meta: true, handler: () => setSidebarExpanded((v) => !v), label: "Toggle sidebar" },
    { key: "escape", handler: () => setMobileMenuOpen(false), label: "Close panel" },
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
      if (collapsed) {
        return (
          <Link
            href={item.href}
            title={item.label}
            onClick={onNavigate}
            className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-gpu duration-150 ${
              active
                ? "bg-white/10 text-white"
                : "text-neutral-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <item.icon className="w-4 h-4" />
          </Link>
        );
      }
      return (
        <Link
          href={item.href}
          onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-gpu duration-150 ${
            active
              ? "bg-white/10 text-white"
              : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span>{item.label}</span>
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
            {!sidebarExpanded && (
              <button
                onClick={() => setSidebarExpanded(true)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
          </div>
        </aside>

        {/* === MAIN CONTENT === */}
        <main className="flex-1 overflow-y-auto bg-[#000000] relative z-10 custom-scrollbar">
          <div className="relative z-10 w-full min-h-full max-w-[1600px] mx-auto">
            {/* Breadcrumb Bar */}
            {!isHome && pageLabel && (
              <div className="px-6 lg:px-8 pt-3 pb-1 flex items-center gap-1.5">
                <Link
                  href="/dashboard"
                  className="text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors"
                >
                  Dashboard
                </Link>
                <ChevronRight className="w-3 h-3 text-neutral-700" />
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

        {/* === MOBILE BOTTOM NAV === */}
        <nav
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
