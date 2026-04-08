"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, ArrowRight, Zap, Target, FileText, Code2, Shield, Mic, TrendingUp, Filter, BadgeCheck, Plus } from "lucide-react";
import Link from "next/link";

/**
 * AGENT MARKETPLACE — Browse and install first-party agents.
 *
 * Honest version: no fake install counts, no fake star ratings.
 * Shows capability tags, "Built-in" badges for first-party agents,
 * category color coding, and gradient border hover effects.
 */

interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  authorType: "first-party" | "community";
}

const CATEGORY_COLORS: Record<string, { border: string; bg: string; text: string; glow: string; gradient: string }> = {
  sales:      { border: "border-orange-500/30", bg: "bg-orange-500/10", text: "text-orange-400", glow: "hover:shadow-orange-500/10", gradient: "from-orange-500/20 via-transparent to-orange-500/10" },
  content:    { border: "border-violet-500/30", bg: "bg-violet-500/10", text: "text-violet-400", glow: "hover:shadow-violet-500/10", gradient: "from-violet-500/20 via-transparent to-violet-500/10" },
  seo:        { border: "border-cyan-500/30",   bg: "bg-cyan-500/10",   text: "text-cyan-400",   glow: "hover:shadow-cyan-500/10",   gradient: "from-cyan-500/20 via-transparent to-cyan-500/10" },
  code:       { border: "border-blue-500/30",   bg: "bg-blue-500/10",   text: "text-blue-400",   glow: "hover:shadow-blue-500/10",   gradient: "from-blue-500/20 via-transparent to-blue-500/10" },
  research:   { border: "border-amber-500/30",  bg: "bg-amber-500/10",  text: "text-amber-400",  glow: "hover:shadow-amber-500/10",  gradient: "from-amber-500/20 via-transparent to-amber-500/10" },
  automation: { border: "border-emerald-500/30", bg: "bg-emerald-500/10", text: "text-emerald-400", glow: "hover:shadow-emerald-500/10", gradient: "from-emerald-500/20 via-transparent to-emerald-500/10" },
  voice:      { border: "border-pink-500/30",   bg: "bg-pink-500/10",   text: "text-pink-400",   glow: "hover:shadow-pink-500/10",   gradient: "from-pink-500/20 via-transparent to-pink-500/10" },
};

const CATEGORIES = [
  { id: "all", label: "All Agents", icon: Zap },
  { id: "sales", label: "Sales", icon: Target },
  { id: "content", label: "Content", icon: FileText },
  { id: "seo", label: "SEO", icon: TrendingUp },
  { id: "code", label: "Code", icon: Code2 },
  { id: "research", label: "Research", icon: Search },
  { id: "automation", label: "Automation", icon: Shield },
  { id: "voice", label: "Voice", icon: Mic },
];

const FEATURED_AGENTS: MarketplaceAgent[] = [
  {
    id: "1",
    name: "Lead Blitz",
    description: "Find verified leads in any niche. Enriched with LinkedIn data, funding rounds, and email verification.",
    category: "sales",
    tags: ["Lead scraping", "Email enrichment", "LinkedIn data"],
    authorType: "first-party",
  },
  {
    id: "2",
    name: "Content Machine",
    description: "Generate blog posts, social content, and email sequences that pass AI detection. Anti-slop pipeline, SEO-optimized.",
    category: "content",
    tags: ["Blog writing", "Social media", "Email sequences"],
    authorType: "first-party",
  },
  {
    id: "3",
    name: "Competitor Takedown",
    description: "Deep competitive intelligence: weaknesses, market gaps, pricing analysis, and a strategy to differentiate.",
    category: "research",
    tags: ["Competitive intel", "Market analysis", "SWOT"],
    authorType: "first-party",
  },
  {
    id: "4",
    name: "SEO Dominator",
    description: "Full SEO audit: keyword gaps, technical issues, content strategy, and schema markup recommendations.",
    category: "seo",
    tags: ["Keyword research", "Technical SEO", "Schema markup"],
    authorType: "first-party",
  },
  {
    id: "5",
    name: "Voice Caller",
    description: "AI cold-calls prospects, qualifies for budget and timeline, books meetings on your calendar. Sub-200ms latency.",
    category: "voice",
    tags: ["Cold calling", "Lead qualification", "Calendar booking"],
    authorType: "first-party",
  },
  {
    id: "6",
    name: "Code Agent",
    description: "Writes production-ready code, reviews for bugs, prepares PRs. Supports TypeScript, Python, Go, Rust.",
    category: "code",
    tags: ["Code generation", "Bug review", "Multi-language"],
    authorType: "first-party",
  },
  {
    id: "7",
    name: "Brand Voice Analyzer",
    description: "Paste your content, get a detailed brand voice profile. Tone, vocabulary, sentence patterns, and consistency score.",
    category: "content",
    tags: ["Brand analysis", "Tone detection", "Style guide"],
    authorType: "first-party",
  },
  {
    id: "8",
    name: "Ad Optimizer",
    description: "Analyze ad campaigns, identify underperforming creatives, generate new copy variants. ROAS tracking built in.",
    category: "sales",
    tags: ["Ad analysis", "Copy generation", "ROAS tracking"],
    authorType: "first-party",
  },
  {
    id: "9",
    name: "War Room",
    description: "3 AI models debate your business question independently, then synthesize a consensus answer. Multi-perspective intelligence.",
    category: "research",
    tags: ["Multi-model", "Consensus AI", "Strategic debate"],
    authorType: "first-party",
  },
];

