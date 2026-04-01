"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Play, Trash2, Loader2, CheckCircle2, XCircle, Clock,
  Target, Mail, Mic, FileText, Search, Zap, Code2, Shield, Globe,
  LayoutTemplate, ChevronDown,
} from "lucide-react";

/* ─── Agent Registry ─── */
const AGENTS = [
  { id: "leads", name: "Lead Gen", icon: Target, color: "#22d3ee", desc: "Scrape and qualify leads" },
  { id: "email-sequence", name: "Email Outreach", icon: Mail, color: "#a78bfa", desc: "Automated drip sequences" },
  { id: "voice-closer", name: "Voice Closer", icon: Mic, color: "#f472b6", desc: "AI voice follow-up calls" },
  { id: "blog-gen", name: "Blog Writer", icon: FileText, color: "#34d399", desc: "SEO-optimized articles" },
  { id: "seo-dominator", name: "SEO Dominator", icon: Search, color: "#60a5fa", desc: "Keyword and gap analysis" },
  { id: "competitor", name: "Competitor Intel", icon: Shield, color: "#fbbf24", desc: "Monitor and analyze rivals" },
  { id: "code-agent", name: "Code Agent", icon: Code2, color: "#818cf8", desc: "Generate and execute code" },
  { id: "site-assassin", name: "Site Assassin", icon: Globe, color: "#f87171", desc: "Full-stack site audit" },
  { id: "social-content", name: "Social Content", icon: Zap, color: "#fb923c", desc: "Multi-platform posts" },
] as const;

type AgentDef = (typeof AGENTS)[number];

/* ─── Templates ─── */
const TEMPLATES = [
  { name: "Lead Gen \u2192 Email Outreach", agents: ["leads", "email-sequence", "voice-closer"] },
  { name: "Content Pipeline", agents: ["blog-gen", "seo-dominator", "social-content"] },
  { name: "Competitor Strike", agents: ["competitor", "site-assassin", "seo-dominator"] },
];

/* ─── Types ─── */
interface CanvasNode {
  id: string;
  agent: AgentDef;
  x: number;
  y: number;
  status: "idle" | "running" | "done" | "failed";
  output?: string;
  durationMs?: number;
}

/* ─── Node positioning ─── */
const NODE_W = 200;
const NODE_H = 72;
const GAP_X = 80;
const START_X = 40;
const START_Y = 60;

function positionForIndex(i: number): { x: number; y: number } {
  const cols = 3;
  const row = Math.floor(i / cols);
  const col = i % cols;
  return { x: START_X + col * (NODE_W + GAP_X), y: START_Y + row * (NODE_H + 60) };
}

