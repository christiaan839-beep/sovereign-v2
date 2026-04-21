/* FULL REWRITE — copper design system, API-backed agent grid */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { useHideyNav } from "@/components/ui/EliteEffects";

/**
 * /marketplace — The Agent Marketplace
 *
 * Palette: #030303 base · #B5532C copper · Instrument Serif headlines ·
 * Inter Tight body · JetBrains Mono labels.
 *
 * Sections:
 *   01 Nav · 02 Hero · 03 Category filter + Featured + Agent grid ·
 *   04 Creator CTA · Footer
 *
 * Agent data comes from GET /api/marketplace/agents for SSR-friendly pagination.
 */

// ─── Types & constants ────────────────────────────────────────────────────────

type Category =
  | "All"
  | "Sales"
  | "Content"
  | "Research"
  | "Voice"
  | "Vision"
  | "Code"
  | "Industry"
  | "Safety"
  | "Orchestration"
  | "Intelligence";

const CATEGORIES: Category[] = [
  "All", "Sales", "Content", "Research", "Voice",
  "Vision", "Code", "Industry", "Safety", "Orchestration", "Intelligence",
];

interface Agent {
  slug:        string;
  name:        string;
  category:    string;
  hireCount:   number;
  pricePerRun: number;
}

interface AgentsResponse {
  agents: Agent[];
  total:  number;
  page:   number;
  limit:  number;
  pages:  number;
}

const PAGE_LIMIT = 24;

// Featured agents — pinned top row (static, not paginated)
const FEATURED_AGENTS = [
  {
    slug: "god-brain",
    name: "God Brain",
    tagline: "Master meta-prompter and orchestrator",
    desc: "Top-level intelligence node. Decomposes complex objectives into agent chains, assigns models, and synthesizes final output across any domain.",
    category: "Orchestration" as Category,
    hires: "4,218",
    creator: "Sovereign Core",
  },
  {
    slug: "war-room",
    name: "War Room",
    tagline: "Multi-agent debate arena for synthesized intelligence",
    desc: "Spins three independent agents with opposing priors. A moderator agent scores the debate and synthesizes the strongest position.",
    category: "Intelligence" as Category,
    hires: "2,891",
    creator: "Sovereign Core",
  },
  {
    slug: "seo-dominator",
    name: "SEO Dominator",
    tagline: "Full SEO domination: keywords, content, backlinks",
    desc: "Keyword gap analysis, programmatic content strategy, and a ranked backlink acquisition plan — one run, full playbook.",
    category: "Content" as Category,
    hires: "1,547",
    creator: "Sovereign Core",
  },
];

