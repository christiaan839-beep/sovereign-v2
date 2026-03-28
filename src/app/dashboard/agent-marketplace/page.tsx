"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Store, Search, Star, Download, Crown, Rocket,
  Target, FileText, Globe2, Mic, Code2, Shield, Sparkles,
} from "lucide-react";

const CATEGORIES = ["All", "Sales", "Content", "SEO", "Intelligence", "Voice", "Code"];

const TEMPLATES = [
  { name: "Cold Outbound Pro", desc: "Multi-channel outbound sequence with personalized emails, LinkedIn, and follow-ups.", category: "Sales", creator: "Sovereign Labs", installs: 2847, rating: 4.9, premium: false },
  { name: "SEO Content Engine", desc: "Auto-research keywords, generate optimized blog posts, and track rankings.", category: "SEO", creator: "Growth AI", installs: 3412, rating: 4.8, premium: true },
  { name: "Voice Qualifier", desc: "AI voice agent that qualifies inbound leads with natural conversation.", category: "Voice", creator: "VoxForge", installs: 1256, rating: 4.7, premium: true },
  { name: "Competitor Radar", desc: "Track competitor pricing, features, and content changes in real time.", category: "Intelligence", creator: "Sovereign Labs", installs: 1890, rating: 4.6, premium: false },
  { name: "Blog Ghost Writer", desc: "Generate long-form blog posts matching your brand voice and style.", category: "Content", creator: "ContentStack", installs: 4201, rating: 4.9, premium: false },
  { name: "Lead Scraper X", desc: "Find and enrich B2B leads from LinkedIn, Apollo, and company sites.", category: "Sales", creator: "DataMine Co", installs: 2134, rating: 4.5, premium: true },
  { name: "Code Review Agent", desc: "Automated PR reviews with security checks, performance tips, and style linting.", category: "Code", creator: "DevFlow", installs: 987, rating: 4.8, premium: false },
  { name: "Social Scheduler", desc: "Generate and schedule posts across Twitter, LinkedIn, and Instagram.", category: "Content", creator: "SocialPilot AI", installs: 1567, rating: 4.4, premium: false },
  { name: "Site Audit Pro", desc: "Full technical SEO audit with Core Web Vitals and accessibility checks.", category: "SEO", creator: "Sovereign Labs", installs: 2345, rating: 4.7, premium: true },
  { name: "Meeting Intel", desc: "Pre-call research that pulls company news, funding, and attendee profiles.", category: "Intelligence", creator: "PrepAI", installs: 1123, rating: 4.6, premium: false },
  { name: "Voice Transcriber", desc: "Real-time call transcription with sentiment analysis and action items.", category: "Voice", creator: "VoxForge", installs: 876, rating: 4.3, premium: false },
  { name: "API Builder Agent", desc: "Generate REST APIs from natural language specs with auto-documentation.", category: "Code", creator: "DevFlow", installs: 654, rating: 4.9, premium: true },
];

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Sales: Target, Content: FileText, SEO: Search, Intelligence: Globe2, Voice: Mic, Code: Code2,
};

export default function AgentMarketplacePage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = TEMPLATES.filter((t) => {
    const matchCat = activeCategory === "All" || t.category === activeCategory;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase());
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tmpl, i) => {
          const CatIcon = CATEGORY_ICON[tmpl.category] || Shield;
          return (
            <motion.div key={tmpl.name} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
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
                <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{tmpl.desc}</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                <span>{tmpl.creator}</span>
                <span className="flex items-center gap-0.5"><Download className="w-3 h-3" /> {tmpl.installs.toLocaleString()}</span>
                <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-400" /> {tmpl.rating}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-400 self-start">{tmpl.category}</span>
              <button className="mt-auto w-full py-2 rounded-lg bg-white/[0.06] border border-white/[0.06] text-xs font-medium text-white hover:bg-white/10 transition-colors">
                Install
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
