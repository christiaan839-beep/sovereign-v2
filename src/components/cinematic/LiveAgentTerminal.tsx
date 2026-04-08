"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Terminal, Cpu } from "lucide-react";
import Link from "next/link";

// Realistic step-by-step scan output for demo
const DEMO_STEPS = [
  { delay: 0,    type: "system",   text: "SOVEREIGN AGENT v2.4 · competitor-intelligence · TARGET: hubspot.com" },
  { delay: 500,  type: "system",   text: "ROUTING → nemotron-ultra-253b · deepseek-v3.2 · gemma-4-31b  [3 parallel]" },
  { delay: 900,  type: "think",    text: "→ DNS resolution + CDN fingerprint: Cloudflare Enterprise, 12-region..." },
  { delay: 1400, type: "think",    text: "→ Crawling 847 pages across 4 subdomains (www, blog, academy, community)..." },
  { delay: 2000, type: "think",    text: "→ Tech stack: React 18, GraphQL, Contentful CMS, MixPanel analytics..." },
  { delay: 2600, type: "think",    text: "→ Pricing signal extraction (3 tiers detected: Starter $20, Pro $890, Enterprise custom)..." },
  { delay: 3200, type: "think",    text: "→ SEO coverage: scanning 22,400 target keywords against their rankings..." },
  { delay: 3900, type: "think",    text: "→ Cross-referencing G2 reviews (3,847 reviews), Capterra, Trustpilot, Reddit/SaaS..." },
  { delay: 4600, type: "think",    text: "→ Social sentiment NLP over last 90 days (Twitter, LinkedIn, HN)..." },
  { delay: 5200, type: "think",    text: "→ Consensus verification: 3 models agree on 94.1% of findings..." },
  { delay: 5800, type: "divider",  text: "═══════════════════════════════════════════" },
  { delay: 6000, type: "heading",  text: "COMPETITIVE INTELLIGENCE REPORT  ·  hubspot.com" },
  { delay: 6200, type: "divider",  text: "───────────────────────────────────────────" },
  { delay: 6400, type: "subhead",  text: "CRITICAL WEAKNESSES  [3 of 14 shown]" },
  { delay: 6600, type: "weakness", text: "⚠  PRICING GAP: 47% of churned SMBs cite $890+/mo pricing. Demand exists in $50–200 tier they ignore." },
  { delay: 7100, type: "weakness", text: "⚠  NO TRUE AGENTS: HubSpot AI = OpenAI wrapper. No memory, no chaining, no multi-model routing. Marketing only." },
  { delay: 7600, type: "weakness", text: "⚠  SETUP FRICTION: Workflows require 8+ manual steps. Mentioned in 340+ negative reviews as primary churn driver." },
  { delay: 8000, type: "subhead",  text: "MARKET GAPS  [2 of 12 shown]" },
  { delay: 8200, type: "gap",      text: "◆  14,200 keywords they rank <20 for: ai-sales-agent, autonomous-outreach, agent-crm — all growing 340% YoY." },
  { delay: 8600, type: "gap",      text: "◆  3,400 agencies actively searching for white-label HubSpot alternative. HubSpot offers none." },
  { delay: 8900, type: "subhead",  text: "YOUR BATTLE PLAN  [immediate actions]" },
  { delay: 9100, type: "action",   text: '01 → Run ads targeting churned HubSpot SMBs: "HubSpot charged you $890. We do more for $199."' },
  { delay: 9500, type: "action",   text: '02 → Own keyword cluster: "HubSpot alternative for agencies" — 8,400 searches/mo, KD 28 (easy win).' },
  { delay: 9900, type: "action",   text: "03 → Demo agent chaining vs their workflow builder. Your 3-step vs their 14-step setup — side by side." },
  { delay: 10300,type: "action",   text: "04 → Contact the 3,400 agencies. Lead list attached: 3,400 companies, enriched with LinkedIn + email." },
  { delay: 10700,type: "divider",  text: "───────────────────────────────────────────" },
  { delay: 10900,type: "subhead",  text: "SAFETY PIPELINE  [5-layer verification]" },
  { delay: 11100,type: "system",   text: "  ✓ L1 Jailbreak Detection ··· PASS (0 injections detected)" },
  { delay: 11300,type: "system",   text: "  ✓ L2 PII Scanning ········· PASS (0 personal data exposed)" },
  { delay: 11500,type: "system",   text: "  ✓ L3 Content Safety ······· PASS (no harmful content)" },
  { delay: 11700,type: "system",   text: "  ✓ L4 Quality Score ········ 94.1/100 (exceeds 70 threshold)" },
  { delay: 11900,type: "system",   text: "  ✓ L5 Critic Review ········ APPROVED (factual, no hallucinations)" },
  { delay: 12200,type: "divider",  text: "───────────────────────────────────────────" },
  { delay: 12400,type: "complete", text: "✓ COMPLETE · 12.4s · 5-layer verified · 4 models consulted · confidence: 94.1/100" },
];

