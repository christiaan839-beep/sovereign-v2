"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ACTIVITIES = [
  "Lead Gen found 23 prospects in Austin, TX",
  "Blog Gen wrote 1,847-word SEO article",
  "Market Analyst completed website audit (score: 87/100)",
  "Voice Agent booked 2 meetings for Thursday",
  "Smart Router selected DeepSeek V3.2 for reasoning task",
  "PII Guard redacted 3 email addresses from output",
  "Code Agent generated React component (47 lines)",
  "SEO Dominator found 234 keyword opportunities",
  "Email Sequence sent 15 personalized outreach emails",
  "Content Agent created social media pack (5 posts)",
  "War Room synthesized 4-agent competitive analysis",
  "Document Intel extracted 12 key clauses from contract",
  "NeMo Guardrails blocked jailbreak attempt (score: 0.94)",
  "Workflow Engine completed 3-step pipeline in 4.2s",
  "Image Gen created product mockup via FLUX.1",
];

/**
 * LiveTicker — Scrolling banner of agent activity.
 * Creates urgency and social proof — the platform is alive and working.
 */
export function LiveTicker() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % ACTIVITIES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full overflow-hidden border-y border-white/[0.03] bg-white/[0.01] py-2.5">
      <div className="max-w-5xl mx-auto px-6 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-40" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[10px] text-emerald-500/60 uppercase tracking-widest font-semibold">Live</span>
        </div>

        <div className="flex-1 overflow-hidden h-4 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 flex items-center"
            >
              <span className="text-[11px] text-neutral-500 truncate">{ACTIVITIES[current]}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        <span className="text-[9px] text-neutral-700 shrink-0 hidden sm:block">
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
