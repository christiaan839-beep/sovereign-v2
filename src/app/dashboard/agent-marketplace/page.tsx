"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Store, Search, Star, Download, Crown, Rocket,
  Target, FileText, Globe2, Mic, Code2, Shield, Loader2, CheckCircle2,
} from "lucide-react";

const CATEGORIES = ["All", "Sales", "Content", "SEO", "Intelligence", "Voice", "Code"];

// No fabricated fallback agents. If the marketplace DB is empty, show an honest
// empty state — never hardcoded templates masquerading as real listings.

interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  authorName: string;
  installs: number;
  rating?: number;
  premium?: boolean;
}

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Sales: Target, Content: FileText, SEO: Search, Intelligence: Globe2, Voice: Mic, Code: Code2,
};

export default function AgentMarketplacePage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

  // Fetch agents from marketplace API
  const fetchAgents = useCallback(async () => {
    try {
      const categoryParam = activeCategory !== "All" ? `&category=${activeCategory.toLowerCase()}` : "";
      const res = await fetch(`/api/marketplace?limit=50${categoryParam}`);
      const data = await res.json();
      if (Array.isArray(data.agents) && data.agents.length > 0) {
        setAgents(data.agents.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          name: a.name as string,
          description: a.description as string,
          category: a.category as string,
          authorName: (a.authorName as string) || "Community",
          installs: (a.installs as number) || 0,
          // Only show a rating if the API actually returned one — never fabricate
          rating: typeof a.rating === "number" ? a.rating : undefined,
          premium: (a.premium as boolean) || false,
        })));
      } else {
        setAgents([]);
      }
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Install agent from marketplace
  const installAgent = async (agentId: string) => {
    if (agentId.startsWith("fb-")) return; // Fallback agents can't be installed
    setInstallingId(agentId);
    try {
      const res = await fetch(`/api/marketplace/${agentId}/install`, { method: "POST" });
      const data = await res.json();
      if (data.skill) {
        setInstalledIds((prev) => new Set([...prev, agentId]));
      }
    } catch {
      // Silent
    } finally {
      setInstallingId(null);
    }
  };

  const filtered = agents.filter((t) => {
    const matchCat = activeCategory === "All" || t.category === activeCategory;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-400 text-[10px] font-bold uppercase tracking-widest mb-3">
          <Store className="w-3 h-3" /> Agent Marketplace
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Agent Marketplace</h1>
        <p className="text-sm text-neutral-500 mt-1">Browse, install, and publish agent templates built by the community</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agents..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] text-sm text-white placeholder-neutral-600 outline-none focus:border-white/[0.12] transition-colors" />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCategory === cat ? "bg-white/10 text-white" : "text-neutral-500 hover:text-white hover:bg-white/[0.04]"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Agent Grid */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tmpl, i) => {
          const CatIcon = CATEGORY_ICON[tmpl.category] || Shield;
          const isInstalled = installedIds.has(tmpl.id);
          const isInstalling = installingId === tmpl.id;
          return (
            <motion.div key={tmpl.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-5 flex flex-col gap-3 hover:border-white/[0.12] transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                  <CatIcon className="w-4 h-4 text-violet-400" />
                </div>
                {tmpl.premium ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase">
                    <Crown className="w-2.5 h-2.5" /> Premium
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">Free</span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{tmpl.name}</h3>
                <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{tmpl.description}</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                <span>{tmpl.authorName}</span>
                <span className="flex items-center gap-0.5"><Download className="w-3 h-3" /> {tmpl.installs.toLocaleString()}</span>
                {tmpl.rating && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-400" /> {tmpl.rating}</span>}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-400 self-start">{tmpl.category}</span>
              <button
                onClick={() => installAgent(tmpl.id)}
                disabled={isInstalling || isInstalled || tmpl.id.startsWith("fb-")}
                className={`mt-auto w-full py-2 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  isInstalled
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-white/[0.06] border-white/[0.06] text-white hover:bg-white/10"
                } disabled:opacity-50`}
              >
                {isInstalling ? <><Loader2 className="w-3 h-3 animate-spin" /> Installing...</> : isInstalled ? <><CheckCircle2 className="w-3 h-3" /> Installed</> : "Install"}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Publish CTA */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-emerald-500/5 p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
          <Rocket className="w-6 h-6 text-violet-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Publish Your Agent</h3>
        <p className="text-sm text-neutral-400 max-w-md mx-auto mb-5">
          Built a powerful agent template? Share it with the Sovereign community and earn revenue from premium installs.
        </p>
        <button className="px-6 py-2.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-colors">
          Start Publishing
        </button>
      </motion.div>
    </div>
  );
}
