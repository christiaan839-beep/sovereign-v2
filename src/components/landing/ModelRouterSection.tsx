"use client";

import { motion } from "framer-motion";

const PROVIDERS = [
  { name: "NVIDIA NIM",       tag: "nim",       models: "22 models",  active: true  },
  { name: "Anthropic Claude", tag: "anthropic",  models: "5 models",   active: true  },
  { name: "Google Gemini",    tag: "google",     models: "4 models",   active: true  },
  { name: "Groq",             tag: "groq",       models: "4 models",   active: true  },
  { name: "Cerebras",         tag: "cerebras",   models: "2 models",   active: true  },
  { name: "Ollama",           tag: "ollama",     models: "Local",      active: false },
];

/**
 * ModelRouterSection — 39+ model routing infrastructure with sovereignty badge.
 */
export function ModelRouterSection() {
  return (
    <section className="relative px-6 py-28 md:py-36 bg-[#030303] overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 h-[400px] w-[400px] opacity-[0.05] blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(181,83,44,1) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto">
        <div className="mb-8 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">05 / 10</span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            model infrastructure
          </p>
        </div>

        <h2 className="font-serif text-4xl md:text-5xl lg:text-[58px] leading-[1.05] mb-4 tracking-[-0.02em] max-w-3xl">
          Best Model for Every Task.
          <br />
          <em className="not-italic text-[#B5532C]">Always.</em>
        </h2>

        <p className="text-[15px] md:text-[17px] text-neutral-400 leading-relaxed mb-12 max-w-2xl">
          Smart routing across 39+ models. NVIDIA NIM, Anthropic, Google, Groq, Cerebras, Ollama.
          11-model failover chain. Sub-100ms routing decisions.
        </p>

        {/* Provider grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {PROVIDERS.map((p, i) => (
            <motion.div
              key={p.tag}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="group relative flex items-center gap-3 p-4 rounded-[6px] border border-white/[0.06] bg-white/[0.025] hover:border-[#B5532C]/30 transition-all duration-300 overflow-hidden"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.4)" }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(circle at 0% 50%, rgba(181,83,44,0.10) 0%, transparent 60%)" }}
              />

              {/* Status dot */}
              <span className="relative flex-shrink-0">
                {p.active ? (
                  <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#B5532C] opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#B5532C]" />
                  </span>
                ) : (
                  <span className="inline-flex h-2 w-2 rounded-full bg-neutral-600" />
                )}
              </span>

              <div className="relative flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white truncate tracking-tight">{p.name}</p>
                <p className="text-[10px] font-mono text-neutral-500">{p.models}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Sovereignty badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[#B5532C]/35 bg-[#B5532C]/[0.07] mb-8"
        >
          {/* Lock icon */}
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
            <rect x="1" y="6" width="10" height="7" rx="1.5" stroke="#B5532C" strokeWidth="1.2" fill="rgba(181,83,44,0.15)" />
            <path d="M3.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="#B5532C" strokeWidth="1.2" fill="none" />
          </svg>
          <span className="font-mono text-[11px] text-[#B5532C] tracking-wide">
            Sovereign Mode: Zero Chinese routing available
          </span>
        </motion.div>

        {/* Routing stat row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* Honest claims: routing latency comes from the smart-router
              math (not measured here), failover-chain depth is a
              structural fact (11 entries in src/lib/ai.ts). Uptime
              is removed from this strip — it's published live at
              /api/health/permanence + /reliability where it's
              measured, not fabricated. */}
          {[
            { v: "<100ms", l: "routing decision" },
            { v: "11",     l: "model failover chain" },
            { v: "verifiable", l: "/api/health/permanence" },
          ].map((s, i) => (
            <div key={s.l} className="flex items-center gap-2 font-mono text-[12px]">
              {i > 0 && (
                <span aria-hidden="true" className="w-1 h-1 rounded-full bg-neutral-700 flex-shrink-0" />
              )}
              <span className="text-[#B5532C] font-semibold">{s.v}</span>
              <span className="text-neutral-500">{s.l}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
