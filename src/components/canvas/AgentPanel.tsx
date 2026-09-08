"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Clock, RefreshCcw, CheckCircle2, AlertCircle } from "lucide-react";

export interface GenerationTask {
  id: string;
  prompt: string;
  vibe: string;
  status: "generating" | "complete" | "error";
  timestamp: number;
  nodeId?: string;
}

interface AgentPanelProps {
  open: boolean;
  onClose: () => void;
  tasks: GenerationTask[];
  onExploreMore: (task: GenerationTask) => void;
}

export function AgentPanel({ open, onClose, tasks, onExploreMore }: AgentPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="absolute right-0 top-0 bottom-0 z-40 border-l border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00B7FF]" />
              <span className="text-xs font-semibold text-white">Design Agent</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.05] text-neutral-400">{tasks.length}</span>
            </div>
            <button aria-label="Close design agent panel" onClick={onClose} className="p-1 rounded hover:bg-white/[0.05] text-neutral-500 hover:text-white transition-colors">
              <X aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Sparkles className="w-8 h-8 text-neutral-700 mb-3" />
                <p className="text-xs text-neutral-500">No generations yet</p>
                <p className="text-[10px] text-neutral-600 mt-1">Use the prompt bar below to start designing</p>
              </div>
            )}
            {tasks.slice().reverse().map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs text-neutral-300 line-clamp-2 flex-1">{task.prompt}</p>
                  {task.status === "generating" ? (
                    <div className="w-3.5 h-3.5 border-2 border-[#00B7FF] border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : task.status === "complete" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#00B7FF]/10 text-[#00B7FF]">{task.vibe}</span>
                    <span className="text-[9px] text-neutral-600 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(task.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {task.status === "complete" && (
                    <button
                      onClick={() => onExploreMore(task)}
                      className="flex items-center gap-1 text-[9px] font-semibold text-[#00B7FF] hover:text-[#33C5FF] transition-colors"
                    >
                      <RefreshCcw className="w-2.5 h-2.5" />
                      Explore More
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
