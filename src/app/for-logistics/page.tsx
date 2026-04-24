"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Truck,
  FileText,
  Barcode,
  Receipt,
  MessageSquare,
  CheckCircle2,
  Shield,
  Database,
  Layers,
  Zap,
} from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: FileText,
    title: "Bill of Lading reader",
    desc: "Extract all 23 canonical BOL fields — shipper, consignee, carrier, commodities, weights, hazmat. Output plugs directly into McLeod, MercuryGate, Oracle OTM.",
  },
  {
    icon: Barcode,
    title: "HS code classification",
    desc: "Product description + country of origin → HS6, HTS10, and duty-rate estimate. GRI-compliant reasoning so brokers can defend the call.",
  },
  {
    icon: Receipt,
    title: "Freight invoice audit",
    desc: "Compare invoiced rates against quotes, detariffed rates, and accessorial conventions. Flag $thousands/month in overcharges that manual AP can't catch.",
  },
  {
    icon: Truck,
    title: "Dispatch + manifest digitizer",
    desc: "Turn truck-route manifests and dispatch sheets into structured TMS JSON. A full yard's worth of paperwork cleared in seconds.",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"Process the BOL batch from this morning's Long Beach pickup\"",
    steps: [
      "Agent ingests 47 scanned BOL PDFs from the inbox",
      "Extracts shipper, consignee, commodities, weights, PRO numbers for each",
      "Validates SCAC codes against registered carriers in the TMS",
      "Pushes structured payloads to the TMS — flags 3 BOLs with missing signatures",
    ],
    result: "47 BOLs TMS-ready in under 4 minutes. 3 exceptions queued for human review.",
  },
  {
    trigger: "\"Classify the HS code for a bamboo cutting board, made in Vietnam, for import to US\"",
    steps: [
      "Agent identifies HS code 4419.12 — 'Cutting boards, of bamboo'",
      "Returns HTS10 4419.12.0000 with 3.2% general rate",
      "Notes Section 301 List 4A does not apply to Vietnamese origin",
      "Effective duty rate: 3.2%. Confidence: high",
    ],
    result: "Classification returned in 1s with chapter / heading / subheading reasoning chain.",
  },
];

export default function ForLogisticsPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">Sovereign Matrix</Link>
        <Link href="/signup" className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors">
          Get Started
        </Link>
      </nav>

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.06] mb-6"
          >
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-[0.2em]">Logistics & Freight</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            AI agents for<br />
            <span className="text-amber-400">logistics.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            BOL OCR in seconds. HS codes with defensible reasoning. Freight-invoice
            audits that pay for the platform. Built for the paperwork flood.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Deploy logistics agents <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">Capabilities</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Kill the keystroke tax.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Every BOL manually typed into a TMS is 3-5 minutes of margin you never get back.
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
                className="p-6 rounded-2xl border bg-[#080808] hover:border-amber-500/20 border-white/[0.05]"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                  <cap.icon className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{cap.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">How It Works</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              From paper to TMS — one command.
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
                <div className="px-6 py-4 border-b border-white/[0.04] bg-[#060606]">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] text-amber-500/60 uppercase tracking-wider font-semibold">You say</span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-xs text-neutral-400">
                      <span className="text-amber-500/50 font-mono shrink-0 mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                      {step}
                    </div>
                  ))}
                </div>
                <div className="px-6 py-4 border-t border-white/[0.04] bg-amber-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">{flow.result}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-y border-white/[0.03] bg-[#030303]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">Integrates With</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built for the TMS stack you already run.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "McLeod / MercuryGate", desc: "Canonical output shapes — no transform layer needed" },
              { icon: Layers, label: "Oracle OTM", desc: "Direct JSON payload compatibility for ACE eManifest" },
              { icon: Shield, label: "Customs-grade audit", desc: "Every classification logged with reasoning chain" },
              { icon: Zap, label: "Webhook triggers", desc: "Email-to-agent and S3-to-agent pipelines built-in" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                <item.icon className="w-5 h-5 text-amber-400 mb-3" />
                <div className="text-xs font-semibold text-white mb-0.5">{item.label}</div>
                <p className="text-[10px] text-neutral-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            Move paper faster<br />
            <span className="text-amber-400">than freight.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            The loads don&apos;t wait. Your dispatchers shouldn&apos;t either.
            Deploy agents that keep paperwork from being the bottleneck.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
