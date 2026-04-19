"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Send, Loader2, CheckCircle2, Cpu,
  Sparkles, Brain, Target, Shield, Activity,
  ChevronRight, RotateCcw, Copy, Check,
} from "lucide-react";

/* ─── Agent Config ─── */

const AGENTS = [
  {
    id: "nemotron",
    name: "Nemotron Ultra",
    role: "Strategic Analyst",
    color: "#76b900",
    bg: "rgba(118,185,0,0.08)",
    border: "rgba(118,185,0,0.25)",
    glow: "rgba(118,185,0,0.15)",
    icon: Target,
    params: "253B",
  },
  {
    id: "qwen",
    name: "Qwen 3",
    role: "Deep Reasoner",
    color: "#9333ea",
    bg: "rgba(147,51,234,0.08)",
    border: "rgba(147,51,234,0.25)",
    glow: "rgba(147,51,234,0.15)",
    icon: Brain,
    params: "235B",
  },
  {
    id: "mistral",
    name: "Mistral Nemotron",
    role: "Devil's Advocate",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
    glow: "rgba(245,158,11,0.15)",
    icon: Shield,
    params: "70B",
  },
  {
    id: "deepseek",
    name: "DeepSeek V3",
    role: "Pragmatist",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.08)",
    border: "rgba(56,189,248,0.25)",
    glow: "rgba(56,189,248,0.15)",
    icon: Cpu,
    params: "685B",
  },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];
type Phase = "idle" | "racing" | "consensus" | "done";

interface AgentState {
  text: string;
  done: boolean;
  latencyMs: number | null;
  error: string | null;
}

const DEFAULT_AGENT_STATE: AgentState = { text: "", done: false, latencyMs: null, error: null };

const EXAMPLE_PROMPTS = [
  "What's the biggest hidden risk in raising VC funding vs staying bootstrapped?",
  "How can a 5-person startup beat a 500-person company?",
  "What's the most effective way to generate B2B leads in 2025?",
  "Is AI replacing founders or making them more powerful?",
  "What separates a $1M company from a $100M company?",
];

/**
 * Safe markdown-bold renderer — splits on **bold** without injecting raw HTML.
 * Prevents XSS when rendering LLM output.
 */
function renderSafeBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-indigo-300">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ─── ModelCard ─── */

function ModelCard({
  agent,
  state,
  active,
}: {
  agent: (typeof AGENTS)[number];
  state: AgentState;
  active: boolean;
}) {
  const Icon = agent.icon;
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [state.text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: agent.bg,
        border: `1px solid ${state.done ? agent.border : active ? agent.border : "rgba(255,255,255,0.06)"}`,
        boxShadow: active && !state.done ? `0 0 30px ${agent.glow}` : "none",
        transition: "box-shadow 0.4s ease, border-color 0.3s ease",
        minHeight: 260,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${agent.color}20` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: agent.color }} />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-200">{agent.name}</p>
            <p className="text-[10px]" style={{ color: agent.color }}>{agent.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${agent.color}15`, color: agent.color }}>
            {agent.params}
          </span>
          {active && !state.done && (
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: agent.color }}
            />
          )}
          {state.done && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: agent.color }} />}
        </div>
      </div>

      {/* Content */}
      <div ref={textRef} className="flex-1 p-4 overflow-y-auto text-xs leading-relaxed text-neutral-300 font-mono" style={{ maxHeight: 220 }}>
        {state.error ? (
          <p className="text-rose-400">{state.error}</p>
        ) : state.text ? (
          <>
            {state.text}
            {active && !state.done && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="inline-block w-0.5 h-3 ml-0.5 align-middle"
                style={{ background: agent.color }}
              />
            )}
          </>
        ) : active ? (
          <div className="flex items-center gap-1.5 text-neutral-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Thinking...</span>
          </div>
        ) : (
          <p className="text-neutral-600 italic">Waiting for prompt...</p>
        )}
      </div>

      {/* Footer latency */}
      {state.latencyMs !== null && (
        <div className="px-4 py-2 border-t text-[10px] text-neutral-500 font-mono" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {(state.latencyMs / 1000).toFixed(1)}s
        </div>
      )}
    </motion.div>
  );
}

/* ─── ConsensusCard ─── */

