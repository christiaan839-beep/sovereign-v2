"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Shield,
  Mail,
  Sparkles,
  Loader2,
  CheckCircle2,
  Clock,
  Rocket,
} from "lucide-react";
import { TOTAL_MODELS } from "@/lib/platform-stats";

/* ─── types ─── */
type StepStatus = "waiting" | "running" | "done";

interface Step {
  id: string;
  agent: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string;         // tailwind text color
  accent: string;        // tailwind ring / border color
  bg: string;            // subtle background tint
  glow: string;          // box-shadow color
  runningLabel: string;
  doneLabel: string;
  durationMs: number;
}

/* ─── data ─── */
const GOAL =
  "Find 50 fintech companies in London and draft personalized outreach";

const STEPS: Step[] = [
  {
    id: "leads",
    agent: "leads",
    Icon: Target,
    color: "text-emerald-400",
    accent: "border-emerald-500/30",
    bg: "bg-emerald-500/[0.06]",
    glow: "rgba(16,185,129,0.15)",
    runningLabel: "Finding prospects...",
    doneLabel: "7 companies found, 6 verified",
    durationMs: 3000,
  },
  {
    id: "competitor-scan",
    agent: "competitor-scan",
    Icon: Shield,
    color: "text-orange-400",
    accent: "border-orange-500/30",
    bg: "bg-orange-500/[0.06]",
    glow: "rgba(251,146,60,0.15)",
    runningLabel: "Analyzing market...",
    doneLabel: "3 positioning angles identified",
    durationMs: 2500,
  },
  {
    id: "email-sequence",
    agent: "email-sequence",
    Icon: Mail,
    color: "text-cyan-400",
    accent: "border-cyan-500/30",
    bg: "bg-cyan-500/[0.06]",
    glow: "rgba(34,211,238,0.15)",
    runningLabel: "Drafting outreach...",
    doneLabel: "5-email sequence generated",
    durationMs: 2000,
  },
];

const TOTAL_DISPLAY_TIME = "17.6s";

/* ─── helpers ─── */
function useTypewriter(text: string, speed = 38, startDelay = 0) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    let interval: ReturnType<typeof setInterval>;

    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

