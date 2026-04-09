"use client";

import { motion } from "framer-motion";
import { ArrowRight, Scale, ShieldAlert, MessageCircle, TrendingUp, Shield, Database, Layers, Zap, MessageSquare, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: Scale,
    title: "Compliance monitoring",
    desc: "Scan regulations in real time, cross-reference your portfolio against evolving rules, and flag violations before they become fines. What took a compliance team days now runs continuously.",
    color: "cyan",
  },
  {
    icon: ShieldAlert,
    title: "Fraud detection",
    desc: "Pattern analysis across millions of transactions. Agents surface anomalies, cluster suspicious behavior, and escalate high-confidence alerts — faster than any manual review queue.",
    color: "emerald",
  },
  {
    icon: MessageCircle,
    title: "Customer communication",
    desc: "Personalized financial advice drafted from client history, risk profile, and market conditions. Every message is compliant, on-brand, and ready for advisor review.",
    color: "violet",
  },
  {
    icon: TrendingUp,
    title: "Portfolio analysis",
    desc: "Combine live market data with client objectives to generate allocation recommendations, rebalancing alerts, and performance summaries — all verified by a second model before delivery.",
    color: "amber",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"Monitor our portfolio for compliance violations\"",
    steps: [
      "Agent ingests current portfolio holdings and latest regulatory filings",
      "Cross-references positions against jurisdiction-specific rules and exposure limits",
      "Flags three holdings that breach updated concentration thresholds",
      "Generates a remediation report with suggested trades and filing deadlines",
    ],
    result: "3 violations caught 48 hours before the regulatory deadline. Zero manual review.",
  },
  {
    trigger: "\"Analyze transaction patterns for fraud signals\"",
    steps: [
      "Pulls 90 days of transaction data across all accounts",
      "Clusters transactions by velocity, geography, and counterparty behavior",
      "Identifies 12 accounts with anomalous patterns matching known fraud typologies",
      "Escalates high-confidence cases with evidence packets for the investigations team",
    ],
    result: "12 suspicious accounts flagged in under 4 minutes. $2.1M in potential losses intercepted.",
  },
  {
    trigger: "\"Draft personalized quarterly client reports\"",
    steps: [
      "Retrieves each client\u0027s portfolio performance, transactions, and stated goals",
      "Generates a plain-language summary with YTD returns, benchmark comparison, and outlook",
      "Tailors tone and detail level based on client\u0027s communication preferences",
      "Queues 340 reports for advisor review with one-click approval",
    ],
    result: "340 personalized reports drafted in 8 minutes. Advisors approve and send same day.",
  },
];

export default function ForFintechPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      {/* Nav */}
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">Sovereign Matrix</Link>
        <Link href="/signup" className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors">
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] mb-6"
          >
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em]">Fintech</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            Your AI<br />
            <span className="text-cyan-400">fintech engine.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            Air-gapped execution. Trust levels for regulated outputs. Fiduciary data never leaves your infrastructure.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Deploy fintech agents <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-500/60 mb-4">Capabilities</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Automate the compliance. Focus on the client.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Every task that pulls advisors away from client relationships — automated, verified, and audit-logged.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {CAPABILITIES.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`p-6 rounded-2xl border bg-[#080808] transition-all hover:border-${cap.color}-500/20 border-white/[0.05]`}
              >
                <div className={`w-10 h-10 rounded-xl bg-${cap.color}-500/10 flex items-center justify-center mb-4`}>
                  <cap.icon className={`w-5 h-5 text-${cap.color}-400`} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{cap.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow examples */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-500/60 mb-4">How It Works</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Give the command. Get the outcome.
            </h2>
          </div>

          <div className="space-y-8">
            {WORKFLOWS.map((flow, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-white/[0.06] bg-[#080808] overflow-hidden"
              >
                {/* Trigger */}
                <div className="px-6 py-4 border-b border-white/[0.04] bg-[#060606]">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] text-cyan-500/60 uppercase tracking-wider font-semibold">You say</span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>

                {/* Steps */}
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-xs text-neutral-400">
                      <span className="text-cyan-500/50 font-mono shrink-0 mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                      {step}
                    </div>
                  ))}
                </div>

                {/* Result */}
                <div className="px-6 py-4 border-t border-white/[0.04] bg-cyan-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-cyan-300">{flow.result}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-16 px-6 border-y border-white/[0.03] bg-[#030303]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-500/60 mb-4">Under The Hood</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built for financial-grade security.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Pinecone", desc: "Vector memory — semantic search across transaction histories and compliance documents" },
              { icon: Layers, label: "Neon Postgres", desc: "Tenant-scoped relational store — fiduciary data isolation per firm" },
              { icon: Shield, label: "5-Layer Pipeline", desc: "Every output passes through PII detection, content policy, and quality guardrails" },
              { icon: Zap, label: "Ollama Local", desc: "Air-gapped mode — fiduciary data never leaves your infrastructure" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                <item.icon className="w-5 h-5 text-cyan-400 mb-3" />
                <div className="text-xs font-semibold text-white mb-0.5">{item.label}</div>
                <p className="text-[10px] text-neutral-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            Less risk.<br />
            <span className="text-cyan-400">More alpha.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Your team shouldn&apos;t spend half their day on compliance spreadsheets.
            Deploy AI agents that handle the regulated work so your advisors can focus on clients.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
