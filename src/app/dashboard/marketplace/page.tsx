"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Star, Eye, Search, Users, TrendingUp,
  Briefcase, FileText, BarChart3, Code2, Zap, FlaskConical,
  Sparkles, ArrowRight, Loader2, X, Bot,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/ToastProvider";
import { PageHeader } from "@/components/ui/PageHeader";

/* ─── Types ─── */

interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  authorName: string;
  installs: number;
  rating: number | null;
  createdAt: string;
}

/* ─── Category Config ─── */

const CATEGORIES = [
  { id: "all", label: "All Agents", icon: Bot },
  { id: "sales", label: "Sales", icon: Briefcase, color: "emerald" },
  { id: "content", label: "Content", icon: FileText, color: "cyan" },
  { id: "seo", label: "SEO", icon: BarChart3, color: "amber" },
  { id: "code", label: "Code", icon: Code2, color: "violet" },
  { id: "automation", label: "Automation", icon: Zap, color: "blue" },
  { id: "research", label: "Research", icon: FlaskConical, color: "rose" },
] as const;

const CATEGORY_STYLES: Record<string, { badge: string; glow: string }> = {
  sales:      { badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", glow: "shadow-emerald-500/5" },
  content:    { badge: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", glow: "shadow-cyan-500/5" },
  seo:        { badge: "text-amber-400 bg-amber-500/10 border-amber-500/20", glow: "shadow-amber-500/5" },
  code:       { badge: "text-violet-400 bg-violet-500/10 border-violet-500/20", glow: "shadow-violet-500/5" },
  automation: { badge: "text-blue-400 bg-blue-500/10 border-blue-500/20", glow: "shadow-blue-500/5" },
  research:   { badge: "text-rose-400 bg-rose-500/10 border-rose-500/20", glow: "shadow-rose-500/5" },
};

/* ─── Featured Agents (hardcoded) ─── */

const FEATURED_AGENTS: MarketplaceAgent[] = [
  {
    id: "featured-1",
    name: "LinkedIn Lead Machine",
    description: "Finds and qualifies LinkedIn prospects by analyzing profiles, engagement patterns, and mutual connections to build targeted lead lists.",
    category: "sales",
    systemPrompt: "You are an expert LinkedIn prospecting agent. Analyze target profiles, identify decision makers, score leads based on ICP fit, and draft personalized connection requests. Output structured lead reports with qualification scores.",
    authorName: "Sovereign Labs",
    installs: 2847,
    rating: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: "featured-2",
    name: "SEO Content Writer",
    description: "Writes SEO-optimized blog posts with keyword clustering, internal linking suggestions, and meta descriptions that rank.",
    category: "seo",
    systemPrompt: "You are an SEO content strategist. Given a target keyword, produce a fully optimized blog post with: H1/H2/H3 structure, keyword density analysis, LSI keywords, meta description, FAQ schema suggestions, and internal linking recommendations. Write in a conversational yet authoritative tone.",
    authorName: "Sovereign Labs",
    installs: 3412,
    rating: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: "featured-3",
    name: "Contract Analyzer",
    description: "Reviews contracts for risks, unfavorable clauses, and missing protections. Highlights issues with severity ratings.",
    category: "research",
    systemPrompt: "You are a legal contract analysis agent. Review contracts and identify: unfavorable terms, missing clauses, liability risks, IP concerns, termination penalties, and auto-renewal traps. Rate each finding as Critical/Warning/Info. Provide a risk score out of 100 and recommend amendments.",
    authorName: "Sovereign Labs",
    installs: 1893,
    rating: 4,
    createdAt: new Date().toISOString(),
  },
  {
    id: "featured-4",
    name: "Social Media Manager",
    description: "Creates a full content calendar for all platforms with captions, hashtags, and posting schedules optimized for engagement.",
    category: "content",
    systemPrompt: "You are a social media strategist managing content across Instagram, LinkedIn, Twitter/X, TikTok, and Facebook. Given a brand description and goals, produce a 30-day content calendar with: post types, captions, hashtag sets, optimal posting times, and content pillars. Include engagement hooks and CTA variations.",
    authorName: "Sovereign Labs",
    installs: 4201,
    rating: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: "featured-5",
    name: "Cold Email Closer",
    description: "Writes personalized cold outreach sequences that get replies. Multi-step sequences with follow-ups and objection handling.",
    category: "sales",
    systemPrompt: "You are an elite cold email copywriter. Given a target persona and value proposition, create a 5-email outreach sequence with: attention-grabbing subject lines, personalization tokens, social proof elements, clear CTAs, and strategic follow-up timing. Each email should be under 150 words. Include A/B test variants for the first email.",
    authorName: "Sovereign Labs",
    installs: 3756,
    rating: 5,
    createdAt: new Date().toISOString(),
  },
];

/* ─── Main Page ─── */

export default function MarketplacePage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [communityAgents, setCommunityAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [previewAgent, setPreviewAgent] = useState<MarketplaceAgent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const toast = useToast();

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const url = activeCategory === "all"
        ? "/api/marketplace"
        : `/api/marketplace?category=${activeCategory}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCommunityAgents(data.agents || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleInstall = async (agent: MarketplaceAgent) => {
    setInstalling(agent.id);
    try {
      const isFeatured = agent.id.startsWith("featured-");

      if (isFeatured) {
        // For featured agents, publish to marketplace first then install
        const pubRes = await fetch("/api/marketplace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: agent.name,
            description: agent.description,
            category: agent.category,
            systemPrompt: agent.systemPrompt,
            authorName: agent.authorName,
          }),
        });
        // Whether publish succeeds or already exists, just copy to skills directly
        const skillRes = await fetch("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: agent.name,
            description: agent.description,
            systemPrompt: agent.systemPrompt,
          }),
        });
        if (skillRes.ok) {
          toast.success(`"${agent.name}" installed to your agents!`);
        }
      } else {
        const res = await fetch(`/api/marketplace/${agent.id}/install`, {
          method: "POST",
        });
        if (res.ok) {
          toast.success(`"${agent.name}" installed to your agents!`);
          fetchAgents(); // refresh counts
        } else {
          const data = await res.json();
          toast.error(data.error || "Failed to install agent.");
        }
      }
    } catch {
      toast.error("Installation failed. Please try again.");
    } finally {
      setInstalling(null);
    }
  };

  // Filter featured agents by category and search
  const filteredFeatured = FEATURED_AGENTS.filter((a) => {
    const matchCategory = activeCategory === "all" || a.category === activeCategory;
    const matchSearch = !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const filteredCommunity = communityAgents.filter((a) => {
    if (!searchQuery) return true;
    return a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[#000000] px-6 lg:px-8 py-8 pb-32">
      <PageHeader
        title="Agent Marketplace"
        description="Discover and deploy community-built agents"
      />

      {/* ─── Search Bar ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents by name or description..."
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/[0.15] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-neutral-500 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>

      {/* ─── Category Tabs ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-wrap gap-2 mb-10"
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-gpu duration-200 ${
              activeCategory === cat.id
                ? "bg-white/[0.1] text-white border border-white/[0.15]"
                : "bg-white/[0.03] text-neutral-500 border border-white/[0.04] hover:bg-white/[0.05] hover:text-neutral-300"
            }`}
          >
            <cat.icon className="w-3.5 h-3.5" />
            {cat.label}
          </button>
        ))}
      </motion.div>

      {/* ─── Featured Agents (Horizontal Scroll) ─── */}
      <AnimatePresence mode="wait">
        {filteredFeatured.length > 0 && (
          <motion.div
            key={`featured-${activeCategory}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-5">
              <Star className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-300">Featured Agents</h2>
              <span className="text-[10px] text-neutral-600 font-mono">{filteredFeatured.length} curated</span>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 custom-scrollbar">
              {filteredFeatured.map((agent, i) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  index={i}
                  installing={installing}
                  onInstall={handleInstall}
                  onPreview={setPreviewAgent}
                  featured
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Community Agents Grid ─── */}
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-5">
          <Users className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-300">Community Agents</h2>
          {!loading && (
            <span className="text-[10px] text-neutral-600 font-mono">{filteredCommunity.length} published</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
          </div>
        ) : filteredCommunity.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/[0.02] border border-white/[0.04] border-dashed rounded-2xl py-16 flex flex-col items-center gap-3"
          >
            <TrendingUp className="w-8 h-8 text-neutral-600" />
            <p className="text-sm text-neutral-500">No community agents published yet. Be the first!</p>
            <Link
              href="/dashboard/agent-builder"
              className="mt-2 px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" /> Create an Agent
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredCommunity.map((agent, i) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  index={i}
                  installing={installing}
                  onInstall={handleInstall}
                  onPreview={setPreviewAgent}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ─── Publish CTA ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 lg:p-10 text-center"
      >
        <Sparkles className="w-8 h-8 text-emerald-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Built something great?</h3>
        <p className="text-sm text-neutral-400 mb-6 max-w-md mx-auto">
          Share your custom agents with the community. Publish from the Agent Builder and help others automate their workflows.
        </p>
        <Link
          href="/dashboard/agent-builder"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
        >
          Go to Agent Builder <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>

      {/* ─── Preview Modal ─── */}
      <AnimatePresence>
        {previewAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewAgent(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-6 lg:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08]">
                    <Bot className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{previewAgent.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${CATEGORY_STYLES[previewAgent.category]?.badge || "text-neutral-400 bg-white/5 border-white/10"}`}>
                        {previewAgent.category}
                      </span>
                      <span className="text-[10px] text-neutral-600">by {previewAgent.authorName}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewAgent(null)}
                  className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-neutral-300 mb-6">{previewAgent.description}</p>

              <div className="mb-6">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">System Prompt</label>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-xs text-neutral-400 font-mono leading-relaxed whitespace-pre-wrap">
                    {previewAgent.systemPrompt}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    handleInstall(previewAgent);
                    setPreviewAgent(null);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" /> Install Agent
                </button>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Download className="w-3 h-3" /> {previewAgent.installs.toLocaleString()}
                  </span>
                  {previewAgent.rating != null && previewAgent.rating > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400" /> {previewAgent.rating}/5
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Agent Card Component ─── */

function AgentCard({
  agent,
  index,
  installing,
  onInstall,
  onPreview,
  featured,
}: {
  agent: MarketplaceAgent;
  index: number;
  installing: string | null;
  onInstall: (a: MarketplaceAgent) => void;
  onPreview: (a: MarketplaceAgent) => void;
  featured?: boolean;
}) {
  const style = CATEGORY_STYLES[agent.category] || { badge: "text-neutral-400 bg-white/5 border-white/10", glow: "" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 flex flex-col hover:border-white/[0.12] transition-gpu duration-200 ${
        featured ? "min-w-[320px] max-w-[360px] flex-shrink-0" : ""
      } ${style.glow}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-white/[0.05] border border-white/[0.08] flex-shrink-0">
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
            <span className="text-[10px] text-neutral-600">by {agent.authorName}</span>
          </div>
        </div>
        {featured && (
          <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            Featured
          </span>
        )}
      </div>

      <p className="text-[11px] text-neutral-500 leading-relaxed mb-4 line-clamp-2 flex-1">
        {agent.description}
      </p>

      <div className="flex items-center gap-2 mb-4">
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${style.badge}`}>
          {agent.category}
        </span>
        <div className="flex items-center gap-3 ml-auto text-[10px] text-neutral-600">
          <span className="flex items-center gap-1">
            <Download className="w-3 h-3" /> {agent.installs.toLocaleString()}
          </span>
          {agent.rating != null && agent.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400" /> {agent.rating}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onInstall(agent)}
          disabled={installing === agent.id}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {installing === agent.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          Install
        </button>
        <button
          onClick={() => onPreview(agent)}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
      </div>
    </motion.div>
  );
}