function getCategoryStyle(category: string) {
  return CATEGORY_COLORS[category] ?? { border: "border-white/10", bg: "bg-white/5", text: "text-neutral-400", glow: "", gradient: "from-white/10 via-transparent to-white/5" };
}

export default function MarketplacePage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return FEATURED_AGENTS.filter(a =>
      (category === "all" || a.category === category) &&
      (q === "" || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q)))
    );
  }, [category, search]);

  const handleInstall = async (agentId: string) => {
    setInstalling(agentId);
    try {
      const res = await fetch(`/api/marketplace/${agentId}/install`, { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/signup";
        return;
      }
      setTimeout(() => setInstalling(null), 1500);
    } catch {
      setInstalling(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303]">
      <title>Agent Marketplace | 130+ AI Agents | Sovereign Matrix</title>

      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 bg-[#030303]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white">Sovereign Matrix</Link>
          <div className="flex items-center gap-4">
            <Link href="/developers" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              Build an Agent &rarr;
            </Link>
            <Link href="/dashboard" className="text-xs px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-neutral-200 transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">

          {/* Agent Marketplace badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.6 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] mb-6"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-60" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-[0.2em]">Agent Marketplace</span>
            <span className="text-[10px] text-neutral-500 font-mono">130+ agents</span>
          </motion.div>

          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            Every Agent Your Business Needs
          </h1>
          <p className="text-neutral-400 max-w-lg mx-auto mb-8">
            Browse the full agent catalog. Every agent runs through a 5-layer safety pipeline
            and multi-model consensus verification.
          </p>

          {/* Search */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agents by name, description, or capability..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            />
          </div>
        </motion.div>

        {/* Category filters */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <Filter className="w-4 h-4 text-neutral-500 shrink-0" />
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                category === cat.id
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-white/[0.02] text-neutral-500 border border-white/[0.06] hover:text-white hover:border-white/[0.12]"
              }`}
            >
              <cat.icon className="w-3 h-3" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="mb-4 text-xs text-neutral-600">
          {filtered.length} agent{filtered.length !== 1 ? "s" : ""}{category !== "all" ? ` in ${CATEGORIES.find(c => c.id === category)?.label ?? category}` : ""}{search ? ` matching "${search}"` : ""}
        </div>

        {/* Agent grid */}
        <div className="grid md:grid-cols-3 gap-4">
          {filtered.map((agent, i) => {
            const colors = getCategoryStyle(agent.category);
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`group relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300 hover:shadow-lg ${colors.glow} hover:border-transparent`}
              >
                {/* Gradient glow on hover */}
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 bg-gradient-to-br ${colors.gradient} blur-xl`} />

                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">{agent.name}</h3>
                      {agent.authorType === "first-party" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                          <BadgeCheck className="w-3 h-3 text-emerald-400" />
                          <span className="text-[9px] font-semibold text-emerald-400">Built-in</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-600">by Sovereign Core</span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border} uppercase font-semibold`}>
                    {agent.category}
                  </span>
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed mb-4 line-clamp-2">{agent.description}</p>

                {/* Capability tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {agent.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-neutral-500 border border-white/[0.06]">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-600 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> 5-layer verified
                  </span>
                  <button
                    onClick={() => handleInstall(agent.id)}
                    disabled={installing === agent.id}
                    className={`text-[11px] px-3 py-1.5 rounded-lg ${colors.bg} ${colors.text} border ${colors.border} hover:brightness-125 transition-all font-medium disabled:opacity-50`}
                  >
                    {installing === agent.id ? "Adding..." : "Add to Stack"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-neutral-500 text-sm mb-2">No agents match your search.</p>
            <button onClick={() => { setSearch(""); setCategory("all"); }} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              Clear filters
            </button>
          </div>
        )}

        {/* Submit Your Agent CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 relative overflow-hidden rounded-2xl border border-dashed border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-cyan-500/[0.04]"
        >
          <div className="p-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <Plus className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Submit Your Agent</h2>
            <p className="text-sm text-neutral-400 max-w-md mx-auto mb-6">
              Build an agent with our SDK and publish it to the marketplace.
              The SDK handles auth, safety pipelines, and billing.
              You keep 80% of revenue.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/developers"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full text-sm transition-colors"
              >
                Start Building <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/developers"
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 rounded-full text-sm transition-colors"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
