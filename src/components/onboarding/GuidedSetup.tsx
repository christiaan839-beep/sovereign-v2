"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, User, Rocket, Building2, Code2,
  FileText, Target, Globe2, BarChart3, Mic, Cpu, Shield, Palette,
  ArrowRight, ArrowLeft, Check, Sparkles,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────── */
interface OnboardingData {
  role: string;
  needs: string[];
  workspaceName: string;
  completedAt: string;
}

const STORAGE_KEY = "sovereign_onboarding";

/* ── Hook: check onboarding completion ─────────────────────────── */
export function useOnboardingComplete(): boolean {
  const [complete] = useState(() => {
    if (typeof window === "undefined") return true; // default true to prevent flash
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw).completedAt != null : false;
    } catch {
      return false;
    }
  });
  return complete;
}

/* ── Role options ──────────────────────────────────────────────── */
const ROLES = [
  { id: "agency", label: "Agency Owner", icon: Briefcase, desc: "Running a marketing or dev agency" },
  { id: "freelancer", label: "Freelancer", icon: User, desc: "Solo creative or consultant" },
  { id: "startup", label: "Startup Founder", icon: Rocket, desc: "Building a new venture" },
  { id: "enterprise", label: "Enterprise Team", icon: Building2, desc: "Part of a large organization" },
  { id: "developer", label: "Developer", icon: Code2, desc: "Building with code and APIs" },
];

/* ── Needs options ─────────────────────────────────────────────── */
const NEEDS = [
  { id: "content", label: "Content Creation", icon: FileText },
  { id: "leads", label: "Lead Generation", icon: Target },
  { id: "websites", label: "Website Building", icon: Globe2 },
  { id: "seo", label: "SEO & Analytics", icon: BarChart3 },
  { id: "voice", label: "Voice & Calls", icon: Mic },
  { id: "code", label: "Code & Automation", icon: Cpu },
  { id: "intel", label: "Competitor Intel", icon: Shield },
  { id: "design", label: "Design", icon: Palette },
];

/* ── Spring config ─────────────────────────────────────────────── */
const spring = { type: "spring" as const, damping: 25, stiffness: 300 };

/* ── Main Component ────────────────────────────────────────────── */
export function GuidedSetup({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return !raw || !JSON.parse(raw).completedAt;
    } catch {
      return true;
    }
  });
  const [step, setStep] = useState(0);
  const [role, setRole] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [finishing, setFinishing] = useState(false);

  const toggleNeed = (id: string) => {
    setNeeds((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  const canNext = useCallback(() => {
    if (step === 0) return role !== "";
    if (step === 1) return needs.length > 0;
    if (step === 2) return workspaceName.trim().length > 0;
    return true;
  }, [step, role, needs, workspaceName]);

  const finish = () => {
    setFinishing(true);
    const data: OnboardingData = {
      role,
      needs,
      workspaceName: workspaceName.trim() || "My Workspace",
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setTimeout(() => setShow(false), 600);
  };

  if (!show) return <>{children}</>;

  const stepVariants = {
    enter: { opacity: 0, x: 60 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60 },
  };

  return (
    <div className="fixed inset-0 z-[999] bg-[#030303] flex items-center justify-center overflow-hidden">
      {/* Subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: finishing ? 0 : 1, scale: finishing ? 1.02 : 1 }}
        transition={spring}
        className="relative w-full max-w-2xl mx-4"
      >
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8 px-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-white/[0.06]">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: step >= i ? "100%" : "0%" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          ))}
        </div>

        {/* Card container */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 md:p-10 min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait">
            {/* ── Step 0: Role ── */}
            {step === 0 && (
              <motion.div
                key="step-0"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={spring}
                className="flex-1 flex flex-col"
              >
                <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                  What&apos;s your role?
                </h2>
                <p className="text-sm text-neutral-400 mb-8">
                  We&apos;ll customize your workspace based on how you work.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                  {ROLES.map((r, i) => (
                    <motion.button
                      key={r.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, ...spring }}
                      onClick={() => setRole(r.id)}
                      className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-gpu duration-200 ${
                        role === r.id
                          ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
                          : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <div className={`p-2.5 rounded-lg ${role === r.id ? "bg-emerald-500/20" : "bg-white/[0.04]"}`}>
                        <r.icon className={`w-5 h-5 ${role === r.id ? "text-emerald-400" : "text-neutral-400"}`} />
                      </div>
                      <div>
                        <span className={`text-sm font-medium ${role === r.id ? "text-white" : "text-neutral-200"}`}>
                          {r.label}
                        </span>
                        <span className="block text-[11px] text-neutral-500 mt-0.5">{r.desc}</span>
                      </div>
                      {role === r.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-auto"
                        >
                          <Check className="w-4 h-4 text-emerald-400" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Step 1: Needs ── */}
            {step === 1 && (
              <motion.div
                key="step-1"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={spring}
                className="flex-1 flex flex-col"
              >
                <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                  What do you need most?
                </h2>
                <p className="text-sm text-neutral-400 mb-8">
                  Select all that apply. You can always change these later.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                  {NEEDS.map((n, i) => {
                    const selected = needs.includes(n.id);
                    return (
                      <motion.button
                        key={n.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, ...spring }}
                        onClick={() => toggleNeed(n.id)}
                        className={`flex flex-col items-center gap-3 p-4 rounded-xl border text-center transition-gpu duration-200 ${
                          selected
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]"
                        }`}
                      >
                        <div className={`p-3 rounded-lg ${selected ? "bg-emerald-500/20" : "bg-white/[0.04]"}`}>
                          <n.icon className={`w-5 h-5 ${selected ? "text-emerald-400" : "text-neutral-400"}`} />
                        </div>
                        <span className={`text-xs font-medium ${selected ? "text-white" : "text-neutral-300"}`}>
                          {n.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Workspace Name ── */}
            {step === 2 && (
              <motion.div
                key="step-2"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={spring}
                className="flex-1 flex flex-col"
              >
                <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                  Name your workspace
                </h2>
                <p className="text-sm text-neutral-400 mb-8">
                  This will be your command center identity.
                </p>
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                  {/* Live preview header */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={spring}
                    className="w-full max-w-md bg-white/[0.03] border border-white/[0.06] rounded-xl p-6"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-lg font-semibold text-white">
                        {workspaceName || "My Workspace"}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                      sovereign matrix // command center
                    </div>
                  </motion.div>

                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="e.g. Apex Digital, Nova Labs..."
                    autoFocus
                    className="w-full max-w-md bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/30 rounded-xl px-5 py-3 text-white placeholder:text-neutral-600 focus:outline-none transition-colors text-sm"
                  />
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Success ── */}
            {step === 3 && (
              <motion.div
                key="step-3"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={spring}
                className="flex-1 flex flex-col items-center justify-center text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ ...spring, delay: 0.1 }}
                  className="w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6"
                >
                  <Check className="w-10 h-10 text-emerald-400" />
                </motion.div>
                <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                  You&apos;re ready
                </h2>
                <p className="text-sm text-neutral-400 mb-8 max-w-sm">
                  Your workspace <span className="text-white font-medium">{workspaceName || "My Workspace"}</span> is configured.
                  The Sovereign Matrix is at your command.
                </p>
                <motion.button
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={finish}
                  className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-colors text-sm flex items-center gap-2"
                >
                  Enter Dashboard
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation footer */}
          {step < 3 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
                Step {step + 1} of 4
              </div>
              <button
                onClick={() => setStep((s) => Math.min(3, s + 1))}
                disabled={!canNext()}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
