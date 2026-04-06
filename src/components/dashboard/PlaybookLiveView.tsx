"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, CheckCircle2, XCircle, Clock, Loader2, ArrowRight, SkipForward } from "lucide-react";

/**
 * PLAYBOOK LIVE VIEW — Real-time visualization of multi-agent playbook execution.
 *
 * Shows each step as it executes: pending → running → success/failed/skipped.
 * Agents "hand off" to each other visually, like n8n's workflow execution view.
 *
 * Usage:
 *   <PlaybookLiveView
 *     playbookId="lead-blitz"
 *     inputs={{ niche: "SaaS", location: "Austin" }}
 *     onComplete={(results) => console.log(results)}
 *   />
 */

interface StepResult {
  step: number;
  agent: string;
  reason: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  data?: unknown;
  error?: string;
  duration_ms: number;
}

interface PlaybookResult {
  goal: string;
  results: StepResult[];
  summary: { status: string; succeeded: number; failed: number; skipped: number; total_duration_ms: number };
}

interface PlaybookLiveViewProps {
  playbookId: string;
  inputs: Record<string, string>;
  onComplete?: (result: PlaybookResult) => void;
  autoStart?: boolean;
}

const AGENT_COLORS: Record<string, string> = {
  leads: "emerald",
  "email-sequence": "rose",
  "seo-dominator": "amber",
  "blog-gen": "cyan",
  "competitor-scan": "violet",
  "brand-voice": "pink",
  "proposal-generator": "blue",
  "client-report": "orange",
};

function getColor(agent: string): string {
  return AGENT_COLORS[agent] || "neutral";
}

export function PlaybookLiveView({ playbookId, inputs, onComplete, autoStart = false }: PlaybookLiveViewProps) {
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlaybookResult | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);

  const executePlaybook = useCallback(async () => {
    setRunning(true);
    setSteps([]);
    setResult(null);
    setCurrentStep(0);

    try {
      // First, get the plan (preview mode)
      const planRes = await fetch("/api/agents/coordinator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playbook_id: playbookId,
          ...inputs,
          auto_execute: false,
        }),
      });

      if (!planRes.ok) {
        setRunning(false);
        return;
      }

      const planData = await planRes.json();
      const plan = planData.plan || [];

      // Initialize all steps as pending
      const initialSteps: StepResult[] = plan.map((s: { agent: string; reason: string }, i: number) => ({
        step: i + 1,
        agent: s.agent,
        reason: s.reason,
        status: "pending" as const,
        duration_ms: 0,
      }));
      setSteps(initialSteps);

      // Now execute (auto_execute: true)
      const execRes = await fetch("/api/agents/coordinator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playbook_id: playbookId,
          ...inputs,
          auto_execute: true,
        }),
      });

      const execData = await execRes.json();

      // Update steps with results
      if (execData.results) {
        const updatedSteps = execData.results.map((r: StepResult) => ({
          ...r,
          status: r.status || "failed",
        }));
        setSteps(updatedSteps);
        setCurrentStep(updatedSteps.length);
      }

      setResult(execData);
      onComplete?.(execData);
    } catch (err) {
      setSteps((prev) => prev.map((s) => s.status === "pending" ? { ...s, status: "failed" as const, error: String(err) } : s));
    } finally {
      setRunning(false);
    }
  }, [playbookId, inputs, onComplete]);

  useEffect(() => {
    if (autoStart) executePlaybook();
  }, [autoStart, executePlaybook]);

  // Simulate step-by-step animation by cycling through currentStep
  useEffect(() => {
    if (!running || steps.length === 0) return;
    let i = 0;
    const interval = setInterval(() => {
      if (i >= steps.length) { clearInterval(interval); return; }
      setCurrentStep(i);
      i++;
    }, 800);
    return () => clearInterval(interval);
  }, [running, steps.length]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Playbook</span>
          <span className="text-sm font-semibold text-white">{playbookId}</span>
        </div>
        {!running && !result && (
          <button
            onClick={executePlaybook}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors"
          >
            <Play className="w-3 h-3" /> Execute
          </button>
        )}
        {running && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Loader2 className="w-3 h-3 animate-spin" /> Running...
          </div>
        )}
        {result && (
          <div className={`text-xs font-mono px-2 py-1 rounded ${
            result.summary.status === "success" ? "bg-emerald-500/10 text-emerald-400" :
            result.summary.status === "partial" ? "bg-amber-500/10 text-amber-400" :
            "bg-red-500/10 text-red-400"
          }`}>
            {result.summary.status.toUpperCase()} ({result.summary.total_duration_ms}ms)
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="p-5 space-y-3">
        {steps.length === 0 && !running && (
          <p className="text-sm text-neutral-500 text-center py-4">
            Click Execute to run the playbook
          </p>
        )}

        <AnimatePresence>
          {steps.map((step, i) => {
            const color = getColor(step.agent);
            const isActive = i === currentStep && running;

            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isActive ? `border-${color}-500/30 bg-${color}-500/5` :
                  step.status === "success" ? "border-emerald-500/10 bg-emerald-500/[0.02]" :
                  step.status === "failed" ? "border-red-500/10 bg-red-500/[0.02]" :
                  step.status === "skipped" ? "border-neutral-500/10 bg-neutral-500/[0.02]" :
                  "border-white/[0.04] bg-white/[0.01]"
                }`}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {isActive ? (
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : step.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : step.status === "failed" ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : step.status === "skipped" ? (
                    <SkipForward className="w-4 h-4 text-neutral-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-neutral-600" />
                  )}
                </div>

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-500">#{step.step}</span>
                    <span className={`text-xs font-bold text-${color}-400`}>{step.agent}</span>
                  </div>
                  <p className="text-xs text-neutral-500 truncate">{step.reason}</p>
                  {step.error && <p className="text-xs text-red-400 mt-1">{step.error}</p>}
                </div>

                {/* Duration */}
                {step.duration_ms > 0 && (
                  <span className="text-[10px] text-neutral-600 font-mono shrink-0">
                    {(step.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}

                {/* Handoff arrow */}
                {i < steps.length - 1 && step.status === "success" && (
                  <ArrowRight className="w-3 h-3 text-neutral-600 shrink-0" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
