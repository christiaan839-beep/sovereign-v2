"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Settings, Shield, DollarSign, Target,
  Layers, Globe2, Network, Search, ChevronDown, Rocket, Palette, Factory,
  X, Menu, Cpu, Mic, ScanFace, Video, Swords, ShieldAlert, Database, Headphones,
  FileVideo, Cuboid, Ghost, Zap, CircuitBoard, BarChart3, RefreshCcw, Sparkles,
  PanelLeftOpen, PanelLeftClose, Clock, Plug
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UserButton, useUser } from "@clerk/nextjs";
import { TelemetryProvider } from '@/components/providers/TelemetryProvider';
import { JarvisSocket } from '@/components/JarvisSocket';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CinematicOnboarding } from '@/components/dashboard/CinematicOnboarding';
import { LiveActivityConsole } from '@/components/dashboard/LiveActivityConsole';
import { UsageBar } from '@/components/ui/UsageBar';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { SystemPulseStrip } from '@/components/dashboard/SystemPulseStrip';
import { SmartContextBar } from '@/components/dashboard/SmartContextBar';
import { SovereignAssistant } from '@/components/dashboard/SovereignAssistant';

const NAV_GROUPS = [
  {
    group: "Command Center",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/agent-hq", label: "Agent HQ", icon: Users },
      { href: "/dashboard/agent-world", label: "Agent World", icon: Network },
      { href: "/dashboard/build", label: "Build Mode", icon: Sparkles },
      { href: "/dashboard/agent-command", label: "Agent Command", icon: Zap },
      { href: "/dashboard/workflows", label: "Workflows", icon: CircuitBoard },
      { href: "/dashboard/war-room", label: "War Room", icon: Swords },
      { href: "/dashboard/leads", label: "Lead Prospector", icon: Users },
      { href: "/dashboard/agent-analytics", label: "Analytics", icon: BarChart3 },
      { href: "/dashboard/automations", label: "Automations", icon: Clock },
      { href: "/dashboard/live-terminal", label: "Live Terminal", icon: CircuitBoard },
    ]
  },
  {
    group: "AI Arsenal",
    icon: Rocket,
    items: [
      { href: "/dashboard/arsenal", label: "Playbook Arsenal", icon: Rocket },
      { href: "/dashboard/seo-dominator", label: "SEO X-Ray", icon: Search },
      { href: "/dashboard/content-factory", label: "Content Factory", icon: Factory },
      { href: "/dashboard/competitor", label: "Competitor Intel", icon: Shield },
      { href: "/dashboard/nemo-claw", label: "Local AI (NemoClaw)", icon: Cpu },
      { href: "/dashboard/voice-swarm", label: "Voice Swarm", icon: Mic },
      { href: "/dashboard/voice-assistant", label: "Voice Assistant", icon: Mic },
      { href: "/dashboard/podcast", label: "PDF-to-Podcast", icon: Headphones },
      { href: "/dashboard/omni-search", label: "RAG Search", icon: Database },
      { href: "/dashboard/cyber-audit", label: "Cyber Audit", icon: ShieldAlert },
      { href: "/dashboard/ghost-protocol", label: "Stealth Research", icon: Ghost },
      { href: "/dashboard/flywheel", label: "Quality Engine", icon: RefreshCcw },
    ]
  },
  {
    group: "Creative Suite",
    icon: Palette,
    items: [
      { href: "/dashboard/designer", label: "Design Studio", icon: Palette },
      { href: "/dashboard/visual-studio", label: "Visual Studio", icon: Palette },
      { href: "/dashboard/page-builder", label: "Page Builder", icon: Globe2 },
      { href: "/dashboard/avatar", label: "Digital Human", icon: ScanFace },
      { href: "/dashboard/deepfake-studio", label: "Video Clone", icon: FileVideo },
      { href: "/dashboard/vsl-hacker", label: "Video Sales Letter", icon: Video },
      { href: "/dashboard/edify-forge", label: "Edify 3D Forge", icon: Cuboid },
    ]
  },
  {
    group: "Platform",
    icon: Settings,
    items: [
      { href: "/dashboard/library", label: "My Library", icon: Layers },
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
      { href: "/dashboard/billing", label: "Billing", icon: DollarSign },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ]
  }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const [ping, setPing] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const isHome = pathname === "/dashboard";

  // Persist sidebar preference
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-expanded");
    if (saved === "true") setSidebarExpanded(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("sidebar-expanded", String(sidebarExpanded));
  }, [sidebarExpanded]);

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
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getActiveGroup = useCallback(() => {
    for (const group of NAV_GROUPS) {
      if (group.items.some(item => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)))) {
        return group.group;
      }
    }
    return "Command Center";
  }, [pathname]);

  const activeGroup = getActiveGroup();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    initial.add(activeGroup);
    initial.add("Command Center");
    return initial;
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return NAV_GROUPS;
    const q = searchQuery.toLowerCase();
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item =>
        item.label.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
      )
    })).filter(group => group.items.length > 0);
  }, [searchQuery]);

  const nodeId = user ? `SM-${user.id.slice(-5).toUpperCase()}` : 'SM-OFFLINE';

  const renderNavContent = (isMobile: boolean) => (
    <>
      <div className={`${isMobile ? 'p-4' : 'px-4 pt-6 pb-2 border-b border-white/5'}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 transition-colors font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {filteredGroups.map((section) => {
          const isExpanded = expandedGroups.has(section.group) || searchQuery.trim().length > 0;
          
          return (
            <div key={section.group} className="space-y-1">
              <button
                onClick={() => toggleGroup(section.group)}
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <span>{section.group}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'opacity-100' : '-rotate-90 opacity-0'}`} />
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="py-1 space-y-0.5">
                      {section.items.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => isMobile && setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              isActive
                                ? "bg-white/10 text-white"
                                : "text-neutral-400 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            <item.icon className="w-4 h-4 shrink-0" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <TelemetryProvider>
      <div className="flex h-screen bg-[#000000] text-white overflow-hidden font-sans">
        
        {/* === DESKTOP SIDEBAR === */}
        <aside className={`hidden ${isHome ? "lg:hidden" : "lg:flex"} ${sidebarExpanded ? "w-[260px]" : "w-16"} border-r border-[#111111] bg-[#050505] flex-col shrink-0 overflow-hidden relative z-10 transition-all duration-300`}>

          {/* Logo Header */}
          <div className={`border-b border-white/5 z-10 flex items-center ${sidebarExpanded ? "p-6 justify-between" : "p-4 justify-center"}`}>
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image src="/logo.png" alt="Matrix" width={24} height={24} className="rounded-md opacity-90 grayscale hover:grayscale-0 transition-all duration-500" />
              {sidebarExpanded && <span className="text-sm font-semibold tracking-wide text-white">Sovereign Matrix</span>}
            </Link>
          </div>

          {sidebarExpanded ? (
            renderNavContent(false)
          ) : (
            /* Collapsed: icon-only nav */
            <nav className="flex-1 overflow-y-auto py-3 space-y-1 custom-scrollbar">
              {NAV_GROUPS.flatMap(g => g.items).map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} title={item.label}
                    className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors ${
                      isActive ? "bg-white/10 text-white" : "text-neutral-500 hover:text-white hover:bg-white/5"
                    }`}>
                    <item.icon className="w-4 h-4" />
                  </Link>
                );
              })}
            </nav>
          )}

          {sidebarExpanded && (
            <div className="px-4 py-2 border-t border-white/5">
              <UsageBar userId={user?.id} plan="node" />
            </div>
          )}

          {/* User Footer + Toggle */}
          <div className={`border-t border-white/5 bg-[#0A0A0A] ${sidebarExpanded ? "p-5 flex items-center justify-between" : "p-3 flex flex-col items-center gap-3"}`}>
            <div className="flex items-center gap-3">
               <UserButton appearance={{ elements: { userButtonAvatarBox: "w-8 h-8 rounded-lg outline outline-1 outline-white/10" } }} />
               {sidebarExpanded && (
                 <div className="flex flex-col">
                   <span className="text-xs font-medium text-white">{user?.fullName || "Commander"}</span>
                   <span className="text-[10px] text-neutral-500 font-mono tracking-wider flex items-center gap-1.5 mt-0.5">
                     {isConnected ? (
                       <><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> {ping}ms</>
                     ) : (
                       <><span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> OFF</>
                     )}
                   </span>
                 </div>
               )}
            </div>
            <button onClick={() => setSidebarExpanded(!sidebarExpanded)} title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors">
              {sidebarExpanded ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        {/* === MAIN CONTENT === */}
        <main className="flex-1 overflow-y-auto bg-[#000000] relative z-10 custom-scrollbar">
          <div className="relative z-10 w-full min-h-full max-w-[1600px] mx-auto">
            {!isHome && <SystemPulseStrip />}
            {!isHome && <SmartContextBar />}
            <ErrorBoundary>
              <ToastProvider>
                <CinematicOnboarding>
                  <motion.div
                    key={pathname}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
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
        <nav className={`${isHome ? "hidden" : "lg:hidden"} fixed bottom-6 left-6 right-6 z-50 bg-[#0A0A0A] border border-white/10 rounded-2xl flex items-center justify-around p-3 shadow-2xl`}>
           <Link href="/dashboard" className={`flex flex-col items-center gap-1.5 ${pathname === '/dashboard' ? 'text-white' : 'text-neutral-500'}`}>
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[9px] font-medium tracking-wide">Home</span>
           </Link>
           <Link href="/dashboard/nemo-claw" className="flex items-center justify-center w-12 h-12 -mt-8 rounded-full bg-white text-black shadow-lg">
              <Network className="w-5 h-5" />
           </Link>
           <button onClick={() => setMobileMenuOpen(true)} className="flex flex-col items-center gap-1.5 text-neutral-500">
              <Menu className="w-5 h-5" />
              <span className="text-[9px] font-medium tracking-wide">Menu</span>
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
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <span className="text-sm font-semibold tracking-wide text-white">Sovereign Matrix</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-neutral-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderNavContent(true)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TelemetryProvider>
  );
}
