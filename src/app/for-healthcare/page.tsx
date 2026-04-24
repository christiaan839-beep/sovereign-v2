"use client";

import { motion } from "framer-motion";
import { ArrowRight, Heart, CalendarCheck, FileText, Receipt, Shield, Database, Layers, Zap, MessageSquare, CheckCircle2 } from "lucide-react";
import Link from "next/link";

/**
 * Tailwind v4 JIT cannot see interpolated class names (e.g.
 * `bg-${cap.color}-500/10`) — they never make it into the compiled CSS
 * and render as silent no-ops. This literal map is the documented safe
 * pattern: every class is spelled out so the scanner finds them.
 */
const COLOR_CLASSES = {
  cyan: {
    iconBg: "bg-cyan-500/10",
    iconFg: "text-cyan-400",
    borderHover: "hover:border-cyan-500/20",
  },
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconFg: "text-emerald-400",
    borderHover: "hover:border-emerald-500/20",
  },
  violet: {
    iconBg: "bg-violet-500/10",
    iconFg: "text-violet-400",
    borderHover: "hover:border-violet-500/20",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconFg: "text-amber-400",
    borderHover: "hover:border-amber-500/20",
  },
} as const;

type ColorKey = keyof typeof COLOR_CLASSES;

const CAPABILITIES: Array<{
  icon: typeof Heart;
  title: string;
  desc: string;
  color: ColorKey;
}> = [
  {
    icon: Heart,
    title: "Patient intake automation",
    desc: "Collect patient history, insurance details, and consent forms before the visit. Agents pre-populate records so your staff spends time on care, not clipboards.",
    color: "cyan",
  },
  {
    icon: CalendarCheck,
    title: "Appointment scheduling",
    desc: "Voice and chat agents handle booking, rescheduling, and reminders 24/7. Patients get confirmed slots in seconds. No-shows drop when reminders go out automatically.",
    color: "emerald",
  },
  {
    icon: FileText,
    title: "Medical record summarization",
    desc: "Summarize patient charts, lab results, and visit histories into concise briefs for physicians. What took 20 minutes of chart review now takes 10 seconds.",
    color: "violet",
  },
  {
    icon: Receipt,
    title: "Billing & coding assistance",
    desc: "Agents cross-reference diagnoses with ICD-10 codes, flag coding errors before submission, and process insurance claims in bulk. Fewer denials, faster reimbursement.",
    color: "amber",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"Schedule all follow-up appointments for this week\u0027s discharges\"",
    steps: [
      "Agent pulls discharge list from this week\u0027s records",
      "Cross-references each patient\u0027s follow-up requirements and provider availability",
      "Books appointments and sends confirmation via patient\u0027s preferred channel",
      "Updates the EHR with scheduled follow-up dates",
    ],
    result: "42 follow-up appointments booked in under 3 minutes. Zero phone calls.",
  },
  {
    trigger: "\"Summarize patient chart for Dr. Smith\u0027s 2pm\"",
    steps: [
      "Retrieves full patient history, recent labs, and medication list",
      "Identifies key changes since last visit and outstanding concerns",
      "Generates a 1-page clinical summary with relevant vitals trending",
      "Flags drug interaction risks and overdue screenings",
    ],
    result: "Dr. Smith walks into the exam room prepared, not scrambling through charts.",
  },
  {
    trigger: "\"Process 50 insurance claims from yesterday\"",
    steps: [
      "Pulls all unbilled encounters from the previous day",
      "Maps diagnoses to ICD-10 codes and procedures to CPT codes",
      "Runs pre-submission validation to catch common denial triggers",
      "Submits clean claims to each payer\u0027s electronic portal",
    ],
    result: "50 claims submitted with 96% first-pass acceptance rate.",
  },
];

export default function ForHealthcarePage() {
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
            <Heart className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em]">Healthcare</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            AI agents for<br />
            <span className="text-cyan-400">healthcare.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            HIPAA-compliant. Local execution. Patient data never leaves your machine.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Deploy healthcare agents <ArrowRight className="w-4 h-4" />
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
              Automate the admin. Focus on the patient.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Every task that pulls clinicians away from patient care — automated, verified, and audit-logged.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {CAPABILITIES.map((cap, i) => {
              const cls = COLOR_CLASSES[cap.color];
              return (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`p-6 rounded-2xl border bg-[#080808] transition-all border-white/[0.05] ${cls.borderHover}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${cls.iconBg}`}>
                    <cap.icon className={`w-5 h-5 ${cls.iconFg}`} />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{cap.title}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">{cap.desc}</p>
                </motion.div>
              );
            })}
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
              Built for healthcare-grade security.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Pinecone", desc: "Vector memory — semantic search across patient records and protocols" },
              { icon: Layers, label: "Neon Postgres", desc: "Tenant-scoped relational store — PHI isolation per practice" },
              { icon: Shield, label: "5-Layer Pipeline", desc: "Every output passes through PII detection, content, and quality guardrails" },
              { icon: Zap, label: "Ollama Local", desc: "Air-gapped mode — patient data never leaves your infrastructure" },
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
            Less paperwork.<br />
            <span className="text-cyan-400">More patient care.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Your staff shouldn&apos;t spend half their day on data entry.
            Deploy AI agents that handle the admin so your team can focus on what matters.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
