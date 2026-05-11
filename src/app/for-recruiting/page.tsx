"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Users,
  FileCheck,
  Mail,
  CalendarClock,
  Shield,
  Database,
  Layers,
  Zap,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: FileCheck,
    title: "Resume screening & scoring",
    desc: "Upload a job description and a stack of resumes. Agents parse, score, and rank every candidate against your requirements — skills match, experience depth, culture signals. 200 resumes in 90 seconds.",
    color: "emerald",
  },
  {
    icon: Mail,
    title: "Candidate outreach sequences",
    desc: "Agents craft personalized outreach to passive candidates on LinkedIn, email, and InMail. Each message references their specific experience, recent projects, and role fit. Not templates — real personalization at scale.",
    color: "cyan",
  },
  {
    icon: CalendarClock,
    title: "Interview scheduling",
    desc: "Once a candidate responds, agents handle the back-and-forth of scheduling — timezone detection, interviewer availability, calendar holds, and confirmation emails. No more 6-email scheduling chains.",
    color: "violet",
  },
  {
    icon: Users,
    title: "Talent pipeline management",
    desc: "Agents track every candidate across your pipeline — from sourced to screened to interviewed to offered. Weekly pipeline reports, stale-candidate alerts, and drop-off analysis delivered automatically.",
    color: "amber",
  },
];

const WORKFLOWS = [
  {
    trigger: '"Screen these 200 applications for the Senior Engineer role"',
    steps: [
      "Agent parses all 200 resumes and extracts structured candidate profiles",
      "Scores each candidate against the job description on 8 dimensions (skills, experience, education, etc.)",
      "Flags 23 strong matches, 45 maybes, and 132 passes with reasoning for each",
      "Generates a shortlist with one-paragraph summaries and recommended interview questions per candidate",
    ],
    result:
      "200 resumes screened in 2 minutes. Top 23 candidates ready for recruiter review.",
  },
  {
    trigger: '"Write outreach to 50 passive candidates on LinkedIn"',
    steps: [
      "Pulls each candidate\u0027s LinkedIn profile, recent posts, and work history",
      "Identifies unique connection points — mutual interests, shared alma mater, relevant projects",
      "Generates personalized InMail messages that reference specific achievements",
      "Queues messages with optimal send times based on each candidate\u0027s activity patterns",
    ],
    result:
      "50 hyper-personalized outreach messages. Average response rate: 3x higher than templates.",
  },
  {
    trigger: '"Schedule interviews for all candidates who scored above 80"',
    steps: [
      "Identifies 23 candidates above the 80-point threshold from the screening round",
      "Checks interviewer availability across the hiring panel\u0027s calendars",
      "Sends scheduling links with timezone-aware time slots to each candidate",
      "Books confirmed interviews, sends calendar invites, and attaches prep materials for interviewers",
    ],
    result:
      "23 interviews scheduled across 5 interviewers. Zero scheduling conflicts.",
  },
];

export default function ForRecruitingPage() {
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
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-[0.2em]">
              Recruiting
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            One role brief →
            <br />
            <span className="text-emerald-400">a full sourcing playbook</span>
            <br />
            in 90 seconds.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed mb-8"
          >
            Drop the role title and must-have skills. Get a structured ICP,
            three platform-specific boolean strings, three outreach drafts, five
            non-LinkedIn sourcing channels, and a 4-objection playbook — ready
            to hand to your sourcing team Monday.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/playbooks/recruiting-sourcing-sprint"
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-black font-semibold rounded-full text-sm hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.25)]"
            >
              Try the sourcing sprint <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 border border-white/15 text-neutral-300 font-semibold rounded-full text-sm hover:border-white/30 hover:text-white transition-all"
            >
              Deploy full agent stack
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">
              Capabilities
            </p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Hire faster. Screen smarter. Never miss talent.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Your AI recruiting team screens every resume, personalizes every
              outreach, and schedules every interview — while your recruiters
              focus on closing offers.
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
                <div
                  className={`w-10 h-10 rounded-xl bg-${cap.color}-500/10 flex items-center justify-center mb-4`}
                >
                  <cap.icon className={`w-5 h-5 text-${cap.color}-400`} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  {cap.title}
                </h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  {cap.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow examples */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">
              How It Works
            </p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Tell the agent what you need. Get results.
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
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] text-emerald-500/60 uppercase tracking-wider font-semibold">
                      You say
                    </span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>

                {/* Steps */}
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div
                      key={j}
                      className="flex items-start gap-2.5 text-xs text-neutral-400"
                    >
                      <span className="text-emerald-500/50 font-mono shrink-0 mt-0.5">
                        {String(j + 1).padStart(2, "0")}
                      </span>
                      {step}
                    </div>
                  ))}
                </div>

                {/* Result */}
                <div className="px-6 py-4 border-t border-white/[0.04] bg-emerald-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-300">{flow.result}</p>
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">
              Under The Hood
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built for talent acquisition at scale.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                icon: Database,
                label: "Pinecone",
                desc: "Vector memory — semantic matching across resumes, roles, and candidate history",
              },
              {
                icon: Layers,
                label: "Neon Postgres",
                desc: "Tenant-scoped relational store — per-client pipeline isolation",
              },
              {
                icon: Shield,
                label: "5-Layer Pipeline",
                desc: "Every output checked for bias, PII handling, and quality standards",
              },
              {
                icon: Zap,
                label: "Ollama Local",
                desc: "Air-gapped mode — candidate data never leaves your infrastructure",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]"
              >
                <item.icon className="w-5 h-5 text-emerald-400 mb-3" />
                <div className="text-xs font-semibold text-white mb-0.5">
                  {item.label}
                </div>
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
            Stop drowning in resumes.
            <br />
            <span className="text-emerald-400">Start hiring the best.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Every application screened. Every strong candidate contacted. Every
            interview booked. Your recruiting pipeline runs itself while you
            focus on closing offers.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all"
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
