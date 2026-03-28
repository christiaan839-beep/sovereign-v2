"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Command, ArrowRight, Zap, Target, Shield, LayoutDashboard, Settings,
  Rocket, Palette, Factory, Cpu, Mic, ScanFace, Video, Swords, ShieldAlert,
  Database, Headphones, FileVideo, Cuboid, Briefcase, Ghost, RefreshCcw,
  BarChart3, CircuitBoard, Globe2, Users, DollarSign, Layers, Network,
  Play, Sparkles, Brain, Mail, Clock, Plug, Eye, Wrench, LayoutTemplate,
  Terminal, Hash, Image, PenTool, Bot, Boxes, MonitorSmartphone, Webhook,
  Key, Wand2,
} from "lucide-react";

/* ═══════════ Types ═══════════ */

type ActionCategory =
  | "Recent"
  | "Agent Shortcut"
  | "Quick Actions"
  | "Tools"
  | "Intelligence"
  | "Advanced"
  | "Settings"
  | "Workflow";

type Action = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: () => Promise<unknown>;
  category: ActionCategory;
  shortcut?: string;
  description?: string;
  keywords?: string[];        // extra search tokens for fuzzy match
};

/* ═══════════ Fuzzy Search ═══════════ */

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  // Exact substring
  if (lower.includes(q)) return true;
  // Sequential character match (fuzzy)
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function matchesAction(action: Action, query: string): boolean {
  if (!query) return true;
  if (fuzzyMatch(action.title, query)) return true;
  if (action.description && fuzzyMatch(action.description, query)) return true;
  if (action.keywords?.some((k) => fuzzyMatch(k, query))) return true;
  if (fuzzyMatch(action.category, query)) return true;
  return false;
}

/* ═══════════ Recent Actions (localStorage) ═══════════ */

const RECENTS_KEY = "sovereign_cmd_recents";
const MAX_RECENTS = 3;

function getRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  const prev = getRecents().filter((r) => r !== id);
  const next = [id, ...prev].slice(0, MAX_RECENTS);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

