"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Download, Star, ArrowRight, Zap, Target, FileText, Code2, Shield, Mic, TrendingUp, Filter } from "lucide-react";
import Link from "next/link";

/**
 * AGENT MARKETPLACE — Browse and install community agents.
 *
 * This is the Shopify App Store equivalent. Developers submit agents,
 * users browse and install them. The more agents = the more valuable
 * the platform = network effects = moat.
 */

interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  authorName: string;
  installs: number;
  rating: number;
}

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

// Featured agents (shown when no API data is available)
const FEATURED_AGENTS: MarketplaceAgent[] = [
  { id: "1", name: "Lead Blitz", description: "Find 50+ verified leads in any niche in under 60 seconds. Enriched with LinkedIn, funding data, and email verification.", category: "sales", authorName: "Sovereign Core", installs: 2847, rating: 5 },
  { id: "2", name: "Content Machine", description: "Generate blog posts, social content, and email sequences that pass AI detection. Anti-slop, human-sounding, SEO-ready.", category: "content", authorName: "Sovereign Core", installs: 1923, rating: 5 },
  { id: "3", name: "Competitor Takedown", description: "Deep competitive intelligence: weaknesses, market gaps, pricing analysis, and a battle plan to win.", category: "research", authorName: "Sovereign Core", installs: 1456, rating: 5 },
  { id: "4", name: "SEO Dominator", description: "Full SEO audit: keyword gaps, technical issues, content strategy, and schema markup recommendations.", category: "seo", authorName: "Sovereign Core", installs: 1204, rating: 4 },
  { id: "5", name: "Voice Caller", description: "AI cold-calls prospects, qualifies for budget and timeline, books meetings on your calendar. Sub-200ms latency.", category: "voice", authorName: "Sovereign Core", installs: 987, rating: 5 },
  { id: "6", name: "Code Agent", description: "Writes production-ready code, reviews for bugs, prepares PRs. Supports TypeScript, Python, Go, Rust.", category: "code", authorName: "Sovereign Core", installs: 876, rating: 4 },
  { id: "7", name: "Brand Voice Analyzer", description: "Paste your content, get a detailed brand voice profile. Tone, vocabulary, sentence patterns, and consistency score.", category: "content", authorName: "Sovereign Core", installs: 654, rating: 4 },
  { id: "8", name: "Ad Optimizer", description: "Analyze ad campaigns, identify underperforming creatives, generate new copy variants. ROAS tracking built in.", category: "sales", authorName: "Sovereign Core", installs: 543, rating: 4 },
  { id: "9", name: "War Room", description: "3 AI models debate your business question independently, then synthesize a consensus answer. Multi-perspective intelligence.", category: "research", authorName: "Sovereign Core", installs: 432, rating: 5 },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= rating ? "text-amber-400 fill-amber-400" : "text-neutral-700"}`} />
      ))}
    </div>
  );
}

export default function MarketplacePage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [agents, setAgents] = useState<MarketplaceAgent[]>(FEATURED_AGENTS);
  const [installing, setInstalling] = useState<string | null>(null);

  // Try to fetch from API, fall back to featured
  useEffect(() => {
    fetch(`/api/marketplace?category=${category}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.agents?.length > 0) setAgents(data.agents);
      })
      .catch(() => {}); // Silent fail — use featured agents
  }, [category]);

  const filtered = agents.filter(a =>
    (category === "all" || a.category === category) &&
    (search === "" || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase()))
  );

  const handleInstall = async (agentId: string) => {
    setInstalling(agentId);
    try {
      const res = await fetch(`/api/marketplace/${agentId}/install`, { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/signup";
        return;
      }
      // Success — agent installed
      setTimeout(() => setInstalling(null), 1500);
    } catch {
      setInstalling(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303]">
      <title>Agent Marketplace | 130+ AI Agents | Sovereign Matrix</title>

      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white">Sovereign Matrix</Link>
          <div className="flex items-center gap-4">
            <Link href="/developers" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              Build an Agent →
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
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            Agent Marketplace
          </h1>
          <p className="text-neutral-400 max-w-lg mx-auto mb-8">
            130+ AI agents built by the community. Install any agent in one click.
            Or <Link href="/developers" className="text-emerald-400 hover:text-emerald-300">build your own</Link> and earn 80% revenue.
          </p>

          {/* Search */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-emerald-500/30 transition-colors"
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

        {/* Agent grid */}
        <div className="grid md:grid-cols-3 gap-4">
          {filtered.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/20 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">{agent.name}</h3>
                  <span className="text-[10px] text-neutral-600">by {agent.authorName}</span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.04] text-neutral-500 border border-white/[0.06] uppercase">
                  {agent.category}
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed mb-4 line-clamp-2">{agent.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StarRating rating={agent.rating} />
                  <span className="text-[10px] text-neutral-600 flex items-center gap-1">
                    <Download className="w-3 h-3" /> {agent.installs.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => handleInstall(agent.id)}
                  disabled={installing === agent.id}
                  className="text-[11px] px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors font-medium disabled:opacity-50"
                >
                  {installing === agent.id ? "Installing..." : "Install"}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center p-8 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02]">
          <h2 className="text-xl font-bold text-white mb-2">Build the next top agent</h2>
          <p className="text-sm text-neutral-400 mb-6">
            Developers earn 80% of revenue. Ship an agent in 1 hour. The SDK handles auth, safety, and billing.
          </p>
          <Link
            href="/developers"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full text-sm transition-colors"
          >
            Start Building <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