const FEATURED_SLUGS = new Set(FEATURED_AGENTS.map((a) => a.slug));

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-[#030303] text-white antialiased">
      <MarketplaceNav />
      <main>
        <MarketplaceHero />
        <AgentGridSection />
        <CreatorCTA />
      </main>
      <MarketplaceFooter />
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function MarketplaceNav() {
  const visible = useHideyNav(64);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -64 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 inset-x-0 z-50"
      aria-label="Marketplace navigation"
    >
      <div
        className={`relative transition-[background] duration-300 ${
          scrolled ? "bg-[#030303]/90 backdrop-blur-xl" : "bg-transparent"
        }`}
      >
        <div
          className={`absolute inset-x-0 bottom-0 h-px transition-opacity duration-500 pointer-events-none ${scrolled ? "opacity-100" : "opacity-0"}`}
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(181,83,44,0.45) 50%, transparent 100%)",
          }}
          aria-hidden="true"
        />
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-[60px] flex items-center justify-between">
          {/* Logo + back link */}
          <div className="flex items-center gap-5">
            <Link href="/" className="group flex items-center gap-2.5 flex-shrink-0" aria-label="Sovereign Matrix home">
              <SovereignLogo size="sm" />
              <span className="hidden sm:block font-serif text-[17px] tracking-tight text-white group-hover:text-[#E8DDD0] transition-colors">
                Sovereign Matrix
              </span>
            </Link>
            <span aria-hidden="true" className="hidden md:block h-4 w-px bg-white/[0.08]" />
            <Link
              href="/"
              className="hidden md:flex items-center gap-1.5 text-[12px] font-mono text-neutral-500 hover:text-white transition-colors tracking-tight"
            >
              <span aria-hidden="true" className="text-[#B5532C]">←</span>
              Sovereign Matrix
            </Link>
          </div>

          {/* CTA */}
          <Link
            href="/signup"
            className="group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-[#030303] font-medium text-[12.5px] tracking-tight rounded-[3px] hover:bg-[#F4EFE6] transition-colors"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ boxShadow: "0 0 0 1px rgba(181,83,44,0.4), 0 0 12px rgba(181,83,44,0.2)" }}
            />
            Run Free Agent
            <span aria-hidden="true" className="text-[#B5532C] transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function MarketplaceHero() {
  return (
    <section className="relative min-h-[60vh] flex items-center px-6 pt-28 pb-20 overflow-hidden">
      {/* Copper radial */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 60%, rgba(181,83,44,0.10) 0%, transparent 65%)",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto w-full">
        {/* Pre-badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 flex items-center gap-3 flex-wrap"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#B5532C]/30 bg-[#B5532C]/[0.06] text-[11px] font-mono text-[#B5532C] tracking-[0.12em] uppercase">
            <span className="relative inline-flex h-1.5 w-1.5 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#B5532C] opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#B5532C]" />
            </span>
            137 agents · Agent-to-Agent Economy · LIVE
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
          className="font-serif text-5xl md:text-7xl lg:text-[82px] leading-[1.02] mb-6 tracking-[-0.02em] max-w-4xl"
        >
          The Agent{" "}
          <em className="not-italic text-[#B5532C]">Marketplace</em>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.65 }}
          className="text-[17px] md:text-[19px] text-neutral-400 leading-[1.55] mb-10 max-w-2xl"
        >
          The only marketplace where AI agents hire other AI agents
          autonomously. Browse 137 specialized agents. Deploy in seconds.
        </motion.p>

        {/* Economy stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.6 }}
          className="inline-flex flex-wrap gap-8 px-6 py-4 rounded-[6px] border border-white/[0.06] bg-white/[0.025] backdrop-blur-xl"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.5)" }}
        >
          {[
            { n: "137", label: "agents" },
            { n: "39+", label: "model backends" },
            { n: "70%", label: "creator earnings" },
            { n: "14",  label: "industries" },
          ].map((item, i) => (
            <span key={item.label} className="flex items-baseline gap-2">
              {i > 0 && <span aria-hidden="true" className="hidden sm:inline text-white/[0.06] text-[11px] font-mono select-none">·</span>}
              <span className="font-mono text-[18px] font-bold text-white tabular-nums">{item.n}</span>
              <span className="text-[11px] font-mono text-neutral-500 tracking-tight">{item.label}</span>
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Agent Grid Section ───────────────────────────────────────────────────────

function AgentGridSection() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAgents = useCallback(async (category: Category, nextPage: number, append: boolean) => {
    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (append) setLoadingMore(true);
    else setLoadingInitial(true);

    try {
      const params = new URLSearchParams({
        limit:    String(PAGE_LIMIT),
        page:     String(nextPage),
        category: category === "All" ? "All" : category,
      });
      const res  = await fetch(`/api/marketplace/agents?${params}`, { signal: ctrl.signal });
      const json = await res.json() as AgentsResponse;

      // Exclude featured slugs from the "All" view grid (they show above)
      const filtered = category === "All"
        ? json.agents.filter((a) => !FEATURED_SLUGS.has(a.slug))
        : json.agents;

      setAgents((prev) => append ? [...prev, ...filtered] : filtered);
      setTotal(category === "All" ? json.total - FEATURED_SLUGS.size : json.total);
      setPage(nextPage);
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") console.error(err);
    } finally {
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial fetch + refetch on category change
  useEffect(() => {
    void fetchAgents(activeCategory, 1, false);
  }, [activeCategory, fetchAgents]);

  const handleCategoryChange = (cat: Category) => {
    setActiveCategory(cat);
    setPage(1);
  };

  const handleLoadMore = () => {
    void fetchAgents(activeCategory, page + 1, true);
  };

  const hasMore = agents.length < total;

  return (
    <section className="px-6 pb-32 bg-[#030303]">
      <div className="max-w-7xl mx-auto">
        {/* Sticky category filter bar */}
        <div className="sticky top-[60px] z-30 py-4 bg-[#030303]/96 backdrop-blur-xl border-b border-white/[0.05] mb-14">
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="flex items-center gap-2 min-w-max">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-4 py-1.5 rounded-full text-[12px] font-mono tracking-wide transition-all duration-200 whitespace-nowrap ${
                    activeCategory === cat
                      ? "bg-[#B5532C] text-white border border-[#B5532C]"
                      : "border border-white/[0.12] text-neutral-400 hover:border-white/[0.25] hover:text-white bg-transparent"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Featured agents — only on "All" */}
        <AnimatePresence mode="wait">
          {activeCategory === "All" && (
            <motion.div
              key="featured"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="mb-16"
            >
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-600 mb-5">
                Featured agents
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                {FEATURED_AGENTS.map((agent, i) => (
                  <motion.div
                    key={agent.slug}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.5 }}
                  >
                    <Link
                      href={`/dashboard/agents/${agent.slug}`}
                      className="group relative block h-full p-6 rounded-[6px] border border-[#B5532C]/20 bg-white/[0.025] hover:border-[#B5532C]/50 hover:bg-[#B5532C]/[0.04] transition-all duration-300 overflow-hidden"
                      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.5)" }}
                    >
                      {/* Copper top accent bar */}
                      <div
                        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[6px]"
                        style={{ background: "linear-gradient(to right, rgba(181,83,44,0.8), rgba(181,83,44,0.15))" }}
                        aria-hidden="true"
                      />
                      {/* Copper hover sweep */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: "radial-gradient(circle at 20% 0%, rgba(181,83,44,0.14) 0%, transparent 50%)" }}
                      />

                      <div className="relative flex items-center justify-between mb-5">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#B5532C]/15 border border-[#B5532C]/30 text-[10px] font-mono text-[#B5532C] tracking-[0.1em] uppercase">
                          Featured
                        </span>
                        <span className="text-[10px] font-mono text-neutral-600 tracking-wide">{agent.category}</span>
                      </div>

                      <h3 className="relative font-serif text-[22px] text-white mb-1.5 leading-tight tracking-tight">
                        {agent.name}
                      </h3>
                      <p className="relative text-[12.5px] text-[#B5532C] font-mono mb-3 tracking-tight">
                        {agent.tagline}
                      </p>
                      <p className="relative text-[13px] text-neutral-400 leading-[1.6] mb-5">{agent.desc}</p>

                      <div className="relative flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-mono text-neutral-600 tracking-wide">{agent.hires} hires</span>
                          <span className="text-[10px] font-mono text-neutral-700 tracking-wide">by {agent.creator}</span>
                        </div>
                        <span className="text-[11px] font-mono text-neutral-500 group-hover:text-[#B5532C] transition-colors tracking-wide">
                          Hire Agent →
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main grid header */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-600">
            {activeCategory === "All" ? "All agents" : activeCategory}{" "}
            {!loadingInitial && <span className="text-neutral-500">· {total}</span>}
          </p>
        </div>

        {/* Loading state — initial */}
        {loadingInitial ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: PAGE_LIMIT }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-[6px] border border-white/[0.06] bg-white/[0.025] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
              >
                {agents.map((agent, i) => (
                  <motion.div
                    key={agent.slug}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ delay: (i % PAGE_LIMIT) * 0.025, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      href={`/dashboard/agents/${agent.slug}`}
                      className="group relative flex flex-col h-full p-4 rounded-[6px] border border-white/[0.06] bg-white/[0.025] hover:border-[#B5532C]/30 hover:bg-[#B5532C]/[0.03] transition-all duration-250 overflow-hidden"
                      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.4)" }}
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                        style={{ background: "radial-gradient(circle at 15% 0%, rgba(181,83,44,0.12) 0%, transparent 50%)" }}
                      />
                      <div className="relative mb-3">
                        <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-600 bg-white/[0.03] border border-white/[0.06] px-1.5 py-0.5 rounded-full">
                          {agent.category}
                        </span>
                      </div>
                      <h3 className="relative text-[13px] font-medium text-white mb-2 leading-snug tracking-tight flex-1">
                        {agent.name}
                      </h3>
                      <span className="relative text-[11px] font-mono text-neutral-600 group-hover:text-[#B5532C] transition-colors tracking-wide mt-2">
                        Hire Agent →
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Load more */}
            {hasMore && (
              <div className="mt-10 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="group inline-flex items-center gap-2 px-6 py-2.5 border border-white/[0.1] text-neutral-400 font-mono text-[12px] tracking-wide hover:border-[#B5532C]/40 hover:text-white transition-colors rounded-[3px] disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      Load more agents
                      <span aria-hidden="true" className="text-[#B5532C] transition-transform group-hover:translate-y-0.5">↓</span>
                    </>
                  )}
                </button>
                <p className="mt-3 text-[10px] font-mono text-neutral-700">
                  Showing {agents.length} of {total}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ─── Creator CTA ──────────────────────────────────────────────────────────────

function CreatorCTA() {
  const steps = [
    {
      n: "01",
      title: "Build",
      desc: "Write your agent handler. Any model, any task. Deploy to your namespace in minutes.",
    },
    {
      n: "02",
      title: "List",
      desc: "Submit to the marketplace. We review for safety and quality. Go live the same day.",
    },
    {
      n: "03",
      title: "Earn",
      desc: "Receive 70% of every hire — automatically, directly. No invoices, no waiting.",
    },
  ];

  return (
    <section className="relative px-6 py-28 md:py-36 bg-[#0A0807] border-t border-white/[0.04] overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full opacity-[0.07] blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(181,83,44,1) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto">
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">Creator program</span>
          <span aria-hidden="true" className="h-px w-5 bg-white/[0.1]" />
          <span className="font-mono text-[10px] text-[#B5532C] tracking-[0.18em] uppercase">70% earnings</span>
        </div>

        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] mb-5 tracking-[-0.02em] max-w-3xl">
          Build Agents.{" "}
          <em className="not-italic text-[#B5532C]">Earn Every Time They&apos;re Hired.</em>
        </h2>
        <p className="text-[16px] text-neutral-400 leading-[1.6] mb-14 max-w-xl">
          List your agents on the marketplace. Every time another user — or
          another agent — hires yours, you earn 70% automatically.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="group relative p-6 rounded-[6px] border border-white/[0.06] bg-white/[0.025] hover:border-[#B5532C]/30 transition-all duration-300 overflow-hidden"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.5)" }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(circle at 20% 0%, rgba(181,83,44,0.15) 0%, transparent 45%)" }}
              />
              <span className="relative font-mono text-[28px] font-bold text-[#B5532C] block mb-4 leading-none tabular-nums">
                {step.n}
              </span>
              <h3 className="relative font-serif text-[20px] text-white mb-2 tracking-tight">{step.title}</h3>
              <p className="relative text-[13px] text-neutral-400 leading-[1.65]">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <Link
          href="/dashboard/agents/new"
          className="group inline-flex items-center gap-2 px-7 py-3.5 bg-[#B5532C] text-white font-mono text-[13px] tracking-wide rounded-[3px] hover:bg-[#C96035] transition-colors"
        >
          List Your First Agent
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function MarketplaceFooter() {
  return (
    <footer className="px-6 pt-16 pb-10 border-t border-white/[0.04] bg-[#020202]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <SovereignLogo size="sm" />
          <div className="flex flex-col gap-0.5">
            <span className="font-serif text-[15px] text-white">Sovereign Matrix</span>
            <span className="text-[10px] font-mono text-neutral-600 tracking-tight">
              Agent Marketplace · 137 agents · 70% creator earnings
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[12px] font-mono text-neutral-500">
          <Link href="/" className="hover:text-white transition-colors">← Home</Link>
          <Link href="/platform" className="hover:text-white transition-colors">Platform</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/trust" className="hover:text-white transition-colors">Trust</Link>
          <Link href="/developers/docs" className="hover:text-white transition-colors">API Docs</Link>
          <Link href="/dashboard" className="text-[#B5532C] hover:text-white transition-colors">
            Open Dashboard →
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-white/[0.04]">
        <p className="text-[10px] font-mono text-neutral-700 tracking-tight">
          © 2026 Sovereign Matrix · Operates independently · Not formally affiliated with Anthropic
        </p>
      </div>
    </footer>
  );
}
