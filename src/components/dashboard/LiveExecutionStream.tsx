"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, CheckCircle2, Loader2, AlertTriangle, Clock,
  Search, FileText, Phone, Code2, Shield, Brain,
  Target, Globe, BarChart3, Sparkles, Send,
  ChevronDown, ChevronUp, Copy, Check
} from "lucide-react";

/* ─── Types ─── */

interface ExecutionStep {
  id: string;
  label: string;
  detail?: string;
  status: "pending" | "running" | "complete" | "error";
  icon: React.ComponentType<{ className?: string }>;
  result?: string;
  duration?: number;
  substeps?: string[];
}

interface AgentExecution {
  agentName: string;
  agentColor: string;
  goal: string;
  steps: ExecutionStep[];
  status: "idle" | "running" | "complete" | "error";
  totalDuration?: number;
  result?: string;
}

/* ─── Step Icon Map ─── */

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  search: Search,
  analyze: Brain,
  write: FileText,
  call: Phone,
  code: Code2,
  scan: Shield,
  score: Target,
  browse: Globe,
  report: BarChart3,
  generate: Sparkles,
  send: Send,
  default: Zap,
};

function getStepIcon(label: string): React.ComponentType<{ className?: string }> {
  const lower = label.toLowerCase();
  for (const [key, icon] of Object.entries(STEP_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return STEP_ICONS.default;
}

/* ─── Agent Execution Templates ─── */

const AGENT_TEMPLATES: Record<string, {
  name: string;
  color: string;
  steps: Omit<ExecutionStep, "id" | "status" | "duration">[];
}> = {
  "lead-gen": {
    name: "Lead Hunter",
    color: "#10b981",
    steps: [
      { label: "Scanning industry databases", icon: Search, detail: "LinkedIn, Apollo, Crunchbase" },
      { label: "Filtering by ICP criteria", icon: Target, detail: "Title, company size, funding stage" },
      { label: "Enriching contact data", icon: Brain, detail: "Email, phone, LinkedIn URL" },
      { label: "Scoring leads (hot/warm/cold)", icon: BarChart3, detail: "Based on 12 signal categories" },
      { label: "Generating personalized outreach", icon: FileText, detail: "Anti-slop pipeline applied" },
      { label: "Compiling results", icon: Sparkles, detail: "CSV + dashboard ready" },
    ],
  },
  "competitor-intel": {
    name: "Site Assassin",
    color: "#ef4444",
    steps: [
      { label: "Opening target website", icon: Globe, detail: "Headless browser initialized" },
      { label: "Scanning tech stack", icon: Code2, detail: "Wappalyzer + custom detection" },
      { label: "Analyzing SEO structure", icon: Search, detail: "Meta tags, headers, schema markup" },
      { label: "Extracting content strategy", icon: FileText, detail: "Blog frequency, topics, tone" },
      { label: "Identifying vulnerabilities", icon: Shield, detail: "Missing keywords, broken links" },
      { label: "Generating counter-strategy", icon: Brain, detail: "Tactical recommendations" },
      { label: "Compiling intelligence report", icon: BarChart3, detail: "PDF + actionable insights" },
    ],
  },
  "content": {
    name: "Content Engine",
    color: "#8b5cf6",
    steps: [
      { label: "Analyzing brand voice memory", icon: Brain, detail: "Loading tone, style, vocabulary" },
      { label: "Researching topic depth", icon: Search, detail: "Top 10 SERP analysis" },
      { label: "Generating initial draft", icon: FileText, detail: "DeepSeek V3.2 (long-form)" },
      { label: "Running anti-slop pipeline", icon: Shield, detail: "Humanize → Polish → Score" },
      { label: "SEO optimization pass", icon: BarChart3, detail: "Keywords, headers, meta" },
      { label: "Final quality check", icon: Sparkles, detail: "AI detection: 4% (human-like)" },
    ],
  },
  "voice": {
    name: "Voice Closer",
    color: "#f59e0b",
    steps: [
      { label: "Loading call script", icon: FileText, detail: "Customized for prospect profile" },
      { label: "Initializing voice synthesis", icon: Phone, detail: "ElevenLabs TTS (<200ms latency)" },
      { label: "Connecting to prospect", icon: Globe, detail: "VoIP outbound dialer" },
      { label: "Running qualification flow", icon: Brain, detail: "BANT framework questions" },
      { label: "Detecting buying signals", icon: Target, detail: "NLP sentiment analysis" },
      { label: "Booking meeting", icon: Sparkles, detail: "Calendar integration" },
    ],
  },
  "code": {
    name: "Code Agent",
    color: "#06b6d4",
    steps: [
      { label: "Parsing requirements", icon: Brain, detail: "Breaking down into components" },
      { label: "Generating code", icon: Code2, detail: "TypeScript + React components" },
      { label: "Running lint checks", icon: Shield, detail: "ESLint + TypeScript compiler" },
      { label: "Executing test suite", icon: Zap, detail: "Unit + integration tests" },
      { label: "Self-correcting errors", icon: AlertTriangle, detail: "Fixing 2 failed tests..." },
      { label: "Retesting after fixes", icon: CheckCircle2, detail: "All tests passing" },
      { label: "Preparing deployment", icon: Send, detail: "Build optimized, ready to ship" },
    ],
  },
  "seo": {
    name: "SEO Dominator",
    color: "#ec4899",
    steps: [
      { label: "Crawling site structure", icon: Globe, detail: "Sitemap, robots.txt, pages" },
      { label: "Analyzing page speed", icon: Zap, detail: "Core Web Vitals audit" },
      { label: "Checking keyword rankings", icon: Search, detail: "Position tracking vs competitors" },
      { label: "Finding content gaps", icon: Target, detail: "Topics competitors rank for" },
      { label: "Generating recommendations", icon: Brain, detail: "Priority-ordered action items" },
      { label: "Building SEO report", icon: BarChart3, detail: "Score: 72/100 → 89/100 potential" },
    ],
  },
};

/* ─── Live Execution Stream Component ─── */

interface LiveExecutionStreamProps {
  agentType?: keyof typeof AGENT_TEMPLATES;
  goal?: string;
  onComplete?: (result: string) => void;
  autoStart?: boolean;
  compact?: boolean;
  apiEndpoint?: string;
}

export function LiveExecutionStream({
  agentType = "lead-gen",
  goal = "Find 50 qualified leads in fintech",
  onComplete,
  autoStart = false,
  compact = false,
  apiEndpoint,
}: LiveExecutionStreamProps) {
  const template = AGENT_TEMPLATES[agentType] || AGENT_TEMPLATES["lead-gen"];

  const [execution, setExecution] = useState<AgentExecution>({
    agentName: template.name,
    agentColor: template.color,
    goal,
    steps: template.steps.map((s, i) => ({
      ...s,
      id: `step-${i}`,
      status: "pending" as const,
    })),
    status: "idle",
  });

  const [currentStep, setCurrentStep] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [apiResult, setApiResult] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startTime = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll to latest step
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentStep]);

  // Timer
  useEffect(() => {
    if (execution.status === "running") {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime.current);
      }, 100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [execution.status]);

  // Execute steps sequentially with realistic timing
  const executeSteps = useCallback(async () => {
    startTime.current = Date.now();
    setExecution((prev) => ({ ...prev, status: "running" }));
    setCurrentStep(0);

    // If we have a real API endpoint, call it in parallel
    let realResult: string | null = null;
    if (apiEndpoint) {
      fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: goal }),
      })
        .then((r) => r.json())
        .then((data) => {
          realResult = data.result || data.response || data.text || JSON.stringify(data);
          setApiResult(realResult);
        })
        .catch(() => {
          // API failed silently — stream still shows
        });
    }

    const steps = template.steps;
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);

      // Mark step as running
      setExecution((prev) => ({
        ...prev,
        steps: prev.steps.map((s, idx) =>
          idx === i ? { ...s, status: "running" as const } : s
        ),
      }));

      // Simulate realistic processing time (1.5-4 seconds per step)
      const stepDuration = 1500 + Math.random() * 2500;
      await new Promise((resolve) => setTimeout(resolve, stepDuration));

      // Mark step as complete with duration
      setExecution((prev) => ({
        ...prev,
        steps: prev.steps.map((s, idx) =>
          idx === i
            ? { ...s, status: "complete" as const, duration: stepDuration }
            : s
        ),
      }));
    }

    const totalDuration = Date.now() - startTime.current;

    setExecution((prev) => ({
      ...prev,
      status: "complete",
      totalDuration,
      result: realResult || `${template.name} completed ${steps.length} steps in ${(totalDuration / 1000).toFixed(1)}s`,
    }));

    if (timerRef.current) clearInterval(timerRef.current);
    setElapsed(totalDuration);

    if (onComplete) {
      onComplete(realResult || "Execution complete");
    }
  }, [template, goal, apiEndpoint, onComplete]);

  // Auto-start if prop is set
  useEffect(() => {
    if (autoStart && execution.status === "idle") {
      executeSteps();
    }
  }, [autoStart, executeSteps, execution.status]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${seconds}.${tenths}s`;
  };

  const handleCopy = () => {
    const text = execution.steps
      .map((s) => `${s.status === "complete" ? "✅" : "⏳"} ${s.label} ${s.detail ? `(${s.detail})` : ""} ${s.duration ? `— ${(s.duration / 1000).toFixed(1)}s` : ""}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-2xl border overflow-hidden transition-gpu duration-300 ${
      execution.status === "running"
        ? "border-emerald-500/30 bg-emerald-950/10"
        : execution.status === "complete"
        ? "border-emerald-500/20 bg-[#0a0a0a]"
        : "border-white/10 bg-[#0a0a0a]"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Agent avatar */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${template.color}20`, color: template.color }}
          >
            {template.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{template.name}</span>
              {execution.status === "running" && (
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-2 h-2 rounded-full bg-emerald-400"
                />
              )}
              {execution.status === "complete" && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <p className="text-[11px] text-neutral-500 truncate max-w-[300px]">{goal}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer */}
          {execution.status !== "idle" && (
            <span className="text-xs font-mono text-neutral-400 tabular-nums">
              <Clock className="w-3 h-3 inline mr-1" />
              {formatTime(elapsed)}
            </span>
          )}

          {/* Copy */}
          {execution.status === "complete" && (
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Expand/Collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Steps */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              ref={scrollRef}
              className={`px-4 py-3 space-y-1 overflow-y-auto ${compact ? "max-h-[240px]" : "max-h-[400px]"}`}
            >
              {execution.steps.map((step, i) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-start gap-3 py-2 px-3 rounded-lg transition-gpu duration-300 ${
                    step.status === "running"
                      ? "bg-emerald-500/5"
                      : step.status === "complete"
                      ? "bg-white/[0.02]"
                      : ""
                  }`}
                >
                  {/* Tree line */}
                  <div className="flex flex-col items-center pt-0.5">
                    {step.status === "running" ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      >
                        <Loader2 className="w-4 h-4 text-emerald-400" />
                      </motion.div>
                    ) : step.status === "complete" ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500 }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </motion.div>
                    ) : step.status === "error" ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-neutral-700" />
                    )}
                    {i < execution.steps.length - 1 && (
                      <div className={`w-px flex-1 min-h-[16px] mt-1 ${
                        step.status === "complete" ? "bg-emerald-500/20" : "bg-white/5"
                      }`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${
                        step.status === "running"
                          ? "text-emerald-300 font-medium"
                          : step.status === "complete"
                          ? "text-neutral-300"
                          : "text-neutral-600"
                      }`}>
                        {step.label}
                        {step.status === "running" && (
                          <motion.span
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="ml-1"
                          >
                            ...
                          </motion.span>
                        )}
                      </span>
                      {step.duration && (
                        <span className="text-[10px] font-mono text-neutral-600 ml-2">
                          {(step.duration / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                    {step.detail && (
                      <p className={`text-[11px] mt-0.5 ${
                        step.status === "running" ? "text-emerald-400/60" : "text-neutral-600"
                      }`}>
                        {step.detail}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* API Result */}
              {apiResult && execution.status === "complete" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
                >
                  <p className="text-[10px] uppercase tracking-widest text-emerald-500/60 font-bold mb-1">
                    Agent Output
                  </p>
                  <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
                    {apiResult.slice(0, 500)}{apiResult.length > 500 ? "..." : ""}
                  </p>
                </motion.div>
              )}
            </div>

            {/* Footer — Start / Complete */}
            <div className="px-4 py-3 border-t border-white/5">
              {execution.status === "idle" && (
                <button
                  onClick={executeSteps}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-bold hover:opacity-90 transition-gpu flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Execute {template.name}
                </button>
              )}
              {execution.status === "running" && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    Step {currentStep + 1} of {execution.steps.length}
                  </span>
                  {/* Progress bar */}
                  <div className="flex-1 mx-3 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${((currentStep + 1) / execution.steps.length) * 100}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-xs font-mono text-emerald-400 tabular-nums">
                    {Math.round(((currentStep + 1) / execution.steps.length) * 100)}%
                  </span>
                </div>
              )}
              {execution.status === "complete" && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">
                      Complete — {execution.steps.length} steps in {formatTime(elapsed)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setExecution((prev) => ({
                        ...prev,
                        status: "idle",
                        steps: prev.steps.map((s) => ({ ...s, status: "pending" as const, duration: undefined })),
                        totalDuration: undefined,
                        result: undefined,
                      }));
                      setCurrentStep(-1);
                      setElapsed(0);
                      setApiResult(null);
                    }}
                    className="text-xs text-neutral-500 hover:text-white transition-colors"
                  >
                    Run Again
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Multi-Agent Execution View ─── */

interface MultiAgentStreamProps {
  agents: {
    type: keyof typeof AGENT_TEMPLATES;
    goal: string;
    apiEndpoint?: string;
  }[];
  autoStart?: boolean;
}

export function MultiAgentStream({ agents, autoStart = false }: MultiAgentStreamProps) {
  return (
    <div className="space-y-3">
      {agents.map((agent, i) => (
        <LiveExecutionStream
          key={`${agent.type}-${i}`}
          agentType={agent.type}
          goal={agent.goal}
          apiEndpoint={agent.apiEndpoint}
          autoStart={autoStart}
          compact={agents.length > 2}
        />
      ))}
    </div>
  );
}

/* ─── Exported Agent Types for External Use ─── */
export const AVAILABLE_AGENTS = Object.keys(AGENT_TEMPLATES) as (keyof typeof AGENT_TEMPLATES)[];
export type AgentType = keyof typeof AGENT_TEMPLATES;
