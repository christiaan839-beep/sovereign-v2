"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Users, Code2, FileText, Search, Sparkles, Zap } from "lucide-react";
import { getSystemPrompt } from "@/lib/system-prompts";

const PROMPT_TEMPLATES = [
  { id: "sales", name: "Sales Agent", icon: Users },
  { id: "technical", name: "Code Reviewer", icon: Code2 },
  { id: "creative", name: "Content Writer", icon: FileText },
  { id: "analysis", name: "SEO Analyst", icon: Search },
  { id: "support", name: "Support Engineer", icon: Sparkles },
  { id: "general", name: "General Assistant", icon: Zap },
] as const;

interface SystemPromptEditorProps {
  prompt: string;
  onChange: (prompt: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function SystemPromptEditor({ prompt, onChange, isOpen, onToggle }: SystemPromptEditorProps) {
  const tokenCount = Math.ceil(prompt.length / 4);
  const activeTemplate = PROMPT_TEMPLATES.find((t) => prompt.includes(t.id)) || null;
  const [localValue, setLocalValue] = useState(prompt);

  // Keep local value in sync when prompt changes externally
  if (localValue !== prompt && !isOpen) {
    setLocalValue(prompt);
  }

  return (
    <div className="border-b border-white/[0.04]">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-500">System Prompt:</span>
          <span className="text-[10px] text-neutral-400">{activeTemplate?.name || "Custom"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-neutral-600 font-mono">{tokenCount} tokens</span>
          <ChevronDown className={`w-3 h-3 text-neutral-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
                {PROMPT_TEMPLATES.map((t) => {
                  const Icon = t.icon;
                  const isActive = prompt === getSystemPrompt(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        const newPrompt = getSystemPrompt(t.id);
                        setLocalValue(newPrompt);
                        onChange(newPrompt);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-gpu ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-white/[0.03] text-neutral-500 border border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {t.name}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={localValue}
                onChange={(e) => {
                  setLocalValue(e.target.value);
                  onChange(e.target.value);
                }}
                rows={4}
                className="w-full bg-transparent border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 resize-none focus:outline-none focus:border-emerald-500/30"
                placeholder="Customize the system prompt..."
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
