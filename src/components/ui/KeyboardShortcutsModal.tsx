"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/* ─── Shortcut Data ─── */

interface ShortcutDisplay {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutDisplay[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["\u2318", "K"], label: "Open command palette" },
      { keys: ["\u2318", "/"], label: "Toggle sidebar" },
      { keys: ["\u2318", "1"], label: "Go to Home" },
      { keys: ["\u2318", "2"], label: "Go to Inbox" },
      { keys: ["\u2318", "3"], label: "Go to Build" },
      { keys: ["\u2318", "4"], label: "Go to Leads" },
      { keys: ["\u2318", "5"], label: "Go to Content" },
      { keys: ["\u2318", "6"], label: "Go to Canvas" },
      { keys: ["\u2318", "7"], label: "Go to Templates" },
      { keys: ["\u2318", "8"], label: "Go to SEO Tools" },
      { keys: ["\u2318", "9"], label: "Go to Competitor Intel" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["\u2318", "\u23CE"], label: "Submit current form" },
      { keys: ["\u2318", "\\"], label: "Focus chat input" },
      { keys: ["Esc"], label: "Close any modal or palette" },
    ],
  },
  {
    title: "Help",
    shortcuts: [{ keys: ["?"], label: "Show this shortcuts panel" }],
  },
];

/* ─── Modal Component ─── */

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // "?" key (shift+/ on most keyboards) — only trigger outside inputs
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !isEditable) {
        e.preventDefault();
        setIsOpen((v) => !v);
      }

      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  return (
    <>
      {/* Floating help button — offset to not overlap SovereignAssistant FAB */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-[5.5rem] z-40 w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-neutral-500 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200 flex items-center justify-center backdrop-blur-sm shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B7FF]"
        title="Keyboard Shortcuts (?)"
        aria-label="Show keyboard shortcuts"
      >
        <span className="text-xs font-mono" aria-hidden="true">
          ?
        </span>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              ref={trapRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="shortcuts-title"
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[201]"
            >
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Keyboard className="w-4 h-4 text-[#00B7FF]" />
                    <span
                      id="shortcuts-title"
                      className="text-sm font-semibold text-white"
                    >
                      Keyboard Shortcuts
                    </span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    aria-label="Close keyboard shortcuts"
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B7FF]"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-5 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-5">
                  {SHORTCUT_GROUPS.map((group) => (
                    <div key={group.title}>
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500 mb-2.5">
                        {group.title}
                      </h3>
                      <div className="space-y-1">
                        {group.shortcuts.map((sc, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors"
                          >
                            <span className="text-sm text-neutral-300">
                              {sc.label}
                            </span>
                            <div className="flex items-center gap-1">
                              {sc.keys.map((key, ki) => (
                                <kbd
                                  key={ki}
                                  className="min-w-[24px] h-6 px-1.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-400 flex items-center justify-center"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-neutral-600">
                    Press ? to toggle
                  </span>
                  <span className="text-[10px] font-mono text-neutral-600">
                    esc to close
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
