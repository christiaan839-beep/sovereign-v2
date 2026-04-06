"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Plus, Trash2, Play, Save, ArrowRight, GripVertical,
  Target, FileText, Search, Mic, Code2, Mail, Globe, Shield,
  Loader2, CheckCircle2, BrainCircuit, ChevronsRight, GitBranch,
  ArrowDown, ChevronDown, SkipForward, FolderOpen, X, Clock,
  MessageSquare, Table2, CalendarClock,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { useSearchParams } from "next/navigation";
import { getTemplateById } from "@/lib/workflow-templates";

// ─── Types ──────────────────────────────────────────────────────

type ExecutionMode = "sequential" | "parallel" | "conditional";

interface AgentNode {
  id: string;
  agentId: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  config: Record<string, string>;
  executionMode: ExecutionMode;
  condition?: string;
}

// Serializable version for persistence (icons can't be serialized)
interface SerializedNode {
  id: string;
  agentId: string;
  name: string;
  color: string;
  config: Record<string, string>;
  executionMode: ExecutionMode;
  condition?: string;
}

interface NodeResult {
  nodeId: string;
  agentId: string;
  status: "running" | "complete" | "error" | "skipped";
  output: string;
}

interface SavedWorkflow {
  id: string;
  name: string;
  nodes: string; // JSON string
  status: string;
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Webhook icon (lucide doesn't export "Webhook" — use Globe2 variant) ──
const WebhookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
    <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
    <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8H12" />
  </svg>
);

// ─── Agent catalog for workflow builder ──────────────────────────

const AGENT_CATALOG = [
  { agentId: "leads", name: "Lead Gen", icon: Target, color: "emerald", description: "Find and enrich leads matching your criteria" },
  { agentId: "content", name: "Content Writer", icon: FileText, color: "cyan", description: "Write blog posts, articles, and copy" },
  { agentId: "seo", name: "SEO Analyzer", icon: Search, color: "violet", description: "Analyze websites for SEO opportunities" },
  { agentId: "voice", name: "Voice Agent", icon: Mic, color: "amber", description: "Make AI-powered outbound calls" },
  { agentId: "code-agent", name: "Code Agent", icon: Code2, color: "rose", description: "Generate, review, and deploy code" },
  { agentId: "email-sequence", name: "Email Sequence", icon: Mail, color: "blue", description: "Create and send drip campaigns" },
  { agentId: "competitor", name: "Competitor Intel", icon: Globe, color: "orange", description: "Analyze competitor websites and strategy" },
  { agentId: "content-safety", name: "Safety Check", icon: Shield, color: "red", description: "Run NeMo Guardrails on content" },
  { agentId: "god-brain", name: "God Brain", icon: BrainCircuit, color: "purple", description: "Multi-model orchestration pipeline" },
  { agentId: "code-sandbox", name: "Run Code", icon: Code2, color: "cyan", description: "Execute Python code in a cloud sandbox" },
  // ─── Integration connectors ─────────────────────────────────────
  { agentId: "integration-slack", name: "Send to Slack", icon: MessageSquare, color: "purple", description: "Post a message to a Slack channel" },
  { agentId: "integration-webhook", name: "Fire Webhook", icon: WebhookIcon, color: "orange", description: "Send data to any external URL" },
  { agentId: "integration-sheets", name: "Add to Sheet", icon: Table2, color: "green", description: "Append a row to Google Sheets" },
  { agentId: "integration-notion", name: "Create in Notion", icon: FileText, color: "neutral", description: "Create a page in Notion" },
];

// ─── Resolve icon from agentId ─────────────────────────────────

function resolveIcon(agentId: string): React.ComponentType<{ className?: string }> {
  const match = AGENT_CATALOG.find((a) => a.agentId === agentId);
  return match?.icon || BrainCircuit;
}

// ─── Execution Mode Config ──────────────────────────────────────

const MODE_CONFIG: Record<ExecutionMode, { label: string; icon: React.ComponentType<{ className?: string }>; borderClass: string; badgeClass: string }> = {
  sequential: { label: "Sequential", icon: ArrowDown, borderClass: "", badgeClass: "bg-white/5 text-neutral-400 border-white/10" },
  parallel: { label: "Parallel", icon: ChevronsRight, borderClass: "!border-cyan-500/40", badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  conditional: { label: "Conditional", icon: GitBranch, borderClass: "!border-amber-500/40", badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
};

// ─── Workflow Builder Page ───────────────────────────────────────

function WorkflowBuilderInner() {
  const toast = useToast();
  const searchParams = useSearchParams();

  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [nodes, setNodes] = useState<AgentNode[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<NodeResult[]>([]);
  const [openModeDropdown, setOpenModeDropdown] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // My Workflows drawer
  const [showDrawer, setShowDrawer] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);

  // Schedule modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulePreset, setSchedulePreset] = useState("daily-9am");
  const [customCron, setCustomCron] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduledWorkflowIds, setScheduledWorkflowIds] = useState<Set<string>>(new Set());

  // ─── Deserialize nodes from DB ──────────────────────────────────

  const deserializeNodes = useCallback((raw: string): AgentNode[] => {
    try {
      const parsed: SerializedNode[] = JSON.parse(raw);
      return parsed.map((n) => ({
        ...n,
        icon: resolveIcon(n.agentId),
      }));
    } catch {
      return [];
    }
  }, []);

  // ─── Load workflow from URL param on mount ──────────────────────

  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;

    (async () => {
      try {
        const res = await fetch(`/api/workflows/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        const wf = data.workflow;
        setWorkflowId(wf.id);
        setWorkflowName(wf.name);
        setNodes(deserializeNodes(wf.nodes));
        toast.success(`Loaded "${wf.name}"`);
      } catch {
        // ignore — new workflow
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Load from template marketplace ────────────────────────────

  useEffect(() => {
    const templateId = searchParams.get("template");
    if (!templateId) return;

    const template = getTemplateById(templateId);
    if (!template) return;

    const hydratedNodes: AgentNode[] = template.nodes.map((n, i) => ({
      id: `${n.agentId}-tpl-${i}-${Date.now()}`,
      agentId: n.agentId,
      name: n.name,
      icon: resolveIcon(n.agentId),
      color: n.color,
      config: n.config,
      executionMode: n.executionMode,
      condition: n.condition,
    }));

    setWorkflowId(null);
    setWorkflowName(template.name);
    setNodes(hydratedNodes);
    setResults([]);
    toast.success(`Template loaded: ${template.name}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Save workflow ──────────────────────────────────────────────

  const saveWorkflow = useCallback(async () => {
    if (nodes.length === 0) {
      toast.error("Add at least one agent before saving");
      return;
    }
    setSaving(true);
    try {
      const serialized: SerializedNode[] = nodes.map(({ icon: _icon, ...rest }) => rest);
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: workflowId,
          name: workflowName,
          nodes: serialized,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWorkflowId(data.workflow.id);
        toast.success("Workflow saved");
      } else {
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save workflow");
    } finally {
      setSaving(false);
    }
  }, [nodes, workflowId, workflowName, toast]);

  // ─── Fetch saved workflows ──────────────────────────────────────

  const fetchWorkflows = useCallback(async () => {
    setLoadingWorkflows(true);
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        setSavedWorkflows(data.workflows || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingWorkflows(false);
    }
  }, []);

  // ─── Load a workflow from the drawer ────────────────────────────

  const loadWorkflow = useCallback((wf: SavedWorkflow) => {
    setWorkflowId(wf.id);
    setWorkflowName(wf.name);
    setNodes(deserializeNodes(wf.nodes));
    setResults([]);
    setShowDrawer(false);
    toast.success(`Loaded "${wf.name}"`);
  }, [deserializeNodes, toast]);

  // ─── Delete a workflow from the drawer ──────────────────────────

  const deleteWorkflow = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSavedWorkflows((prev) => prev.filter((w) => w.id !== id));
        if (workflowId === id) {
          setWorkflowId(null);
          setWorkflowName("Untitled Workflow");
          setNodes([]);
        }
        toast.success("Workflow deleted");
      }
    } catch {
      toast.error("Failed to delete");
    }
  }, [workflowId, toast]);

  // ─── Fetch which workflows are scheduled ────────────────────────

  const fetchScheduledIds = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduled-workflows");
      if (res.ok) {
        const data = await res.json();
        const ids = new Set<string>(
          (data.scheduledWorkflows || [])
            .filter((sw: { enabled: boolean }) => sw.enabled)
            .map((sw: { prompt: string }) => sw.prompt) // prompt stores the workflow ID
        );
        setScheduledWorkflowIds(ids);
      }
    } catch {
      // silent
    }
  }, []);

  // ─── Schedule a workflow ────────────────────────────────────────

  const scheduleWorkflow = useCallback(async () => {
    if (!workflowId) {
      toast.error("Save the workflow first before scheduling");
      return;
    }

    setScheduleSaving(true);
    try {
      const cronExpression = schedulePreset === "custom" ? customCron : schedulePreset;

      const res = await fetch("/api/scheduled-workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          workflowName,
          cronExpression,
          enabled: true,
        }),
      });

      if (res.ok) {
        toast.success("Workflow scheduled");
        setShowScheduleModal(false);
        setScheduledWorkflowIds((prev) => new Set([...prev, workflowId]));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to schedule");
      }
    } catch {
      toast.error("Failed to schedule workflow");
    } finally {
      setScheduleSaving(false);
    }
  }, [workflowId, workflowName, schedulePreset, customCron, toast]);

  // ─── Add / Remove / Update nodes ───────────────────────────────

  const addNode = useCallback((agent: typeof AGENT_CATALOG[0]) => {
    const node: AgentNode = {
      id: `${agent.agentId}-${Date.now()}`,
      agentId: agent.agentId,
      name: agent.name,
      icon: agent.icon,
      color: agent.color,
      config: {},
      executionMode: "sequential",
    };
    setNodes((prev) => [...prev, node]);
    setShowCatalog(false);
    toast.success(`${agent.name} added to workflow`);
  }, [toast]);

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const updateNodeMode = useCallback((id: string, mode: ExecutionMode) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, executionMode: mode, condition: mode === "conditional" ? n.condition || "" : undefined } : n
      )
    );
    setOpenModeDropdown(null);
  }, []);

  const updateNodeCondition = useCallback((id: string, condition: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, condition } : n))
    );
  }, []);

  // ─── Execute a single node ──────────────────────────────────────

  const executeNode = useCallback(async (node: AgentNode, prevOutput: string): Promise<NodeResult> => {
    const enrichedPrompt = node.config.prompt
      ? `${node.config.prompt}\n\nContext from previous step:\n${prevOutput.slice(0, 500)}`
      : `Execute ${node.name} as part of workflow "${workflowName}". Context from previous step:\n${prevOutput.slice(0, 500)}`;

    // Route integrations to /api/_integrations/{type}, agents to /api/_agents/{agentId}
    const isIntegration = node.agentId.startsWith("integration-");
    const endpoint = isIntegration
      ? `/api/_integrations/${node.agentId.replace("integration-", "")}`
      : `/api/_agents/${node.agentId}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: enrichedPrompt,
          ...node.config,
        }),
      });

      const data = await res.json();
      return {
        nodeId: node.id,
        agentId: node.agentId,
        status: res.ok ? "complete" : "error",
        output: data.output || data.error || JSON.stringify(data).slice(0, 200),
      };
    } catch (err) {
      return {
        nodeId: node.id,
        agentId: node.agentId,
        status: "error",
        output: (err as Error).message,
      };
    }
  }, [workflowName]);

  // ─── Run the full workflow with batching ─────────────────────────

  const runWorkflow = useCallback(async () => {
    if (nodes.length === 0) {
      toast.error("Add at least one agent to the workflow");
      return;
    }

    setRunning(true);
    setResults([]);

    // Group consecutive parallel nodes into batches
    const batches: AgentNode[][] = [];
    let currentBatch: AgentNode[] = [];

    for (const node of nodes) {
      if (node.executionMode === "parallel") {
        currentBatch.push(node);
      } else {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
        }
        batches.push([node]);
      }
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    const allResults: NodeResult[] = [];

    for (const batch of batches) {
      const prevOutput = allResults.length > 0 ? allResults[allResults.length - 1]?.output || "" : "";

      if (batch.length === 1) {
        const node = batch[0];

        // Mark as running
        setResults((prev) => [...prev, { nodeId: node.id, agentId: node.agentId, status: "running", output: "" }]);

        // Conditional check
        if (node.executionMode === "conditional" && node.condition) {
          const prevResult = allResults[allResults.length - 1];
          if (prevResult && !prevResult.output.toLowerCase().includes(node.condition.toLowerCase())) {
            const skipped: NodeResult = {
              nodeId: node.id,
              agentId: node.agentId,
              status: "skipped",
              output: `Condition not met: "${node.condition}"`,
            };
            allResults.push(skipped);
            setResults((prev) => prev.map((r) => (r.nodeId === node.id ? skipped : r)));
            continue;
          }
        }

        // Sequential execution
        const result = await executeNode(node, prevOutput);
        allResults.push(result);
        setResults((prev) => prev.map((r) => (r.nodeId === node.id ? result : r)));
      } else {
        // Mark all parallel nodes as running
        setResults((prev) => [
          ...prev,
          ...batch.map((n) => ({ nodeId: n.id, agentId: n.agentId, status: "running" as const, output: "" })),
        ]);

        // Parallel execution
        const batchResults = await Promise.all(batch.map((node) => executeNode(node, prevOutput)));

        for (const result of batchResults) {
          allResults.push(result);
        }

        setResults((prev) =>
          prev.map((r) => {
            const match = batchResults.find((br) => br.nodeId === r.nodeId);
            return match || r;
          })
        );
      }
    }

    setRunning(false);
    toast.success("Workflow completed");
  }, [nodes, executeNode, toast]);

  // ─── Color maps ─────────────────────────────────────────────────

  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    cyan: "border-cyan-500/30 bg-cyan-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    orange: "border-orange-500/30 bg-orange-500/5",
    red: "border-red-500/30 bg-red-500/5",
    purple: "border-purple-500/30 bg-purple-500/5",
    green: "border-green-500/30 bg-green-500/5",
    neutral: "border-neutral-500/30 bg-neutral-500/5",
  };

  // ─── Connector icon between nodes ────────────────────────────────

  const ConnectorIcon = ({ nextNode }: { node: AgentNode; nextNode?: AgentNode }) => {
    const nextMode = nextNode?.executionMode;
    if (nextMode === "parallel") {
      return (
        <div className="flex justify-center py-1">
          <ChevronsRight className="w-4 h-4 text-cyan-400 rotate-90" />
        </div>
      );
    }
    if (nextMode === "conditional") {
      return (
        <div className="flex justify-center py-1">
          <GitBranch className="w-4 h-4 text-amber-400" />
        </div>
      );
    }
    return (
      <div className="flex justify-center py-1">
        <ArrowDown className="w-4 h-4 text-neutral-500" />
      </div>
    );
  };

  // ─── Helper to count nodes from JSON ────────────────────────────

  const countNodes = (nodesStr: string): number => {
    try { return JSON.parse(nodesStr).length; } catch { return 0; }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-400 text-xs font-bold uppercase tracking-wider mb-3">
            <BrainCircuit className="w-3 h-3 text-emerald-400" /> Workflow Builder
          </div>
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="block text-2xl font-bold text-white bg-transparent border-none outline-none focus:ring-0 w-full"
            placeholder="Name your workflow..."
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setShowDrawer(true); fetchWorkflows(); fetchScheduledIds(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <FolderOpen className="w-4 h-4" /> My Workflows
          </button>
          <button
            onClick={saveWorkflow}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button
            onClick={() => {
              if (!workflowId) {
                toast.error("Save the workflow first before scheduling");
                return;
              }
              setShowScheduleModal(true);
            }}
            disabled={nodes.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <CalendarClock className="w-4 h-4" />
            {workflowId && scheduledWorkflowIds.has(workflowId) ? "Scheduled" : "Schedule"}
            {workflowId && scheduledWorkflowIds.has(workflowId) && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>
          <button
            onClick={runWorkflow}
            disabled={running || nodes.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Running..." : "Run Workflow"}
          </button>
        </div>
      </div>

      {/* Workflow Canvas */}
      <div className="relative">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-white/10 rounded-2xl">
            <BrainCircuit className="w-12 h-12 text-neutral-500 mb-4" />
            <p className="text-neutral-500 text-sm mb-2">No agents in this workflow yet</p>
            <p className="text-neutral-500 text-xs mb-6">Add agents to create an automated pipeline</p>
            <button
              onClick={() => setShowCatalog(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add First Agent
            </button>
          </div>
        ) : (
          <div className="space-y-0">
            <Reorder.Group axis="y" values={nodes} onReorder={setNodes} className="space-y-0">
              {nodes.map((node, i) => {
                const Icon = node.icon;
                const result = results.find((r) => r.nodeId === node.id);
                const modeConf = MODE_CONFIG[node.executionMode];
                const ModeIcon = modeConf.icon;

                return (
                  <Reorder.Item key={node.id} value={node}>
                    <motion.div layout>
                      {/* Node card */}
                      <div
                        className={`relative flex flex-col gap-3 p-4 rounded-xl border transition-colors ${colorMap[node.color] || "border-white/10 bg-white/5"} ${modeConf.borderClass}`}
                      >
                        <div className="flex items-center gap-4">
                          <GripVertical className="w-4 h-4 text-neutral-500 cursor-grab shrink-0" />

                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                              <Icon className="w-5 h-5 text-neutral-300" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white">{node.name}</div>
                              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                                Step {i + 1}
                                {node.agentId.startsWith("integration-") && (
                                  <span className="ml-2 text-purple-400">Integration</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Execution mode selector */}
                          <div className="relative shrink-0">
                            <button
                              onClick={() => setOpenModeDropdown(openModeDropdown === node.id ? null : node.id)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${modeConf.badgeClass}`}
                            >
                              <ModeIcon className="w-3 h-3" />
                              {modeConf.label}
                              <ChevronDown className="w-3 h-3 opacity-50" />
                            </button>

                            <AnimatePresence>
                              {openModeDropdown === node.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  className="absolute right-0 top-full mt-1 z-20 bg-[#111] border border-white/10 rounded-lg p-1 min-w-[160px] shadow-xl"
                                >
                                  {(Object.entries(MODE_CONFIG) as [ExecutionMode, typeof MODE_CONFIG["sequential"]][]).map(([mode, conf]) => {
                                    const ItemIcon = conf.icon;
                                    return (
                                      <button
                                        key={mode}
                                        onClick={() => updateNodeMode(node.id, mode)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors ${
                                          node.executionMode === mode
                                            ? "bg-white/10 text-white"
                                            : "text-neutral-400 hover:text-white hover:bg-white/5"
                                        }`}
                                      >
                                        <ItemIcon className="w-3.5 h-3.5" />
                                        {conf.label}
                                      </button>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Prompt input */}
                          <input
                            type="text"
                            placeholder="Custom prompt (optional)..."
                            value={node.config.prompt || ""}
                            onChange={(e) => {
                              setNodes((prev) =>
                                prev.map((n) =>
                                  n.id === node.id ? { ...n, config: { ...n.config, prompt: e.target.value } } : n
                                )
                              );
                            }}
                            className="flex-1 max-w-xs px-3 py-1.5 rounded-lg bg-black/30 border border-white/5 text-xs text-neutral-300 placeholder:text-neutral-500 outline-none focus:border-white/15"
                          />

                          {/* Status indicator */}
                          {result && (
                            <div className="shrink-0">
                              {result.status === "running" && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                              {result.status === "complete" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                              {result.status === "error" && <span className="text-[10px] text-rose-400 font-medium">Error</span>}
                              {result.status === "skipped" && <SkipForward className="w-4 h-4 text-neutral-500" />}
                            </div>
                          )}

                          <button onClick={() => removeNode(node.id)} aria-label="Delete workflow node" className="p-1 text-neutral-500 hover:text-rose-400 transition-colors shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Conditional: condition input */}
                        {node.executionMode === "conditional" && (
                          <div className="flex items-center gap-2 ml-8">
                            <GitBranch className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="text-[10px] text-amber-500/70 uppercase tracking-wider font-medium shrink-0">If previous output contains:</span>
                            <input
                              type="text"
                              placeholder='e.g. "qualified" or "approved"'
                              value={node.condition || ""}
                              onChange={(e) => updateNodeCondition(node.id, e.target.value)}
                              className="flex-1 px-3 py-1 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300 placeholder:text-amber-500/30 outline-none focus:border-amber-500/40"
                            />
                          </div>
                        )}

                        {/* Parallel visual indicator */}
                        {node.executionMode === "parallel" && (
                          <div className="flex items-center gap-2 ml-8">
                            <ChevronsRight className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                            <span className="text-[10px] text-cyan-500/70 uppercase tracking-wider font-medium">
                              Runs in parallel with adjacent parallel nodes
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Connector between nodes */}
                      {i < nodes.length - 1 && (
                        <ConnectorIcon node={node} nextNode={nodes[i + 1]} />
                      )}
                    </motion.div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>

            {/* Add more button */}
            <button
              onClick={() => setShowCatalog(true)}
              className="w-full flex items-center justify-center gap-2 py-3 mt-3 rounded-xl border border-dashed border-white/10 text-neutral-500 text-sm hover:border-emerald-500/20 hover:text-emerald-400 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Agent
            </button>
          </div>
        )}
      </div>

      {/* Results Panel */}
      {results.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-white mb-4">Execution Results</h3>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border ${
                  r.status === "skipped"
                    ? "bg-white/[0.01] border-white/[0.04] opacity-60"
                    : "bg-white/[0.02] border-white/[0.06]"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {r.status === "complete" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {r.status === "error" && <span className="w-4 h-4 rounded-full bg-rose-500/20 flex items-center justify-center text-[8px] text-rose-400">!</span>}
                  {r.status === "running" && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                  {r.status === "skipped" && <SkipForward className="w-4 h-4 text-neutral-500" />}
                  <span className="text-xs font-semibold text-white">{r.agentId}</span>
                  <span
                    className={`text-[10px] uppercase tracking-wider ${
                      r.status === "complete"
                        ? "text-emerald-500"
                        : r.status === "error"
                        ? "text-rose-500"
                        : r.status === "skipped"
                        ? "text-neutral-500"
                        : "text-amber-500"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                {r.output && (
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {r.output.slice(0, 300)}
                    {r.output.length > 300 ? "..." : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Catalog Modal */}
      <AnimatePresence>
        {showCatalog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCatalog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-1">Add Agent</h3>
              <p className="text-xs text-neutral-500 mb-5">Select an agent or integration to add to your workflow pipeline</p>

              {/* Agents section */}
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-2 px-1">Agents</div>
              <div className="space-y-2 mb-5">
                {AGENT_CATALOG.filter((a) => !a.agentId.startsWith("integration-")).map((agent) => {
                  const CatIcon = agent.icon;
                  return (
                    <button
                      key={agent.agentId}
                      onClick={() => addNode(agent)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-colors hover:border-emerald-500/20 hover:bg-white/[0.03] ${colorMap[agent.color] || "border-white/10 bg-white/[0.02]"}`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        <CatIcon className="w-5 h-5 text-neutral-300" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{agent.name}</div>
                        <div className="text-xs text-neutral-500">{agent.description}</div>
                      </div>
                      <Plus className="w-4 h-4 text-neutral-500 ml-auto shrink-0" />
                    </button>
                  );
                })}
              </div>

              {/* Integrations section */}
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-2 px-1">Integrations</div>
              <div className="space-y-2">
                {AGENT_CATALOG.filter((a) => a.agentId.startsWith("integration-")).map((agent) => {
                  const CatIcon = agent.icon;
                  return (
                    <button
                      key={agent.agentId}
                      onClick={() => addNode(agent)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-colors hover:border-purple-500/20 hover:bg-white/[0.03] ${colorMap[agent.color] || "border-white/10 bg-white/[0.02]"}`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        <CatIcon className="w-5 h-5 text-neutral-300" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{agent.name}</div>
                        <div className="text-xs text-neutral-500">{agent.description}</div>
                      </div>
                      <Plus className="w-4 h-4 text-neutral-500 ml-auto shrink-0" />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowScheduleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-1">
                <CalendarClock className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Schedule Workflow</h3>
              </div>
              <p className="text-xs text-neutral-500 mb-6">
                Set a recurring schedule for &quot;{workflowName}&quot;
              </p>

              {/* Presets */}
              <div className="space-y-2 mb-5">
                {[
                  { key: "every-hour", label: "Every hour", desc: "Runs at the top of every hour" },
                  { key: "daily-9am", label: "Daily at 9 AM", desc: "Runs once per day at 9:00 AM UTC" },
                  { key: "weekly-monday", label: "Weekly on Monday", desc: "Runs every Monday at 9:00 AM UTC" },
                  { key: "custom", label: "Custom cron", desc: "Enter your own cron expression" },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => setSchedulePreset(preset.key)}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl border text-left transition-colors ${
                      schedulePreset === preset.key
                        ? "border-cyan-500/30 bg-cyan-500/5"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      schedulePreset === preset.key ? "border-cyan-400" : "border-neutral-600"
                    }`}>
                      {schedulePreset === preset.key && (
                        <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{preset.label}</div>
                      <div className="text-[10px] text-neutral-500">{preset.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom cron input */}
              {schedulePreset === "custom" && (
                <div className="mb-5">
                  <label className="block text-xs text-neutral-400 mb-1.5">Cron Expression</label>
                  <input
                    type="text"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="*/30 * * * *"
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-cyan-500/30"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Format: minute hour day month weekday (e.g., &quot;0 9 * * 1-5&quot; = weekdays at 9 AM)
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={scheduleWorkflow}
                  disabled={scheduleSaving || (schedulePreset === "custom" && !customCron.trim())}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors disabled:opacity-50"
                >
                  {scheduleSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CalendarClock className="w-4 h-4" />
                  )}
                  {scheduleSaving ? "Saving..." : "Schedule"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* My Workflows Drawer */}
      <AnimatePresence>
        {showDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDrawer(false)}
          >
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md h-full bg-[#0A0A0A] border-l border-white/10 p-6 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">My Workflows</h3>
                <button onClick={() => setShowDrawer(false)} aria-label="Close workflows panel" className="p-1 text-neutral-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingWorkflows ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
                </div>
              ) : savedWorkflows.length === 0 ? (
                <div className="text-center py-16">
                  <FolderOpen className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">No saved workflows yet</p>
                  <p className="text-xs text-neutral-500 mt-1">Save your current workflow to see it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedWorkflows.map((wf) => (
                    <div
                      key={wf.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        workflowId === wf.id
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold text-white">{wf.name}</div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                              {countNodes(wf.nodes)} steps
                            </span>
                            <span className="text-[10px] text-neutral-500">
                              {wf.status}
                            </span>
                            {wf.lastRunAt && (
                              <span className="flex items-center gap-1 text-[10px] text-neutral-500">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(wf.lastRunAt).toLocaleDateString()}
                              </span>
                            )}
                            {wf.runCount > 0 && (
                              <span className="text-[10px] text-neutral-500">
                                {wf.runCount} runs
                              </span>
                            )}
                            {scheduledWorkflowIds.has(wf.id) && (
                              <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-medium">
                                <CalendarClock className="w-2.5 h-2.5" /> Scheduled
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => loadWorkflow(wf)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                        >
                          <ArrowRight className="w-3 h-3" /> Load
                        </button>
                        <button
                          onClick={() => deleteWorkflow(wf.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WorkflowBuilderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030303] flex items-center justify-center text-neutral-500 text-sm">Loading workflow builder…</div>}>
      <WorkflowBuilderInner />
    </Suspense>
  );
}
