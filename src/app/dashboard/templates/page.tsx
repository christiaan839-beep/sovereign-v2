"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutGrid,
  Target,
  FileText,
  Globe,
  Zap,
  FlaskConical,
  Download,
  Clock,
  ArrowRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from "@/lib/workflow-templates";

// ─── Types ──────────────────────────────────────────────────────

type FilterKey = "all" | WorkflowTemplate["category"];

const CATEGORY_CONFIG: Record<
  WorkflowTemplate["category"],
  { label: string; color: string; bgClass: string; textClass: string }
> = {
  sales: { label: "Sales", color: "emerald", bgClass: "bg-emerald-500/10", textClass: "text-emerald-400" },
  content: { label: "Content", color: "cyan", bgClass: "bg-cyan-500/10", textClass: "text-cyan-400" },
  seo: { label: "SEO", color: "violet", bgClass: "bg-violet-500/10", textClass: "text-violet-400" },
  automation: { label: "Automation", color: "amber", bgClass: "bg-amber-500/10", textClass: "text-amber-400" },
  research: { label: "Research", color: "purple", bgClass: "bg-purple-500/10", textClass: "text-purple-400" },
};

const DIFFICULTY_CONFIG: Record<
  WorkflowTemplate["difficulty"],
  { label: string; dotClass: string }
> = {
  beginner: { label: "Beginner", dotClass: "bg-emerald-400" },
  intermediate: { label: "Intermediate", dotClass: "bg-amber-400" },
  advanced: { label: "Advanced", dotClass: "bg-rose-400" },
};

const TABS: { key: FilterKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all", label: "All", icon: LayoutGrid },
  { key: "sales", label: "Sales", icon: Target },
  { key: "content", label: "Content", icon: FileText },
  { key: "seo", label: "SEO", icon: Globe },
  { key: "automation", label: "Automation", icon: Zap },
  { key: "research", label: "Research", icon: FlaskConical },
];

// ─── Component ──────────────────────────────────────────────────

export default function WorkflowTemplatesPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const visible = useMemo(() => {
    let list = WORKFLOW_TEMPLATES;

    if (filter !== "all") {
      list = list.filter((t) => t.category === filter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    return list;
  }, [filter, searchQuery]);

  const totalInstalls = WORKFLOW_TEMPLATES.reduce((sum, t) => sum + t.installs, 0);

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-10" role="region" aria-label="Workflow template marketplace">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-emerald-400" /> Template Marketplace
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Workflow Templates
        </h1>
        <p className="mt-2 text-neutral-400 text-sm max-w-xl">
          Pre-built agent pipelines you can deploy in seconds. Pick a template, customize it, and run.
        </p>

        {/* Stats row */}
        <div className="flex gap-6 mt-4">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <LayoutGrid className="w-3.5 h-3.5" />
            {WORKFLOW_TEMPLATES.length} templates
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <TrendingUp className="w-3.5 h-3.5" />
            {totalInstalls.toLocaleString()} total installs
          </div>
        </div>
      </motion.div>

      {/* Search + Category Tabs */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Search bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-neutral-500 outline-none focus:border-emerald-500/30 transition-colors"
          />
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active = filter === tab.key;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`
                  flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold
                  transition-all duration-200
                  ${
                    active
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/[0.03] text-neutral-400 border border-white/[0.06] hover:border-white/10 hover:text-neutral-200"
                  }
                `}
              >
                <TabIcon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <motion.div
        layout
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <AnimatePresence mode="popLayout">
          {visible.map((template, i) => {
            const catConfig = CATEGORY_CONFIG[template.category];
            const diffConfig = DIFFICULTY_CONFIG[template.difficulty];
            return (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className="group relative flex flex-col justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/20 hover:bg-white/[0.04]"
              >
                {/* Top row: category badge + difficulty */}
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${catConfig.bgClass} ${catConfig.textClass}`}>
                      {catConfig.label}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${diffConfig.dotClass}`} />
                      {diffConfig.label}
                    </span>
                  </div>

                  {/* Title + Description */}
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {template.name}
                  </h3>
                  <p className="text-xs leading-relaxed text-neutral-500 mb-4">
                    {template.description}
                  </p>

                  {/* Node count visualization */}
                  <div className="flex items-center gap-1 mb-4">
                    {template.nodes.map((node, ni) => (
                      <div key={ni} className="flex items-center gap-1">
                        <div
                          className={`h-1.5 w-6 rounded-full opacity-60 ${
                            node.executionMode === "parallel"
                              ? "bg-cyan-500"
                              : node.executionMode === "conditional"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        />
                        {ni < template.nodes.length - 1 && (
                          <div className="h-px w-1.5 bg-neutral-700" />
                        )}
                      </div>
                    ))}
                    <span className="ml-2 text-[10px] text-neutral-500">
                      {template.nodes.length} agents
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 text-[10px] text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {template.estimatedTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3" /> {template.installs.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() =>
                    router.push(`/dashboard/workflow-builder?template=${template.id}`)
                  }
                  className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 py-2.5 text-xs font-semibold text-emerald-400 transition-all duration-200 hover:bg-emerald-500/20 active:scale-[0.98] group-hover:bg-emerald-500 group-hover:text-black group-hover:border-emerald-500"
                >
                  Use Template <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Empty state */}
      {visible.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <Search className="w-10 h-10 text-neutral-500 mb-3" />
          <p className="text-sm text-neutral-500">No templates match your search</p>
          <button
            onClick={() => { setSearchQuery(""); setFilter("all"); }}
            className="mt-3 text-xs text-emerald-400 hover:underline"
          >
            Clear filters
          </button>
        </motion.div>
      )}
    </div>
  );
}
