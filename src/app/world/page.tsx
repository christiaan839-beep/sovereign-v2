"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Constellation, type ConstellationAgent } from "@/components/world/Constellation";
import { FilterRail } from "@/components/world/FilterRail";
import { AgentDrawer } from "@/components/world/AgentDrawer";

/**
 * /world — the constellation. All 137 agents as clickable nodes, filtered
 * by category and search, with a right-side drawer for details.
 *
 * Data path:
 *   GET /api/catalog on mount (edge-cached 60s) → seed Constellation.
 *   Filter+search are applied client-side so switching categories doesn't
 *   refetch (catalog is small: 137 rows × ~400 bytes ≈ 55KB gzipped).
 *
 * Keyboard:
 *   /   → focus search
 *   Esc → close drawer (handled inside AgentDrawer)
 */

interface CatalogResponse {
  agents: ConstellationAgent[];
  counts: Record<string, number>;
  total: number;
}

export default function WorldPage() {
  const [agents, setAgents] = useState<ConstellationAgent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/catalog");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: CatalogResponse = await res.json();
        if (!cancelled) {
          setAgents(data.agents);
          setCounts(data.counts);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Slash keybinding → focus search (convention from GitHub / Linear)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      e.preventDefault();
      document.getElementById("world-search")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((a) => {
      if (category && a.category !== category) return false;
      if (!q) return true;
      return (
        a.slug.toLowerCase().includes(q) ||
        a.displayName.toLowerCase().includes(q)
      );
    });
  }, [agents, category, search]);

  const hoveredAgent = hoveredSlug ? agents.find((a) => a.slug === hoveredSlug) : null;

  return (
    <div className="min-h-screen bg-[#030303] text-white antialiased relative overflow-hidden">
      {/* Ambient background gradient — keeps the canvas from looking flat */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(181,83,44,0.045) 0%, transparent 70%)",
        }}
      />

      <FilterRail
        categoryCounts={counts}
        category={category}
        onCategoryChange={setCategory}
        search={search}
        onSearchChange={setSearch}
        totalAgents={agents.length}
        filteredCount={visible.length}
      />

      {/* Constellation fills everything to the right of the rail */}
      <main className="ml-[240px] relative min-h-screen">
        <div className="absolute inset-0">
          <Constellation
            agents={visible}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
            onHover={setHoveredSlug}
          />
        </div>

        {/* Top-right meta strip */}
        <div className="absolute top-5 right-6 z-20 flex items-center gap-4">
          <Link
            href="/"
            className="text-[12px] font-mono text-neutral-500 hover:text-white transition-colors tracking-tight"
          >
            ← Home
          </Link>
          <Link
            href="/leaderboard"
            className="text-[12px] font-mono text-neutral-500 hover:text-[#B5532C] transition-colors tracking-tight"
          >
            Leaderboard →
          </Link>
        </div>

        {/* Hover tooltip — lightweight, doesn't fetch */}
        {hoveredAgent && !selectedSlug && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="px-4 py-2 rounded-[4px] border border-white/[0.08] bg-[#0A0807]/90 backdrop-blur-xl">
              <p className="font-serif text-[15px] text-white leading-tight">
                {hoveredAgent.displayName}
              </p>
              <p className="text-[10px] font-mono text-neutral-500 tracking-wide capitalize">
                {hoveredAgent.category} · {hoveredAgent.runs30d.toLocaleString()} runs (30d)
              </p>
            </div>
          </div>
        )}

        {/* Loading / empty states */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="font-mono text-[12px] text-neutral-600 tracking-wider">Loading constellation…</p>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-[12px] text-red-400">Failed to load: {error}</p>
          </div>
        )}
        {!loading && !error && agents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-[12px] text-neutral-600">No agents yet</p>
          </div>
        )}
      </main>

      <AgentDrawer slug={selectedSlug} onClose={() => setSelectedSlug(null)} />
    </div>
  );
}
