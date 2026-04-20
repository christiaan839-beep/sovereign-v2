"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { X, Sparkles } from "lucide-react";

/**
 * FIRST-RUN PROMPT — the single biggest activation lever.
 *
 * A new user hits the dashboard, sees empty widgets, feels
 * overwhelmed, leaves. Activation rate craters.
 *
 * This component intercepts FIRST VISIT ONLY and routes them
 * straight into Lead Blitz with a pre-filled URL. They run one
 * playbook before they even look at the full dashboard — and
 * the success of that one run determines whether they come back.
 *
 * Storage: localStorage flag (per-browser, per-user mixing fine
 * for a one-shot onboarding hint). A server-side marker in the
 * settings table would be stricter but isn't justified here —
 * if they clear localStorage and see the prompt again, worst
 * case they run another Lead Blitz. Harmless.
 *
 * Shown ONLY on /dashboard root. Dismissible. Auto-hides after
 * 8 seconds if untouched (so returning users aren't trapped).
 */

const FIRST_RUN_KEY = "sovereign-first-run-v1";
const AUTO_HIDE_MS = 8000;

export function FirstRunPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(FIRST_RUN_KEY);
    if (seen) return;

    // Wait 600ms so the dashboard finishes its own entrance animation
    // before we interrupt with this modal. Feels less jarring.
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Auto-dismiss after 8s so returning users who cleared localStorage
    // don't get stuck staring at the prompt.
    const t = setTimeout(() => {
      setVisible(false);
      localStorage.setItem(FIRST_RUN_KEY, "1");
    }, AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [visible]);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(FIRST_RUN_KEY, "1");
  }

  function handleCTA() {
    localStorage.setItem(FIRST_RUN_KEY, "1");
    // Navigation handled by Link; flag set first so back-button doesn't re-prompt
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-w-md w-full rounded-2xl bg-[#1A1712] border border-[#B5532C]/30 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="first-run-title"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute right-4 top-4 text-neutral-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#B5532C]/15 border border-[#B5532C]/30">
              <Sparkles className="h-4 w-4 text-[#B5532C]" />
            </div>

            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-neutral-500 mb-3">
              Welcome · First Run
            </p>

            <h2
              id="first-run-title"
              className="font-serif text-3xl text-white leading-tight mb-3"
            >
              Let&apos;s run your first playbook.
            </h2>
            <p className="text-[15px] text-neutral-400 leading-relaxed mb-6">
              Lead Blitz is the fastest way to see what Sovereign can
              do. Tell us your niche; in ~2 minutes you&apos;ll have
              qualified prospects with contact angles.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/dashboard/playbooks?auto=lead-blitz"
                onClick={handleCTA}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#B5532C] text-white font-mono text-sm tracking-wide hover:bg-[#A04527] transition-colors"
              >
                Run Lead Blitz →
              </Link>
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex items-center justify-center px-5 py-3 border border-white/[0.08] text-neutral-400 font-mono text-sm tracking-wide hover:bg-white/[0.04] hover:text-white transition-colors"
              >
                Explore on my own
              </button>
            </div>

            <p className="mt-4 text-[11px] text-neutral-600">
              Free tier includes 50 runs/month · No credit card required
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
