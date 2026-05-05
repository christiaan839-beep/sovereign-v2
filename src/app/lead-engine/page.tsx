"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Target,
  Mail,
  CheckCircle2,
  Shield,
  Zap,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import {
  RevealText,
  GlowDivider,
  MagneticButton,
} from "@/components/ui/ScrollAnimations";

/**
 * /lead-engine — the founder-led wedge product.
 *
 * Positioning: "50 qualified B2B SaaS leads/month. Or your money back."
 * Pricing:    one-time setup ($4,999) + monthly retainer ($999/mo).
 * CTA:        15-min fit call (Calendly).
 *
 * This page is intentionally narrow. Every element answers one question:
 * "Will I get 50 qualified leads next month if I pay you $4,999 + $999?"
 * No platform tour, no 137-agent boast, no FAQ rabbit-holes.
 *
 * The Calendly link is read from NEXT_PUBLIC_CALENDLY_URL so the operator
 * can swap it without a redeploy.
 */

const CALENDLY =
  process.env.NEXT_PUBLIC_CALENDLY_URL ||
  "https://calendly.com/sovereignmatrix/lead-engine-fit-call";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const STEPS = [
  {
    n: "01",
    icon: Target,
    title: "We define your ideal customer with you",
    detail:
      "30-min kickoff call. We map your ICP — vertical, headcount, ARR, role, geography. The output is a precise targeting brief, not a vibe.",
  },
  {
    n: "02",
    icon: Zap,
    title: "Sovereign agents source + qualify",
    detail:
      "Our lead-blitz playbook scans 500+ companies/week, runs enrichment, and qualifies against your brief. You see every lead in a shared dashboard before it leaves the building.",
  },
  {
    n: "03",
    icon: Mail,
    title: "You get 50 qualified leads/month + outreach drafts",
    detail:
      "Each lead includes the company, decision-maker, role, email, recent triggers (funding, hire, post), and a personalised first message. You send. You book meetings. You close.",
  },
];

const INCLUDES = [
  "ICP definition workshop (1 × 30-min call)",
  "50 qualified prospects/month, dedup'd against your CRM",
  "Verified email + LinkedIn for every lead",
  "3 personalised outreach messages per lead",
  "Weekly delivery, Mondays at 9am your timezone",
  "Live dashboard you can share with your team",
  "Slack channel for real-time replies and tweaks",
  "30-day money-back guarantee on the first month",
];

const FAQS = [
  {
    q: "What happens if I don't get 50 qualified leads?",
    a: "If we deliver fewer than 50 qualified leads in your first 30 days, you get the $4,999 setup fee back, full refund. The $999 monthly retainer doesn't start until you sign off on the first delivery.",
  },
  {
    q: "What does 'qualified' mean exactly?",
    a: "Matches the ICP brief we built together: right vertical, headcount range, role title, geography, with verified contact info and at least one recent buying signal (hiring, funding, tech stack change, content trigger). You see the qualification logic and can tighten or relax it.",
  },
  {
    q: "Who is this for?",
    a: "B2B SaaS founders 1–50 employees, $0–$2M ARR, who need a steady lead pipeline but can't justify a $120k/year SDR. If you're spending $5k+/mo on agencies that don't deliver, this is built for you.",
  },
  {
    q: "Who is this NOT for?",
    a: "If your ACV is under $500/year, the unit economics don't work. If you sell to consumers (B2C), you'll get better results from paid ads. If you need 500+ leads/month, you need an agency, not me.",
  },
  {
    q: "How is this different from Apollo / Clay / Smartlead?",
    a: "Those are tools. You still need the operator running them. I run them — using Sovereign Matrix, the AI agent platform I built — and deliver the qualified leads + outreach copy ready to send. You don't touch the tools.",
  },
  {
    q: "Can I see a sample delivery?",
    a: "On the fit call I'll walk you through 5 anonymised real leads from a recent customer (with permission). You'll see the qualification logic, the enrichment depth, and the outreach tone before you commit a dollar.",
  },
];