/* ─── component ─── */
export default function MissionControlDemo() {
  /* phase machine:
     0 = title fade-in
     1 = goal typing
     2 = steps executing (sub-phases per step)
     3 = summary
     4 = CTA
     5 = hold, then restart */
  const [phase, setPhase] = useState(0);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    STEPS.map(() => "waiting")
  );
  const [activeStepIdx, setActiveStepIdx] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loopKey, setLoopKey] = useState(0);

  // Progress bars: 0–100 per step
  const [progressValues, setProgressValues] = useState<number[]>(
    STEPS.map(() => 0)
  );

  /* typewriter for the goal text — starts when phase >= 1 */
  const { displayed: goalText, done: goalDone } = useTypewriter(
    GOAL,
    32,
    phase >= 1 ? 0 : 999999
  );

  /* elapsed timer */
  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 0.1), 100);
  }, []);
  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  /* orchestrator */
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];

    // Phase 0 → 1 (show title for 1.5s then start typing)
    t.push(setTimeout(() => setPhase(1), 1500));

    return () => t.forEach(clearTimeout);
  }, [loopKey]);

  // When goal typing finishes, move to phase 2
  useEffect(() => {
    if (phase === 1 && goalDone) {
      const t = setTimeout(() => {
        setPhase(2);
        startTimer();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [phase, goalDone, startTimer]);

  // Phase 2: run steps sequentially
  useEffect(() => {
    if (phase !== 2) return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let cumulativeDelay = 300; // small gap before first step

    STEPS.forEach((step, idx) => {
      // start this step
      timeouts.push(
        setTimeout(() => {
          setActiveStepIdx(idx);
          setStepStatuses((prev) => {
            const next = [...prev];
            next[idx] = "running";
            return next;
          });

          // animate progress bar
          const progressInterval = setInterval(() => {
            setProgressValues((prev) => {
              const next = [...prev];
              next[idx] = Math.min(next[idx] + 2, 100);
              if (next[idx] >= 100) clearInterval(progressInterval);
              return next;
            });
          }, step.durationMs / 50);

          // mark done
          timeouts.push(
            setTimeout(() => {
              clearInterval(progressInterval);
              setProgressValues((prev) => {
                const next = [...prev];
                next[idx] = 100;
                return next;
              });
              setStepStatuses((prev) => {
                const next = [...prev];
                next[idx] = "done";
                return next;
              });
            }, step.durationMs)
          );
        }, cumulativeDelay)
      );

      cumulativeDelay += step.durationMs + 400; // gap between steps
    });

    // After all steps done → summary
    timeouts.push(
      setTimeout(() => {
        stopTimer();
        setPhase(3);
      }, cumulativeDelay + 200)
    );

    // summary → CTA
    timeouts.push(
      setTimeout(() => {
        setPhase(4);
      }, cumulativeDelay + 1600)
    );

    // CTA hold, then loop restart
    timeouts.push(
      setTimeout(() => {
        setPhase(0);
        setStepStatuses(STEPS.map(() => "waiting"));
        setActiveStepIdx(-1);
        setProgressValues(STEPS.map(() => 0));
        setElapsed(0);
        setLoopKey((k) => k + 1);
      }, cumulativeDelay + 5000)
    );

    return () => timeouts.forEach(clearTimeout);
  }, [phase, stopTimer, startTimer, loopKey]);

  return (
    <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center overflow-hidden relative">
      {/* ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.03] blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-cyan-500/[0.02] blur-[100px]" />
      </div>

      {/* grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 w-full max-w-[600px] mx-auto px-6 py-12">
        {/* ── TITLE ── */}
        <AnimatePresence>
          {phase >= 0 && (
            <motion.div
              key={`title-${loopKey}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-center mb-10"
            >
              <div className="inline-flex items-center gap-2 mb-5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400/80 font-mono">
                  Live Simulation
                </span>
              </div>

              <h1
                className="text-4xl md:text-5xl font-bold tracking-tight mb-2"
                style={{
                  textShadow: "0 0 60px rgba(16,185,129,0.3), 0 0 120px rgba(16,185,129,0.1)",
                }}
              >
                <span className="bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-transparent">
                  SOVEREIGN MATRIX
                </span>
              </h1>

              <p className="text-sm text-neutral-500 font-mono tracking-[0.2em] uppercase">
                Mission Control
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── GOAL ── */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              key={`goal-${loopKey}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-3">
                <Rocket className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 font-mono">
                  Mission Objective
                </span>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 backdrop-blur-sm">
                <p className="text-sm md:text-base text-neutral-200 font-mono leading-relaxed">
                  {goalText}
                  {!goalDone && (
                    <span className="inline-block w-[2px] h-[1.1em] bg-emerald-400 ml-0.5 align-middle animate-pulse" />
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ELAPSED TIMER ── */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              key={`timer-${loopKey}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between mb-5"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs font-mono text-neutral-500">
                  Elapsed:{" "}
                  <span className="text-neutral-300">{elapsed.toFixed(1)}s</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-wider">
                  Executing
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── STEPS ── */}
        <div className="space-y-3">
          <AnimatePresence>
            {STEPS.map((step, idx) => {
              const status = stepStatuses[idx];
              if (status === "waiting" && activeStepIdx < idx) return null;

              return (
                <motion.div
                  key={`${step.id}-${loopKey}`}
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{
                    duration: 0.5,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={`
                    relative rounded-xl border backdrop-blur-sm overflow-hidden
                    transition-all duration-500
                    ${status === "done"
                      ? `border-white/[0.08] bg-white/[0.02]`
                      : `${step.accent} bg-white/[0.03]`
                    }
                  `}
                  style={{
                    boxShadow:
                      status === "running"
                        ? `0 0 30px ${step.glow}, 0 0 60px ${step.glow.replace("0.15", "0.05")}`
                        : "none",
                  }}
                >
                  <div className="px-5 py-4">
                    {/* header row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`
                            w-8 h-8 rounded-lg flex items-center justify-center
                            ${status === "done" ? "bg-white/[0.05]" : step.bg}
                            transition-colors duration-500
                          `}
                        >
                          <step.Icon
                            className={`w-4 h-4 ${
                              status === "done" ? "text-neutral-500" : step.color
                            } transition-colors duration-500`}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white tracking-wide">
                            {step.agent}
                          </p>
                          <p className="text-[10px] text-neutral-500 font-mono">
                            agent
                          </p>
                        </div>
                      </div>

                      {/* status badge */}
                      <div className="flex items-center gap-2">
                        {status === "running" && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="flex items-center gap-1.5"
                          >
                            <Loader2 className={`w-3.5 h-3.5 ${step.color} animate-spin`} />
                            <span className={`text-[10px] font-mono ${step.color}`}>
                              Running
                            </span>
                          </motion.div>
                        )}
                        {status === "done" && (
                          <motion.div
                            initial={{ scale: 0, rotate: -90 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[10px] font-mono text-emerald-400">
                              Complete
                            </span>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* label */}
                    <AnimatePresence mode="wait">
                      {status === "running" && (
                        <motion.p
                          key="running"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          className={`text-xs font-mono ${step.color} opacity-80`}
                        >
                          {step.runningLabel}
                        </motion.p>
                      )}
                      {status === "done" && (
                        <motion.p
                          key="done"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-xs font-mono text-neutral-300"
                        >
                          {step.doneLabel}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {/* progress bar */}
                    {status !== "waiting" && (
                      <div className="mt-3 h-[2px] w-full bg-white/[0.04] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            width: `${progressValues[idx]}%`,
                            background:
                              status === "done"
                                ? "rgba(16,185,129,0.5)"
                                : `linear-gradient(90deg, transparent, ${step.glow.replace("0.15", "0.8")})`,
                          }}
                          transition={{ ease: "linear" }}
                        />
                      </div>
                    )}
                  </div>

                  {/* running left-edge glow */}
                  {status === "running" && (
                    <motion.div
                      className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full"
                      style={{ background: step.glow.replace("0.15", "0.6") }}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── SUMMARY ── */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              key={`summary-${loopKey}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 text-center"
            >
              <div
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/[0.03] border border-emerald-500/20 backdrop-blur-sm"
                style={{
                  boxShadow: "0 0 40px rgba(16,185,129,0.08)",
                }}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-mono text-neutral-300">
                  <span className="text-white font-bold">3/3</span> succeeded
                  <span className="text-neutral-500 mx-2">&bull;</span>
                  <span className="text-white font-bold">{TOTAL_DISPLAY_TIME}</span>
                  <span className="text-neutral-500 mx-2">&bull;</span>
                  Powered by{" "}
                  <span className="text-emerald-400 font-bold">{TOTAL_MODELS}+ AI models</span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CTA ── */}
        <AnimatePresence>
          {phase >= 4 && (
            <motion.div
              key={`cta-${loopKey}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 text-center"
            >
              <motion.div
                className="inline-block"
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(16,185,129,0.1)",
                    "0 0 40px rgba(16,185,129,0.2)",
                    "0 0 20px rgba(16,185,129,0.1)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-cyan-500/20 border border-emerald-500/30 backdrop-blur-sm">
                  <p className="text-lg font-bold text-white mb-1">
                    Try it free
                    <span className="text-emerald-400 ml-1">&rarr;</span>
                  </p>
                  <p className="text-xs font-mono text-emerald-400/80 tracking-wider">
                    sovereignmatrix.agency
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── watermark ── */}
        <div className="mt-12 text-center">
          <p className="text-[10px] text-neutral-500 font-mono tracking-wider">
            SOVEREIGN MATRIX &mdash; Autonomous Agent Platform
          </p>
        </div>
      </div>
    </div>
  );
}
