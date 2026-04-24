"use client";

import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield, Brain, Target, Mic, Code2, Globe, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const LAUNCH_FEATURES = [
  { icon: Brain, title: "130 AI Agents", desc: "Lead gen, content, SEO, voice, code, competitive intel — all pre-built and ready.", color: "emerald" },
  { icon: Zap, title: "38 Models", desc: "Claude Sonnet 4.6, Nemotron Ultra, Gemini 3.1 Pro, DeepSeek V3, Llama 4 Maverick. Auto-routed per task.", color: "cyan" },
  { icon: Shield, title: "5-Layer Safety", desc: "Jailbreak detection, PII scanning, content safety, quality scoring, critic review. Every request.", color: "violet" },
  { icon: Mic, title: "Voice Agents", desc: "AI that makes phone calls, qualifies leads, books meetings. Discloses AI on every call.", color: "amber" },
  { icon: Target, title: "$199/mo Flat", desc: "No credits. No per-token fees. No usage limits. One price for everything.", color: "emerald" },
  { icon: Globe, title: "Frontier-Ready", desc: "Built for frontier model safety. Every agent call passes through jailbreak, PII, policy, and quality gates.", color: "violet" },
  { icon: Code2, title: "Developer SDK", desc: "Build agents, publish to marketplace, earn 80% revenue. The Shopify for AI agents.", color: "cyan" },
  { icon: CheckCircle2, title: "White-Label", desc: "Your brand, your clients, your revenue. Agencies resell at 5x margin.", color: "amber" },
];

export default function LaunchPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 py-6 max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-white">Sovereign Matrix</Link>
        <Link href="/signup" className="px-5 py-2 rounded-full bg-emerald-500 text-xs font-semibold text-black hover:bg-emerald-400 transition-colors">
          Get Started Free
        </Link>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.06),transparent_60%)] pointer-events-none" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-60" />
              <span className="relative rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Now Live</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6">
            The Agent<br />
            <span className="text-emerald-400">Operating System.</span>
          </h1>

          <p className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-4">
            130 AI agents. 38 models. One flat price.
            They find leads, write content, scan competitors, make calls, and close deals.
            Autonomously.
          </p>

          <p className="text-sm text-neutral-600 mb-8">
            Built on NVIDIA NIM. Glasswing-grade safety. $199/mo. No credits. No per-token fees.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Link href="/free/competitor-scan" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Try Free — Scan Any Competitor <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/demo" className="px-8 py-4 rounded-full text-sm font-semibold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/5 transition-all">
              Live Demo — No Signup
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">What shipped</p>
            <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">Everything an AI platform should be.</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {LAUNCH_FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={`p-5 rounded-2xl border border-${feat.color}-500/10 bg-${feat.color}-500/[0.02] hover:border-${feat.color}-500/25 transition-all`}
              >
                <feat.icon className={`w-5 h-5 text-${feat.color}-400 mb-3`} />
                <h3 className="text-sm font-bold text-white mb-1">{feat.title}</h3>
                <p className="text-[10px] text-neutral-400 leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-16 px-6 bg-[#020202] border-y border-white/[0.03]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl md:text-3xl font-black text-white mb-8">One price. Everything included.</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Agents",       value: "130",       sub: "pre-built" },
              { label: "Models",       value: "38",        sub: "auto-routed" },
              { label: "Integrations", value: "25+",       sub: "live" },
              { label: "Safety",       value: "5-layer",   sub: "every call" },
              { label: "Cost",         value: "$19–199",   sub: "flat /mo" },
            ].map((c) => (
              <div key={c.label} className="p-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04]">
                <p className="text-[10px] text-neutral-500 mb-1 uppercase tracking-widest">{c.label}</p>
                <p className="text-sm text-emerald-400 font-bold">{c.value}</p>
                <p className="text-[10px] text-emerald-400/50">{c.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "130", label: "AI Agents" },
            { value: "38", label: "Models" },
            { value: "$199", label: "/month flat" },
            { value: "5", label: "Safety layers" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl md:text-4xl font-black text-emerald-400">{stat.value}</div>
              <div className="text-xs text-neutral-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 text-center border-t border-white/[0.03]">
        <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
          Your competitors hire humans.<br />
          <span className="text-emerald-400">You deploy agents.</span>
        </h2>
        <p className="text-neutral-400 max-w-md mx-auto mb-8">
          223 agents. 38 models. $199/mo. Start in 60 seconds.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-black font-semibold rounded-full text-sm hover:bg-emerald-400 transition-all">
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/" className="px-8 py-4 rounded-full text-sm text-neutral-300 border border-white/[0.1] hover:border-white/[0.2] transition-all">
            Explore the platform
          </Link>
        </div>
      </section>
    </div>
  );
}
