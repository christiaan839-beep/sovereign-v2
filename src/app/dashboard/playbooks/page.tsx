"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Target, Swords, PenTool, FileText, TrendingUp, Fingerprint,
  Activity, Ghost, Rocket, Brain, Settings, Play, Loader2,
  CheckCircle2, XCircle, Clock, ArrowLeft, ChevronRight,
  Zap, Sparkles,
} from "lucide-react";
import { PLAYBOOKS, PLAYBOOK_CATEGORIES } from "@/lib/playbooks";
import type { Playbook } from "@/lib/playbooks";

// Map icon names to Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Swords, PenTool, FileText, TrendingUp, Fingerprint,
  Activity, Ghost, Rocket, Brain, Settings,
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; shadow: string; gradient: string }> = {
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", shadow: "shadow-emerald-500/20", gradient: "from-emerald-600 to-emerald-500" },
  red: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", shadow: "shadow-red-500/20", gradient: "from-red-600 to-red-500" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", shadow: "shadow-violet-500/20", gradient: "from-violet-600 to-violet-500" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", shadow: "shadow-amber-500/20", gradient: "from-amber-600 to-amber-500" },
  cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-400", shadow: "shadow-cyan-500/20", gradient: "from-cyan-600 to-cyan-500" },
  pink: { bg: "bg-pink-500/10", border: "border-pink-500/20", text: "text-pink-400", shadow: "shadow-pink-500/20", gradient: "from-pink-600 to-pink-500" },
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400", shadow: "shadow-orange-500/20", gradient: "from-orange-600 to-orange-500" },
  neutral: { bg: "bg-white/5", border: "border-white/10", text: "text-neutral-300", shadow: "shadow-white/10", gradient: "from-neutral-600 to-neutral-500" },
};

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket, PenTool, Brain, Settings,
};

type StepStatus = "pending" | "running" | "success" | "failed";

interface ExecutionStep {
  agent: string;
  reason: string;
  status: StepStatus;
  duration_ms?: number;
  data?: unknown;
  error?: string;
}

