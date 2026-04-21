"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * AgentDrawer — right-side panel shown when a constellation node is clicked.
 *
 * Fetches /api/catalog/[slug] on open (not on hover — tapping the graph
 * shouldn't trigger 137 preflight fetches). ESC closes. Click outside
 * closes. Keyboard focus trapped inside the drawer while open.
 */

export interface DrawerAgent {
  slug: string;
  displayName: string;
  tagline: string | null;
  description: string | null;
  category: string;
  heroColor: string | null;
  creatorHandle: string | null;
  pricingCents: number;
  tags: string[];
  featured: boolean;
  verified: boolean;
  runs30d: number;
  successRate: number;
  avgDurationMs: number | null;
  avgRating: number | null;
  reviewCount: number;
}

interface Props {
  slug: string | null;
  onClose: () => void;
}

export function AgentDrawer({ slug, onClose }: Props) {
  const [agent, setAgent] = useState<DrawerAgent | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch when slug changes (null = closed).
  useEffect(() => {
    if (!slug) {
      setAgent(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/catalog/${slug}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setAgent(data.agent);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ESC to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (slug) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slug, onClose]);

  async function handleInstall() {
    if (!agent) return;
    setInstalling(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalog/${agent.slug}/install`, { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/signup?next=/world";
        return;
      }
      if (res.status === 402) {
        const body = await res.json();
        window.location.href = body.topUpUrl ?? "/dashboard/billing?topup=true";
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInstalled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setInstalling(false);
    }
  }

  return (
    <AnimatePresence>
      {slug && (
        <>
          {/* Scrim — click to close */}
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-label="Close drawer"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            role="dialog"
            aria-label={agent ? `${agent.displayName} details` : "Agent details"}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[480px] bg-[#0A0807] border-l border-white/[0.08] overflow-y-auto custom-scrollbar"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 h-14 border-b border-white/[0.06] bg-[#0A0807]/90 backdrop-blur-xl">
              <span className="font-mono text-[10px] text-neutral-500 tracking-[0.22em] uppercase">
                {agent?.category ?? "agent"}
              </span>
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-white transition-colors p-1 -mr-1"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-6">
              {loading && (
                <div className="flex items-center gap-2 text-[12px] font-mono text-neutral-500">
                  <span className="inline-block h-1.5 w-1.5 bg-[#B5532C] rounded-full animate-pulse" />
                  Loading…
                </div>
              )}

              {error && !loading && (
                <div className="text-[13px] text-red-400 font-mono">
                  {error}
                </div>
              )}

              {agent && !loading && (
                <>
                  <div className="flex items-start gap-3 mb-5">
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center"
                      style={{
                        background: `${agent.heroColor ?? "#B5532C"}20`,
                        borderColor: `${agent.heroColor ?? "#B5532C"}55`,
                      }}
                    >
                      <span className="font-mono text-[11px] text-[#B5532C]">
                        {agent.displayName.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-serif text-2xl leading-tight tracking-tight text-white">
                        {agent.displayName}
                      </h2>
                      {agent.tagline && (
                        <p className="text-[13px] text-neutral-400 mt-1 leading-snug">{agent.tagline}</p>
                      )}
                    </div>
                  </div>

                  {agent.verified && (
                    <div className="inline-flex items-center gap-1.5 mb-5 px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono text-emerald-400 uppercase tracking-wide">
                      <span>◆</span> Verified
                    </div>
                  )}

                  {agent.description && (
                    <p className="text-[14px] text-neutral-300 leading-[1.65] mb-6">
                      {agent.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2 mb-6 p-3 rounded-[6px] border border-white/[0.06] bg-white/[0.02]">
                    <Stat label="Runs" value={fmtRuns(agent.runs30d)} sub="30d" />
                    <Stat label="Success" value={`${Math.round(agent.successRate * 100)}%`} />
                    <Stat label="Avg" value={fmtDuration(agent.avgDurationMs)} />
                    <Stat
                      label="Rating"
                      value={agent.avgRating != null ? agent.avgRating.toFixed(1) : "—"}
                      sub={agent.reviewCount > 0 ? `${agent.reviewCount} reviews` : undefined}
                    />
                  </div>

                  {/* Tags */}
                  {agent.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {agent.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-[3px] border border-white/[0.08] text-[10px] font-mono text-neutral-500 tracking-wide"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Pricing + install */}
                  <div className="p-4 rounded-[6px] border border-white/[0.08] bg-white/[0.015] mb-4">
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="font-mono text-[10px] text-neutral-500 tracking-[0.18em] uppercase">
                        {agent.pricingCents === 0 ? "Free" : "Per run"}
                      </span>
                      <span className="font-serif text-xl text-white">
                        {agent.pricingCents === 0 ? "$0" : `$${(agent.pricingCents / 100).toFixed(2)}`}
                      </span>
                    </div>

                    <button
                      onClick={handleInstall}
                      disabled={installing || installed}
                      className="w-full py-2.5 bg-[#B5532C] text-white font-medium text-[13px] tracking-tight rounded-[3px] hover:bg-[#C96234] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {installed ? "Installed ✓" : installing ? "Installing…" : "Install"}
                    </button>
                  </div>

                  {agent.creatorHandle && (
                    <p className="text-[11px] font-mono text-neutral-600 mb-5">
                      by <span className="text-neutral-400">{agent.creatorHandle}</span>
                    </p>
                  )}

                  <Link
                    href={`/agents/${agent.slug}`}
                    className="inline-flex items-center gap-1.5 text-[12px] font-mono text-[#B5532C] hover:text-white transition-colors tracking-tight"
                  >
                    Full page →
                  </Link>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="font-serif text-[17px] text-white leading-none">{value}</p>
      <p className="mt-1 text-[9px] font-mono text-neutral-500 tracking-[0.15em] uppercase">{label}</p>
      {sub && <p className="text-[9px] font-mono text-neutral-600">{sub}</p>}
    </div>
  );
}

function fmtRuns(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}
