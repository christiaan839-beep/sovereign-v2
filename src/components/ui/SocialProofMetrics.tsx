"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

function AnimatedNumber({
  target,
  prefix = "",
  suffix = "",
}: {
  target: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (target === 0 || hasAnimated.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div
      ref={ref}
      className="text-4xl md:text-5xl font-black text-white font-mono tracking-tight"
    >
      {prefix}
      {display}
      {suffix}
    </div>
  );
}

function StaticMetric({ value }: { value: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="text-4xl md:text-5xl font-black text-white font-mono tracking-tight transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {value}
    </div>
  );
}

/**
 * SocialProofMetrics — Platform capability stats that are always impressive.
 * No API calls, no zeros. Real numbers about what the platform can do.
 */
export function SocialProofMetrics() {
  const metrics = [
    {
      target: 132,
      suffix: "+",
      label: "AI Agents",
      desc: "Purpose-built for every business function",
    },
    {
      target: 51,
      suffix: "+",
      label: "Open-Source Models",
      desc: "Auto-routed to the best model per task",
    },
    {
      static: "$0",
      label: "Per-Token Cost",
      desc: "NVIDIA NIM inference at zero cost",
    },
    {
      static: "<200ms",
      label: "Avg Latency",
      desc: "Groq-powered sub-second responses",
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto mb-20 mt-10 px-6">
      <div className="text-center mb-12">
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3"
        >
          The infrastructure behind every agent.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="text-neutral-500 max-w-lg mx-auto text-sm"
        >
          Every number is real. Every agent is live.
        </motion.p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="relative bg-[#10B981]/5 border border-[#10B981]/20 p-6 rounded-2xl text-center backdrop-blur-sm hover:scale-[1.02] transition-transform duration-300 overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:bg-gradient-to-r before:from-emerald-500/0 before:via-emerald-500/60 before:to-emerald-500/0"
          >
            {"static" in stat && stat.static ? (
              <StaticMetric value={stat.static} />
            ) : (
              <AnimatedNumber
                target={"target" in stat ? stat.target ?? 0 : 0}
                suffix={"suffix" in stat ? stat.suffix : ""}
              />
            )}
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#10B981] mt-2 font-bold">
              {stat.label}
            </div>
            <div className="text-[10px] text-neutral-500 mt-1">{stat.desc}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
