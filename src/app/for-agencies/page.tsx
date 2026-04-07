"use client";

import { motion } from "framer-motion";
import {
  ArrowRight, Search, FileText, BarChart3,
  Mail, Eye, Zap, Settings, Rocket,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import {
  RevealText,
  StaggerChildren,
  GlowDivider,
  MagneticButton,
} from "@/components/ui/ScrollAnimations";

/* ─── Animation Variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
} as const;

/* ─── Timeline Data ─── */
const TIMELINE = [
  {
    time: "8:00 AM",
    icon: Search,
    title: "Lead Gen scans 500 companies",
    result: "53 qualified leads found",
    color: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/10",
  },
  {
    time: "9:00 AM",
    icon: FileText,
    title: "Content Agent publishes 3 blog posts",
    result: "SEO-optimized, brand-matched",
    color: "text-cyan-400",
    border: "border-cyan-500/20",
    bg: "bg-cyan-500/10",
  },
  {
    time: "10:00 AM",
    icon: BarChart3,
    title: "SEO Dominator optimizes 12 pages",
    result: "Meta tags, headers, internal links",
    color: "text-purple-400",
    border: "border-purple-500/20",
    bg: "bg-purple-500/10",
  },
  {
    time: "12:00 PM",
    icon: Mail,
    title: "Email Sequencer sends 200 outreach emails",
    result: "Personalized per prospect",
    color: "text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/10",
  },
  {
    time: "3:00 PM",
    icon: Eye,
    title: "Competitor Agent delivers market intel report",
    result: "Pricing, positioning, gaps",
    color: "text-rose-400",
    border: "border-rose-500/20",
    bg: "bg-rose-500/10",
  },
  {
    time: "5:00 PM",
    icon: BarChart3,
    title: "Revenue dashboard shows attribution",
    result: "Leads → pipeline → revenue tracked",
    color: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/10",
  },
];

/* ─── Steps Data ─── */
const STEPS = [
  {
    step: "01",
    icon: Zap,
    title: "Connect",
    desc: "Link your domain, CRM, and email. Takes under 10 minutes.",
  },
  {
    step: "02",
    icon: Settings,
    title: "Configure",
    desc: "Pick which agents run, set schedules, define your ICP and brand voice.",
  },
  {
    step: "03",
    icon: Rocket,
    title: "Deploy",
    desc: "Agents go live. Lead gen, content, SEO, and outreach run on autopilot.",
  },
];

/* ─── ROI Calculator ─── */
function ROICalculator() {
  const [employees, setEmployees] = useState(3);
  const [salary, setSalary] = useState(40000);

  const currentCost = employees * salary;
  const sovereignCost = 499; // Enterprise plan — $499/mo (white-label, 10K runs, SLA)
  const savings = currentCost - sovereignCost;
  const savingsPercent = Math.round((savings / currentCost) * 100);

  const formatUsd = (n: number) =>
    "$" + n.toLocaleString("en-US");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      className="relative p-8 md:p-12 rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.02] backdrop-blur-xl overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5" />

      <div className="relative z-10">
        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-[0.2em] mb-10">
          ROI Calculator
        </h3>

        {/* Sliders */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Employees slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-neutral-400">
                Employees you&apos;d replace
              </label>
              <span className="text-lg font-bold text-white font-mono">
                {employees}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={employees}
              onChange={(e) => setEmployees(Number(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400
                [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(16,185,129,0.5)] [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-emerald-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
              <span>1</span>
              <span>10</span>
            </div>
          </div>

          {/* Salary slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-neutral-400">
                Avg monthly salary per employee
              </label>
              <span className="text-lg font-bold text-white font-mono">
                {formatUsd(salary)}
              </span>
            </div>
            <input
              type="range"
              min={20000}
              max={80000}
              step={5000}
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400
                [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(16,185,129,0.5)] [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-emerald-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
              <span>R20K</span>
              <span>R80K</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">
              Current cost
            </p>
            <p className="text-2xl md:text-3xl font-bold text-red-400 font-mono">
              {formatUsd(currentCost)}
            </p>
            <p className="text-xs text-neutral-500 mt-1">/month</p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">
              Sovereign Matrix
            </p>
            <p className="text-2xl md:text-3xl font-bold text-emerald-400 font-mono">
              {formatUsd(sovereignCost)}
            </p>
            <p className="text-xs text-neutral-500 mt-1">/month</p>
          </div>

          <div className="p-6 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 text-center">
            <p className="text-xs text-emerald-400/70 uppercase tracking-wider mb-2">
              You save
            </p>
            <p className="text-2xl md:text-3xl font-bold text-emerald-400 font-mono">
              {savings > 0 ? formatUsd(savings) : "$0"}
            </p>
            <p className="text-xs text-emerald-400/50 mt-1">
              {savings > 0 ? `${savingsPercent}% less` : "—"} /month
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <MagneticButton>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-emerald-500 text-black text-sm font-bold uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            >
              Start saving <ArrowRight className="w-4 h-4" />
            </Link>
          </MagneticButton>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Page ─── */
export default function ForAgenciesPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-white antialiased">
      {/* ─── Navigation ─── */}
      <nav className="fixed top-6 inset-x-0 z-50 flex justify-center px-6 pointer-events-none">
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-full px-8 h-16 flex items-center justify-between gap-12 pointer-events-auto max-w-5xl w-full">
          <Link href="/" className="flex items-center gap-3">
            <SovereignLogo size="sm" />
            <span className="hidden sm:block text-sm font-bold tracking-[0.2em] uppercase text-white font-serif">
              For Agencies
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="hidden md:block text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Home
            </Link>
            <Link
              href="/signup"
              className="px-6 py-2.5 rounded-full bg-emerald-500 text-black text-xs font-bold uppercase tracking-widest hover:bg-emerald-400 transition-all"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      <main id="main-content">

      {/* ─── Hero ─── */}
      <section className="relative pt-40 pb-24 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-emerald-500/[0.04] rounded-full blur-[250px]" />
        <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[200px]" />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-5xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-[0.2em] mb-8">
            <Zap className="w-3 h-3" /> For Agencies
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6 font-serif">
            Replace 6 employees
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
              with AI agents
            </span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 max-w-3xl mx-auto mb-12 leading-relaxed">
            Lead gen, content, SEO, outreach, design, and reporting — running 24/7.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <MagneticButton>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-emerald-500 text-black text-sm font-bold uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
              >
                Start your free trial <ArrowRight className="w-4 h-4" />
              </Link>
            </MagneticButton>
            <Link
              href="#calculator"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/10 text-neutral-300 text-sm font-bold uppercase tracking-widest hover:border-white/20 hover:text-white transition-all"
            >
              See the math
            </Link>
          </div>
        </motion.div>
      </section>

      <GlowDivider />

      {/* ─── ROI Calculator ─── */}
      <section id="calculator" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <RevealText as="h2" className="text-3xl md:text-4xl font-bold text-center mb-6 font-serif">
            The Math Speaks for Itself
          </RevealText>
          <RevealText as="p" className="text-neutral-500 text-center max-w-2xl mx-auto mb-16" delay={0.1}>
            Drag the sliders. See what you save.
          </RevealText>

          <ROICalculator />
        </div>
      </section>

      <GlowDivider />

      {/* ─── Day-in-the-Life Timeline ─── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <RevealText as="h2" className="text-3xl md:text-4xl font-bold text-center mb-6 font-serif">
            A Day in the Life of Your AI Team
          </RevealText>
          <RevealText as="p" className="text-neutral-500 text-center max-w-2xl mx-auto mb-16" delay={0.1}>
            While you sleep, pitch, or take calls — your agents are working.
          </RevealText>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 md:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500/30 via-white/10 to-transparent" />

            <StaggerChildren className="space-y-6">
              {TIMELINE.map((item) => (
                <motion.div
                  key={item.time}
                  variants={fadeUp}
                  className="relative flex gap-6 md:gap-8 group"
                >
                  {/* Time dot */}
                  <div className="relative z-10 flex-shrink-0 w-12 md:w-16 flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${item.bg} border ${item.border} shadow-[0_0_12px_rgba(16,185,129,0.2)] mt-1.5`} />
                  </div>

                  {/* Card */}
                  <div className="flex-1 p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl group-hover:border-emerald-500/20 transition-all duration-500 mb-2">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center flex-shrink-0`}>
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`text-xs font-mono font-bold ${item.color}`}>
                            {item.time}
                          </span>
                        </div>
                        <h3 className="text-sm md:text-base font-semibold text-white mb-1">
                          {item.title}
                        </h3>
                        <p className="text-xs text-neutral-400">
                          {item.result}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </StaggerChildren>
          </div>
        </div>
      </section>

      <GlowDivider />

      {/* ─── 3-Step Process ─── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <RevealText as="h2" className="text-3xl md:text-4xl font-bold text-center mb-6 font-serif">
            Live in 3 Steps
          </RevealText>
          <RevealText as="p" className="text-neutral-500 text-center max-w-2xl mx-auto mb-16" delay={0.1}>
            No code. No training. No onboarding calls required.
          </RevealText>

          <StaggerChildren className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <motion.div
                key={s.step}
                variants={fadeUp}
                className="group relative p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-emerald-500/20 transition-all duration-500 overflow-hidden text-center"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-emerald-500/[0.04] to-transparent" />

                <div className="relative z-10">
                  <span className="text-4xl font-bold text-white/[0.06] font-mono block mb-4">
                    {s.step}
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-6 group-hover:border-emerald-500/20 transition-colors">
                    <s.icon className="w-6 h-6 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      <GlowDivider />

      {/* ─── Final CTA ─── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <RevealText as="h2" className="text-3xl md:text-5xl font-bold mb-6 font-serif">
            Start Your Free Trial
          </RevealText>
          <RevealText as="p" className="text-neutral-500 mb-10 max-w-xl mx-auto" delay={0.1}>
            100 free runs. No credit card. Cancel anytime.
          </RevealText>
          <MagneticButton>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold uppercase tracking-widest hover:from-emerald-600 hover:to-teal-600 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            >
              Start your free trial <ArrowRight className="w-4 h-4" />
            </Link>
          </MagneticButton>
        </div>
      </section>

      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <SovereignLogo size="sm" />
            <span className="text-xs text-neutral-500">
              Sovereign Matrix &mdash; AI Agents for Agencies
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-neutral-500">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
