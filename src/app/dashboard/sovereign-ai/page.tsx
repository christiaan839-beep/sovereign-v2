"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Sparkles, Zap, Target, BarChart3,
  Shield, Globe, AlertTriangle, Loader2,
  Lightbulb, RefreshCw, Play, CheckCircle2, XCircle,
  ClipboardList, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Types ───

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  actions?: Action[];
  metrics?: Metric[];
}

interface Action {
  label: string;
  endpoint: string;
  method: string;
  body?: Record<string, unknown>;
  icon: "zap" | "target" | "shield" | "globe" | "chart";
}

interface Metric {
  label: string;
  value: string;
  trend?: "up" | "down" | "stable";
}

interface HealthData {
  status: string;
  services: Record<string, { status: string; latencyMs: number }>;
  capabilities: Record<string, number>;
}

interface PlanStep {
  agent: string;
  params: Record<string, string>;
  reason: string;
}

interface StepResult {
  step: number;
  agent: string;
  reason: string;
  status: "success" | "failed";
  data?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
}

interface CoordinatorResponse {
  goal: string;
  plan: PlanStep[];
  auto_execute: boolean;
  results?: StepResult[];
  summary?: {
    total_steps: number;
    succeeded: number;
    failed: number;
    total_duration_ms: number;
  };
  error?: string;
  message?: string;
}

// ─── Constants ───

const ICON_MAP = {
  zap: Zap,
  target: Target,
  shield: Shield,
  globe: Globe,
  chart: BarChart3,
};

// ─── Proactive Suggestions Engine ───
function generateSuggestions(health: HealthData | null): Message[] {
  const suggestions: Message[] = [];

  if (health) {
    const downServices = Object.entries(health.services || {}).filter(
      ([, s]) => s.status === "down"
    );

    if (downServices.length > 0) {
      suggestions.push({
        id: "health-alert",
        role: "system",
        content: `I detected ${downServices.length} service(s) with issues: ${downServices.map(([name]) => name).join(", ")}. Want me to run diagnostics?`,
        timestamp: new Date(),
        actions: [
          { label: "Run Diagnostics", endpoint: "/api/health/deep", method: "GET", icon: "shield" },
        ],
      });
    }
  }

  suggestions.push({
    id: "daily-suggestion",
    role: "assistant",
    content: "Good to see you. Here are 3 things I'd recommend doing today to grow the platform:",
    timestamp: new Date(),
    actions: [
      { label: "Find 50 Leads", endpoint: "/api/agents/prospector", method: "POST", body: { prompt: "Find 50 Series A SaaS companies in the US with open marketing roles", count: 50 }, icon: "target" },
      { label: "Run SEO Audit", endpoint: "/api/agents/seo-dominator", method: "POST", body: { prompt: "Audit sovereignmatrix.agency for SEO improvements", url: "sovereignmatrix.agency" }, icon: "globe" },
      { label: "Check System Health", endpoint: "/api/health", method: "GET", icon: "shield" },
    ],
  });

  return suggestions;
}

// ─── Action Button ───
function ActionButton({ action, onExecute }: { action: Action; onExecute: (action: Action) => void }) {
  const [loading, setLoading] = useState(false);
  const Icon = ICON_MAP[action.icon] || Zap;

  const execute = async () => {
    setLoading(true);
    await onExecute(action);
    setLoading(false);
  };

  return (
    <button
      onClick={execute}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/20 transition-gpu disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      {action.label}
    </button>
  );
}

