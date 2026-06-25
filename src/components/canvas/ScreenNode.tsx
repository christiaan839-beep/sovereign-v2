"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { X, Maximize2, Copy, Check, Monitor, Tablet, Smartphone } from "lucide-react";
import { useState } from "react";

type DevicePreview = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTHS: Record<DevicePreview, number> = { desktop: 360, tablet: 280, mobile: 180 };

export interface ScreenNodeData {
  label: string;
  html: string;
  vibe: string;
  prompt: string;
  status: "generating" | "ready" | "error";
  progress?: number;
  onDelete?: (id: string) => void;
  onExpand?: (id: string) => void;
}

export function ScreenNode({ id, data }: NodeProps) {
  const d = data as unknown as ScreenNodeData;
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState<DevicePreview>("desktop");

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(d.html || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative">
      <Handle type="target" position={Position.Left} className="!bg-[#00B7FF]/60 !w-2.5 !h-2.5 !border-2 !border-[#050505]" />
      <Handle type="source" position={Position.Right} className="!bg-[#00B7FF]/60 !w-2.5 !h-2.5 !border-2 !border-[#050505]" />

      <div className="rounded-2xl border border-white/[0.08] bg-[#0A0A0A] shadow-2xl shadow-black/40 overflow-hidden hover:border-[#00B7FF]/20 transition-gpu" style={{ width: DEVICE_WIDTHS[device] + 0 }}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#00B7FF] shrink-0" />
            <span className="text-[10px] font-semibold text-white truncate">{d.label || "Screen"}</span>
            {d.vibe && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#00B7FF]/10 text-[#00B7FF] border border-[#00B7FF]/20 shrink-0">{d.vibe}</span>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Device toggles */}
            {d.status === "ready" && (
              <div className="flex items-center gap-0.5 mr-1 px-1 py-0.5 rounded bg-white/[0.03] border border-white/[0.04]">
                {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([dev, Icon]) => (
                  <button key={dev} onClick={(e) => { e.stopPropagation(); setDevice(dev); }}
                    aria-label={`Switch to ${dev} view`}
                    title={`Switch to ${dev} view`}
                    className={`p-0.5 rounded transition-colors ${device === dev ? "text-[#00B7FF]" : "text-neutral-600 hover:text-neutral-400"}`}>
                    <Icon className="w-2.5 h-2.5" />
                  </button>
                ))}
              </div>
            )}
            <button onClick={handleCopy} aria-label={copied ? "Copied to clipboard" : "Copy code"} title={copied ? "Copied" : "Copy code"} className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors">
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); d.onExpand?.(id); }} aria-label="Expand view" title="Expand view" className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors">
              <Maximize2 className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); d.onDelete?.(id); }} aria-label="Delete screen" title="Delete screen" className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="w-full h-[220px] bg-white relative">
          {d.status === "generating" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505]">
              <div className="w-8 h-8 border-2 border-[#00B7FF] border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-[10px] text-neutral-400">Generating...</span>
              {d.progress !== undefined && (
                <div className="w-32 h-1 bg-white/[0.06] rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-[#00B7FF]/60 rounded-full transition-gpu duration-500" style={{ width: `${d.progress}%` }} />
                </div>
              )}
            </div>
          ) : d.status === "error" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050505]">
              <span className="text-[10px] text-red-400">Generation failed</span>
            </div>
          ) : d.html ? (
            <iframe
              srcDoc={d.html}
              sandbox="allow-scripts"
              className="w-full h-full border-0 pointer-events-none"
              title={d.label}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050505]">
              <span className="text-[10px] text-neutral-600">Empty screen</span>
            </div>
          )}
        </div>

        {/* Prompt footer */}
        {d.prompt && (
          <div className="px-3 py-1.5 border-t border-white/[0.04] bg-white/[0.01]">
            <p className="text-[9px] text-neutral-500 truncate">{d.prompt}</p>
          </div>
        )}
      </div>
    </div>
  );
}
