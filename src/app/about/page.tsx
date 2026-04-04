"use client";

import { motion } from "framer-motion";
import { Brain, Shield, Code, ArrowRight, Cpu } from "lucide-react";
import Link from "next/link";

const fadeIn = (d: number) => ({ initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: d, duration: 0.6 } });

const VALUES = [
  { icon: Cpu, title: "Autonomy Over Manual", desc: "Every feature we build must work without human intervention. If it needs babysitting, it doesn't ship." },
  { icon: Brain, title: "Intelligence That Compounds", desc: "Every success is stored. Every failure is learned from. The system gets smarter with every campaign it runs." },
  { icon: Shield, title: "Your Data, Your System", desc: "SOVEREIGN runs on your infrastructure, with your API keys. We never see your data. Period." },
  { icon: Code, title: "Build in Public", desc: "15 engines, 53 routes, open architecture. We don't hide behind a black box. You see everything." },
];

const STATS = [
  { value: "15", label: "AI Engines" },
  { value: "53+", label: "Routes" },
  { value: "R2.3M", label: "Revenue Generated" },
  { value: "0", label: "Human Employees Needed" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-midnight text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-gradient-radial from-electric/5 via-transparent to-transparent blur-3xl" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-5xl mx-auto">
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

      <main id="main-content">

      <section className="relative z-10 px-8 pt-16 pb-20 max-w-3xl mx-auto">
        <motion.div {...fadeIn(0)} className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl serif-text font-light mb-6">We Build Autonomous<br /><span className="bg-gradient-to-r from-electric to-rose-glow bg-clip-text text-transparent font-medium">Intelligence Systems</span></h1>
          <p className="text-text-secondary max-w-xl mx-auto leading-relaxed">
            SOVEREIGN was born from a simple question: what if your marketing team never slept, never forgot, and got better every single day? We built the answer — 15 AI engines that run your entire marketing operation autonomously.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div {...fadeIn(0.1)} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-20">
          {STATS.map((s, i) => (
            <div key={i} className="glass-card p-5 text-center">
              <p className="text-2xl font-bold text-white font-mono mb-1">{s.value}</p>
              <p className="text-[10px] uppercase tracking-widest text-text-secondary">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* The Story */}
        <motion.div {...fadeIn(0.15)} className="mb-20">
          <h2 className="text-xs font-bold uppercase tracking-widest text-electric mb-6">The Problem</h2>
          <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
            <p>Marketing agencies charge R100-250k per month for a team that works 9-5, takes holidays, and forgets what worked last quarter. AI tools like Jasper or Copy.ai solve one problem each — but your marketing needs a system, not a typewriter.</p>
            <p>We asked: what if one platform could replace the entire team? Not just write copy — but analyze competitors, debate ad variations with itself, test prompts against each other, kill underperforming ads while you sleep, and remember every winning pattern forever?</p>
            <p className="text-white font-medium">That&apos;s SOVEREIGN. 15 engines. Zero employees. Fully autonomous.</p>
          </div>
        </motion.div>

        {/* Values */}
        <motion.div {...fadeIn(0.2)} className="mb-20">
          <h2 className="text-xs font-bold uppercase tracking-widest text-electric mb-6">Our Principles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VALUES.map((v, i) => (
              <div key={i} className="glass-card p-5">
                <v.icon className="w-5 h-5 text-electric mb-3" />
                <h3 className="text-sm font-bold text-white mb-1.5">{v.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Architecture */}
        <motion.div {...fadeIn(0.25)} className="mb-20">
          <h2 className="text-xs font-bold uppercase tracking-widest text-electric mb-6">The Architecture</h2>
          <div className="glass-card p-6 text-xs font-mono text-text-secondary space-y-2">
            <p><span className="text-electric">Framework:</span> Next.js 15 · React 19 · TypeScript</p>
            <p><span className="text-electric">AI Models:</span> Gemini 2.5 Pro + Claude 3.5 (unified router)</p>
            <p><span className="text-electric">Engines:</span> 15 autonomous agents operating in parallel</p>
            <p><span className="text-electric">Deployment:</span> Vercel Edge Network (global CDN)</p>
            <p><span className="text-electric">Auth:</span> Cookie-based with middleware route guards</p>
            <p><span className="text-electric">Payments:</span> Paystack with HMAC-SHA512 webhook verification</p>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div {...fadeIn(0.3)} className="text-center">
          <h3 className="text-2xl serif-text font-light mb-4">See It In Action</h3>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/demo" className="px-8 py-3 bg-white text-midnight font-bold rounded-xl flex items-center justify-center gap-2 group hover:bg-gray-200 transition-gpu">
              Try Live Demo <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/case-studies" className="px-8 py-3 border border-glass-border text-white font-medium rounded-xl text-center hover:bg-glass-bg transition-gpu">View Results</Link>
          </div>
        </motion.div>
      </section>

      </main>

      <footer className="relative z-10 border-t border-glass-border/30 px-8 py-10 text-center">
        <p className="text-[10px] text-text-secondary/40 uppercase tracking-[0.4em]">SOVEREIGN — Shadow Intelligence Platform</p>
      </footer>
    </div>
  );
}
