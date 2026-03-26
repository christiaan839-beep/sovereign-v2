"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Play, Trash2, ArrowRight, Loader2, CheckCircle2,
  FileText, Search, Image, Globe, Code2, Shield, Mic, Languages, Brain, Zap,
} from "lucide-react";

const AGENT_CATALOG = [
  { id: "blog-gen", name: "Blog Writer", icon: FileText, color: "text-emerald-400", desc: "Generate articles from a topic" },
  { id: "grounded-search", name: "Web Research", icon: Search, color: "text-cyan-400", desc: "Search with Google grounding" },
  { id: "flux-image", name: "Image Gen", icon: Image, color: "text-violet-400", desc: "Generate images from prompts" },
  { id: "translate", name: "Translator", icon: Languages, color: "text-amber-400", desc: "Translate to 12 languages" },
  { id: "audit", name: "Site Audit", icon: Globe, color: "text-rose-400", desc: "Audit any website" },
  { id: "code-sandbox", name: "Code Runner", icon: Code2, color: "text-blue-400", desc: "Write and execute Python" },
  { id: "pii-guard", name: "PII Scanner", icon: Shield, color: "text-orange-400", desc: "Detect personal data" },
  { id: "voice-synth", name: "Voice Synth", icon: Mic, color: "text-pink-400", desc: "Text to speech" },
  { id: "deep-think", name: "Deep Think", icon: Brain, color: "text-indigo-400", desc: "Extended reasoning" },
  { id: "competitive-radar", name: "Competitor Intel", icon: Zap, color: "text-yellow-400", desc: "Analyze competitors" },
];

interface WorkflowNode {
  id: string;
  agentId: string;
  name: string;
  icon: typeof FileText;
  color: string;
  params: Record<string, string>;
}

interface WorkflowResult {
  nodeId: string;
  status: "success" | "error";
  output: string;
  durationMs: number;
}

export default function WorkflowBuilderPage() {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<WorkflowResult[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);

  const addNode = (agent: typeof AGENT_CATALOG[0]) => {
    setNodes((prev) => [
      ...prev,
      {
        id: `node-${crypto.randomUUID()}`,
        agentId: agent.id,
        name: agent.name,
        icon: agent.icon,
        color: agent.color,
        params: {},
      },
    ]);
    setShowCatalog(false);
  };

  const removeNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
  };

  const updateParam = (nodeId: string, key: string, value: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, [key]: value } } : n))
    );
  };

  const runWorkflow = async () => {
    if (nodes.length === 0) return;
    setRunning(true);
    setResults([]);
    setCurrentStep(0);

    let workflowResults: WorkflowResult[] = [];

    for (let i = 0; i < nodes.length; i++) {
      setCurrentStep(i);
      const node = nodes[i];

      // Build params — inject previous node output if referenced
      const resolvedParams: Record<string, string> = { ...node.params };
      if (i > 0 && workflowResults[i - 1]?.status === "success") {
        // Auto-inject previous output as context if no explicit param set
        const mainKey = Object.keys(resolvedParams)[0];
        if (!mainKey || !resolvedParams[mainKey]) {
          const prevOutput = workflowResults[i - 1].output.slice(0, 2000);
          resolvedParams.prompt = resolvedParams.prompt || prevOutput;
          resolvedParams.text = resolvedParams.text || prevOutput;
          resolvedParams.query = resolvedParams.query || prevOutput;
          resolvedParams.topic = resolvedParams.topic || prevOutput;
          resolvedParams.problem = resolvedParams.problem || prevOutput;
        }
      }

      const start = performance.now();
      try {
        const res = await fetch(`/api/agents/${node.agentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resolvedParams),
          signal: AbortSignal.timeout(30000),
        });

        const data = await res.json();
        const output = data.result || data.answer || data.response || data.analysis || data.text ||
          data.code || data.translation?.text || JSON.stringify(data, null, 2);

        workflowResults = [...workflowResults, {
          nodeId: node.id,
          status: "success",
          output: typeof output === "string" ? output.slice(0, 3000) : JSON.stringify(output).slice(0, 3000),
          durationMs: Math.round(performance.now() - start),
        }];
      } catch (err) {
        workflowResults = [...workflowResults, {
          nodeId: node.id,
          status: "error",
          output: err instanceof Error ? err.message : "Failed",
          durationMs: Math.round(performance.now() - start),
        }];
      }

      setResults([...workflowResults]);
    }

    setCurrentStep(-1);
    setRunning(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflow Builder</h1>
          <p className="text-neutral-500 text-sm mt-1">Chain agents together. Each step feeds into the next.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCatalog(!showCatalog)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Step
          </button>
          <button
            onClick={runWorkflow}
            disabled={running || nodes.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00B7FF] text-sm font-semibold text-white hover:bg-[#00B7FF]/90 disabled:opacity-30 transition-colors"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Running..." : "Run Workflow"}
          </button>
        </div>
      </div>

      {/* Agent Catalog */}
      <AnimatePresence>
        {showCatalog && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
              {AGENT_CATALOG.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => addNode(agent)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/5 hover:border-white/15 hover:bg-white/[0.04] transition-all text-center group"
                >
                  <agent.icon className={`w-5 h-5 ${agent.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-xs font-medium text-white">{agent.name}</span>
                  <span className="text-[10px] text-neutral-600">{agent.desc}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workflow Pipeline */}
      {nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <Plus className="w-6 h-6 text-neutral-600" />
          </div>
          <p className="text-neutral-500 text-sm mb-2">No steps yet</p>
          <p className="text-neutral-600 text-xs">Click &quot;Add Step&quot; to start building your workflow</p>
        </div>
      ) : (
        <div className="space-y-3">
          {nodes.map((node, i) => {
            const result = results.find((r) => r.nodeId === node.id);
            const isRunning = currentStep === i;

            return (
              <div key={node.id}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-5 rounded-2xl border transition-all ${
                    isRunning
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : result?.status === "success"
                      ? "border-emerald-500/20 bg-white/[0.02]"
                      : result?.status === "error"
                      ? "border-red-500/20 bg-red-500/5"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 text-xs font-bold text-neutral-500">
                        {i + 1}
                      </div>
                      <node.icon className={`w-4 h-4 ${node.color}`} />
                      <span className="text-sm font-semibold text-white">{node.name}</span>
                      {isRunning && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
                      {result?.status === "success" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      {result && <span className="text-[10px] text-neutral-600">{result.durationMs}ms</span>}
                    </div>
                    <button onClick={() => removeNode(node.id)} className="text-neutral-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Input */}
                  <input
                    type="text"
                    placeholder={i === 0 ? "Enter your input..." : "Leave empty to use previous step's output"}
                    value={node.params.prompt || node.params.text || node.params.query || node.params.url || node.params.topic || ""}
                    onChange={(e) => {
                      const key = ["audit", "competitive-radar"].includes(node.agentId) ? "url"
                        : node.agentId === "translate" ? "text"
                        : node.agentId === "grounded-search" ? "query"
                        : node.agentId === "blog-gen" ? "topic"
                        : node.agentId === "deep-think" ? "problem"
                        : "prompt";
                      updateParam(node.id, key, e.target.value);
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20 transition-colors"
                  />

                  {/* Result */}
                  {result && (
                    <div className="mt-3 p-3 rounded-xl bg-black/40 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-neutral-400 whitespace-pre-wrap break-words font-mono">{result.output}</pre>
                    </div>
                  )}
                </motion.div>

                {/* Arrow connector */}
                {i < nodes.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowRight className="w-4 h-4 text-neutral-700 rotate-90" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
