"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { TOTAL_AGENTS } from "@/lib/platform-stats";


const PLATFORM_FACTS = [
  {
    metric: "130+",
    label: "Agent Endpoints",
    desc: "Each calling a real AI model. Zero fakes, zero simulations.",
    color: "from-emerald-400/20 to-transparent",
  },
  {
    metric: "$0",
    label: "Per-Token Cost",
    desc: "26 NVIDIA NIM models at zero inference cost. Scale without scaling your bill.",
    color: "from-[#00B7FF]/20 to-transparent",
  },
  {
    metric: "5",
    label: "Safety Layers",
    desc: "Jailbreak detection, topic control, content safety, PII scan, quality scoring.",
    color: "from-rose-400/20 to-transparent",
  },
];

const TOOL_SHOWCASE = [
  {
    name: "Outbound Engine",
    desc: "Multi-step cold outreach sequences",
    gradient: "from-[#00B7FF] to-blue-600",
  },
  {
    name: "Programmatic SEO",
    desc: "50+ SEO pages generated per hour",
    gradient: "from-emerald-400 to-green-600",
  },
  {
    name: "Competitor Intel",
    desc: "Porter's Five Forces battle plans",
    gradient: "from-rose-400 to-red-600",
  },
  {
    name: "Ad Creative Gen",
    desc: "5 variations per campaign, PAS framework",
    gradient: "from-amber-400 to-orange-600",
  },
  {
    name: "Page Builder",
    desc: "Full landing pages in 30 seconds",
    gradient: "from-purple-400 to-indigo-600",
  },
  {
    name: "AI Booking Agent",
    desc: "BANT-qualified leads, 0-100 scoring",
    gradient: "from-pink-400 to-rose-600",
  },
];

export function Testimonials() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="w-full max-w-7xl mx-auto py-24 relative z-10">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y:20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white serif-text mb-4">
            Built different. Verified.
          </h2>
          <p className="text-neutral-400 text-sm uppercase tracking-[0.2em]">
            Every number is real. Every agent calls a real AI model.
          </p>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLATFORM_FACTS.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: i * 0.15 }}
            className="relative group"
          >
            <div className={`absolute inset-0 rounded-3xl bg-gradient-to-b ${t.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="relative rounded-2xl border border-white/[0.06] bg-[#080808] p-8 h-full flex flex-col">
              <div className="text-5xl font-black text-white mb-2 tracking-tight">{t.metric}</div>
              <div className="text-sm font-semibold text-white mb-3">{t.label}</div>
              <p className="text-sm text-neutral-500 leading-relaxed">{t.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function ToolShowcase() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % TOOL_SHOWCASE.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={ref} className="w-full max-w-7xl mx-auto py-24 relative z-10">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white serif-text mb-4">
            {TOTAL_AGENTS} AI Agents. One Dashboard.
          </h2>
          <p className="text-neutral-400 text-sm uppercase tracking-[0.2em]">
            From lead generation to deployment — every function automated
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {TOOL_SHOWCASE.map((tool, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className={`relative rounded-2xl p-6 border transition-gpu duration-500 cursor-pointer group ${
              activeIndex === i
                ? "border-white/20 bg-white/[0.05] scale-105 shadow-[0_0_40px_rgba(0,183,255,0.1)]"
                : "border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.03]"
            }`}
            onClick={() => setActiveIndex(i)}
          >
            {/* Gradient bar */}
            <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${tool.gradient} mb-4 transition-gpu duration-500 ${
              activeIndex === i ? "w-full" : "w-12"
            }`} />

            <h3 className="text-sm font-bold text-white mb-1">{tool.name}</h3>
            <p className="text-[10px] text-neutral-500 leading-relaxed">{tool.desc}</p>

            {/* Active indicator */}
            {activeIndex === i && (
              <motion.div
                layoutId="active-tool"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#00B7FF] shadow-[0_0_10px_rgba(0,183,255,0.5)]"
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* Bottom CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 0.8 }}
        className="text-center mt-12"
      >
        <p className="text-xs text-neutral-600 uppercase tracking-[0.2em]">
          + 23 more agents including Email Sequences, Reputation AI, Social Router, Content Calendar, and more
        </p>
      </motion.div>
    </section>
  );
}
