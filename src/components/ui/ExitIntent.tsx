"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const STORAGE_KEY = "sovereign_exit_intent_shown";

/**
 * ExitIntent — Captures visitors about to leave.
 * Shows once per session when mouse moves toward browser close/tab area.
 * Offers the live demo as a low-commitment alternative to signing up.
 */
export function ExitIntent() {
  const [visible, setVisible] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(visible);

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVisible(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  useEffect(() => {
    // Only show on desktop, only once per session
    if (typeof window === "undefined" || window.innerWidth < 768) return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 5 && !sessionStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
        sessionStorage.setItem(STORAGE_KEY, "true");
      }
    };

    // Delay listener by 10 seconds so it doesn't trigger on page load
    const timeout = setTimeout(() => {
      document.addEventListener("mouseleave", handleMouseLeave);
    }, 10000);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={() => setVisible(false)}
      >
        <motion.div
          ref={trapRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-intent-title"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setVisible(false)}
            className="absolute top-4 right-4 p-1 text-neutral-500 hover:text-white transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-5">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Before you go</span>
            </div>

            <h3 id="exit-intent-title" className="text-xl font-bold text-white mb-3">
              See it work in 30 seconds
            </h3>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              No signup needed. Type a goal, watch an AI agent execute it live. Three free tries.
            </p>

            <Link
              href="/demo/live"
              onClick={() => setVisible(false)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-full text-sm hover:bg-emerald-400 transition-colors"
            >
              Try the Live Demo <ArrowRight className="w-4 h-4" />
            </Link>

            <p className="text-[10px] text-neutral-600 mt-4">
              No account required. No credit card. Just results.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
