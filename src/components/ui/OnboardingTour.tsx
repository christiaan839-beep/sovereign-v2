"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Zap, Brain, Target, Shield } from "lucide-react";

const TOUR_STEPS = [
  {
    title: "Welcome, Commander.",
    description: "Your Sovereign Matrix control plane is ready. This is where you command 72+ autonomous AI agents powered by NVIDIA NIM.",
    icon: Zap,
    color: "text-emerald-400",
    highlight: "Your AI swarm is standing by.",
  },
  {
    title: "The Agent Hub",
    description: "Each card represents an autonomous agent. Click any agent to interact with it — from content generation to competitor analysis, voice AI to visual design.",
    icon: Brain,
    color: "text-violet-400",
    highlight: "72+ agents at your command.",
  },
  {
    title: "War Room Intelligence",
    description: "Navigate to the War Room to run competitive audits. Paste any competitor URL and watch the AI swarm dissect their entire strategy in real-time.",
    icon: Target,
    color: "text-orange-400",
    highlight: "Real OSINT reconnaissance.",
  },
  {
    title: "Protected by Morpheus Shield",
    description: "Every output is filtered through NeMo Guardrails for brand safety, PII redaction, and content compliance. Enterprise-grade protection by default.",
    icon: Shield,
    color: "text-red-400",
    highlight: "Zero data leaks. Ever.",
  },
];

export function OnboardingTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setVisible(false);
      window.localStorage.setItem("sovereign-onboarded", "true");
      setTimeout(onComplete, 300);
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    setVisible(false);
    window.localStorage.setItem("sovereign-onboarded", "true");
    setTimeout(onComplete, 300);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleSkip} />

          {/* Tour Card */}
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-[0_0_100px_rgba(16,185,129,0.1)]"
          >
            <button onClick={handleSkip} className="absolute top-6 right-6 text-neutral-600 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>

            <div className={`w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 ${current.color}`}>
              <current.icon className="w-7 h-7" />
            </div>

            <h2 className="text-2xl font-bold text-white serif-text mb-3">{current.title}</h2>
            <p className="text-sm text-neutral-400 leading-relaxed mb-2">{current.description}</p>
            <p className={`text-xs font-bold uppercase tracking-widest ${current.color} mb-8`}>{current.highlight}</p>

            {/* Progress dots */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${i === step ? "bg-emerald-400 w-6" : i < step ? "bg-emerald-400/30" : "bg-white/10"}`}
                  />
                ))}
              </div>
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-neutral-200 transition-all"
              >
                {isLast ? "Launch" : "Next"} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook to determine if onboarding should show.
 */
export function useOnboarding() {
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    const done = window.localStorage.getItem("sovereign-onboarded");
    if (!done) setTimeout(() => setShowTour(true), 0);
  }, []);
  return { showTour, setShowTour };
}
