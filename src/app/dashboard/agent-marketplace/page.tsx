"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Search, Star, Download, Crown, Rocket,
  Target, FileText, Globe2, Mic, Code2, Shield, Loader2,
  CheckCircle2, PlusCircle, TrendingUp, DollarSign, BarChart3,
  X, ChevronDown, Zap, Lock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

const CATEGORIES = ["All", "sales", "content", "seo", "code", "automation", "research", "voice", "data"];

interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  authorName: string;
  installs: number;
  rating?: number;
  pricePerRun: number;
  priceDisplay: string;
  totalRunCount: number;
  weeklyRunCount: number;
  safetyScore?: number;
  featured?: boolean;
  isVerified: boolean;
  tags: string[];
}

interface CreatorStats {
  summary: {
    totalAgents: number;
    totalRuns: number;
    weeklyRuns: number;
    revenue: {
      grossDollars: string;
      creatorDollars: string;
      split: { creator: number; platform: number; infra: number };
    };
  };
  agents: Array<{
    id: string;
    name: string;
    category: string;
    priceDisplay: string;
    installs: number;
    totalRunCount: number;
    creatorRevenueDisplay: string;
    verificationStatus: string;
    safetyScore?: number;
  }>;
}

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  sales: Target, content: FileText, seo: Search, intelligence: Globe2,
  voice: Mic, code: Code2, automation: Zap, research: Globe2, data: BarChart3,
};

// ─── Submit Panel ─────────────────────────────────────────────