export default function PlaybooksPage() {
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [executionDone, setExecutionDone] = useState(false);

  const filteredPlaybooks = activeCategory === "all"
    ? PLAYBOOKS
    : PLAYBOOKS.filter((p) => p.category === activeCategory);

  const resetExecution = () => {
    setExecutionSteps([]);
    setExecutionDone(false);
    setExecuting(false);
  };

  const executePlaybook = async () => {
    if (!selectedPlaybook || executing) return;

    // Validate required fields
    for (const field of selectedPlaybook.fields) {
      if (field.required && (!inputs[field.key] || !inputs[field.key].trim())) {
        return;
      }
    }

    setExecuting(true);
    setExecutionDone(false);
    setExecutionSteps(
      selectedPlaybook.steps.map((s) => ({
        agent: s.agent,
        reason: s.reason,
        status: "pending" as StepStatus,
      }))
    );

    try {
      // Set first step to running
      setExecutionSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: "running" as StepStatus } : s))
      );

      const res = await fetch("/api/agents/coordinator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playbook_id: selectedPlaybook.id,
          inputs,
          auto_execute: true,
          confirmed: true,
        }),
      });

      const data = await res.json();

      if (data.results && Array.isArray(data.results)) {
        setExecutionSteps(
          data.results.map((r: { agent: string; reason: string; status: string; duration_ms: number; data?: unknown; error?: string }) => ({
            agent: r.agent,
            reason: r.reason,
            status: r.status as StepStatus,
            duration_ms: r.duration_ms,
            data: r.data,
            error: r.error,
          }))
        );
      }
    } catch (err) {
      setExecutionSteps((prev) =>
        prev.map((s, i) => (i === 0 && s.status === "running"
          ? { ...s, status: "failed" as StepStatus, error: err instanceof Error ? err.message : "Network error" }
          : s
        ))
      );
    } finally {
      setExecuting(false);
      setExecutionDone(true);
    }
  };

  // ─── Execution View ───
  if (selectedPlaybook && (executing || executionDone)) {
    const colors = COLOR_MAP[selectedPlaybook.color] || COLOR_MAP.neutral;
    const Icon = ICON_MAP[selectedPlaybook.icon] || Zap;

    return (
      <div className="min-h-screen bg-[#0A0A0A] p-6 md:p-10">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className={`p-2.5 rounded-xl ${colors.bg} border ${colors.border}`}>
              <Icon className={`w-5 h-5 ${colors.text}`} />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{selectedPlaybook.name}</h1>
              <p className="text-sm text-neutral-500">{executing ? "Executing pipeline..." : "Execution complete"}</p>
            </div>
            {executionDone && (
              <button
                onClick={() => { resetExecution(); setSelectedPlaybook(null); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Playbooks
              </button>
            )}
          </div>

          {/* Live Execution Steps */}
          <div className="space-y-4">
            {executionSteps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl border p-5 transition-all ${
                  step.status === "running"
                    ? `${colors.bg} ${colors.border} ring-1 ring-${selectedPlaybook.color}-500/30`
                    : step.status === "success"
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : step.status === "failed"
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-white/[0.02] border-white/[0.06]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Status Icon */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5">
                    {step.status === "running" ? (
                      <Loader2 className={`w-4 h-4 ${colors.text} animate-spin`} />
                    ) : step.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : step.status === "failed" ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-neutral-600" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-neutral-500">Step {i + 1}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-500">{step.agent}</span>
                    </div>
                    <p className="text-sm text-white mt-1">{step.reason}</p>
                  </div>

                  {step.duration_ms !== undefined && (
                    <span className="text-xs text-neutral-500 font-mono">{(step.duration_ms / 1000).toFixed(1)}s</span>
                  )}
                </div>

                {/* Error Display */}
                {step.error && (
                  <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    {step.error}
                  </div>
                )}

                {/* Running Animation */}
                {step.status === "running" && (
                  <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className={`h-full bg-gradient-to-r ${colors.gradient}`}
                      animate={{ width: ["0%", "100%"] }}
                      transition={{ duration: 8, ease: "linear" }}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Summary */}
          {executionDone && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Pipeline Complete</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-400">{executionSteps.filter((s) => s.status === "success").length}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Succeeded</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">{executionSteps.filter((s) => s.status === "failed").length}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Failed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{(executionSteps.reduce((s, e) => s + (e.duration_ms || 0), 0) / 1000).toFixed(1)}s</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Total Time</p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── Playbook Configuration View ───
  if (selectedPlaybook) {
    const colors = COLOR_MAP[selectedPlaybook.color] || COLOR_MAP.neutral;
    const Icon = ICON_MAP[selectedPlaybook.icon] || Zap;
    const allRequiredFilled = selectedPlaybook.fields
      .filter((f) => f.required)
      .every((f) => inputs[f.key]?.trim());

    return (
      <div className="min-h-screen bg-[#0A0A0A] p-6 md:p-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => { setSelectedPlaybook(null); setInputs({}); }}
            className="flex items-center gap-2 text-xs text-neutral-500 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Playbooks
          </button>

          {/* Playbook Header */}
          <div className="flex items-start gap-4 mb-8">
            <div className={`p-3 rounded-2xl ${colors.bg} border ${colors.border}`}>
              <Icon className={`w-6 h-6 ${colors.text}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{selectedPlaybook.name}</h1>
              <p className="text-sm text-neutral-500 mt-1">{selectedPlaybook.description}</p>
              <div className="flex items-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <Clock className="w-3 h-3" /> {selectedPlaybook.estimatedTime}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <Zap className="w-3 h-3" /> {selectedPlaybook.agentCount} agents
                </span>
              </div>
            </div>
          </div>

          {/* Pipeline Preview */}
          <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="text-xs text-neutral-500 uppercase tracking-wider mb-4">Agent Pipeline</h3>
            <div className="space-y-3">
              {selectedPlaybook.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${colors.bg} ${colors.border} ${colors.text} border`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-mono text-neutral-500">{step.agent}</span>
                    <span className="text-xs text-neutral-600 ml-2">— {step.reason}</span>
                  </div>
                  {i < selectedPlaybook.steps.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-neutral-700" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Input Fields */}
          <div className="space-y-4 mb-8">
            {selectedPlaybook.fields.map((field) => (
              <div key={field.key}>
                <label className="text-xs text-neutral-400 mb-2 block">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {field.type === "select" ? (
                  <select
                    value={inputs[field.key] || ""}
                    onChange={(e) => setInputs({ ...inputs, [field.key]: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:border-white/20 focus:outline-none transition-colors appearance-none"
                  >
                    <option value="" className="bg-neutral-900">{field.placeholder}</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt} className="bg-neutral-900">{opt}</option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    value={inputs[field.key] || ""}
                    onChange={(e) => setInputs({ ...inputs, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-neutral-600 focus:border-white/20 focus:outline-none transition-colors resize-none"
                  />
                ) : (
                  <input
                    type={field.type}
                    value={inputs[field.key] || ""}
                    onChange={(e) => setInputs({ ...inputs, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-neutral-600 focus:border-white/20 focus:outline-none transition-colors"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Execute Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={executePlaybook}
            disabled={!allRequiredFilled}
            className={`w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all ${
              allRequiredFilled
                ? `bg-gradient-to-r ${colors.gradient} text-white shadow-lg ${colors.shadow} cursor-pointer`
                : "bg-white/5 text-neutral-600 cursor-not-allowed"
            }`}
          >
            <Play className="w-4 h-4" />
            Deploy {selectedPlaybook.name}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ─── Playbook Gallery View ───
  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 md:p-10">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-emerald-500/20 border border-white/10">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Playbooks</h1>
            <p className="text-sm text-neutral-500">1-click multi-agent workflows. Pick an outcome, fill in the blanks, deploy.</p>
          </div>
        </div>
      </motion.div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeCategory === "all"
              ? "bg-white/10 border border-white/20 text-white"
              : "bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:text-white"
          }`}
        >
          All Playbooks
        </button>
        {PLAYBOOK_CATEGORIES.map((cat) => {
          const CatIcon = CATEGORY_ICON_MAP[cat.icon] || Zap;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? "bg-white/10 border border-white/20 text-white"
                  : "bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:text-white"
              }`}
            >
              <CatIcon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Playbook Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredPlaybooks.map((playbook, index) => {
          const colors = COLOR_MAP[playbook.color] || COLOR_MAP.neutral;
          const Icon = ICON_MAP[playbook.icon] || Zap;
          return (
            <motion.button
              key={playbook.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => { setSelectedPlaybook(playbook); setInputs({}); }}
              className="text-left rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/10 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl ${colors.bg} border ${colors.border} group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white">{playbook.name}</h3>
                </div>
              </div>
              <p className={`text-xs ${colors.text} font-medium mb-2`}>{playbook.tagline}</p>
              <p className="text-xs text-neutral-500 leading-relaxed mb-4 line-clamp-2">{playbook.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[10px] text-neutral-600">
                    <Clock className="w-3 h-3" /> {playbook.estimatedTime}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-neutral-600">
                    <Zap className="w-3 h-3" /> {playbook.agentCount} agents
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-700 group-hover:text-white transition-colors" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
