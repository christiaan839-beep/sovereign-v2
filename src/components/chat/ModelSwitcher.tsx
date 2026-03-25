"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { MODEL_REGISTRY, PROVIDER_COLORS, getModel } from "@/config/models";
import type { ModelTag } from "@/config/models";

const TAG_COLORS: Partial<Record<ModelTag | string, string>> = {
  free: "bg-emerald-500/10 text-emerald-400",
  vision: "bg-purple-500/10 text-purple-400",
  thinking: "bg-[#00B7FF]/10 text-[#00B7FF]",
  code: "bg-amber-500/10 text-amber-400",
  reasoning: "bg-orange-500/10 text-orange-400",
  agentic: "bg-rose-500/10 text-rose-400",
  "long-context": "bg-violet-500/10 text-violet-400",
  fast: "bg-cyan-500/10 text-cyan-400",
  streaming: "bg-teal-500/10 text-teal-400",
  tools: "bg-indigo-500/10 text-indigo-400",
};

interface ModelSwitcherProps {
  selected: string;
  onChange: (id: string) => void;
}

export function ModelSwitcher({ selected, onChange }: ModelSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = getModel(selected);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const providerColor = PROVIDER_COLORS[current.provider] || "#888";

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] hover:border-white/15 transition-colors text-xs text-neutral-400"
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: providerColor }} />
        {current.name}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-full left-0 mb-2 w-72 rounded-xl bg-[#0A0A0A] border border-white/10 shadow-2xl overflow-hidden z-50 max-h-[400px] overflow-y-auto"
          >
            {MODEL_REGISTRY.map((m) => {
              const color = PROVIDER_COLORS[m.provider] || "#888";
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors ${
                    selected === m.id ? "bg-white/[0.03]" : ""
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0`}
                    style={{ backgroundColor: selected === m.id ? color : "#525252" }}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-white block">{m.name}</span>
                    <span className="text-[9px] text-neutral-600 block">{m.description}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-[7px] px-1 py-0.5 rounded ${TAG_COLORS[tag] || "bg-white/[0.05] text-neutral-500"}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
