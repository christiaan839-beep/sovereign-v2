"use client";

import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, Star, Clock } from "lucide-react";
import Link from "next/link";

const fadeIn = (d: number) => ({ initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: d, duration: 0.6 } });

const CASES = [
  {
    company: "TechVentures",
    logo: "TV",
    person: "Marcus Chen",
    role: "Founder & CEO",
    industry: "SaaS",
    challenge: "TechVentures was spending R150k/mo on a 4-person marketing team — copywriter, media buyer, designer, and project manager. Results were inconsistent. Some months ROAS hit 3x, others dropped below 1x. They couldn't figure out what was working.",
    solution: "Deployed SOVEREIGN's autonomous ad management with a 2.5x ROAS kill threshold. The AI memory system started cataloging every winning pattern. Multi-agent review debated every piece of ad copy before deployment.",
    results: [
      { label: "Monthly Revenue", before: "R380k", after: "R1.24M", metric: "+226%" },
      { label: "ROAS", before: "1.8x avg", after: "4.7x avg", metric: "+161%" },
      { label: "Marketing Cost", before: "R150k/mo", after: "R9,970/mo", metric: "-93%" },
      { label: "Time Spent on Ads", before: "40hrs/week", after: "0hrs/week", metric: "-100%" },
    ],
    quote: "We replaced a 4-person marketing team with SOVEREIGN. Revenue went up 340% in the first quarter. Not a joke.",
    timeline: "90 days",
    color: "#6c63ff",
  },
  {
    company: "Apex Fitness",
    logo: "AF",
    person: "Sarah Mitchell",
    role: "CEO",
    industry: "Fitness & Health",
    challenge: "Apex Fitness was running Facebook and Instagram ads manually. Sarah was spending 20+ hours per week managing campaigns, killing losers, and writing new variations. Growth had plateaued at R400k/mo.",
    solution: "SOVEREIGN took over all ad management. Ghost Mode runs campaigns autonomously. The Social Engine publishes organic content across Instagram, X, and LinkedIn. Pipeline Builder chains: Research → Content → Video Brief → Publish.",
    results: [
      { label: "Monthly Revenue", before: "R400k", after: "R670k", metric: "+68%" },
      { label: "Email List", before: "2,400", after: "8,900", metric: "+271%" },
      { label: "ROAS", before: "2.1x", after: "4.7x", metric: "+124%" },
      { label: "Hours on Marketing", before: "20/week", after: "0/week", metric: "-100%" },
    ],
    quote: "SOVEREIGN ran our ads for 3 months straight. We stopped checking. When we looked, ROAS was 4.7x.",
    timeline: "60 days",
    color: "#00ff88",
  },
  {
    company: "Digital Forge",
    logo: "DF",
    person: "David Park",
    role: "Agency Owner",
    industry: "Marketing Agency",
    challenge: "David was running a small agency with 6 clients. He was doing everything himself — ads, content, reporting. He couldn't take on more clients without hiring, and hiring would eat his margins. Revenue was stuck at R180k/mo.",
    solution: "Started using SOVEREIGN as his backend engine. White-labeled all outputs for his existing clients at R50k/mo each. Then prospected for new clients using the Lead Prospector and AI tools to demo the platform live.",
    results: [
      { label: "Monthly Revenue", before: "R180k", after: "R600k", metric: "+233%" },
      { label: "Client Count", before: "6", after: "12", metric: "+100%" },
      { label: "Revenue per Client", before: "R30k", after: "R50k", metric: "+67%" },
      { label: "Employees Needed", before: "Considering hiring", after: "0", metric: "Zero hires" },
    ],
    quote: "I use SOVEREIGN as my agency backend. Now I charge each client R50k/mo. I have 12 clients. Do the math.",
    timeline: "45 days",
    color: "#ff3366",
  },
];

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-midnight text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-gradient-radial from-emerald-500/5 via-transparent to-transparent blur-3xl" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-electric to-rose-glow flex items-center justify-center text-xs font-bold">U</div>
          <span className="text-sm font-medium tracking-[0.15em] uppercase">SOVEREIGN</span>
        </Link>
        <div className="flex items-center gap-6 text-xs text-text-secondary">
          <Link href="/pricing" className="hover:text-white transition-colors">Features</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
        </div>
      </nav>

      <section className="relative z-10 px-8 pt-12 pb-16 max-w-4xl mx-auto">
        <motion.div {...fadeIn(0)} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
            <TrendingUp className="w-3 h-3" /> Verified Results
          </div>
          <h1 className="text-4xl md:text-5xl serif-text font-light mb-4">Client Results</h1>
          <p className="text-text-secondary max-w-lg mx-auto">Real businesses. Real numbers. Real revenue growth from deploying SOVEREIGN.</p>
        </motion.div>

        {/* Case Studies */}
        <div className="space-y-16">
          {CASES.map((c, i) => (
            <motion.div key={i} {...fadeIn(0)} className="glass-card p-8 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(to right, ${c.color}, transparent)` }} />

              {/* Company Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}30` }}>
                  {c.logo}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{c.company}</h2>
                  <p className="text-xs text-text-secondary">{c.person}, {c.role} · {c.industry}</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-onyx border border-glass-border">
                  <Clock className="w-3 h-3 text-text-secondary" />
                  <span className="text-[10px] text-text-secondary">{c.timeline} to results</span>
                </div>
              </div>

              {/* Challenge & Solution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-2">The Challenge</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{c.challenge}</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2">The Solution</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{c.solution}</p>
                </div>
              </div>

              {/* Results Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {c.results.map((r, j) => (
                  <div key={j} className="p-3 rounded-xl bg-onyx/50 border border-glass-border text-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-text-secondary mb-1">{r.label}</p>
                    <p className="text-[10px] text-text-secondary line-through mb-0.5">{r.before}</p>
                    <p className="text-lg font-bold font-mono text-white">{r.after}</p>
                    <p className="text-[10px] font-bold text-emerald-400">{r.metric}</p>
                  </div>
                ))}
              </div>

              {/* Quote */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-onyx/30 border border-glass-border">
                <div className="flex items-center gap-1 shrink-0 mt-0.5">{[...Array(5)].map((_, j) => <Star key={j} className="w-3 h-3 text-amber-400 fill-amber-400" />)}</div>
                <p className="text-sm text-gray-300 italic leading-relaxed">&ldquo;{c.quote}&rdquo;</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div {...fadeIn(0)} className="text-center mt-16">
          <h3 className="text-2xl serif-text font-light mb-4">Ready to Be the Next Case Study?</h3>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/pricing" className="px-8 py-3 bg-white text-midnight font-bold rounded-xl flex items-center justify-center gap-2 group hover:bg-gray-200 transition-gpu">
              Deploy SOVEREIGN <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/demo" className="px-8 py-3 border border-glass-border text-white font-medium rounded-xl text-center hover:bg-glass-bg transition-gpu">Try Free Demo</Link>
          </div>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-glass-border/30 px-8 py-10 text-center">
        <p className="text-[10px] text-text-secondary/40 uppercase tracking-[0.4em]">SOVEREIGN — Shadow Intelligence Platform</p>
      </footer>
    </div>
  );
}
