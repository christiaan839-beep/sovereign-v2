"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Circle, Clock } from "lucide-react";

/**
 * PlaybookGraph — live DAG view of a playbook run's step execution.
 *
 * Each step in the run becomes a node laid out left-to-right. Color and
 * icon animate by status (pending/running/done/failed/skipped). Edges
 * connect step N → step N+1 with a subtle motion hint while a step is
 * running.
 *
 * Because playbooks execute strictly sequentially today, we don't need
 * a graph-layout algorithm — `x = i * NODE_STRIDE` does the job. When
 * we add parallel branches, swap in Dagre.
 */

const NODE_STRIDE = 240;

export interface PlaybookStep {
  stepIndex: number;
  agentName: string;
  reason: string | null;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  durationMs?: number | null;
}

interface Props {
  steps: PlaybookStep[];
  runStatus?: "running" | "done" | "failed";
}

/* ─── Custom step node ─────────────────────────────────── */

function StepNode({ data }: NodeProps) {
  const { agentName, status, reason, durationMs, stepIndex } = data as unknown as PlaybookStep;

  const { ring, bg, accent, icon } = statusStyle(status);

  return (
    <div className="relative">
      {/* Incoming edge */}
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-4 py-3 min-w-[200px] max-w-[240px]"
        style={{
          background: bg,
          border: `1px solid ${ring}`,
          boxShadow: status === "running" ? `0 0 24px ${ring}` : "none",
          transition: "box-shadow 400ms ease",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: `${accent}15`, color: accent }}
          >
            {icon}
          </div>
          <span className="ed-mono text-[10px]" style={{ color: accent, letterSpacing: "0.12em" }}>
            {String(stepIndex + 1).padStart(2, "0")}
          </span>
        </div>
        <p className="text-sm font-medium text-white leading-tight mb-1 break-words">{agentName}</p>
        {reason && (
          <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2">{reason}</p>
        )}
        {typeof durationMs === "number" && durationMs > 0 && (
          <p className="text-[10px] text-neutral-500 font-mono mt-1.5 tabular-nums">
            {(durationMs / 1000).toFixed(2)}s
          </p>
        )}
      </motion.div>

      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
}

function statusStyle(status: PlaybookStep["status"]) {
  switch (status) {
    case "running":
      return {
        ring: "rgba(251,191,36,0.35)",
        bg: "rgba(251,191,36,0.08)",
        accent: "#fbbf24",
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
      };
    case "done":
      return {
        ring: "rgba(52,211,153,0.35)",
        bg: "rgba(52,211,153,0.06)",
        accent: "#34d399",
        icon: <CheckCircle2 className="w-3 h-3" />,
      };
    case "failed":
      return {
        ring: "rgba(244,63,94,0.35)",
        bg: "rgba(244,63,94,0.08)",
        accent: "#f43f5e",
        icon: <XCircle className="w-3 h-3" />,
      };
    case "skipped":
      return {
        ring: "rgba(163,163,163,0.2)",
        bg: "rgba(255,255,255,0.02)",
        accent: "#737373",
        icon: <Clock className="w-3 h-3" />,
      };
    default:
      return {
        ring: "rgba(255,255,255,0.1)",
        bg: "rgba(255,255,255,0.03)",
        accent: "#a3a3a3",
        icon: <Circle className="w-3 h-3" />,
      };
  }
}

const nodeTypes = { step: StepNode };

/* ─── Component ───────────────────────────────────────── */

export function PlaybookGraph({ steps, runStatus }: Props) {
  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = steps.map((s) => ({
      id: `step-${s.stepIndex}`,
      type: "step",
      position: { x: s.stepIndex * NODE_STRIDE, y: 0 },
      data: { ...s } as unknown as Record<string, unknown>,
      draggable: false,
    }));

    const es: Edge[] = steps.slice(0, -1).map((_, i) => {
      const thisDone = steps[i].status === "done";
      const nextRunning = steps[i + 1].status === "running";
      const animated = thisDone && nextRunning;
      return {
        id: `e-${i}-${i + 1}`,
        source: `step-${i}`,
        target: `step-${i + 1}`,
        type: "smoothstep",
        animated,
        style: {
          stroke: animated ? "#34d399" : "rgba(255,255,255,0.12)",
          strokeWidth: 1.5,
        },
      };
    });

    return { nodes: ns, edges: es };
  }, [steps]);

  if (!steps.length) {
    return (
      <div className="h-64 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-center">
        <p className="ed-caption">No steps yet</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/5 bg-[#0B0A08]"
      style={{ height: 240 }}
      aria-label={`Playbook run ${runStatus ?? "status"}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.4}
        maxZoom={1.4}
        panOnScroll
        zoomOnScroll={false}
        preventScrolling={false}
        nodesConnectable={false}
        nodesDraggable={false}
        selectionOnDrag={false}
      >
        <Background gap={16} size={1} color="rgba(255,255,255,0.04)" />
      </ReactFlow>
    </div>
  );
}
