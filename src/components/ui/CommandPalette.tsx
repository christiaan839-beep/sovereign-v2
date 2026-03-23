"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Command, ArrowRight, Zap, Target, Shield, LayoutDashboard, Settings,
  Rocket, Palette, Factory, Cpu, Mic, ScanFace, Video, Swords, ShieldAlert,
  Database, Headphones, FileVideo, Cuboid, Briefcase, Ghost, RefreshCcw,
  BarChart3, CircuitBoard, Globe2, Users, DollarSign, Layers, Network,
  Play, Sparkles, Brain, Mail, Clock,
} from "lucide-react";

type Action = {
  id: string;
  title: string;
  icon: React.ElementType;
  href?: string;
  action?: () => Promise<void>;
  category: "Navigation" | "AI Agent" | "Workflow" | "Quick Action";
  shortcut?: string;
  description?: string;
};

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [executing, setExecuting] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  // All 40 dashboard pages + workflows + quick actions
  const ACTIONS: Action[] = [
    // ═══════════ ONE-CLICK WORKFLOWS (GAME-CHANGERS) ═══════════
    { id: "wf-1", title: "Full Competitor Teardown", icon: Swords, category: "Workflow",
      description: "Audit site → Generate report → Send via email",
      action: async () => {
        const res = await fetch("/api/agents/workflows", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflow: "competitor-teardown", target: "competitor.com" }),
        });
        return (await res.json()).summary || "Workflow complete";
      }
    },
    { id: "wf-2", title: "Lead-to-Close Pipeline", icon: Target, category: "Workflow",
      description: "Scrape lead → Enrich → Draft email → Queue call",
      action: async () => {
        const res = await fetch("/api/agents/workflows", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflow: "lead-to-close" }),
        });
        return (await res.json()).summary || "Pipeline ready";
      }
    },
    { id: "wf-3", title: "Content Blitz (5 posts in 60s)", icon: Factory, category: "Workflow",
      description: "Generate 5 platform-specific posts instantly",
      action: async () => {
        const res = await fetch("/api/agents/workflows", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflow: "content-blitz", count: 5 }),
        });
        return (await res.json()).summary || "Content generated";
      }
    },
    { id: "wf-4", title: "God-Brain Deep Analysis", icon: Brain, category: "Workflow",
      description: "Safety → Analysis → Embedding → Voice → Image",
      action: async () => {
        const topic = prompt("What should the God-Brain analyze?");
        if (!topic) return;
        const res = await fetch("/api/agents/god-brain", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: topic, depth: "deep" }),
        });
        return JSON.stringify((await res.json()).meta, null, 2);
      }
    },
    { id: "wf-5", title: "Overnight Batch (NemoClaw)", icon: Clock, category: "Workflow",
      description: "Queue 10 competitor audits for overnight processing",
      action: async () => {
        const res = await fetch("/api/agents/claw-queue", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "batch", tasks: Array.from({length: 10}, (_, i) => ({
            type: "competitor-audit", payload: { url: `https://competitor-${i+1}.com` }
          })) }),
        });
        return (await res.json()).queued + " tasks queued for overnight processing";
      }
    },

    // ═══════════ QUICK ACTIONS ═══════════
    { id: "qa-1", title: "Check System Health", icon: Zap, category: "Quick Action", shortcut: "H",
      action: async () => {
        const res = await fetch("/api/health");
        const data = await res.json();
        return `Status: ${data.status} | Services: ${Object.keys(data.services || {}).length} active`;
      }
    },
    { id: "qa-2", title: "Send Test Email", icon: Mail, category: "Quick Action",
      action: async () => {
        const res = await fetch("/api/email", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: "test@example.com", template: "welcome", data: { name: "Commander" } }),
        });
        return (await res.json()).provider === "resend" ? "Email sent!" : "Email logged (set RESEND_API_KEY for delivery)";
      }
    },
    { id: "qa-3", title: "Run AI Benchmark", icon: BarChart3, category: "Quick Action",
      action: async () => {
        const res = await fetch("/api/agents/benchmark", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "Explain quantum computing in 50 words." }),
        });
        const data = await res.json();
        return `Winner: ${data.winners?.fastest || "N/A"} | ${data.benchmarks?.length || 0} models tested`;
      }
    },
    { id: "qa-4", title: "Quick Content Generate", icon: Sparkles, category: "Quick Action",
      action: async () => {
        const topic = prompt("What content to generate?");
        if (!topic) return;
        const res = await fetch("/api/agents/smart-router", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: topic, task_type: "content" }),
        });
        const data = await res.json();
        return data.output?.slice(0, 200) + "..." || "Generated";
      }
    },

    // ═══════════ ALL 40 NAVIGATION PAGES ═══════════
    { id: "n-01", title: "Dashboard Overview", icon: LayoutDashboard, href: "/dashboard", category: "Navigation", shortcut: "D" },
    { id: "n-02", title: "Agent Command", icon: Zap, href: "/dashboard/agent-command", category: "Navigation" },
    { id: "n-03", title: "War Room", icon: Swords, href: "/dashboard/war-room", category: "Navigation" },
    { id: "n-04", title: "Lead Prospector", icon: Users, href: "/dashboard/leads", category: "Navigation" },
    { id: "n-05", title: "Agent Analytics", icon: BarChart3, href: "/dashboard/agent-analytics", category: "Navigation" },
    { id: "n-06", title: "Live Terminal", icon: CircuitBoard, href: "/dashboard/live-terminal", category: "Navigation" },
    { id: "n-07", title: "SEO X-Ray Dominator", icon: Search, href: "/dashboard/seo-dominator", category: "Navigation" },
    { id: "n-08", title: "Content Factory", icon: Factory, href: "/dashboard/content-factory", category: "Navigation" },
    { id: "n-09", title: "Competitor Intel", icon: Shield, href: "/dashboard/competitor", category: "Navigation" },
    { id: "n-10", title: "Edge Terminal (NemoClaw)", icon: Cpu, href: "/dashboard/nemo-claw", category: "Navigation", shortcut: "G" },
    { id: "n-11", title: "Voice Swarm", icon: Mic, href: "/dashboard/voice-swarm", category: "Navigation" },
    { id: "n-12", title: "PDF-to-Podcast", icon: Headphones, href: "/dashboard/podcast", category: "Navigation" },
    { id: "n-13", title: "RAG Omni-Search", icon: Database, href: "/dashboard/omni-search", category: "Navigation" },
    { id: "n-14", title: "Cyber Audit", icon: ShieldAlert, href: "/dashboard/cyber-audit", category: "Navigation" },
    { id: "n-15", title: "Ghost Protocol", icon: Ghost, href: "/dashboard/ghost-protocol", category: "Navigation" },
    { id: "n-16", title: "Anti-Slop Flywheel", icon: RefreshCcw, href: "/dashboard/flywheel", category: "Navigation" },
    { id: "n-17", title: "Design Studio", icon: Palette, href: "/dashboard/designer", category: "Navigation" },
    { id: "n-18", title: "Visual Studio", icon: Video, href: "/dashboard/visual-studio", category: "Navigation" },
    { id: "n-19", title: "Page Builder", icon: Globe2, href: "/dashboard/page-builder", category: "Navigation" },
    { id: "n-20", title: "Digital Human Avatar", icon: ScanFace, href: "/dashboard/avatar", category: "Navigation" },
    { id: "n-21", title: "Deepfake Prospector", icon: FileVideo, href: "/dashboard/deepfake-studio", category: "Navigation" },
    { id: "n-22", title: "VSL Hacker (Cosmos)", icon: Video, href: "/dashboard/vsl-hacker", category: "Navigation" },
    { id: "n-23", title: "Edify 3D Forge", icon: Cuboid, href: "/dashboard/edify-forge", category: "Navigation" },
    { id: "n-24", title: "Holographic Agent", icon: CircuitBoard, href: "/dashboard/holographic-agent", category: "Navigation" },
    { id: "n-25", title: "Marketplace", icon: Globe2, href: "/dashboard/marketplace", category: "Navigation" },
    { id: "n-26", title: "Agency Cartel Hub", icon: Briefcase, href: "/dashboard/agency-hub", category: "Navigation" },
    { id: "n-27", title: "My Library", icon: Layers, href: "/dashboard/library", category: "Navigation" },
    { id: "n-28", title: "Billing & Plans", icon: DollarSign, href: "/dashboard/billing", category: "Navigation" },
    { id: "n-29", title: "Settings", icon: Settings, href: "/dashboard/settings", category: "Navigation", shortcut: "S" },
    { id: "n-30", title: "God Eye Surveillance", icon: Network, href: "/dashboard/god-eye", category: "Navigation" },
    { id: "n-31", title: "AI Leaderboard", icon: Rocket, href: "/dashboard/leaderboard", category: "Navigation" },
    { id: "n-32", title: "Omnipresence", icon: Globe2, href: "/dashboard/omnipresence", category: "Navigation" },
    { id: "n-33", title: "Audit & Destroy", icon: ShieldAlert, href: "/dashboard/audit-destroy", category: "Navigation" },
    { id: "n-34", title: "Morpheus Shield", icon: Shield, href: "/dashboard/morpheus-shield", category: "Navigation" },
    { id: "n-35", title: "Support Router", icon: Headphones, href: "/dashboard/support-router", category: "Navigation" },
    { id: "n-36", title: "NIM Arsenal", icon: Cpu, href: "/dashboard/nim-arsenal", category: "Navigation" },
    { id: "n-37", title: "Capability Matrix", icon: Layers, href: "/dashboard/capability-matrix", category: "Navigation" },
  ];

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setIsOpen(o => !o); }
      if (e.key === "Escape") { setIsOpen(false); setResult(null); }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const filteredActions = ACTIONS.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase()) ||
    (a.description || "").toLowerCase().includes(query.toLowerCase())
  );

  const grouped = {
    Workflow: filteredActions.filter(a => a.category === "Workflow"),
    "Quick Action": filteredActions.filter(a => a.category === "Quick Action"),
    Navigation: filteredActions.filter(a => a.category === "Navigation"),
  };

  const handleSelect = useCallback(async (action: Action) => {
    if (action.href) {
      setIsOpen(false);
      setQuery("");
      router.push(action.href);
      return;
    }
    if (action.action) {
      setExecuting(action.id);
      setResult(null);
      try {
        const output = await action.action();
        setResult(typeof output === "string" ? output : "Done");
      } catch (err: unknown) {
        const error = err as Error;
        setResult(`Error: ${error.message}`);
      } finally {
        setExecuting(null);
      }
    }
  }, [router]);

  const categoryColors: Record<string, string> = {
    Workflow: "text-emerald-400",
    "Quick Action": "text-amber-400",
    Navigation: "text-[#00B7FF]",
    "AI Agent": "text-[#00ff66]",
  };

  const categoryBg: Record<string, string> = {
    Workflow: "bg-emerald-500/10 border-emerald-500/20",
    "Quick Action": "bg-amber-500/10 border-amber-500/20",
    Navigation: "bg-[#00B7FF]/5 border-[#00B7FF]/10",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md"
            onClick={() => { setIsOpen(false); setResult(null); }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-[101]"
          >
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
              {/* Search */}
              <div className="flex items-center px-5 py-4 border-b border-white/5 gap-3">
                <Search className="w-5 h-5 text-[#00B7FF]" />
                <input
                  autoFocus
                  className="flex-1 bg-transparent border-none text-white text-lg placeholder:text-neutral-500 focus:outline-none"
                  placeholder="Search pages, run workflows, execute actions..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10">
                  <span className="text-xs text-neutral-400 font-mono">esc</span>
                </div>
              </div>

              {/* Result Banner */}
              {result && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  className="border-b border-emerald-500/20 bg-emerald-500/5 px-5 py-3"
                >
                  <p className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">{result}</p>
                </motion.div>
              )}

              {/* Actions */}
              <div className="max-h-[55vh] overflow-y-auto p-2 custom-scrollbar">
                {Object.entries(grouped).map(([category, items]) => {
                  if (items.length === 0) return null;
                  return (
                    <div key={category} className="mb-2">
                      <div className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] ${categoryColors[category] || "text-neutral-500"}`}>
                        {category} {category === "Workflow" && "⚡"} {category === "Quick Action" && "🎯"}
                      </div>
                      {items.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleSelect(action)}
                          disabled={executing === action.id}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/[0.04] transition-colors group text-left disabled:opacity-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg border ${categoryBg[action.category] || "bg-black border-white/5"} group-hover:border-[#00B7FF]/30 transition-colors`}>
                              <action.icon className={`w-4 h-4 ${categoryColors[action.category] || "text-neutral-400"}`} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-neutral-200 group-hover:text-white">{action.title}</span>
                              {action.description && (
                                <span className="text-[10px] text-neutral-600 font-mono">{action.description}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {executing === action.id && (
                              <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            )}
                            {action.shortcut && (
                              <span className="text-[10px] font-mono text-neutral-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">⌘{action.shortcut}</span>
                            )}
                            {action.href ? (
                              <ArrowRight className="w-4 h-4 text-neutral-600 opacity-0 group-hover:opacity-100 group-hover:text-[#00B7FF] transition-all" />
                            ) : (
                              <Play className="w-3.5 h-3.5 text-neutral-600 opacity-0 group-hover:opacity-100 group-hover:text-emerald-400 transition-all" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
                {filteredActions.length === 0 && (
                  <div className="p-8 text-center text-neutral-500 font-mono text-sm">No matching directives.</div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-black/50 border-t border-white/5 px-4 py-3 flex items-center justify-between text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
                <span className="flex items-center gap-2"><Command className="w-3 h-3" /> {ACTIONS.length} commands available</span>
                <span className="flex items-center gap-3">
                  <span>Navigate ↑↓</span>
                  <span>Execute ↵</span>
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