function ConsensusCard({ text, done }: { text: string; done: boolean }) {
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current) textRef.current.scrollTop = textRef.current.scrollHeight;
  }, [text]);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 0 60px rgba(99,102,241,0.12), 0 0 120px rgba(99,102,241,0.05)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(99,102,241,0.08)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-200">Gemini 2.0 — Consensus Synthesis</p>
            <p className="text-[10px] text-indigo-400">4 perspectives unified</p>
          </div>
        </div>
        {done && (
          <button
            onClick={copy}
            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      <div
        ref={textRef}
        className="p-5 text-sm leading-relaxed text-neutral-200"
        style={{ maxHeight: 260, overflowY: "auto" }}
      >
        {text ? (
          <>
            {renderSafeBold(text)}
            {!done && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="inline-block w-0.5 h-4 ml-0.5 align-middle bg-indigo-400"
              />
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-neutral-500">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span className="text-sm">Synthesizing {AGENTS.length} perspectives...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Main Page ─── */

export default function NexusPage() {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentState>>(
    Object.fromEntries(AGENTS.map((a) => [a.id, { ...DEFAULT_AGENT_STATE }])) as Record<AgentId, AgentState>,
  );
  const [consensus, setConsensus] = useState("");
  const [consensusDone, setConsensusDone] = useState(false);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
    setAgentStates(
      Object.fromEntries(AGENTS.map((a) => [a.id, { ...DEFAULT_AGENT_STATE }])) as Record<AgentId, AgentState>,
    );
    setConsensus("");
    setConsensusDone(false);
    setTotalMs(null);
    setSubmittedPrompt("");
  }, []);

  const run = useCallback(async () => {
    if (!prompt.trim() || phase === "racing" || phase === "consensus") return;

    reset();
    await new Promise((r) => setTimeout(r, 50));

    setSubmittedPrompt(prompt);
    setPhase("racing");
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/agents/nexus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: abort.signal,
      });

      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));

            if (ev.type === "token") {
              setAgentStates((prev) => ({
                ...prev,
                [ev.model]: { ...prev[ev.model as AgentId], text: prev[ev.model as AgentId].text + ev.text },
              }));
            } else if (ev.type === "model_done") {
              setAgentStates((prev) => ({
                ...prev,
                [ev.model]: { ...prev[ev.model as AgentId], done: true, latencyMs: ev.latencyMs },
              }));
            } else if (ev.type === "error") {
              setAgentStates((prev) => ({
                ...prev,
                [ev.model]: { ...prev[ev.model as AgentId], error: ev.message, done: true },
              }));
            } else if (ev.type === "consensus_start") {
              setPhase("consensus");
            } else if (ev.type === "consensus_token") {
              setConsensus((c) => c + ev.text);
            } else if (ev.type === "end") {
              setTotalMs(ev.latencyMs);
              setConsensusDone(true);
              setPhase("done");
            }
          } catch {
            // bad JSON chunk
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setPhase("done");
      }
    }
  }, [prompt, phase, reset]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      run();
    }
  };

  const isRunning = phase === "racing" || phase === "consensus";

  return (
    <div className="min-h-screen bg-[#030303] p-6 pb-16">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-indigo-400" />
              </div>
              <h1 className="text-lg font-semibold text-neutral-100">Nexus Protocol</h1>
            </div>
            <p className="text-xs text-neutral-500">
              4 frontier models · true parallel execution · live consensus synthesis
            </p>
          </div>

          {phase === "done" && totalMs && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 text-xs text-neutral-400"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Completed in {(totalMs / 1000).toFixed(1)}s</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="max-w-5xl mx-auto mb-6">
        <div
          className="relative rounded-2xl overflow-hidden transition-all duration-300"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: isRunning ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)",
            boxShadow: isRunning ? "0 0 40px rgba(99,102,241,0.1)" : "none",
          }}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask any question — watch 4 frontier models race to answer..."
            disabled={isRunning}
            rows={2}
            className="w-full bg-transparent px-5 py-4 pr-24 text-sm text-neutral-200 placeholder-neutral-600 resize-none outline-none"
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            {phase !== "idle" && (
              <button
                onClick={reset}
                className="p-2 rounded-xl text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={run}
              disabled={!prompt.trim() || isRunning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
              style={{
                background: prompt.trim() && !isRunning ? "rgba(99,102,241,0.9)" : "rgba(99,102,241,0.15)",
                color: prompt.trim() && !isRunning ? "#fff" : "rgba(99,102,241,0.6)",
              }}
            >
              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {isRunning ? "Racing..." : "Run"}
            </button>
          </div>
        </div>

        {phase === "idle" && (
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] text-neutral-500 hover:text-neutral-300 hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all"
              >
                <ChevronRight className="w-2.5 h-2.5 flex-shrink-0" />
                {p.length > 60 ? p.slice(0, 60) + "…" : p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Submitted prompt echo */}
      <AnimatePresence>
        {submittedPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto mb-5"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8">
              <span className="text-[10px] text-neutral-500">Prompt:</span>
              <span className="text-xs text-neutral-300">{submittedPrompt}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Model Grid */}
      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto"
          >
            {phase === "racing" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 mb-4 text-xs text-neutral-500"
              >
                <div className="flex gap-1">
                  {AGENTS.map((a, i) => (
                    <motion.div
                      key={a.id}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                      className="w-1 h-3 rounded-full"
                      style={{ background: a.color }}
                    />
                  ))}
                </div>
                <span>4 models generating simultaneously...</span>
              </motion.div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {AGENTS.map((agent, i) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <ModelCard
                    agent={agent}
                    state={agentStates[agent.id]}
                    active={!agentStates[agent.id].done && phase === "racing"}
                  />
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {(phase === "consensus" || phase === "done") && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1" style={{ background: "rgba(99,102,241,0.2)" }} />
                    <span className="text-[10px] text-indigo-400 font-medium uppercase tracking-widest px-2">
                      Consensus Synthesis
                    </span>
                    <div className="h-px flex-1" style={{ background: "rgba(99,102,241,0.2)" }} />
                  </div>
                  <ConsensusCard text={consensus} done={consensusDone} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle state — capability cards */}
      {phase === "idle" && (
        <div className="max-w-5xl mx-auto mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            return (
              <motion.div
                key={agent.id}
                whileHover={{ y: -2 }}
                className="rounded-xl p-4 cursor-default"
                style={{
                  background: agent.bg,
                  border: `1px solid ${agent.border}`,
                }}
              >
                <Icon className="w-5 h-5 mb-2" style={{ color: agent.color }} />
                <p className="text-xs font-medium text-neutral-200">{agent.name}</p>
                <p className="text-[10px] mt-0.5" style={{ color: agent.color }}>{agent.role}</p>
                <p className="text-[10px] text-neutral-600 mt-1 font-mono">{agent.params} params</p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