/* ─── Main Page ─── */
export default function WorkflowBuilderPage() {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [running, setRunning] = useState(false);

  const addAgent = useCallback((agent: AgentDef) => {
    setNodes((prev) => {
      const pos = positionForIndex(prev.length);
      return [...prev, { id: `n-${Date.now()}`, agent, ...pos, status: "idle" }];
    });
    setShowCatalog(false);
  }, []);

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id).map((n, i) => ({ ...n, ...positionForIndex(i) })));
  }, []);

  const loadTemplate = useCallback((agentIds: string[]) => {
    const built: CanvasNode[] = agentIds.map((aid, i) => {
      const agent = AGENTS.find((a) => a.id === aid)!;
      return { id: `n-${Date.now()}-${i}`, agent, ...positionForIndex(i), status: "idle" as const };
    });
    setNodes(built);
    setShowTemplates(false);
  }, []);

  /* ─── Execution ─── */
  const runWorkflow = async () => {
    if (nodes.length === 0 || running) return;
    setRunning(true);
    setNodes((prev) => prev.map((n) => ({ ...n, status: "idle" as const, output: undefined, durationMs: undefined })));

    for (let i = 0; i < nodes.length; i++) {
      setNodes((prev) => prev.map((n, j) => (j === i ? { ...n, status: "running" as const } : n)));
      const start = Date.now();
      try {
        const res = await fetch(`/api/agents/${nodes[i].agent.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: "AI automation", prompt: "Execute workflow step" }),
          signal: AbortSignal.timeout(30000),
        });
        const data = await res.json();
        const output = data.result || data.answer || data.response || JSON.stringify(data).slice(0, 300);
        setNodes((prev) =>
          prev.map((n, j) => (j === i ? { ...n, status: "done" as const, output: String(output).slice(0, 200), durationMs: Date.now() - start } : n))
        );
      } catch (err) {
        setNodes((prev) =>
          prev.map((n, j) => (j === i ? { ...n, status: "failed" as const, output: err instanceof Error ? err.message : "Failed", durationMs: Date.now() - start } : n))
        );
      }
    }
    setRunning(false);
  };

  /* ─── SVG Connections ─── */
  const connections = nodes.slice(0, -1).map((from, i) => {
    const to = nodes[i + 1];
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;
    // If wrapping to next row, go down
    const sameRow = Math.abs(y1 - y2) < 10;
    const path = sameRow
      ? `M${x1},${y1} C${x1 + 40},${y1} ${x2 - 40},${y2} ${x2},${y2}`
      : `M${x1},${y1} C${x1 + 40},${y1} ${x1 + 40},${y2} ${x2},${y2}`;
    const active = from.status === "done" || from.status === "running";
    return { key: `${from.id}-${to.id}`, path, active };
  });

  const canvasW = Math.max(900, ...nodes.map((n) => n.x + NODE_W + 60));
  const canvasH = Math.max(300, ...nodes.map((n) => n.y + NODE_H + 60));

  const statusIcon = (s: CanvasNode["status"]) => {
    if (s === "running") return <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />;
    if (s === "done") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (s === "failed") return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    return <Clock className="w-3.5 h-3.5 text-neutral-500" />;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6" role="main" aria-label="Workflow builder">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Workflow Builder</h1>
          <p className="text-neutral-500 text-sm mt-1">Chain agents visually. Each node feeds into the next.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => { setShowTemplates(!showTemplates); setShowCatalog(false); }}
              aria-expanded={showTemplates}
              aria-label="Templates menu"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/[0.06] text-sm text-neutral-300 hover:bg-white/10 transition-colors">
              <LayoutTemplate className="w-4 h-4" /> Templates <ChevronDown className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {showTemplates && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                  className="absolute right-0 top-full mt-2 w-64 bg-[#0A0A0A] border border-white/[0.08] rounded-xl p-2 z-30 shadow-2xl">
                  {TEMPLATES.map((t) => (
                    <button key={t.name} onClick={() => loadTemplate(t.agents)}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-neutral-300 hover:bg-white/[0.06] transition-colors">
                      {t.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => { setShowCatalog(!showCatalog); setShowTemplates(false); }}
            aria-expanded={showCatalog}
            aria-label="Add agent catalog"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/[0.06] text-sm text-white hover:bg-white/10 transition-colors">
            <Plus className="w-4 h-4" /> Add Agent
          </button>
          <button onClick={runWorkflow} disabled={running || nodes.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500/90 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-30 transition-colors">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Running..." : "Run Workflow"}
          </button>
        </div>
      </div>

      {/* Agent Catalog */}
      <AnimatePresence>
        {showCatalog && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              {AGENTS.map((a) => (
                <button key={a.id} onClick={() => addAgent(a)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.04] transition-all text-center group">
                  <a.icon className="w-5 h-5 group-hover:scale-110 transition-transform" style={{ color: a.color }} />
                  <span className="text-xs font-medium text-white">{a.name}</span>
                  <span className="text-[10px] text-neutral-500 leading-tight">{a.desc}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0A0A0A] overflow-x-auto relative" style={{ minHeight: 340 }}>
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/[0.08] flex items-center justify-center mb-4">
              <Plus className="w-5 h-5 text-neutral-500" />
            </div>
            <p className="text-neutral-500 text-sm">Add agents or load a template to start</p>
          </div>
        ) : (
          <svg width={canvasW} height={canvasH} className="relative z-10">
            <defs>
              <linearGradient id="line-active" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.6" />
              </linearGradient>
            </defs>

            {/* Connection lines — hidden on mobile where absolute positioning overflows */}
            <g className="hidden md:block">
              {connections.map((c) => (
                <motion.path key={c.key} d={c.path} fill="none"
                  stroke={c.active ? "url(#line-active)" : "rgba(255,255,255,0.06)"}
                  strokeWidth={c.active ? 2 : 1.5} strokeDasharray={c.active ? "none" : "6 4"}
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
              ))}
            </g>

            {/* Nodes */}
            {nodes.map((node) => {
              const Icon = node.agent.icon;
              const glowColor = node.status === "running" ? node.agent.color : "transparent";
              return (
                <g key={node.id}>
                  {/* Glow */}
                  {node.status === "running" && (
                    <rect x={node.x - 2} y={node.y - 2} width={NODE_W + 4} height={NODE_H + 4} rx={16}
                      fill="none" stroke={glowColor} strokeWidth={1} opacity={0.4}>
                      <animate attributeName="opacity" values="0.2;0.5;0.2" dur="1.5s" repeatCount="indefinite" />
                    </rect>
                  )}

                  {/* Card background */}
                  <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={14}
                    fill={node.status === "done" ? "rgba(16,185,129,0.06)" : node.status === "failed" ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.03)"}
                    stroke={node.status === "done" ? "rgba(16,185,129,0.2)" : node.status === "failed" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}
                    strokeWidth={1} />

                  {/* Icon circle */}
                  <circle cx={node.x + 28} cy={node.y + NODE_H / 2} r={14}
                    fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />

                  {/* Foreign object for React icons */}
                  <foreignObject x={node.x + 16} y={node.y + NODE_H / 2 - 10} width={24} height={20}>
                    <div className="flex items-center justify-center w-full h-full">
                      <Icon className="w-4 h-4" style={{ color: node.agent.color }} />
                    </div>
                  </foreignObject>

                  {/* Name */}
                  <text x={node.x + 52} y={node.y + 28} fill="white" fontSize={13} fontWeight={600} fontFamily="inherit">
                    {node.agent.name}
                  </text>

                  {/* Status row */}
                  <foreignObject x={node.x + 48} y={node.y + 36} width={120} height={24}>
                    <div className="flex items-center gap-1.5">
                      {statusIcon(node.status)}
                      <span className="text-[10px] text-neutral-500">
                        {node.status === "idle" ? "Pending" : node.status === "running" ? "Executing..." : node.status === "done" ? `${node.durationMs}ms` : "Failed"}
                      </span>
                    </div>
                  </foreignObject>

                  {/* Remove button */}
                  <foreignObject x={node.x + NODE_W - 28} y={node.y + 6} width={20} height={20}>
                    <button onClick={() => removeNode(node.id)} aria-label={`Remove ${node.agent.name}`} className="text-neutral-700 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Execution Results */}
      <AnimatePresence>
        {nodes.some((n) => n.output) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-400" aria-live="polite">Execution Log</h2>
            {nodes.filter((n) => n.output).map((n) => (
              <div key={n.id} className={`p-3 rounded-xl border ${n.status === "done" ? "border-emerald-500/10 bg-emerald-500/[0.03]" : "border-red-500/10 bg-red-500/[0.03]"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <n.agent.icon className="w-3.5 h-3.5" style={{ color: n.agent.color }} />
                  <span className="text-xs font-medium text-white">{n.agent.name}</span>
                  {n.durationMs && <span className="text-[10px] text-neutral-500">{n.durationMs}ms</span>}
                </div>
                <pre className="text-[11px] text-neutral-500 whitespace-pre-wrap break-words font-mono leading-relaxed">{n.output}</pre>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
