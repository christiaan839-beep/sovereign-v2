"use client";

import { motion } from "framer-motion";

/**
 * FilterRail — left-side filter panel for /world.
 *
 * Categories are derived from the `counts` payload in /api/catalog (stable
 * across the session — categories don't churn). Selected category is a
 * single string, not a set, because the constellation reads cleaner with
 * one-at-a-time filtering than OR-combinations.
 *
 * Search is a debounced controlled input; parent owns the value and
 * applies substring match against displayName/slug client-side.
 */

interface Props {
  categoryCounts: Record<string, number>;
  category: string | null;
  onCategoryChange: (c: string | null) => void;
  search: string;
  onSearchChange: (s: string) => void;
  totalAgents: number;
  filteredCount: number;
}

export function FilterRail({
  categoryCounts,
  category,
  onCategoryChange,
  search,
  onSearchChange,
  totalAgents,
  filteredCount,
}: Props) {
  const cats = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  return (
    <motion.aside
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 bottom-0 z-30 w-[240px] bg-[#030303]/85 backdrop-blur-xl border-r border-white/[0.05] overflow-y-auto custom-scrollbar"
    >
      <div className="px-5 py-6">
        <div className="mb-5">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-1">
            World
          </p>
          <h1 className="font-serif text-xl text-white leading-tight">
            {totalAgents} agents
          </h1>
          <p className="text-[11px] font-mono text-neutral-500 mt-1">
            {filteredCount !== totalAgents
              ? `${filteredCount} visible`
              : "all visible"}
          </p>
        </div>

        {/* Search */}
        <div className="mb-5">
          <label htmlFor="world-search" className="sr-only">Search agents</label>
          <div className="relative">
            <input
              id="world-search"
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-[#B5532C]/50 rounded-[4px] px-3 py-2 text-[13px] text-white placeholder:text-neutral-600 outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-[11px]"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Category list */}
        <div>
          <p className="font-mono text-[10px] text-neutral-500 tracking-[0.18em] uppercase mb-2.5">
            Categories
          </p>

          <button
            onClick={() => onCategoryChange(null)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-[3px] text-[13px] tracking-tight transition-colors ${
              category === null
                ? "bg-[#B5532C]/10 text-[#B5532C]"
                : "text-neutral-400 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            <span>All</span>
            <span className="font-mono text-[10px] text-neutral-600">{totalAgents}</span>
          </button>

          {cats.map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-[3px] text-[13px] tracking-tight transition-colors ${
                category === cat
                  ? "bg-[#B5532C]/10 text-[#B5532C]"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              <span className="capitalize">{cat}</span>
              <span className="font-mono text-[10px] text-neutral-600">{count}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
