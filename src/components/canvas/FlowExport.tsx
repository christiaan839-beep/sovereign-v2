"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface Screen {
  id: string;
  label: string;
  html: string;
}

interface FlowExportProps {
  open: boolean;
  onClose: () => void;
  screens: Screen[];
}

export function FlowExport({ open, onClose, screens }: FlowExportProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleExport = () => {
    // Create a simple HTML file for each screen and trigger download
    screens.forEach((screen, i) => {
      const blob = new Blob([screen.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `screen-${i + 1}-${screen.label.replace(/\s+/g, "-").toLowerCase()}.html`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // Auto-play through screens
  const handlePlay = () => {
    if (playing) { setPlaying(false); return; }
    setPlaying(true);
    setActiveIndex(0);
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx >= screens.length) {
        clearInterval(interval);
        setPlaying(false);
        return;
      }
      setActiveIndex(idx);
    }, 2000);
  };

  if (!open || screens.length === 0) return null;
  const current = screens[activeIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
        onClick={onClose}
      >
        <motion.div
          ref={trapRef}
          role="dialog"
          aria-modal="true"
          aria-label="Flow preview"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-5xl h-[80vh] rounded-2xl border border-white/[0.08] bg-[#0A0A0A] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-white">Flow Preview</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-neutral-400">
                {activeIndex + 1} / {screens.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePlay} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00B7FF]/10 text-[#00B7FF] text-[10px] font-semibold hover:bg-[#00B7FF]/20 transition-colors">
                <Play className="w-3 h-3" />
                {playing ? "Stop" : "Auto-Play"}
              </button>
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20 transition-colors">
                <Download className="w-3 h-3" />
                Export All
              </button>
              <button onClick={onClose} aria-label="Close flow preview" className="p-1.5 rounded-lg hover:bg-white/[0.05] text-neutral-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 relative bg-white">
            {current && (
              <iframe
                key={current.id}
                srcDoc={current.html}
                sandbox="allow-scripts"
                className="w-full h-full border-0"
                title={current.label}
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] shrink-0">
            <button
              onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
              disabled={activeIndex === 0}
              aria-label="Previous screen"
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Previous
            </button>
            <div className="flex items-center gap-1.5">
              {screens.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  aria-label={`Go to screen ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-gpu ${i === activeIndex ? "bg-[#00B7FF] scale-125" : "bg-white/[0.15] hover:bg-white/[0.3]"}`}
                />
              ))}
            </div>
            <button
              onClick={() => setActiveIndex(Math.min(screens.length - 1, activeIndex + 1))}
              disabled={activeIndex === screens.length - 1}
              aria-label="Next screen"
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
