"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

interface AgentNodeData {
  label: string;
  status: "active" | "idle" | "always-on";
  description: string;
  lastAction: string;
  icon: string; // emoji
}

export function AgentNode({ data }: NodeProps) {
  const d = data as unknown as AgentNodeData;
  const statusColor = d.status === "always-on" ? "bg-emerald-500" : d.status === "active" ? "bg-amber-400" : "bg-neutral-600";
  const glowClass = d.status === "always-on" ? "shadow-[0_0_12px_rgba(16,185,129,0.4)]" : d.status === "active" ? "shadow-[0_0_8px_rgba(251,191,36,0.3)]" : "";

  return (
    <div className={`px-4 py-3 rounded-xl border border-white/[0.08] bg-[#0A0A0A] min-w-[160px] ${glowClass} hover:border-emerald-500/20 transition-all`}>
      <Handle type="target" position={Position.Top} className="!bg-emerald-500/50 !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500/50 !w-2 !h-2 !border-0" />

      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">{d.icon}</span>
        <span className="text-xs font-semibold text-white">{d.label}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${statusColor} ml-auto`} />
      </div>
      <p className="text-[10px] text-neutral-500 leading-relaxed">{d.description}</p>
      <p className="text-[9px] text-neutral-600 mt-1.5 font-mono">{d.lastAction}</p>
    </div>
  );
}