type StepType = "system" | "think" | "divider" | "heading" | "subhead" | "weakness" | "gap" | "action" | "complete";

const STEP_CLASSES: Record<StepType, string> = {
  system:   "text-neutral-600",
  think:    "text-neutral-500",
  divider:  "text-neutral-700 select-none",
  heading:  "text-white font-bold",
  subhead:  "text-emerald-500/70 font-semibold mt-3",
  weakness: "text-amber-400/80 pl-3 border-l border-amber-500/20",
  gap:      "text-cyan-400/80 pl-3 border-l border-cyan-500/20",
  action:   "text-emerald-300 pl-3 border-l border-emerald-500/30",
  complete: "text-emerald-400 font-semibold",
};

export function LiveAgentTerminal() {
  const [visible, setVisible] = useState<typeof DEMO_STEPS>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function runDemo() {
    if (running) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setVisible([]);
    setRunning(true);
    setDone(false);

    DEMO_STEPS.forEach((step, i) => {
      const t = setTimeout(() => {
        setVisible(prev => [...prev, step]);
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        if (i === DEMO_STEPS.length - 1) {
          setRunning(false);
          setDone(true);
        }
      }, step.delay);
      timers.current.push(t);
    });
  }

  useEffect(() => {
    const t = setTimeout(runDemo, 1000);
    return () => {
      clearTimeout(t);
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="py-24 px-6 bg-[#020202] relative overflow-hidden">
      {/* ambient glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.025] blur-[140px] pointer-events-none" />

      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Live Agent Demo</p>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-[1.05] mb-4">
            Watch an agent dismantle<br />
            <span className="text-emerald-400">your competitor.</span>
          </h2>
          <p className="text-neutral-400 text-sm max-w-md mx-auto leading-relaxed">
            Real competitor intelligence. No signup. This demo runs on HubSpot —
            the same agent works on any URL you choose.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-white/[0.07] bg-[#070707] overflow-hidden shadow-[0_0_100px_rgba(16,185,129,0.05)]"
        >
          {/* Window chrome */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05] bg-[#040404]">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/30" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
              </div>
              <Terminal className="w-3.5 h-3.5 text-neutral-700" />
              <span className="text-[10px] font-mono text-neutral-600">sovereign-matrix · agent/competitor-intelligence</span>
            </div>
            <div className="flex items-center gap-4">
              {running && (
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/80">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  LIVE
                </span>
              )}
              {done && <span className="text-[10px] font-mono text-emerald-500/50">✓ DONE</span>}
              <button
                type="button"
                onClick={runDemo}
                disabled={running}
                className="text-[10px] font-mono text-neutral-600 hover:text-emerald-400 transition-colors disabled:opacity-30"
              >
                ↺ replay
              </button>
            </div>
          </div>

          {/* Terminal output */}
          <div
            ref={scrollRef}
            className="h-[420px] overflow-y-auto p-5 font-mono text-[11px] leading-[1.7] space-y-0.5 scrollbar-hide"
          >
            {visible.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={STEP_CLASSES[step.type as StepType] ?? "text-neutral-400"}
              >
                {step.text}
              </motion.div>
            ))}
            {running && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.7 }}
                className="text-emerald-400 inline-block"
              >█</motion.span>
            )}
          </div>

          {/* Footer CTA */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4 border-t border-white/[0.04] bg-[#030303]">
            <div className="flex items-center gap-2 text-[10px] text-neutral-700 font-mono">
              <Cpu className="w-3 h-3" />
              <span>demo · target: hubspot.com · 3 models · 5-layer verified</span>
            </div>
            <Link
              href="/free/competitor-scan"
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-semibold whitespace-nowrap"
            >
              Run on your competitor — free
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </motion.div>

        {/* Below terminal social proof */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] text-neutral-700">
          <span>No signup required</span>
          <span>·</span>
          <span>Results in &lt;15 seconds</span>
          <span>·</span>
          <span>3 free scans per day</span>
          <span>·</span>
          <span>Works on any URL</span>
        </div>
      </div>
    </section>
  );
}
