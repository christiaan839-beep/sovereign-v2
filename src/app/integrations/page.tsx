"use client";

import { motion } from "framer-motion";
import { ArrowRight, Puzzle } from "lucide-react";
import Link from "next/link";

type Integration = {
  name: string;
  desc: string;
  letter: string;
  status: "connected" | "available";
};

type Category = {
  label: string;
  color: string;
  integrations: Integration[];
};

const CATEGORIES: Category[] = [
  {
    label: "AI Models",
    color: "emerald",
    integrations: [
      { name: "NVIDIA NIM", desc: "20+ models, free tier inference", letter: "N", status: "connected" },
      { name: "Google Gemini", desc: "2.5 Pro/Flash, 1M context", letter: "G", status: "connected" },
      { name: "Anthropic Claude", desc: "Sonnet 4.6, Mythos (coming)", letter: "A", status: "connected" },
      { name: "Groq", desc: "Ultra-low latency inference", letter: "G", status: "connected" },
      { name: "Cerebras", desc: "2,200+ tok/s wafer-scale", letter: "C", status: "available" },
      { name: "Ollama", desc: "Local/offline execution", letter: "O", status: "connected" },
      { name: "DeepSeek", desc: "V3.2, R1 reasoning", letter: "D", status: "connected" },
    ],
  },
  {
    label: "Communication",
    color: "cyan",
    integrations: [
      { name: "Slack", desc: "Notifications, alerts, agent updates", letter: "S", status: "connected" },
      { name: "Discord", desc: "Community webhooks", letter: "D", status: "available" },
      { name: "Email (Resend)", desc: "Transactional + sequences", letter: "E", status: "connected" },
      { name: "ElevenLabs", desc: "AI voice calling", letter: "E", status: "available" },
    ],
  },
  {
    label: "Data & Storage",
    color: "violet",
    integrations: [
      { name: "Pinecone", desc: "Vector memory, semantic search", letter: "P", status: "connected" },
      { name: "Neon PostgreSQL", desc: "Tenant-scoped database", letter: "N", status: "connected" },
      { name: "Google Sheets", desc: "Data import/export", letter: "G", status: "available" },
    ],
  },
  {
    label: "Business Tools",
    color: "amber",
    integrations: [
      { name: "HubSpot", desc: "CRM sync, contact enrichment", letter: "H", status: "available" },
      { name: "GitHub", desc: "Code agent, PR management", letter: "G", status: "connected" },
      { name: "Vercel", desc: "Auto-deployment, edge functions", letter: "V", status: "connected" },
      { name: "Clerk", desc: "Authentication, SSO", letter: "C", status: "connected" },
    ],
  },
  {
    label: "Payments",
    color: "rose",
    integrations: [
      { name: "Stripe", desc: "USD billing", letter: "S", status: "connected" },
      { name: "PayFast", desc: "ZAR payments", letter: "P", status: "available" },
      { name: "Yoco", desc: "South African card processing", letter: "Y", status: "available" },
      { name: "PayStack", desc: "African payments", letter: "P", status: "available" },
    ],
  },
  {
    label: "Infrastructure",
    color: "neutral",
    integrations: [
      { name: "NVIDIA NeMo Guardrails", desc: "5-layer safety", letter: "N", status: "connected" },
      { name: "MCP Server", desc: "JSON-RPC tool integration", letter: "M", status: "connected" },
      { name: "Webhooks", desc: "External automation triggers", letter: "W", status: "connected" },
    ],
  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string; badge: string }> = {
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    dot: "bg-emerald-500",
    badge: "text-emerald-500/60",
  },
  cyan: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/20",
    dot: "bg-cyan-500",
    badge: "text-cyan-500/60",
  },
  violet: {
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    border: "border-violet-500/20",
    dot: "bg-violet-500",
    badge: "text-violet-500/60",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
    badge: "text-amber-500/60",
  },
  rose: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    dot: "bg-rose-500",
    badge: "text-rose-500/60",
  },
  neutral: {
    bg: "bg-neutral-500/10",
    text: "text-neutral-400",
    border: "border-neutral-500/20",
    dot: "bg-neutral-500",
    badge: "text-neutral-500/60",
  },
};

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      {/* Nav */}
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <Link
          href="/signup"
          className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors"
        >
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] mb-6"
          >
            <Puzzle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-[0.2em]">
              Integrations
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            25+ integrations.
            <br />
            <span className="text-emerald-400">Zero lock-in.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            Connect your existing tools. Sovereign works alongside your stack &mdash; not instead of it.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all"
            >
              Start connecting <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Integration Categories */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto space-y-16">
          {CATEGORIES.map((cat, ci) => {
            const colors = COLOR_MAP[cat.color];
            return (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: ci * 0.05 }}
              >
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <h2 className="text-lg font-bold text-white tracking-tight">{cat.label}</h2>
                  <span className={`text-[11px] font-medium uppercase tracking-[0.2em] ${colors.badge}`}>
                    {cat.integrations.length} integrations
                  </span>
                </div>

                {/* Cards Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {cat.integrations.map((intg, ii) => (
                    <motion.div
                      key={intg.name}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: ii * 0.04 }}
                      className={`group relative p-5 rounded-2xl border bg-[#080808] transition-all hover:${colors.border} border-white/[0.05]`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        {/* Icon circle */}
                        <div
                          className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}
                        >
                          <span className={`text-sm font-bold ${colors.text}`}>{intg.letter}</span>
                        </div>

                        {/* Status badge */}
                        {intg.status === "connected" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-[10px] font-semibold text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] text-[10px] font-semibold text-neutral-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                            Available
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-white mb-1">{intg.name}</h3>
                      <p className="text-xs text-neutral-500 leading-relaxed">{intg.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-y border-white/[0.03] bg-[#030303]">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "25+", label: "Integrations" },
              { value: "35+", label: "AI Models" },
              { value: "6", label: "Providers" },
              { value: "0", label: "Vendor Lock-in" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-black text-white mb-1">{stat.value}</div>
                <div className="text-xs text-neutral-500 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            Need an integration?
            <br />
            <span className="text-emerald-400">Request it.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            We&apos;re adding new integrations every week. If your tool isn&apos;t listed,
            let us know and we&apos;ll prioritize it.
          </p>
          <Link
            href="/developers"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all"
          >
            Request an integration <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