/* ═══════════ Component ═══════════ */

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [executing, setExecuting] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  /* ═══════════ ALL NAVIGATION PAGES (grouped by category) ═══════════ */

  const ACTIONS: Action[] = [
    // ─── QUICK ACTIONS (Home, Build, Leads, Content, Canvas) ───
    { id: "n-home", title: "Dashboard Home", icon: LayoutDashboard, href: "/dashboard", category: "Quick Actions", shortcut: "D", keywords: ["home", "overview", "main"] },
    { id: "n-build", title: "Build", icon: Sparkles, href: "/dashboard/build", category: "Quick Actions", keywords: ["create", "new"] },
    { id: "n-leads", title: "Lead Prospector", icon: Target, href: "/dashboard/leads", category: "Quick Actions", keywords: ["prospect", "b2b", "pipeline"] },
    { id: "n-content", title: "Content Factory", icon: Factory, href: "/dashboard/content-factory", category: "Quick Actions", keywords: ["blog", "social", "copy", "write"] },
    { id: "n-canvas", title: "Canvas", icon: Layers, href: "/dashboard/canvas", category: "Quick Actions", keywords: ["draw", "design", "whiteboard"] },
    { id: "n-templates", title: "Templates", icon: LayoutTemplate, href: "/dashboard/templates", category: "Quick Actions", keywords: ["starter", "blueprint", "preset"] },

    // ─── TOOLS ───
    { id: "n-seo", title: "SEO X-Ray Dominator", icon: Search, href: "/dashboard/seo-dominator", category: "Tools", keywords: ["seo", "ranking", "keywords", "google"] },
    { id: "n-competitor", title: "Competitor Intel", icon: Shield, href: "/dashboard/competitor", category: "Tools", keywords: ["spy", "analysis", "rival"] },
    { id: "n-voice", title: "Voice Assistant", icon: Mic, href: "/dashboard/voice-assistant", category: "Tools", keywords: ["call", "phone", "speak", "voice agent"] },
    { id: "n-code", title: "Code Studio", icon: Palette, href: "/dashboard/visual-studio", category: "Tools", keywords: ["ide", "code", "developer", "visual"] },
    { id: "n-workflows", title: "Workflows", icon: CircuitBoard, href: "/dashboard/workflows", category: "Tools", keywords: ["automation", "pipeline", "flow"] },
    { id: "n-automations", title: "Automations", icon: Clock, href: "/dashboard/automations", category: "Tools", keywords: ["schedule", "cron", "trigger", "automate"] },
    { id: "n-pagebuilder", title: "Page Builder", icon: Globe2, href: "/dashboard/page-builder", category: "Tools", keywords: ["landing", "website", "funnel"] },
    { id: "n-designer", title: "Design Studio", icon: PenTool, href: "/dashboard/designer", category: "Tools", keywords: ["graphic", "creative", "design"] },
    { id: "n-podcast", title: "PDF-to-Podcast", icon: Headphones, href: "/dashboard/podcast", category: "Tools", keywords: ["audio", "podcast", "pdf", "convert"] },
    { id: "n-omnisearch", title: "RAG Omni-Search", icon: Database, href: "/dashboard/omni-search", category: "Tools", keywords: ["rag", "search", "knowledge", "retrieval"] },
    { id: "n-library", title: "My Library", icon: Layers, href: "/dashboard/library", category: "Tools", keywords: ["files", "assets", "documents", "storage"] },
    { id: "n-marketplace", title: "Marketplace", icon: Globe2, href: "/dashboard/marketplace", category: "Tools", keywords: ["plugins", "apps", "extensions"] },
    { id: "n-terminal", title: "Live Terminal", icon: Terminal, href: "/dashboard/live-terminal", category: "Tools", keywords: ["console", "shell", "cli", "terminal"] },
    { id: "n-agentbuilder", title: "Agent Builder", icon: Wand2, href: "/dashboard/agent-builder", category: "Tools", keywords: ["agent", "skill", "builder", "custom", "prompt"] },

    // ─── INTELLIGENCE ───
    { id: "n-agenthq", title: "Agent HQ", icon: Users, href: "/dashboard/agent-hq", category: "Intelligence", keywords: ["agents", "hub", "central"] },
    { id: "n-analytics", title: "Agent Analytics", icon: BarChart3, href: "/dashboard/agent-analytics", category: "Intelligence", keywords: ["metrics", "stats", "performance"] },
    { id: "n-warroom", title: "War Room", icon: Swords, href: "/dashboard/war-room", category: "Intelligence", keywords: ["debate", "multi-agent", "arena", "strategy"] },
    { id: "n-godeye", title: "God Eye Surveillance", icon: Eye, href: "/dashboard/god-eye", category: "Intelligence", keywords: ["monitor", "watch", "surveillance", "tracking"] },
    { id: "n-nim", title: "NIM Arsenal", icon: Cpu, href: "/dashboard/nim-arsenal", category: "Intelligence", keywords: ["nvidia", "models", "nim", "gpu"] },
    { id: "n-leaderboard", title: "AI Leaderboard", icon: Rocket, href: "/dashboard/leaderboard", category: "Intelligence", keywords: ["ranking", "benchmark", "models", "compare"] },
    { id: "n-capability", title: "Capability Matrix", icon: Layers, href: "/dashboard/capability-matrix", category: "Intelligence", keywords: ["skills", "features", "matrix", "abilities"] },
    { id: "n-agentcmd", title: "Agent Command", icon: Zap, href: "/dashboard/agent-command", category: "Intelligence", keywords: ["command", "control", "direct"] },
    { id: "n-agentworld", title: "Agent World", icon: Globe2, href: "/dashboard/agent-world", category: "Intelligence", keywords: ["world", "map", "global"] },
    { id: "n-roianalytics", title: "ROI Analytics", icon: BarChart3, href: "/dashboard/analytics/roi", category: "Intelligence", keywords: ["roi", "return", "investment", "revenue"] },

    // ─── ADVANCED ───
    { id: "n-nemoclaw", title: "NemoClaw Sandbox", icon: Cpu, href: "/dashboard/nemo-claw", category: "Advanced", shortcut: "G", keywords: ["nemoclaw", "edge", "local", "sandbox"] },
    { id: "n-voiceswarm", title: "Voice Swarm", icon: Mic, href: "/dashboard/voice-swarm", category: "Advanced", keywords: ["swarm", "multi-voice", "parallel calls"] },
    { id: "n-ghost", title: "Ghost Protocol", icon: Ghost, href: "/dashboard/ghost-protocol", category: "Advanced", keywords: ["stealth", "anonymous", "ghost"] },
    { id: "n-deepfake", title: "Deepfake Prospector", icon: FileVideo, href: "/dashboard/deepfake-studio", category: "Advanced", keywords: ["deepfake", "video", "face"] },
    { id: "n-avatar", title: "Digital Human Avatar", icon: ScanFace, href: "/dashboard/avatar", category: "Advanced", keywords: ["avatar", "digital human", "face", "clone"] },
    { id: "n-holographic", title: "Holographic Agent", icon: CircuitBoard, href: "/dashboard/holographic-agent", category: "Advanced", keywords: ["hologram", "3d", "holographic"] },
    { id: "n-vsl", title: "VSL Hacker (Cosmos)", icon: Video, href: "/dashboard/vsl-hacker", category: "Advanced", keywords: ["vsl", "video sales letter", "cosmos"] },
    { id: "n-edify", title: "Edify 3D Forge", icon: Cuboid, href: "/dashboard/edify-forge", category: "Advanced", keywords: ["3d", "model", "forge", "edify"] },
    { id: "n-flywheel", title: "Anti-Slop Flywheel", icon: RefreshCcw, href: "/dashboard/flywheel", category: "Advanced", keywords: ["quality", "flywheel", "anti-slop"] },
    { id: "n-morpheus", title: "Morpheus Shield", icon: Shield, href: "/dashboard/morpheus-shield", category: "Advanced", keywords: ["morpheus", "defense", "shield", "security"] },
    { id: "n-cyberaudit", title: "Cyber Audit", icon: ShieldAlert, href: "/dashboard/cyber-audit", category: "Advanced", keywords: ["security", "vulnerability", "pentest"] },
    { id: "n-auditdestroy", title: "Audit & Destroy", icon: ShieldAlert, href: "/dashboard/audit-destroy", category: "Advanced", keywords: ["audit", "destroy", "teardown"] },
    { id: "n-omnipresence", title: "Omnipresence", icon: Globe2, href: "/dashboard/omnipresence", category: "Advanced", keywords: ["omnichannel", "presence", "everywhere"] },
    { id: "n-support", title: "Support Router", icon: Headphones, href: "/dashboard/support-router", category: "Advanced", keywords: ["support", "helpdesk", "tickets", "customer"] },
    { id: "n-agencyhub", title: "Agency Cartel Hub", icon: Briefcase, href: "/dashboard/agency-hub", category: "Advanced", keywords: ["agency", "clients", "cartel", "white label"] },
    { id: "n-clientportal", title: "Client Portal", icon: MonitorSmartphone, href: "/dashboard/client-portal", category: "Advanced", keywords: ["client", "portal", "dashboard"] },
    { id: "n-arsenal", title: "Arsenal", icon: Boxes, href: "/dashboard/arsenal", category: "Advanced", keywords: ["tools", "weapons", "arsenal"] },

    // ─── SETTINGS ───
    { id: "n-integrations", title: "Integrations", icon: Plug, href: "/dashboard/integrations", category: "Settings", keywords: ["connect", "api", "zapier", "webhook"] },
    { id: "n-billing", title: "Billing & Plans", icon: DollarSign, href: "/dashboard/billing", category: "Settings", keywords: ["payment", "subscription", "plan", "pricing"] },
    { id: "n-settings", title: "Settings", icon: Settings, href: "/dashboard/settings", category: "Settings", shortcut: "S", keywords: ["preferences", "config", "account"] },

    // ═══════════ AGENT SHORTCUTS (type "/" to discover) ═══════════
    { id: "cmd-audit", title: "/audit [url]", icon: Search, category: "Agent Shortcut",
      description: "Run a full website audit (SEO, performance, security)",
      keywords: ["audit", "website", "scan", "seo"],
      action: async () => {
        const url = prompt("Enter the URL to audit:");
        if (!url) return "Cancelled";
        const res = await fetch("/api/agents/smart-router", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: `Perform a full audit of ${url}`, task_type: "audit" }),
        });
        const data = await res.json();
        return data.output?.slice(0, 300) || "Audit complete";
      },
    },
    { id: "cmd-leads", title: "/leads [industry]", icon: Target, category: "Agent Shortcut",
      description: "Find and qualify B2B leads in any industry",
      keywords: ["leads", "prospect", "find", "b2b"],
      action: async () => {
        const industry = prompt("What industry to prospect?");
        if (!industry) return "Cancelled";
        const res = await fetch("/api/agents/smart-router", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: `Find B2B leads in ${industry}`, task_type: "leads" }),
        });
        const data = await res.json();
        return data.output?.slice(0, 300) || "Leads generated";
      },
    },
    { id: "cmd-write", title: "/write [topic]", icon: PenTool, category: "Agent Shortcut",
      description: "Generate content (blog, social, email) on any topic",
      keywords: ["write", "content", "blog", "generate"],
      action: async () => {
        const topic = prompt("What should I write about?");
        if (!topic) return "Cancelled";
        const res = await fetch("/api/agents/smart-router", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: `Write content about: ${topic}`, task_type: "content" }),
        });
        const data = await res.json();
        return data.output?.slice(0, 300) || "Content generated";
      },
    },
    { id: "cmd-image", title: "/image [desc]", icon: Image, category: "Agent Shortcut",
      description: "Generate an AI image from a text description",
      keywords: ["image", "picture", "generate", "ai art", "flux"],
      action: async () => {
        const desc = prompt("Describe the image to generate:");
        if (!desc) return "Cancelled";
        const res = await fetch("/api/agents/image-gen", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: desc }),
        });
        const data = await res.json();
        return data.url ? `Image ready: ${data.url}` : "Image generation started";
      },
    },
    { id: "cmd-search", title: "/search [query]", icon: Database, category: "Agent Shortcut",
      description: "Deep AI-powered search across all your data",
      keywords: ["search", "find", "query", "rag"],
      action: async () => {
        const q = prompt("What do you want to search for?");
        if (!q) return "Cancelled";
        const res = await fetch("/api/agents/smart-router", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: q, task_type: "search" }),
        });
        const data = await res.json();
        return data.output?.slice(0, 300) || "Search complete";
      },
    },

    // ═══════════ ONE-CLICK WORKFLOWS ═══════════
    { id: "wf-1", title: "Full Competitor Teardown", icon: Swords, category: "Workflow",
      description: "Audit site -> Generate report -> Send via email",
      keywords: ["competitor", "teardown", "audit"],
      action: async () => {
        const res = await fetch("/api/agents/workflows", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflow: "competitor-teardown", target: "competitor.com" }),
        });
        return (await res.json()).summary || "Workflow complete";
      }
    },
    { id: "wf-2", title: "Lead-to-Close Pipeline", icon: Target, category: "Workflow",
      description: "Scrape lead -> Enrich -> Draft email -> Queue call",
      keywords: ["lead", "pipeline", "close"],
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
      keywords: ["content", "blitz", "posts", "social"],
      action: async () => {
        const res = await fetch("/api/agents/workflows", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflow: "content-blitz", count: 5 }),
        });
        return (await res.json()).summary || "Content generated";
      }
    },
    { id: "wf-4", title: "God-Brain Deep Analysis", icon: Brain, category: "Workflow",
      description: "Safety -> Analysis -> Embedding -> Voice -> Image",
      keywords: ["god", "brain", "analysis", "deep"],
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
      keywords: ["overnight", "batch", "queue", "nemoclaw"],
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

    // ═══════════ QUICK INLINE ACTIONS ═══════════
    { id: "qa-1", title: "Check System Health", icon: Zap, category: "Workflow", shortcut: "H",
      description: "Ping all services and report status",
      keywords: ["health", "status", "ping"],
      action: async () => {
        const res = await fetch("/api/health");
        const data = await res.json();
        return `Status: ${data.status} | Services: ${Object.keys(data.services || {}).length} active`;
      }
    },
    { id: "qa-2", title: "Send Test Email", icon: Mail, category: "Workflow",
      description: "Fire a test email to verify delivery",
      keywords: ["email", "test", "send"],
      action: async () => {
        const res = await fetch("/api/email", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: "test@example.com", template: "welcome", data: { name: "Commander" } }),
        });
        return (await res.json()).provider === "resend" ? "Email sent!" : "Email logged (set RESEND_API_KEY for delivery)";
      }
    },
    { id: "qa-3", title: "Run AI Benchmark", icon: BarChart3, category: "Workflow",
      description: "Test all connected models head-to-head",
      keywords: ["benchmark", "test", "models", "speed"],
      action: async () => {
        const res = await fetch("/api/agents/benchmark", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "Explain quantum computing in 50 words." }),
        });
        const data = await res.json();
        return `Winner: ${data.winners?.fastest || "N/A"} | ${data.benchmarks?.length || 0} models tested`;
      }
    },
    { id: "qa-4", title: "Quick Content Generate", icon: Sparkles, category: "Workflow",
      description: "Generate content with a single prompt",
      keywords: ["content", "generate", "quick", "write"],
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
  ];

  // Build recents dynamically
  const recentIds = getRecents();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setIsOpen(o => !o); }
      if (e.key === "Escape") { setIsOpen(false); setResult(null); }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset selection when query changes
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Determine if user typed "/" — show agent shortcuts first
  const isSlashMode = query.startsWith("/");
  const searchQuery = isSlashMode ? query.slice(1) : query;

  const filteredActions = ACTIONS.filter((a) => {
    if (isSlashMode) {
      // In slash mode, only show Agent Shortcuts (and filter by rest of query)
      if (a.category !== "Agent Shortcut") return false;
      return !searchQuery || matchesAction(a, searchQuery);
    }
    return matchesAction(a, searchQuery);
  });

  // Build recent items (only when no query)
  const recentActions: Action[] = (!query && recentIds.length > 0)
    ? recentIds
        .map((id) => ACTIONS.find((a) => a.id === id))
        .filter((a): a is Action => !!a)
        .map((a) => ({ ...a, category: "Recent" as ActionCategory }))
    : [];

  // Category ordering
  const CATEGORY_ORDER: ActionCategory[] = [
    "Recent", "Agent Shortcut", "Quick Actions", "Tools", "Intelligence", "Advanced", "Settings", "Workflow",
  ];

  const allItems = [...recentActions, ...filteredActions];
  const grouped = CATEGORY_ORDER
    .map((cat) => ({ category: cat, items: allItems.filter((a) => a.category === cat) }))
    .filter((g) => g.items.length > 0);

  const flatItems = grouped.flatMap((g) => g.items);

  const handleSelect = useCallback(async (action: Action) => {
    // Track recent (use original ID, strip "Recent" wrapper)
    const originalId = ACTIONS.find((a) => a.title === action.title && a.href === action.href)?.id || action.id;
    pushRecent(originalId);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) handleSelect(item);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, flatItems, selectedIndex, handleSelect]);

  // Scroll selected item into view
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const categoryColors: Record<string, string> = {
    Recent: "text-violet-400",
    "Agent Shortcut": "text-[#00ff66]",
    "Quick Actions": "text-[#00B7FF]",
    Tools: "text-amber-400",
    Intelligence: "text-cyan-400",
    Advanced: "text-rose-400",
    Settings: "text-neutral-400",
    Workflow: "text-emerald-400",
  };

  const categoryBg: Record<string, string> = {
    Recent: "bg-violet-500/10 border-violet-500/20",
    "Agent Shortcut": "bg-[#00ff66]/10 border-[#00ff66]/20",
    "Quick Actions": "bg-[#00B7FF]/5 border-[#00B7FF]/10",
    Tools: "bg-amber-500/10 border-amber-500/20",
    Intelligence: "bg-cyan-500/10 border-cyan-500/20",
    Advanced: "bg-rose-500/10 border-rose-500/20",
    Settings: "bg-white/5 border-white/10",
    Workflow: "bg-emerald-500/10 border-emerald-500/20",
  };

  const categoryLabels: Record<string, string> = {
    Recent: "Recent",
    "Agent Shortcut": "Agent Commands (type / )",
    "Quick Actions": "Quick Actions",
    Tools: "Tools",
    Intelligence: "Intelligence",
    Advanced: "Advanced",
    Settings: "Settings",
    Workflow: "Workflows & Actions",
  };

  let globalIdx = 0;

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
                  placeholder={`Search pages, type / for commands...`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10">
                  <span className="text-xs text-neutral-400 font-mono">esc</span>
                </div>
              </div>

              {/* Slash-mode hint */}
              {isSlashMode && (
                <div className="px-5 py-2 border-b border-[#00ff66]/10 bg-[#00ff66]/5">
                  <p className="text-[10px] font-mono text-[#00ff66]">AGENT MODE -- type a command name to filter</p>
                </div>
              )}

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
              <div ref={scrollRef} className="max-h-[55vh] overflow-y-auto p-2 custom-scrollbar">
                {grouped.map(({ category, items }) => {
                  const section = (
                    <div key={category} className="mb-2">
                      <div className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] ${categoryColors[category] || "text-neutral-500"}`}>
                        {categoryLabels[category] || category}
                      </div>
                      {items.map((action) => {
                        const idx = globalIdx++;
                        const isSelected = idx === selectedIndex;
                        return (
                          <button
                            key={`${category}-${action.id}`}
                            data-index={idx}
                            onClick={() => handleSelect(action)}
                            disabled={executing === action.id}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors group text-left disabled:opacity-50 ${
                              isSelected ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg border ${categoryBg[action.category] || "bg-black border-white/5"} ${isSelected ? "border-[#00B7FF]/30" : "group-hover:border-[#00B7FF]/30"} transition-colors`}>
                                <action.icon className={`w-4 h-4 ${categoryColors[action.category] || "text-neutral-400"}`} />
                              </div>
                              <div className="flex flex-col">
                                <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-neutral-200 group-hover:text-white"}`}>{action.title}</span>
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
                                <ArrowRight className="w-4 h-4 text-neutral-600 opacity-0 group-hover:opacity-100 group-hover:text-[#00B7FF] transition-gpu" />
                              ) : (
                                <Play className="w-3.5 h-3.5 text-neutral-600 opacity-0 group-hover:opacity-100 group-hover:text-emerald-400 transition-gpu" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                  return section;
                })}
                {flatItems.length === 0 && (
                  <div className="p-8 text-center text-neutral-500 font-mono text-sm">No matching directives.</div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-black/50 border-t border-white/5 px-4 py-3 flex items-center justify-between text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
                <span className="flex items-center gap-2"><Command className="w-3 h-3" /> {ACTIONS.length} commands available</span>
                <span className="flex items-center gap-3">
                  <span>Navigate ↑↓</span>
                  <span>Execute ↵</span>
                  <span className="text-[#00ff66]">/ agents</span>
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