// ─── Message Bubble ───
function MessageBubble({ message, onAction }: { message: Message; onAction: (action: Action) => void }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[85%] ${isUser ? "" : "flex gap-3"}`}>
        {!isUser && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
            isSystem
              ? "bg-amber-500/10 border-amber-500/20"
              : "bg-emerald-500/10 border-emerald-500/20"
          }`}>
            {isSystem ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <Bot className="w-4 h-4 text-emerald-400" />
            )}
          </div>
        )}

        <div>
          <div className={`px-4 py-3 rounded-2xl ${
            isUser
              ? "bg-emerald-500/10 border border-emerald-500/15 rounded-br-md"
              : isSystem
                ? "bg-amber-500/[0.05] border border-amber-500/15 rounded-bl-md"
                : "bg-white/[0.03] border border-white/[0.06] rounded-bl-md"
          }`}>
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
              isUser ? "text-emerald-200" : "text-neutral-300"
            }`}>
              {message.content}
            </p>

            {/* Metrics */}
            {message.metrics && message.metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                {message.metrics.map((m) => (
                  <div key={m.label} className="text-center p-2 rounded-lg bg-black/20">
                    <div className="text-base font-black text-white font-mono">{m.value}</div>
                    <div className="text-[8px] text-neutral-500 uppercase tracking-wider">{m.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {message.actions && message.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.actions.map((action) => (
                <ActionButton key={action.label} action={action} onExecute={onAction} />
              ))}
            </div>
          )}

          <div className="text-[9px] text-neutral-700 mt-1 px-1">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Plan Step Card ───
function PlanStepCard({
  step,
  index,
  result,
  isExecuting,
}: {
  step: PlanStep;
  index: number;
  result?: StepResult;
  isExecuting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = isExecuting && !result;
  const succeeded = result?.status === "success";
  const failed = result?.status === "failed";

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`rounded-xl border p-4 transition-colors ${
        isRunning
          ? "border-amber-500/30 bg-amber-500/[0.04]"
          : succeeded
            ? "border-emerald-500/25 bg-emerald-500/[0.04]"
            : failed
              ? "border-red-500/25 bg-red-500/[0.04]"
              : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
            isRunning
              ? "bg-amber-500/15 text-amber-400"
              : succeeded
                ? "bg-emerald-500/15 text-emerald-400"
                : failed
                  ? "bg-red-500/15 text-red-400"
                  : "bg-white/[0.06] text-neutral-500"
          }`}>
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : succeeded ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : failed ? (
              <XCircle className="w-3.5 h-3.5" />
            ) : (
              index + 1
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white">{step.agent}</span>
              {result?.duration_ms !== undefined && (
                <span className="text-[9px] text-neutral-600 font-mono">{result.duration_ms}ms</span>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{step.reason}</p>
          </div>
        </div>

        {result?.data && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-1 rounded hover:bg-white/[0.05] text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {failed && result?.error && (
        <p className="text-[10px] text-red-400/70 mt-2 pl-10">{result.error}</p>
      )}

      <AnimatePresence>
        {expanded && result?.data && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 pl-10 text-[10px] text-neutral-500 font-mono overflow-x-auto max-h-48 overflow-y-auto custom-scrollbar"
          >
            {JSON.stringify(result.data, null, 2).slice(0, 2000)}
          </motion.pre>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Goal Coordinator Panel ───
function GoalCoordinator() {
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<PlanStep[] | null>(null);
  const [results, setResults] = useState<StepResult[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingIndex, setExecutingIndex] = useState(-1);
  const [summary, setSummary] = useState<CoordinatorResponse["summary"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPlan(null);
    setResults([]);
    setSummary(null);
    setError(null);
    setExecutingIndex(-1);
  };

  const generatePlan = async () => {
    if (!goal.trim() || isPlanning) return;
    reset();
    setIsPlanning(true);
    setError(null);

    try {
      const res = await fetch("/api/agents/coordinator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), auto_execute: false }),
      });
      const data: CoordinatorResponse = await res.json();

      if (data.error) {
        setError(data.error);
      } else if (data.plan) {
        setPlan(data.plan);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setIsPlanning(false);
    }
  };

  const executePlan = async () => {
    if (!goal.trim() || isExecuting) return;
    setResults([]);
    setSummary(null);
    setIsExecuting(true);
    setExecutingIndex(0);

    try {
      const res = await fetch("/api/agents/coordinator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), auto_execute: true }),
      });
      const data: CoordinatorResponse = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        if (data.plan) setPlan(data.plan);
        if (data.results) setResults(data.results);
        if (data.summary) setSummary(data.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setIsExecuting(false);
      setExecutingIndex(-1);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <ClipboardList className="w-4.5 h-4.5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-sm font-black text-white">Goal Coordinator</h2>
          <p className="text-[9px] text-violet-500/60 uppercase tracking-wider">Describe a goal. Get a multi-agent plan.</p>
        </div>
      </div>

      {/* Goal Input */}
      <div className="p-5">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              generatePlan();
            }
          }}
          placeholder="Describe your goal... e.g. &quot;Find fintech startups in London, research their tech stacks, then write a personalized outreach email sequence&quot;"
          rows={3}
          className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/30 transition-colors resize-none"
        />

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={generatePlan}
            disabled={!goal.trim() || isPlanning || isExecuting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-400 text-xs font-bold hover:bg-violet-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isPlanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isPlanning ? "Planning..." : "Generate Plan"}
          </button>

          {plan && plan.length > 0 && (
            <button
              onClick={executePlan}
              disabled={isExecuting || isPlanning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isExecuting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {isExecuting ? "Executing..." : "Execute Plan"}
            </button>
          )}

          {(plan || error) && (
            <button
              onClick={() => { reset(); setGoal(""); }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] text-neutral-500 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 pb-4"
          >
            <div className="rounded-lg border border-red-500/20 bg-red-500/[0.05] px-4 py-3">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plan Steps */}
      <AnimatePresence>
        {plan && plan.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-5 pb-5 space-y-2"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-neutral-600 uppercase tracking-wider font-bold">
                Pipeline — {plan.length} step{plan.length !== 1 ? "s" : ""}
              </span>
              {summary && (
                <span className="text-[10px] font-mono text-neutral-600">
                  {summary.succeeded}/{summary.total_steps} passed
                  {summary.total_duration_ms ? ` in ${(summary.total_duration_ms / 1000).toFixed(1)}s` : ""}
                </span>
              )}
            </div>

            {plan.map((step, i) => {
              const result = results.find((r) => r.step === i + 1);
              const isStepExecuting = isExecuting && !result && (
                executingIndex === -1 ||
                i <= (results.length)
              );
              return (
                <PlanStepCard
                  key={`${step.agent}-${i}`}
                  step={step}
                  index={i}
                  result={result}
                  isExecuting={isStepExecuting}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ───
export default function SovereignAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load health + generate initial suggestions
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        setHealth(data);
        const suggestions = generateSuggestions(data);
        setMessages(suggestions);
      })
      .catch(() => {
        const suggestions = generateSuggestions(null);
        setMessages(suggestions);
      });
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Execute an action
  const executeAction = useCallback(async (action: Action) => {
    const addMsg = (msg: Omit<Message, "id" | "timestamp">) => {
      setMessages((prev) => [...prev, { ...msg, id: crypto.randomUUID(), timestamp: new Date() }]);
    };

    addMsg({ role: "user", content: `Execute: ${action.label}` });

    try {
      const res = await fetch(action.endpoint, {
        method: action.method,
        headers: action.method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: action.method === "POST" ? JSON.stringify(action.body || {}) : undefined,
      });
      const data = await res.json();

      // Parse response into a readable message
      const summary = typeof data === "object"
        ? JSON.stringify(data, null, 2).slice(0, 800)
        : String(data);

      addMsg({
        role: "assistant",
        content: `${action.label} completed.\n\n\`\`\`json\n${summary}\n\`\`\``,
        actions: [
          { label: "Run Again", endpoint: action.endpoint, method: action.method, body: action.body, icon: action.icon },
        ],
      });
    } catch (err) {
      addMsg({
        role: "assistant",
        content: `${action.label} failed: ${err instanceof Error ? err.message : "Unknown error"}. The endpoint may require authentication or API keys.`,
      });
    }
  }, []);

  // Send a message
  const sendMessage = async () => {
    if (!input.trim() || isThinking) return;
    const userInput = input.trim();
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userInput,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      // Route to smart-router for AI response
      const res = await fetch("/api/agents/smart-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `You are Sovereign AI, the intelligent assistant for the Sovereign Matrix platform. You help users manage their AI agents, find leads, create content, analyze competitors, and optimize their business.

The platform has 130+ AI agents, 65+ models, and costs $0 per token via NVIDIA NIM.

User's request: ${userInput}

Respond helpfully and concisely. If the user asks to execute a task, describe what agents would handle it and suggest next steps. Always be proactive — suggest improvements and actions.`,
          agentId: "sovereign-ai",
        }),
      });

      const data = await res.json();
      const response = data.response || data.result || "I'm processing your request. The agents are working on it.";

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
        actions: getContextualActions(userInput),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I couldn't connect to the AI engine. This usually means the API keys need to be configured. Check your .env.local file for NVIDIA_NIM_API_KEY or GEMINI_API_KEY.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-4xl mx-auto p-4 md:p-8" role="main" aria-label="Sovereign AI assistant">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Sovereign AI</h1>
            <p className="text-[10px] text-emerald-500/60 uppercase tracking-wider">
              {health?.status === "healthy" ? "All systems operational" : "Checking systems..."}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setMessages([]);
            const suggestions = generateSuggestions(health);
            setMessages(suggestions);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] text-neutral-500 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Goal Coordinator */}
      <div className="mb-6">
        <GoalCoordinator />
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { label: "Find Leads", prompt: "Find 20 qualified leads in SaaS" },
          { label: "System Health", prompt: "Check all system health and give me a status report" },
          { label: "Write Content", prompt: "Write a LinkedIn post about AI agents replacing agencies" },
          { label: "Competitor Scan", prompt: "Analyze the top 3 AI agency competitors and find gaps we can exploit" },
        ].map((q) => (
          <button
            key={q.label}
            onClick={() => { setInput(q.prompt); inputRef.current?.focus(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] text-neutral-500 hover:text-emerald-400 hover:border-emerald-500/20 transition-gpu"
          >
            <Lightbulb className="w-3 h-3" /> {q.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[400px] max-h-[60vh] custom-scrollbar"
        aria-live="polite"
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onAction={executeAction} />
          ))}
        </AnimatePresence>

        {isThinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs text-neutral-500">Thinking...</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask Sovereign AI anything..."
          aria-label="Message to Sovereign AI"
          className="w-full bg-[#0A0A0A] border border-white/[0.08] rounded-xl px-5 py-4 pr-14 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500/30 transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isThinking}
          aria-label="Send message"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/25 transition-gpu disabled:opacity-30"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Contextual Actions based on user input ───
function getContextualActions(input: string): Action[] {
  const lower = input.toLowerCase();
  const actions: Action[] = [];

  if (lower.includes("lead") || lower.includes("prospect") || lower.includes("find")) {
    actions.push({ label: "Execute Lead Search", endpoint: "/api/agents/prospector", method: "POST", body: { prompt: input, count: 20 }, icon: "target" });
  }
  if (lower.includes("seo") || lower.includes("audit") || lower.includes("rank")) {
    actions.push({ label: "Run SEO Audit", endpoint: "/api/agents/seo-dominator", method: "POST", body: { prompt: input }, icon: "globe" });
  }
  if (lower.includes("competitor") || lower.includes("analyze") || lower.includes("scan")) {
    actions.push({ label: "Scan Competitor", endpoint: "/api/agents/site-assassin", method: "POST", body: { prompt: input }, icon: "chart" });
  }
  if (lower.includes("content") || lower.includes("write") || lower.includes("blog") || lower.includes("post")) {
    actions.push({ label: "Generate Content", endpoint: "/api/agents/blog-gen", method: "POST", body: { prompt: input }, icon: "zap" });
  }
  if (lower.includes("health") || lower.includes("status") || lower.includes("system")) {
    actions.push({ label: "System Health Check", endpoint: "/api/health", method: "GET", icon: "shield" });
  }

  return actions.slice(0, 3);
}
