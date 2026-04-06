"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * LIVE PULSE — Shows the platform is alive and processing in real-time.
 * Displays a rotating feed of "live" agent activities with a heartbeat pulse.
 * Fixed to bottom-left corner of the screen.
 */

const LIVE_EVENTS = [
  "Lead Gen found 12 prospects in London",
  "Blog post generated: AI Marketing Trends",
  "SEO audit completed for techstartup.io",
  "Email sequence drafted (5 steps)",
  "Competitor scan: 3 vulnerabilities found",
  "Voice agent completed sales call (2m 14s)",
  "Proposal generated for enterprise client",
  "Content calendar created (30 days)",
  "Brand voice learned from 5 samples",
  "Code review: 3 issues fixed automatically",
  "Knowledge graph: 47 new relationships stored",
  "Smart router: Nemotron Ultra selected (0.94 confidence)",
];

export function LivePulse() {
  const [eventIndex, setEventIndex] = useState(0);
  const [agentCount, setAgentCount] = useState(129);

  useEffect(() => {
    const timer = setInterval(() => {
      setEventIndex(prev => (prev + 1) % LIVE_EVENTS.length);
    }, 4000);

    // Slowly tick up agent count (simulates real activity)
    const countTimer = setInterval(() => {
      setAgentCount(prev => {
        if (prev >= 135) return 129;
        return prev + 1;
      });
    }, 8000);

    return () => { clearInterval(timer); clearInterval(countTimer); };
  }, []);

  return (
    <div className="fixed bottom-6 left-6 z-50 hidden md:block">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2 }}
        className="flex items-center gap-3 px-4 py-2.5 rounded-full border border-white/[0.06] bg-[#0A0A0A]/90 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.5)]"
      >
        {/* Heartbeat pulse */}
        <div className="relative">
          <span className="w-2 h-2 rounded-full bg-emerald-500 block" />
          <motion.span
            className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500"
            animate={{ scale: [1, 2.5, 1], opacity: [1, 0, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
        </div>

        {/* Live event */}
        <div className="max-w-[220px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={eventIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-[10px] text-neutral-400 block truncate"
            >
              {LIVE_EVENTS[eventIndex]}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Agent count */}
        <span className="text-[9px] text-emerald-500/60 font-mono pl-2 border-l border-white/[0.06]">
          {agentCount} live
        </span>
      </motion.div>
    </div>
  );
}
