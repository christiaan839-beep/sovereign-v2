"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  HardHat,
  FileSignature,
  AlertTriangle,
  Ruler,
  MessageSquare,
  CheckCircle2,
  Shield,
  Database,
  Layers,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { IndustrySignature } from "@/components/industries/IndustrySignature";
import { PermitStageTimeline } from "@/components/industries/PermitStageTimeline";

const CONSTRUCTION_FEATURED_AGENTS = [
  { slug: "permit-form-filler", name: "Permit Filler", category: "Real Estate" },
  { slug: "safety-incident-reporter", name: "Safety Report", category: "Real Estate" },
  { slug: "blueprint-parser", name: "Blueprint Parser", category: "Real Estate" },
  { slug: "id-verifier", name: "ID Verifier", category: "Compliance" },
];

const CAPABILITIES = [
  {
    icon: FileSignature,
    title: "Permit application drafter",
    desc: "Project details → IBC occupancy + construction type + scope JSON. Gets the first-pass submission clean so plan-check doesn't bounce you for week-3 rework.",
  },
  {
    icon: AlertTriangle,
    title: "OSHA 300 / 301 incident reporter",
    desc: "Voice-transcribed incident narrative in. Recordability analysis, Swiss-Cheese root cause, corrective actions, and regulatory notification deadlines out. Draft ready for safety-pro review.",
  },
  {
    icon: Ruler,
    title: "Blueprint parser",
    desc: "Architect PDF → room-by-room dimensions, door swings, fixture counts. Feeds takeoffs, FF&E lists, and MEP coordination — without the dimension hunt.",
  },
  {
    icon: HardHat,
    title: "Submittal + change-order tracker",
    desc: "Incoming submittals logged, indexed, routed for approval. Email-thread change orders extracted and tied back to the right schedule of values line item.",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"Draft the building permit for 3425 Elm St tenant improvement, 2,400 sqft retail to office\"",
    steps: [
      "Agent classifies as alteration, Occupancy B, Construction Type V-B",
      "Scope draft: demo 2 non-load-bearing walls, add 4 partition walls, egress + lighting upgrade",
      "Flags Title 24 energy compliance and ADA path-of-travel requirements",
      "Produces permit-ready JSON with fee estimates ($2,800-$4,200 plan check)",
    ],
    result: "Expeditor picks up a pre-filled packet. Plan-check red-line risk cut in half.",
  },
  {
    trigger: "\"Foreman just called in: rebar bundle struck worker's shoulder, walked off site with ice pack\"",
    steps: [
      "Agent drafts OSHA 301 narrative with injury timeline",
      "Recordability: not recordable IF return to work next day without medical treatment — flags the boundary test",
      "Root cause: lifting plan not rehearsed, overhead work area not coned off",
      "Corrective actions queued: daily JHA refresh, rigging-zone coning protocol",
    ],
    result: "Safety manager opens a draft, not a blank form. First-pass compliance up.",
  },
];

export default function ForConstructionPage() {
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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/20 bg-orange-500/[0.06] mb-6"
          >
            <HardHat className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[11px] font-semibold text-orange-400 uppercase tracking-[0.2em]">Construction</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="ed-display text-4xl md:text-6xl mb-6"
          >
            AI agents for<br />
            <span className="ed-display-italic text-orange-400">construction.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            Cleaner permits. Faster safety reports. Submittals logged in under a minute.
            Built for GCs who can&apos;t afford another paper-caused schedule slip.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Deploy construction agents <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Industry signature — blueprint grid for Construction */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-16 mx-auto"
          >
            <IndustrySignature
              industry="construction"
              agents={CONSTRUCTION_FEATURED_AGENTS}
              size={420}
              className="mx-auto"
            />
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-orange-500/60 mb-4">Capabilities</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Every paper process, shortened.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              The delays that eat your float aren&apos;t on the site — they&apos;re in the trailer office. Fix that first.
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
                className="p-6 rounded-2xl border bg-[#080808] hover:border-orange-500/20 border-white/[0.05]"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4">
                  <cap.icon className="w-5 h-5 text-orange-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{cap.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Unique-to-construction section: permit-stage timeline.
          Closes WHATS-NOT-ELITE.md §1.2 (industry pages were template
          clones). Construction projects move through 5 distinct
          municipal stages and the agent set + time-saved at each stage
          differs — that story doesn't fit the generic capabilities →
          workflow → integrations rhythm. */}
      <PermitStageTimeline />

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-orange-500/60 mb-4">How It Works</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Say the brief. Get the filing.
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
                    <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-[10px] text-orange-500/60 uppercase tracking-wider font-semibold">You say</span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-xs text-neutral-400">
                      <span className="text-orange-500/50 font-mono shrink-0 mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                      {step}
                    </div>
                  ))}
                </div>
                <div className="px-6 py-4 border-t border-white/[0.04] bg-orange-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-300">{flow.result}</p>
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-orange-500/60 mb-4">Integrates With</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Ready for the construction stack you run.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Procore", desc: "RFI, submittal, change-order JSON shapes preserved" },
              { icon: Layers, label: "Autodesk Construction Cloud", desc: "Blueprint + issue exports round-trip cleanly" },
              { icon: Shield, label: "OSHA compliance", desc: "300 / 301 drafts with recordability test built in" },
              { icon: Zap, label: "IBC / model-code aware", desc: "Occupancy + construction type classification in-the-box" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                <item.icon className="w-5 h-5 text-orange-400 mb-3" />
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
            Stop losing weeks<br />
            <span className="text-orange-400">to paperwork.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            The schedule can take one more rain day. It can&apos;t take another plan-check rejection.
            Deploy agents that keep the office work ahead of the site.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
