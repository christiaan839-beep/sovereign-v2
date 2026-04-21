"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { useHideyNav } from "@/components/ui/EliteEffects";

/**
 * /intelligence — Semantic Intelligence Engine
 *
 * Palette: #030303 base · #B5532C copper · Instrument Serif headlines ·
 * Inter Tight body · JetBrains Mono labels.
 *
 * Sections:
 *   01 Nav · 02 Hero (animated memory counter) ·
 *   03 How it works (4-step flow) · 04 Memory depth timeline ·
 *   05 Technical architecture callout · 06 CTA · Footer
 */

// ─── Animated counter hook ────────────────────────────────────────────

function useCountUp(target: number, duration = 2200): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  return (
    <div className="min-h-screen bg-[#030303] text-white antialiased">
      <IntelligenceNav />
      <main>
        <IntelligenceHero />
        <HowItWorks />
        <MemoryTimeline />
        <TechnicalArchitecture />
        <IntelligenceCTA />
      </main>
      <IntelligenceFooter />
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────

function IntelligenceNav() {
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
      aria-label="Intelligence navigation"
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

// ─── Hero ─────────────────────────────────────────────────────────────

function IntelligenceHero() {
  const [memoryTarget, setMemoryTarget] = useState(847);

  useEffect(() => {
    fetch("/api/memory/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data?.platform?.displayMemories) {
          setMemoryTarget(data.platform.displayMemories);
        }
      })
      .catch(() => {}); // keep 847 fallback
  }, []);

  const memoryCount = useCountUp(memoryTarget, 2200);

  return (
    <section className="relative min-h-[70vh] flex items-center px-6 pt-28 pb-24 overflow-hidden">
      {/* Copper radial */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 55%, rgba(181,83,44,0.10) 0%, transparent 65%)",
        }}
        aria-hidden="true"
      />
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto w-full text-center">
        {/* Pre-badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 flex items-center justify-center gap-3 flex-wrap"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#B5532C]/30 bg-[#B5532C]/[0.06] text-[11px] font-mono text-[#B5532C] tracking-[0.12em] uppercase">
            NVIDIA NIM · 1,024-dim embeddings · Compounding Intelligence
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
          className="font-serif text-5xl md:text-7xl lg:text-[86px] leading-[1.02] mb-6 tracking-[-0.02em]"
        >
          AI That{" "}
          <em className="not-italic text-[#B5532C]">Remembers</em>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.65 }}
          className="text-[17px] md:text-[19px] text-neutral-400 leading-[1.55] mb-16 max-w-2xl mx-auto"
        >
          Every agent execution is embedded, stored, and recalled.
          The more you use it, the smarter it gets — permanently.
        </motion.p>

        {/* Animated memory counter */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="inline-flex flex-col items-center"
        >
          <div
            className="font-serif tabular-nums leading-none tracking-tight"
            style={{
              fontSize: "clamp(72px, 12vw, 120px)",
              color: "#B5532C",
            }}
          >
            {memoryCount.toLocaleString()}
          </div>
          <p className="mt-3 text-[12px] font-mono text-neutral-500 tracking-[0.1em] uppercase">
            memories built across all users today
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ─── How It Works — 4 steps ───────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Run",
      desc: "An agent executes against your task. Input, context, and output are captured in full.",
      detail: "Every playbook run, every agent call",
    },
    {
      n: "02",
      title: "Embed",
      desc: "Input and output are embedded via NVIDIA NIM — 1,024-dimensional vectors encoding semantic meaning.",
      detail: "nvidia/nv-embedqa-e5-v5 · 1,024 dims",
    },
    {
      n: "03",
      title: "Store",
      desc: "Vector and metadata are persisted to your private semantic memory store, scoped to your tenant.",
      detail: "Per-user namespace · never shared",
    },
    {
      n: "04",
      title: "Recall",
      desc: "Future runs retrieve semantically similar past context automatically. No re-briefing needed.",
      detail: "Cosine similarity retrieval",
    },
  ];

  return (
    <section className="px-6 py-28 md:py-36 bg-[#040303]">
      <div className="max-w-6xl mx-auto">
        {/* Section head */}
        <div className="mb-8 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">01 / 04</span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            How it works
          </p>
        </div>

        <h2 className="font-serif text-4xl md:text-6xl lg:text-[68px] leading-[1.05] mb-5 max-w-3xl tracking-[-0.02em]">
          From Execution
          <br />
          <em className="not-italic text-[#B5532C]">to Intelligence</em>
        </h2>
        <p className="text-neutral-400 text-[15px] leading-relaxed mb-16 max-w-xl">
          Four automatic steps turn every agent run into compounding institutional knowledge.
        </p>

        {/* Steps — horizontal flow on desktop, stacked on mobile */}
        <div className="grid md:grid-cols-4 gap-4 relative">
          {/* Connector line (desktop only) */}
          <div
            className="hidden md:block absolute top-[52px] left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px"
            style={{
              background:
                "linear-gradient(to right, rgba(181,83,44,0.3) 0%, rgba(181,83,44,0.6) 50%, rgba(181,83,44,0.3) 100%)",
            }}
            aria-hidden="true"
          />

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
                style={{ background: "radial-gradient(circle at 20% 0%, rgba(181,83,44,0.14) 0%, transparent 45%)" }}
              />

              {/* Step number in copper mono */}
              <div className="relative flex items-center gap-3 mb-5">
                <span className="font-mono text-[22px] font-bold text-[#B5532C] tabular-nums leading-none">
                  {step.n}
                </span>
                {i < steps.length - 1 && (
                  <span aria-hidden="true" className="md:hidden text-[#B5532C]/30 text-[14px] font-mono ml-auto">
                    →
                  </span>
                )}
              </div>

              <h3 className="relative font-serif text-[22px] text-white mb-2 tracking-tight">{step.title}</h3>
              <p className="relative text-[13px] text-neutral-400 leading-[1.65] mb-4">{step.desc}</p>
              <p className="relative text-[10px] font-mono text-neutral-700 tracking-wide">{step.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Memory depth timeline ────────────────────────────────────────────

function MemoryTimeline() {
  const nodes = [
    {
      label: "First Run",
      runs: "1 run",
      desc: "Baseline execution. No context yet. Agents perform on instruction alone.",
      opacity: 0.35,
    },
    {
      label: "10 Runs",
      runs: "~10 runs",
      desc: "Platform knows your agent preferences and common tasks. Retrieval begins.",
      opacity: 0.55,
    },
    {
      label: "100 Runs",
      runs: "~100 runs",
      desc: "Deep industry context. Recalls relevant past work automatically. Re-briefing becomes rare.",
      opacity: 0.8,
    },
    {
      label: "1,000 Runs",
      runs: "~1,000 runs",
      desc: "Sovereign intelligence. Your agents outperform any fresh deployment — context is irreplaceable.",
      opacity: 1.0,
    },
  ];

  return (
    <section className="relative px-6 py-28 md:py-36 bg-[#030303] overflow-hidden">
      {/* Ambient copper */}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 h-[500px] w-[400px] opacity-[0.06] blur-[130px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(181,83,44,1) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Section head */}
        <div className="mb-8 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">02 / 04</span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            Compounding over time
          </p>
        </div>

        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] mb-5 tracking-[-0.02em] max-w-3xl">
          Compounding Intelligence
          <br />
          <em className="not-italic text-[#B5532C]">Over Time</em>
        </h2>
        <p className="text-neutral-400 text-[15px] leading-relaxed mb-20 max-w-xl">
          Each run contributes to your intelligence store. The compound effect is non-linear —
          and unique to your workflow.
        </p>

        {/* Timeline — horizontal desktop, vertical mobile */}
        <div className="relative">
          {/* Horizontal connector (desktop) */}
          <div
            className="hidden md:block absolute top-[28px] left-[28px] right-[28px] h-px"
            style={{
              background: `linear-gradient(to right, rgba(181,83,44,0.35) 0%, rgba(181,83,44,1.0) 100%)`,
            }}
            aria-hidden="true"
          />

          <div className="grid md:grid-cols-4 gap-10 md:gap-6">
            {nodes.map((node, i) => (
              <motion.div
                key={node.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.12, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex md:flex-col gap-5 md:gap-0"
              >
                {/* Node circle */}
                <div
                  className="relative z-10 flex-shrink-0 w-14 h-14 rounded-full border-2 flex items-center justify-center md:mb-6"
                  style={{
                    background: `rgba(181,83,44,${node.opacity * 0.08})`,
                    borderColor: `rgba(181,83,44,${node.opacity})`,
                    boxShadow: `0 0 ${node.opacity * 20}px rgba(181,83,44,${node.opacity * 0.3})`,
                  }}
                >
                  <span
                    className="font-mono text-[10px] font-bold tabular-nums"
                    style={{ color: `rgba(181,83,44,${node.opacity})` }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Vertical connector (mobile) */}
                {i < nodes.length - 1 && (
                  <div
                    className="md:hidden absolute left-7 top-14 bottom-0 w-px"
                    style={{
                      background: `linear-gradient(to bottom, rgba(181,83,44,${node.opacity}) 0%, rgba(181,83,44,${nodes[i + 1].opacity}) 100%)`,
                    }}
                    aria-hidden="true"
                  />
                )}

                <div className="flex-1 md:pt-0 pt-1">
                  {/* Label above */}
                  <p
                    className="font-mono text-[10px] tracking-[0.2em] uppercase mb-1.5"
                    style={{ color: `rgba(181,83,44,${node.opacity})` }}
                  >
                    {node.label}
                  </p>
                  <p className="text-[11px] font-mono text-neutral-700 mb-3 tracking-wide">
                    {node.runs}
                  </p>
                  {/* Description below */}
                  <p className="text-[13px] text-neutral-400 leading-[1.65]">{node.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Technical architecture ───────────────────────────────────────────

function TechnicalArchitecture() {
  const archRows = [
    { label: "Model", value: "nvidia/nv-embedqa-e5-v5" },
    { label: "Dimensions", value: "1,024 float32" },
    { label: "Similarity", value: "Cosine similarity in JS — no pgvector required" },
    { label: "Fallback", value: "Keyword BM25-style scoring when NIM unavailable" },
    { label: "Storage", value: "Per-user tenant isolation" },
  ];

  return (
    <section className="px-6 py-28 md:py-36 bg-[#0A0807]">
      <div className="max-w-6xl mx-auto">
        {/* Section head */}
        <div className="mb-8 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">03 / 04</span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            Architecture
          </p>
        </div>

        <h2 className="font-serif text-4xl md:text-5xl leading-[1.05] mb-16 tracking-[-0.02em] max-w-3xl">
          Built on NVIDIA NIM.
          <br />
          <em className="not-italic text-[#B5532C]">Private by architecture.</em>
        </h2>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Architecture details */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#B5532C] mb-6">
              Built on NVIDIA NIM
            </p>
            <div className="space-y-0 rounded-[6px] border border-white/[0.06] overflow-hidden"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(0,0,0,0.5)" }}>
              {archRows.map((row, i) => (
                <div
                  key={row.label}
                  className={`flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6 px-5 py-4 ${
                    i < archRows.length - 1 ? "border-b border-white/[0.04]" : ""
                  } bg-white/[0.015] hover:bg-white/[0.03] transition-colors`}
                >
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-600 flex-shrink-0 w-24">
                    {row.label}
                  </span>
                  <span className="text-[13px] font-mono text-neutral-300 leading-snug">{row.value}</span>
                </div>
              ))}
            </div>

            <p className="mt-6 text-[11px] font-mono text-neutral-700 leading-relaxed">
              Powered by{" "}
              <a
                href="https://build.nvidia.com/nvidia/nv-embedqa-e5-v5"
                target="_blank"
                rel="noopener"
                className="text-[#B5532C] hover:text-white transition-colors underline decoration-[#B5532C]/30"
              >
                nvidia/nv-embedqa-e5-v5
              </a>{" "}
              via NIM API · cosine similarity search in plain JavaScript · zero database extensions required
            </p>
          </motion.div>

          {/* Privacy guarantee */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="relative p-8 rounded-[6px] border border-white/[0.06] bg-white/[0.025] overflow-hidden"
              style={{
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.5)",
                borderLeft: "2px solid rgba(181,83,44,0.6)",
              }}
            >
              {/* Copper left border glow */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[2px] pointer-events-none"
                style={{ boxShadow: "2px 0 12px rgba(181,83,44,0.25)" }}
                aria-hidden="true"
              />

              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#B5532C] mb-6">
                Privacy guarantee
              </p>

              <h3 className="font-serif text-[24px] md:text-[28px] text-white mb-5 leading-snug tracking-tight">
                Privacy by architecture, not policy
              </h3>

              <p className="text-[15px] text-neutral-300 leading-[1.7] mb-6">
                Memories are user-scoped. Cross-user retrieval is architecturally
                impossible — not just a policy. Your intelligence belongs to you.
              </p>

              <ul className="space-y-3">
                {[
                  "Each user's embeddings live in a separate namespace",
                  "Retrieval queries are filtered by tenantId at the query level",
                  "No aggregation, no pooling, no shared context stores",
                  "You can export or delete your memory store at any time",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[13px] text-neutral-400 leading-snug">
                    <span aria-hidden="true" className="text-[#B5532C] mt-[2px] flex-shrink-0">—</span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-8 pt-6 border-t border-white/[0.05]">
                <Link
                  href="/trust"
                  className="inline-flex items-center gap-2 text-[12px] font-mono text-neutral-500 hover:text-white transition-colors tracking-tight"
                >
                  <span className="text-[#B5532C]">→</span>
                  Full operating charter at /trust
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────

function IntelligenceCTA() {
  return (
    <section className="relative px-6 py-28 md:py-36 overflow-hidden">
      {/* Copper warmth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 60%, rgba(181,83,44,0.09) 0%, transparent 65%)",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-3xl mx-auto text-center">
        {/* Section head */}
        <div className="mb-8 flex items-center justify-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">04 / 04</span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            Start building
          </p>
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="font-serif text-4xl md:text-[68px] leading-[1.02] mb-6 tracking-[-0.02em]"
        >
          Start Building Your
          <br />
          <em className="not-italic text-[#B5532C]">Intelligence</em>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="text-[16px] md:text-[18px] text-neutral-400 leading-[1.6] mb-12 max-w-xl mx-auto"
        >
          Every run contributes. First result in under 60 seconds.
          Your memory store starts building from run one.
        </motion.p>

        {/* Mini value list */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-12 text-[12px] font-mono text-neutral-600">
          <span className="flex items-center gap-1.5">
            <span className="text-[#B5532C]/60">✓</span> 1,024-dim semantic vectors
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#B5532C]/60">✓</span> Per-user isolation
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#B5532C]/60">✓</span> No extra setup required
          </span>
        </div>

        <Link
          href="/signup"
          className="group inline-flex items-center gap-2 px-8 py-4 bg-[#B5532C] text-white font-mono text-[14px] tracking-wide rounded-[3px] hover:bg-[#C96035] transition-colors"
        >
          Run Your First Agent Free
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>

        <p className="mt-6 text-[11px] font-mono text-neutral-600">
          Free tier · 50 runs/month · No card required
        </p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────

function IntelligenceFooter() {
  return (
    <footer className="px-6 pt-16 pb-10 border-t border-white/[0.04] bg-[#020202]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <SovereignLogo size="sm" />
          <div className="flex flex-col gap-0.5">
            <span className="font-serif text-[15px] text-white">Sovereign Matrix</span>
            <span className="text-[10px] font-mono text-neutral-600 tracking-tight">
              Semantic Intelligence Engine · NVIDIA NIM · 1,024-dim
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[12px] font-mono text-neutral-500">
          <Link href="/" className="hover:text-white transition-colors">← Home</Link>
          <Link href="/platform" className="hover:text-white transition-colors">Platform</Link>
          <Link href="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
          <Link href="/trust" className="hover:text-white transition-colors">Trust</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
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