export default function LeadEnginePage() {
  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100 selection:bg-emerald-500/30">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-white/5 bg-[#030303]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/pricing"
              className="text-neutral-400 hover:text-neutral-100 transition"
            >
              Platform
            </Link>
            <a
              href={CALENDLY}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-emerald-500 px-5 py-2 font-semibold text-black hover:bg-emerald-400 transition"
            >
              Book a fit call
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_60%)]" />
        <div className="relative mx-auto max-w-5xl px-6 pt-24 pb-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            For B2B SaaS founders, 1–50 employees
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-8 text-5xl md:text-7xl font-bold tracking-tight"
          >
            <span className="bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent">
              50 qualified leads
            </span>
            <br />
            <span className="text-emerald-400">in 30 days.</span>{" "}
            <span className="text-neutral-300">Or your money back.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.15 }}
            className="mx-auto mt-8 max-w-2xl text-lg text-neutral-400 leading-relaxed"
          >
            I built an AI agent platform. Now I run it for you. Every Monday you
            get a fresh batch of qualified prospects with verified contacts,
            recent buying signals, and ready-to-send outreach copy. You send.
            You book meetings. You close.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.3 }}
            className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <MagneticButton>
              <a
                href={CALENDLY}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-7 py-3.5 text-base font-semibold text-black hover:bg-emerald-400 transition"
              >
                <Calendar className="h-4 w-4" />
                Book a 15-min fit call
              </a>
            </MagneticButton>
            <span className="text-sm text-neutral-500">
              5 founding spots / month at this price
            </span>
          </motion.div>

          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { v: "50", l: "leads / month" },
              { v: "<7d", l: "first delivery" },
              { v: "$0", l: "until first batch" },
              { v: "30d", l: "money-back" },
            ].map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-center backdrop-blur-xl"
              >
                <div className="text-3xl font-bold text-emerald-400">{s.v}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-neutral-500">
                  {s.l}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <GlowDivider />

      {/* ── How it works ── */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <RevealText>
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            How it works
          </h2>
          <p className="mt-4 text-center text-neutral-400 max-w-2xl mx-auto">
            Three steps. No tool training. No hiring. No agency babysitting.
          </p>
        </RevealText>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative rounded-2xl border border-white/5 bg-white/[0.02] p-7 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-600">
                    {step.n}
                  </span>
                  <Icon className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                  {step.detail}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <GlowDivider />

      {/* ── Pricing ── */}
      <section className="mx-auto max-w-3xl px-6 py-24">
        <RevealText>
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            Simple, outcome-based pricing
          </h2>
          <p className="mt-4 text-center text-neutral-400">
            One setup fee. One monthly retainer. No surprises.
          </p>
        </RevealText>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-1"
        >
          <div className="rounded-3xl bg-[#040404] p-10">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <span className="text-5xl font-bold text-white">$4,999</span>
              <span className="text-neutral-400">one-time setup</span>
              <span className="text-neutral-600">+</span>
              <span className="text-3xl font-bold text-emerald-400">$999</span>
              <span className="text-neutral-400">/month retainer</span>
            </div>

            <ul className="mt-8 space-y-3">
              {INCLUDES.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-neutral-300"
                >
                  <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-neutral-300">
              <Shield className="h-5 w-5 flex-shrink-0 text-emerald-400" />
              <span>
                <strong className="text-white">Money-back guarantee:</strong>{" "}
                Fewer than 50 qualified leads in your first 30 days? Full setup
                refund, no questions.
              </span>
            </div>

            <a
              href={CALENDLY}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-4 text-base font-semibold text-black hover:bg-emerald-400 transition"
            >
              Book a 15-min fit call
              <ArrowRight className="h-4 w-4" />
            </a>
            <p className="mt-3 text-center text-xs text-neutral-500">
              We&rsquo;ll review your ICP, walk through a sample delivery, and
              decide together if it&rsquo;s a fit. Zero pressure.
            </p>
          </div>
        </motion.div>
      </section>

      <GlowDivider />

      {/* ── FAQs ── */}
      <section className="mx-auto max-w-3xl px-6 py-24">
        <RevealText>
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            The honest FAQ
          </h2>
        </RevealText>

        <div className="mt-12 space-y-4">
          {FAQS.map((f, i) => (
            <motion.details
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl open:border-emerald-500/20"
            >
              <summary className="flex cursor-pointer items-center justify-between text-left text-base font-medium">
                {f.q}
                <ArrowRight className="h-4 w-4 text-neutral-500 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-4 text-sm text-neutral-400 leading-relaxed">
                {f.a}
              </p>
            </motion.details>
          ))}
        </div>
      </section>

      <GlowDivider />

      {/* ── Founder note ── */}
      <section className="mx-auto max-w-2xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-white/5 bg-white/[0.02] p-10 backdrop-blur-xl"
        >
          <h3 className="text-2xl font-bold">A note from the founder</h3>
          <p className="mt-6 text-neutral-300 leading-relaxed">
            I spent 12 months building Sovereign Matrix — an AI agent platform
            with 137 agents, multi-model routing, and a 5-layer safety pipeline.
            Lots of founders told me they didn&rsquo;t want a platform. They
            wanted
            <em> leads in their inbox by Monday</em>.
          </p>
          <p className="mt-4 text-neutral-300 leading-relaxed">
            So I&rsquo;m running the platform for you. The first 5 customers
            each month I onboard personally. Every lead is reviewed before it
            ships. Every issue gets a same-day fix. If it doesn&rsquo;t work,
            you don&rsquo;t pay.
          </p>
          <p className="mt-4 text-neutral-300 leading-relaxed">
            That&rsquo;s the deal.
          </p>
          <a
            href={CALENDLY}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition"
          >
            Book a fit call
            <ArrowRight className="h-4 w-4" />
          </a>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-7xl px-6 text-center text-xs text-neutral-600">
          Sovereign Matrix &middot;{" "}
          <Link href="/pricing" className="hover:text-neutral-400">
            Platform pricing
          </Link>{" "}
          &middot;{" "}
          <Link href="/terms" className="hover:text-neutral-400">
            Terms
          </Link>{" "}
          &middot;{" "}
          <Link href="/privacy" className="hover:text-neutral-400">
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  );
}
