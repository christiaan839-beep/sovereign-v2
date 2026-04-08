"use client";

import { motion } from "framer-motion";
import { ArrowRight, GraduationCap, BookOpen, ClipboardList, Settings, BarChart3, Shield, Database, Layers, Zap, MessageSquare, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: BookOpen,
    title: "Curriculum & lesson plan generation",
    desc: "Describe the course, grade level, and learning objectives. Agents generate week-by-week curricula aligned to standards (Common Core, AP, IB) — complete with lesson plans, activities, and resource lists.",
    color: "cyan",
  },
  {
    icon: ClipboardList,
    title: "Student assessment creation",
    desc: "Generate unique, standards-aligned assessments in seconds. Multiple choice, short answer, essay prompts, and rubrics — each question tagged by difficulty level, Bloom&apos;s taxonomy tier, and learning objective.",
    color: "emerald",
  },
  {
    icon: Settings,
    title: "Administrative automation",
    desc: "Agents handle parent communications, enrollment processing, attendance reporting, and scheduling. Every repetitive administrative task that pulls educators away from teaching — automated and logged.",
    color: "violet",
  },
  {
    icon: BarChart3,
    title: "Progress tracking & reporting",
    desc: "Aggregate student performance across assignments, assessments, and participation. Generate individual progress reports, class-wide analytics, and early intervention alerts for struggling students.",
    color: "amber",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"Create a 12-week curriculum for AP Computer Science\"",
    steps: [
      "Agent pulls AP Computer Science A framework and exam format requirements",
      "Designs 12-week unit progression covering all required topics with scaffolding",
      "Generates weekly lesson plans with objectives, activities, code exercises, and homework",
      "Includes 3 practice exams, a midterm project spec, and a final project rubric",
    ],
    result: "Complete AP CS curriculum ready to teach. Aligned to College Board standards with differentiation notes.",
  },
  {
    trigger: "\"Generate 30 unique assessment questions on photosynthesis\"",
    steps: [
      "Agent identifies key concepts: light reactions, Calvin cycle, chloroplast structure, factors affecting rate",
      "Generates 10 multiple choice, 10 short answer, and 10 extended response questions",
      "Tags each question by difficulty (easy/medium/hard) and Bloom\u0027s taxonomy level",
      "Creates answer key with detailed explanations and a scoring rubric for open-ended questions",
    ],
    result: "30 unique questions with answer key and rubric. No two students get the same assessment.",
  },
  {
    trigger: "\"Summarize progress reports for all 150 students in Grade 10\"",
    steps: [
      "Pulls grade data, attendance records, and teacher comments for all 150 students",
      "Calculates performance trends, identifies students at risk, and highlights top performers",
      "Generates individual progress narratives for each student with specific, actionable feedback",
      "Produces a class-wide summary with distribution charts and intervention recommendations",
    ],
    result: "150 personalized progress reports generated in 4 minutes. Ready for parent-teacher conferences.",
  },
];

export default function ForEducationPage() {
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
            <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em]">Education</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            AI agents for<br />
            <span className="text-cyan-400">education.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            FERPA-compliant. Curriculum generation. Student assessment. Runs locally.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Deploy education agents <ArrowRight className="w-4 h-4" />
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
              Less busywork. More teaching.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Educators spend 50% of their time on non-teaching tasks. AI agents handle curriculum prep, assessment creation, and admin so your teachers can teach.
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
              Describe what you need. Get it done.
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
              Built for student data privacy.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Pinecone", desc: "Vector memory — semantic search across curricula, assessments, and student records" },
              { icon: Layers, label: "Neon Postgres", desc: "Tenant-scoped relational store — per-school and per-district isolation" },
              { icon: Shield, label: "5-Layer Pipeline", desc: "Every output checked for age-appropriateness, accuracy, and PII protection" },
              { icon: Zap, label: "Ollama Local", desc: "Air-gapped mode — student data never leaves your school network" },
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
            Less admin.<br />
            <span className="text-cyan-400">More impact.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Every curriculum generated saves hours of prep. Every assessment created is standards-aligned.
            Every progress report is personalized. Your agents handle the busywork so educators can educate.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