function SubmitPanel({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: "", description: "", category: "sales", systemPrompt: "",
    pricePerRun: 0, tags: "", isPublic: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ agentId: string; safetyScore: number; qualityScore: number } | null>(null);

  async function handleSubmit() {
    if (!form.name.trim() || !form.systemPrompt.trim() || !form.description.trim()) {
      setError("Name, description, and system prompt are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pricePerRun: Math.round(form.pricePerRun * 100), // dollars → cents
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json() as { success?: boolean; agentId?: string; safetyScore?: number; qualityScore?: number; error?: string; stage?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Submission failed");
        return;
      }
      setResult({ agentId: data.agentId!, safetyScore: data.safetyScore!, qualityScore: data.qualityScore! });
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0d0d0d] border border-white/[0.08] rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-white">Publish Agent</h2>
            <p className="text-[12px] text-neutral-500 mt-0.5">5-layer safety check · 70% revenue share · 24h review</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-neutral-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Agent submitted for review</h3>
            <p className="text-sm text-neutral-400 mb-4">Safety score: <span className="text-emerald-400 font-mono">{result.safetyScore}/100</span> · Quality: <span className="text-amber-400 font-mono">{result.qualityScore}/100</span></p>
            <p className="text-[12px] text-neutral-600">Review typically completes within 24 hours. You&apos;ll receive an email when it goes live.</p>
            <button onClick={onClose} className="mt-6 px-6 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm font-semibold hover:bg-emerald-500/20 transition-colors">
              Close
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
                {error}
              </div>
            )}

            {/* Revenue callout */}
            <div className="p-4 rounded-xl bg-amber-500/[0.05] border border-amber-500/15">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span className="text-[12px] font-semibold text-amber-400">Revenue Sharing Model</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[["70%", "You"], ["20%", "Platform"], ["10%", "Infra"]].map(([pct, label]) => (
                  <div key={label} className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-base font-bold text-white">{pct}</div>
                    <div className="text-[10px] text-neutral-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[11px] font-medium text-neutral-400 mb-1.5 block">Agent Name *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Lead Hunter Pro"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/30 transition-colors"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-neutral-400 mb-1.5 block">Category *</span>
                <div className="relative">
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full appearance-none px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/30 transition-colors"
                  >
                    {CATEGORIES.slice(1).map((c) => (
                      <option key={c} value={c} className="bg-[#0d0d0d]">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
                </div>
              </label>
            </div>

            <label className="block">
              <span className="text-[11px] font-medium text-neutral-400 mb-1.5 block">Description * <span className="text-neutral-600">(20–500 chars)</span></span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder="Finds and qualifies B2B leads using real-time research and Nemotron Ultra analysis..."
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/30 transition-colors resize-none"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-medium text-neutral-400 mb-1.5 block">System Prompt * <span className="text-neutral-600">(min 50 chars)</span></span>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))}
                rows={6}
                placeholder="You are a B2B sales intelligence analyst specialised in..."
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[12px] font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/30 transition-colors resize-none"
              />
            </label>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[11px] font-medium text-neutral-400 mb-1.5 block">Price per run ($ USD)</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    step={0.01}
                    value={form.pricePerRun}
                    onChange={(e) => setForm((p) => ({ ...p, pricePerRun: parseFloat(e.target.value) || 0 }))}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/30 transition-colors"
                  />
                </div>
                <p className="text-[10px] text-neutral-600 mt-1">0 = free · you earn 70%</p>
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-neutral-400 mb-1.5 block">Tags <span className="text-neutral-600">(comma-separated)</span></span>
                <input
                  value={form.tags}
                  onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                  placeholder="leads, b2b, research"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/30 transition-colors"
                />
              </label>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Your agent will be tested against 5 safety layers before going live: jailbreak probe, PII scan, content policy, quality gate, and Claude critic.
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 font-semibold text-sm hover:bg-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Running verification pipeline…</>
              ) : (
                <><Rocket className="w-4 h-4" /> Submit for Review</>
              )}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Creator Dashboard Tab ────────────────────────────────────

function CreatorDashboard() {
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/marketplace/stats")
      .then((r) => r.json())
      .then((d: CreatorStats) => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
    </div>
  );

  if (!stats || stats.summary.totalAgents === 0) return (
    <div className="py-16 text-center">
      <PlusCircle className="w-10 h-10 text-neutral-700 mx-auto mb-4" />
      <p className="text-sm text-neutral-500 mb-2">No published agents yet.</p>
      <p className="text-[12px] text-neutral-600">Publish your first agent to start earning 70% revenue share.</p>
    </div>
  );

  const s = stats.summary;
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Agents", value: s.totalAgents, icon: Store, color: "violet" },
          { label: "Total Runs", value: s.totalRuns.toLocaleString(), icon: BarChart3, color: "sky" },
          { label: "Weekly Runs", value: s.weeklyRuns.toLocaleString(), icon: TrendingUp, color: "emerald" },
          { label: "Your Revenue", value: `$${s.revenue.creatorDollars}`, icon: DollarSign, color: "amber" },
        ].map((card) => (
          <div key={card.label} className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="text-[10px] font-medium text-neutral-500 mb-2">{card.label}</div>
            <div className="text-xl font-bold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Revenue split */}
      <div className="p-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.03]">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-amber-400" />
          <span className="text-[12px] font-semibold text-amber-400">Gross Revenue: ${s.revenue.grossDollars}</span>
        </div>
        <div className="flex gap-0 rounded-lg overflow-hidden h-2">
          <div className="bg-amber-400" style={{ width: "70%" }} title="Creator 70%" />
          <div className="bg-violet-500" style={{ width: "20%" }} title="Platform 20%" />
          <div className="bg-neutral-600" style={{ width: "10%" }} title="Infra 10%" />
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-neutral-500">
          <span><span className="text-amber-400">■</span> You 70% (${s.revenue.creatorDollars})</span>
          <span><span className="text-violet-400">■</span> Platform 20%</span>
          <span><span className="text-neutral-400">■</span> Infra 10%</span>
        </div>
      </div>

      {/* Per-agent table */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Your Agents
        </div>
        {stats.agents.map((a) => (
          <div key={a.id} className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white truncate">{a.name}</p>
                {a.verificationStatus === "verified" && (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                )}
                {a.verificationStatus === "in_review" && (
                  <span className="text-[9px] font-bold text-amber-400 uppercase">In Review</span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500">{a.category} · {a.priceDisplay} · {a.totalRunCount} runs</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-emerald-400">{a.creatorRevenueDisplay}</p>
              {a.safetyScore != null && (
                <p className="text-[10px] text-neutral-600">Safety {a.safetyScore}/100</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function AgentMarketplacePage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeTab, setActiveTab] = useState<"browse" | "creator">("browse");
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [showSubmit, setShowSubmit] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const categoryParam = activeCategory !== "All" ? `&category=${activeCategory}` : "";
      const res = await fetch(`/api/marketplace/trending?limit=50${categoryParam}`);
      const data = await res.json() as { agents?: MarketplaceAgent[] };
      setAgents(Array.isArray(data.agents) ? data.agents : []);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const installAgent = async (agentId: string) => {
    setInstallingId(agentId);
    try {
      const res = await fetch(`/api/marketplace/${agentId}/install`, { method: "POST" });
      const data = await res.json() as { skill?: unknown };
      if (data.skill) setInstalledIds((prev) => new Set([...prev, agentId]));
    } catch { /* silent */ }
    finally { setInstallingId(null); }
  };

  const filtered = agents.filter((t) => {
    const matchCat = activeCategory === "All" || t.category === activeCategory;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-400 text-[10px] font-bold uppercase tracking-widest mb-3">
            <Store className="w-3 h-3" /> Agent Marketplace
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Agent Marketplace</h1>
          <p className="text-sm text-neutral-500 mt-1">Browse verified agents · earn 70% publishing yours</p>
        </div>
        <button
          onClick={() => setShowSubmit(true)}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-semibold hover:bg-violet-500/20 transition-colors"
        >
          <PlusCircle className="w-4 h-4" /> Publish Agent
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
        {(["browse", "creator"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab ? "bg-white/10 text-white" : "text-neutral-500 hover:text-white"
            }`}
          >
            {tab === "browse" ? "Browse" : "Creator Dashboard"}
          </button>
        ))}
      </div>

      {activeTab === "creator" && <CreatorDashboard />}

      {activeTab === "browse" && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] text-sm text-white placeholder-neutral-600 outline-none focus:border-white/[0.12] transition-colors"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 flex-wrap">
            {["All", ...CATEGORIES.slice(1)].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCategory === cat ? "bg-white/10 text-white" : "text-neutral-500 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Agent Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-neutral-500">
              <Store className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No agents yet in this category.</p>
              <p className="text-[12px] text-neutral-600 mt-1">Be the first to publish one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((agent, i) => {
                const CatIcon = CATEGORY_ICON[agent.category] || Shield;
                const isInstalled = installedIds.has(agent.id);
                const isInstalling = installingId === agent.id;
                return (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-5 flex flex-col gap-3 hover:border-white/[0.12] transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                        <CatIcon className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {agent.isVerified && (
                          <span title="Verified by 5-layer safety pipeline" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                          </span>
                        )}
                        {agent.pricePerRun > 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                            <Lock className="w-2.5 h-2.5" /> {agent.priceDisplay}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">Free</span>
                        )}
                        {agent.featured && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[9px] font-bold">
                            <Crown className="w-2.5 h-2.5" /> Featured
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{agent.description}</p>
                    </div>

                    {/* Tags */}
                    {agent.tags?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {agent.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-neutral-500">{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                      <span>{agent.authorName}</span>
                      <span className="flex items-center gap-0.5"><Download className="w-3 h-3" /> {agent.installs.toLocaleString()}</span>
                      {agent.rating ? <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-400" /> {agent.rating}</span> : null}
                      {agent.weeklyRunCount > 0 && (
                        <span className="flex items-center gap-0.5 text-emerald-400/70"><TrendingUp className="w-3 h-3" /> {agent.weeklyRunCount}/wk</span>
                      )}
                    </div>

                    <button
                      onClick={() => installAgent(agent.id)}
                      disabled={isInstalling || isInstalled}
                      className={`mt-auto w-full py-2 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                        isInstalled
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-white/[0.06] border-white/[0.06] text-white hover:bg-white/10"
                      } disabled:opacity-50`}
                    >
                      {isInstalling ? <><Loader2 className="w-3 h-3 animate-spin" /> Installing…</> : isInstalled ? <><CheckCircle2 className="w-3 h-3" /> Installed</> : "Install"}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Publish CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-8 flex flex-col sm:flex-row items-center gap-6"
          >
            <div className="w-14 h-14 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
              <Rocket className="w-7 h-7 text-violet-400" />
            </div>
            <div className="text-center sm:text-left flex-1">
              <h3 className="text-base font-bold text-white mb-1">Publish and earn</h3>
              <p className="text-sm text-neutral-400">
                Share your agents with the community. Every paid run earns you{" "}
                <strong className="text-amber-400">70%</strong> automatically — no manual invoicing.
                5-layer safety check runs before any agent goes live.
              </p>
            </div>
            <button
              onClick={() => setShowSubmit(true)}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30 transition-colors whitespace-nowrap"
            >
              Publish Agent
            </button>
          </motion.div>
        </>
      )}

      {/* Submit Panel Modal */}
      <AnimatePresence>
        {showSubmit && (
          <SubmitPanel
            onClose={() => setShowSubmit(false)}
            onSuccess={() => {
              setActiveTab("creator");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
