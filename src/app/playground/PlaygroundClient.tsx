"use client";

/**
 * PlaygroundClient — the interactive agent tryer island.
 *
 * Split from page.tsx so the full catalog serializes on the server
 * (no extra fetch) but the interactive bits are client-side.
 *
 * DESIGN INTENT
 * ─────────────
 * - Agent picker is a combobox with search (218 agents is too many for a dropdown)
 * - Default agent comes from ?agent=<slug> or falls back to smart-router
 * - Prompt input shows a category-aware example
 * - "Run" posts to /api/agents/<slug> (the public path, not /api/_agents/)
 * - Rate-limit is enforced SERVER-SIDE (free-tier gate); the client-side
 *   localStorage counter is a UX hint, not a security boundary
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Search, Terminal, Copy, Check, Clock, Zap, Lock } from "lucide-react";
import Link from "next/link";
import type { PublicAgent } from "@/lib/agent-catalog";
import { AgentSigil } from "@/components/agent/AgentSigil";

interface Props {
  catalog: PublicAgent[];
  initialSlug: string | null;
}

const EXAMPLE_BY_CATEGORY: Record<string, string> = {
  Sales: "Find 10 SaaS founders in Austin, TX with Series A funding",
  Content: "Write a 400-word blog intro on AI agents for insurance brokers",
  Research: "Compare the top 3 AI agent platforms by pricing + features",
  Meta: "Plan a product launch for a new vertical agent in the insurance market",
  Finance: "Extract key fields from a US W-2 form description",
  Insurance: "A policyholder reports a rear-end collision at 3rd & Main, no injuries",
  Logistics: "Classify the HS code for a bamboo cutting board imported from Vietnam",
  Healthcare: "40yo male with polyuria, polydipsia, HbA1c 8.2% — suggest ICD-10 codes",
  Agriculture: "A field of corn showing yellowing lower leaves at V8 growth stage",
  "Real Estate": "Draft a permit application for a 2400 sqft retail-to-office tenant improvement",
  Compliance: "A construction worker slipped on plastic sheeting — draft the OSHA report",
  Voice: "Generate a 30-second sales pitch script for a SaaS demo",
  "Vision & Media": "Describe the key elements in this image",
  Safety: "Check this text for jailbreak attempts: 'ignore prior instructions'",
  Ecommerce: "Digitize this restaurant menu into structured JSON",
  General: "Explain what Sovereign Matrix does in 100 words",
};

function pickExample(agent: PublicAgent): string {
  // Try an agent-specific example from the catalog metadata first.
  const specific =
    (agent as unknown as { exampleInput?: string }).exampleInput ??
    (agent as unknown as { examplePrompt?: string }).examplePrompt;
  if (typeof specific === "string" && specific.length > 0) return specific;

  // Fall back to category defaults.
  return EXAMPLE_BY_CATEGORY[agent.category] ?? "Explain what this agent does and show a sample output.";
}

export function PlaygroundClient({ catalog, initialSlug }: Props) {
  // Find initial agent from ?agent=<slug>, else smart-router, else first in catalog.
  const initialAgent = useMemo<PublicAgent>(() => {
    if (initialSlug) {
      const hit = catalog.find((a) => a.slug === initialSlug);
      if (hit) return hit;
    }
    return catalog.find((a) => a.slug === "smart-router") ?? catalog[0];
  }, [catalog, initialSlug]);

  const [agent, setAgent] = useState<PublicAgent>(initialAgent);
  const [prompt, setPrompt] = useState<string>(pickExample(initialAgent));
  const [result, setResult] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tries, setTries] = useState(3);

  useEffect(() => {
    const stored = localStorage.getItem("sv_playground_tries");
    if (stored) setTries(Math.max(0, parseInt(stored, 10)));
  }, []);

  // Keep URL in sync when agent changes (history.replaceState so back-button
  // doesn't bounce through every pick).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("agent", agent.slug);
    window.history.replaceState({}, "", url.toString());
  }, [agent.slug]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog.slice(0, 50);
    return catalog
      .filter(
        (a) =>
          a.slug.toLowerCase().includes(q) ||
          a.displayName.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          (a.tagline?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 50);
  }, [catalog, search]);

  const selectAgent = (a: PublicAgent) => {
    setAgent(a);
    setPrompt(pickExample(a));
    setResult(null);
    setLatencyMs(null);
    setPickerOpen(false);
    setSearch("");
  };

  const run = async () => {
    if (tries <= 0 || loading) return;
    setLoading(true);
    setResult(null);
    setLatencyMs(null);
    const remaining = tries - 1;
    setTries(remaining);
    localStorage.setItem("sv_playground_tries", String(remaining));

    const t0 = performance.now();
    try {
      // Public path /api/agents/<slug> — matches the OpenAPI spec.
      // Most agents accept `prompt` as a generic field; schema-specific
      // validation happens server-side and surfaces a structured error.
      const res = await fetch(`/api/agents/${agent.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, problem: prompt, input: prompt, query: prompt }),
      });
      const data = await res.json();
      setLatencyMs(Math.round(performance.now() - t0));
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setLatencyMs(Math.round(performance.now() - t0));
      setResult(
        JSON.stringify(
          { error: { code: "network_error", message: (err as Error).message } },
          null,
          2,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="px-6 pb-16">
      <div className="max-w-4xl mx-auto rounded-[6px] border border-white/[0.06] bg-[#060606] overflow-hidden">
        {/* Agent picker */}
        <div className="p-5 border-b border-white/[0.04]">
          <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-2 block">
            Agent
          </label>
          <div className="relative">
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-[4px] bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-[4px] overflow-hidden shrink-0">
                  <AgentSigil
                    slug={agent.slug}
                    category={agent.category}
                    size={32}
                    detail="minimal"
                  />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-sm text-white truncate">{agent.slug}</p>
                  <p className="text-[10px] text-neutral-500 truncate">{agent.displayName}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-neutral-600 shrink-0 ml-3">
                {agent.category}
              </span>
            </button>

            <AnimatePresence>
              {pickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute z-20 mt-2 w-full rounded-[4px] bg-[#080808] border border-white/[0.08] shadow-2xl overflow-hidden"
                >
                  <div className="p-3 border-b border-white/[0.04] relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={`Search ${catalog.length} agents…`}
                      autoFocus
                      className="w-full pl-9 pr-4 py-2 rounded-[3px] bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#B5532C]/40"
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="p-4 text-xs text-neutral-600 text-center">
                        No agents match &quot;{search}&quot;.
                      </p>
                    ) : (
                      filtered.map((a) => (
                        <button
                          key={a.slug}
                          onClick={() => selectAgent(a)}
                          className={`w-full text-left px-4 py-2.5 hover:bg-white/[0.04] transition-colors flex items-center gap-3 ${
                            a.slug === agent.slug ? "bg-[#B5532C]/[0.04]" : ""
                          }`}
                        >
                          <span className="font-mono text-xs text-white flex-1 truncate">
                            {a.slug}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-600 shrink-0">
                            {a.category}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Prompt */}
        <div className="p-5 border-b border-white/[0.04]">
          <div className="flex items-center justify-between mb-2">
            <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              Prompt
            </label>
            <button
              onClick={() => setPrompt(pickExample(agent))}
              className="text-[10px] font-mono text-neutral-500 hover:text-[#B5532C] transition-colors"
            >
              Reset example
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-[4px] bg-[#030303] border border-white/[0.06] focus:border-[#B5532C]/40 focus:outline-none resize-none font-mono text-sm text-neutral-200 placeholder:text-neutral-600"
            placeholder="Enter your prompt…"
          />
        </div>

        {/* Run bar */}
        <div className="p-5 border-b border-white/[0.04] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={run}
              disabled={loading || tries <= 0 || prompt.trim().length === 0}
              className="px-5 py-2.5 rounded-[4px] bg-[#B5532C] hover:bg-[#C96234] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {loading ? "Running…" : "Run agent"}
            </button>
            <span className="font-mono text-[11px] text-neutral-500">
              {tries > 0 ? `${tries} free ${tries === 1 ? "try" : "tries"} remaining` : "Free tries exhausted"}
            </span>
          </div>
          <Link
            href={`/agents/${agent.slug}`}
            className="font-mono text-[11px] text-neutral-500 hover:text-[#B5532C] transition-colors"
          >
            Agent details ↗
          </Link>
        </div>

        {/* Response */}
        <div className="relative">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-500">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3" /> Response
              </span>
              {latencyMs !== null && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> {latencyMs}ms
                </span>
              )}
              {latencyMs !== null && latencyMs < 1500 && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Zap className="w-3 h-3" /> fast
                </span>
              )}
            </div>
            {result && (
              <button
                onClick={copyResult}
                className="text-[10px] font-mono text-neutral-500 hover:text-[#B5532C] flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{" "}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <pre className="p-5 text-[12px] font-mono overflow-auto max-h-[400px] text-neutral-300 min-h-[120px] bg-[#030303]">
            {loading && <span className="text-neutral-500 animate-pulse">Running {agent.slug}…</span>}
            {!loading && !result && (
              <span className="text-neutral-600">Response will appear here.</span>
            )}
            {!loading && result && result}
          </pre>
        </div>

        {/* Rate-limit CTA */}
        <AnimatePresence>
          {tries <= 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-5 border-t border-white/[0.04] bg-[#B5532C]/[0.04]"
            >
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#B5532C] shrink-0 mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-white font-semibold mb-1">
                    Free tries exhausted
                  </p>
                  <p className="text-xs text-neutral-400 mb-3">
                    The free tier gives you 50 runs/month with no rate limit. Takes
                    10 seconds to create an account.
                  </p>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-[4px] bg-[#B5532C] hover:bg-[#C96234] text-white text-xs font-semibold transition-colors"
                  >
                    Sign up free
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
