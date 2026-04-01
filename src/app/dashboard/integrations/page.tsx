"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Loader2,
  Zap,
  BarChart3,
  MessageCircle,
  Mail,
  CreditCard,
  Code2,
  Share2,
  LayoutGrid,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

// ─── Types (mirrors src/lib/integrations.ts) ───────────────────

interface IntegrationAction {
  id: string;
  label: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

interface IntegrationConnector {
  id: string;
  name: string;
  description: string;
  category: string;
  authType: "oauth2" | "api_key" | "webhook";
  baseUrl: string;
  actions: IntegrationAction[];
  status: "available" | "coming_soon";
  brandColor: string;
}

// ─── Category Metadata ─────────────────────────────────────────

const CATEGORY_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }> = {
  CRM:           { icon: BarChart3,     color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
  Email:         { icon: Mail,          color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/20" },
  Communication: { icon: MessageCircle, color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/20" },
  Productivity:  { icon: LayoutGrid,    color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20" },
  Analytics:     { icon: BarChart3,     color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20" },
  "E-commerce":  { icon: CreditCard,    color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20" },
  Social:        { icon: Share2,        color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/20" },
  Developer:     { icon: Code2,         color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  Support:       { icon: MessageCircle, color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/20" },
  Scheduling:    { icon: Zap,           color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/20" },
  Database:      { icon: Code2,         color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
  Payments:      { icon: CreditCard,    color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20" },
};

const ALL_CATEGORIES = ["All", "CRM", "Email", "Communication", "Productivity", "Analytics", "E-commerce", "Social", "Developer", "Support", "Scheduling", "Database", "Payments"];

// ─── Page Component ────────────────────────────────────────────

export default function IntegrationsPage() {
  const toast = useToast();
  const [integrations, setIntegrations] = useState<IntegrationConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/integrations/registry");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setIntegrations(data.integrations ?? []);
      } catch {
        toast.error("Could not load integrations. Try refreshing.");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = integrations.filter((c) => {
    const matchesCategory = activeCategory === "All" || c.category === activeCategory;
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const available = filtered.filter((c) => c.status === "available");
  const comingSoon = filtered.filter((c) => c.status === "coming_soon");

  const handleConnect = (connector: IntegrationConnector) => {
    if (connector.status === "available") {
      toast.success(`${connector.name} is already connected and active.`);
      return;
    }
    toast.info(
      `Contact support to enable ${connector.name} integration for your workspace.`
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white" role="main" aria-label="Platform integrations">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-400 text-xs font-bold uppercase tracking-wider mb-3">
          <ExternalLink className="w-3 h-3 text-emerald-400" /> Platform Connections
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Integrations
        </h1>
        <p className="text-base text-neutral-400 max-w-2xl leading-relaxed">
          Connect your tools. Agents use real data. {integrations.length} connectors across {Object.keys(CATEGORY_META).length} categories.
        </p>
      </div>

      {/* Search + Category Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search integrations..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-neutral-500 shrink-0" />
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? "bg-white/10 text-white border border-white/20"
                  : "bg-white/[0.03] text-neutral-500 border border-transparent hover:text-neutral-300 hover:bg-white/5"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* Available / Active */}
          {available.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-5">
                <Zap className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                  Active ({available.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnimatePresence>
                  {available.map((connector, i) => (
                    <ConnectorCard
                      key={connector.id}
                      connector={connector}
                      index={i}
                      expanded={expandedId === connector.id}
                      onToggle={() => setExpandedId(expandedId === connector.id ? null : connector.id)}
                      onConnect={handleConnect}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Coming Soon */}
          {comingSoon.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-5">
                <Clock className="w-4 h-4 text-neutral-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                  Coming Soon ({comingSoon.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnimatePresence>
                  {comingSoon.map((connector, i) => (
                    <ConnectorCard
                      key={connector.id}
                      connector={connector}
                      index={i}
                      expanded={expandedId === connector.id}
                      onToggle={() => setExpandedId(expandedId === connector.id ? null : connector.id)}
                      onConnect={handleConnect}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Empty State */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-neutral-500">
              <Search className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm">No integrations match your filters.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Connector Card ────────────────────────────────────────────

function ConnectorCard({
  connector,
  index,
  expanded,
  onToggle,
  onConnect,
}: {
  connector: IntegrationConnector;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onConnect: (c: IntegrationConnector) => void;
}) {
  const meta = CATEGORY_META[connector.category] ?? CATEGORY_META.Developer;
  const Icon = meta.icon;
  const isAvailable = connector.status === "available";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: "easeOut" }}
      className={`relative p-6 rounded-2xl bg-black/40 border overflow-hidden group transition-colors cursor-pointer ${
        isAvailable
          ? "border-emerald-500/20 hover:border-emerald-500/30"
          : "border-white/[0.06] hover:border-white/10"
      }`}
      onClick={onToggle}
    >
      {/* Icon + Status Row */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${meta.bg} ${meta.border} border`}
        >
          <Icon className={`w-6 h-6 ${meta.color}`} />
        </div>
        <div className="flex items-center gap-2">
          {isAvailable ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-400">Active</span>
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 text-neutral-500" />
              <span className="text-xs font-medium text-neutral-500">Coming Soon</span>
            </>
          )}
        </div>
      </div>

      {/* Name + Description */}
      <h3 className="text-base font-semibold text-white mb-1">{connector.name}</h3>
      <p className="text-sm text-neutral-500 mb-3 leading-relaxed">{connector.description}</p>

      {/* Category + Auth Badge */}
      <div className="flex items-center gap-2 mb-5">
        <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border border-white/[0.06]">
          {connector.category}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 border border-white/[0.06]">
          {connector.authType.replace("_", " ")}
        </span>
      </div>

      {/* Expanded Actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden mb-4"
          >
            <div className="pt-3 border-t border-white/[0.06]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
                {connector.actions.length} Actions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {connector.actions.map((action) => (
                  <span
                    key={action.id}
                    className="px-2 py-1 rounded-md bg-white/[0.04] text-[11px] text-neutral-400 border border-white/[0.06]"
                    title={action.description}
                  >
                    <span className="text-neutral-500 mr-1 font-mono text-[9px]">{action.method}</span>
                    {action.label}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onConnect(connector);
        }}
        className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
          isAvailable
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
            : "bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10 hover:text-neutral-200"
        }`}
      >
        {isAvailable ? "Active" : "Notify Me"}
      </button>

      {/* Hover glow */}
      <div
        className="absolute -bottom-10 -right-10 w-32 h-32 blur-[50px] opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none"
        style={{ backgroundColor: connector.brandColor }}
      />
    </motion.div>
  );
}
