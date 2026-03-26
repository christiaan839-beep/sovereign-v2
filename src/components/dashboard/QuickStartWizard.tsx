"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Search, FileText, Send, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";

const STEPS = [
  {
    title: "Scan Your Competition",
    description: "Run a competitor analysis to see exactly what your rivals are doing — their keywords, ad strategy, and content gaps.",
    icon: Search,
    href: "/dashboard/competitor",
    cta: "Run Competitor Scan",
    color: "text-[#00B7FF]",
    bg: "bg-[#00B7FF]/10",
    border: "border-[#00B7FF]/20",
  },
  {
    title: "Generate Your First Content",
    description: "Create a blog post, social caption, or email sequence in seconds using AI — tailored to your brand.",
    icon: FileText,
    href: "/dashboard/content-factory",
    cta: "Open Content Hub",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    title: "Launch Outbound",
    description: "Generate a cold email sequence for your ideal client profile and start booking meetings on autopilot.",
    icon: Send,
    href: "/dashboard/content-factory",
    cta: "Build Outbound Sequence",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
];

const STORAGE_KEY = "umbra-quickstart-dismissed";

export function QuickStartWizard() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("umbra-quickstart-completed");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  const markComplete = (index: number) => {
    const next = new Set(completedSteps);
    next.add(index);
    setCompletedSteps(next);
    localStorage.setItem("umbra-quickstart-completed", JSON.stringify([...next]));
  };

  if (dismissed) return null;

  const progress = (completedSteps.size / STEPS.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-8"
      >
        <div className="glass-card border border-glass-border p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00B7FF] to-purple-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Quick Start Guide</h3>
                <p className="text-xs text-neutral-500">Complete these 3 steps to get the most out of SOVEREIGN</p>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="text-neutral-500 hover:text-white transition-colors p-1"
              aria-label="Dismiss quick start"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-white/5 rounded-full mb-6 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#00B7FF] to-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STEPS.map((step, i) => {
              const isComplete = completedSteps.has(i);
              return (
                <div
                  key={i}
                  className={`rounded-xl p-4 border transition-gpu ${
                    isComplete
                      ? "bg-emerald-500/5 border-emerald-500/20 opacity-60"
                      : `${step.bg} ${step.border} hover:-translate-y-1`
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <step.icon className={`w-5 h-5 ${step.color}`} />
                    )}
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                      Step {i + 1}
                    </span>
                  </div>
                  <h4 className={`text-sm font-bold mb-2 ${isComplete ? "text-neutral-400 line-through" : "text-white"}`}>
                    {step.title}
                  </h4>
                  <p className="text-xs text-neutral-500 mb-4 leading-relaxed">{step.description}</p>
                  {isComplete ? (
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Completed</span>
                  ) : (
                    <Link
                      href={step.href}
                      onClick={() => markComplete(i)}
                      className={`text-xs font-bold uppercase tracking-wider ${step.color} flex items-center gap-1 hover:gap-2 transition-gpu`}
                    >
                      {step.cta} <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* All Complete */}
          {completedSteps.size === STEPS.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
            >
              <p className="text-sm text-emerald-400 font-bold">
                🎉 You&apos;re all set! You&apos;ve completed the Quick Start guide.
              </p>
              <button onClick={dismiss} className="text-xs text-neutral-500 mt-2 hover:text-white transition-colors">
                Dismiss this guide
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
