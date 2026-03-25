"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Globe, FileText, Users, Image as ImageIcon, Zap, X, ArrowRight } from "lucide-react";
import { ModelSwitcher } from "./ModelSwitcher";

// ── Quick Actions ──

const QUICK_ACTIONS = [
  { id: "audit", icon: Globe, label: "Audit URL", placeholder: "Enter URL to audit...", prefix: "audit " },
  { id: "write", icon: FileText, label: "Write", placeholder: "What should I write?", prefix: "write a blog about " },
  { id: "leads", icon: Users, label: "Leads", placeholder: "Industry or company type...", prefix: "find leads for " },
  { id: "image", icon: ImageIcon, label: "Image", placeholder: "Describe the image...", prefix: "generate image of " },
  { id: "workflow", icon: Zap, label: "Workflow", placeholder: "Multi-step task...", prefix: "run a workflow: " },
] as const;

function QuickActionsBar({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionInput, setActionInput] = useState("");

  const handleSubmit = (prefix: string) => {
    if (!actionInput.trim()) return;
    onSubmit(prefix + actionInput.trim());
    setActionInput("");
    setExpanded(null);
  };

  return (
    <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        if (expanded === action.id) {
          return (
            <motion.div key={action.id} layoutId={action.id} className="flex items-center gap-2 flex-1 min-w-0">
              <input
                autoFocus
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit(action.prefix)}
                placeholder={action.placeholder}
                className="flex-1 bg-white/[0.03] border border-emerald-500/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none min-w-0"
              />
              <button
                onClick={() => handleSubmit(action.prefix)}
                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setExpanded(null);
                  setActionInput("");
                }}
                className="p-1.5 text-neutral-600 hover:text-neutral-400"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          );
        }
        return (
          <motion.button
            key={action.id}
            layoutId={action.id}
            onClick={() => setExpanded(action.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[10px] text-neutral-500 hover:border-emerald-500/15 hover:text-neutral-300 transition-all whitespace-nowrap shrink-0"
          >
            <Icon className="w-3 h-3" />
            {action.label}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Input Bar ──

interface InputBarProps {
  loading: boolean;
  selectedModel: string;
  onModelChange: (id: string) => void;
  onSend: (text: string) => void;
}

export function InputBar({ loading, selectedModel, onModelChange, onSend }: InputBarProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="shrink-0">
      {/* Quick Actions */}
      <QuickActionsBar onSubmit={onSend} />

      {/* Main Input */}
      <div className="border-t border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything -- audit a site, write content, find leads, build a page..."
              disabled={loading}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/30 disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center hover:bg-neutral-200 disabled:opacity-30 transition-all shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <ModelSwitcher selected={selectedModel} onChange={onModelChange} />
            <p className="text-[10px] text-neutral-600">109 Agents &middot; 39 Models</p>
          </div>
        </form>
      </div>
    </div>
  );
}
