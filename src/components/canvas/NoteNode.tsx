"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import { StickyNote, X } from "lucide-react";

export interface NoteNodeData {
  text: string;
  color?: string;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, text: string) => void;
}

export function NoteNode({ id, data }: NodeProps) {
  const d = data as unknown as NoteNodeData;
  const [editing, setEditing] = useState(!d.text);
  const [text, setText] = useState(d.text || "");

  const handleBlur = () => {
    setEditing(false);
    d.onUpdate?.(id, text);
  };

  return (
    <div className="group relative">
      <Handle type="target" position={Position.Left} className="!bg-amber-500/60 !w-2 !h-2 !border-2 !border-[#050505]" />
      <Handle type="source" position={Position.Right} className="!bg-amber-500/60 !w-2 !h-2 !border-2 !border-[#050505]" />

      <div className="w-[200px] rounded-xl border border-amber-500/10 bg-amber-500/[0.04] backdrop-blur-xl p-3 shadow-lg focus-within:opacity-100">
        <div className="flex items-center justify-between mb-2">
          <StickyNote className="w-3 h-3 text-amber-500/60" />
          <button
            onClick={() => d.onDelete?.(id)}
            aria-label="Delete note"
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-0.5 rounded focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none hover:bg-white/10 text-neutral-600 hover:text-red-400 transition-gpu"
          >
            <X aria-hidden="true" className="w-3 h-3" />
          </button>
        </div>
        {editing ? (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === "Escape" && handleBlur()}
            className="w-full bg-transparent text-xs text-neutral-300 resize-none outline-none min-h-[40px]"
            placeholder="Add a note..."
          />
        ) : (
          <p className="text-xs text-neutral-400 cursor-text min-h-[20px]" onClick={() => setEditing(true)}>
            {text || "Click to add note..."}
          </p>
        )}
      </div>
    </div>
  );
}
