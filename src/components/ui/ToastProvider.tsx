"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, X, Info, Bot, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

/* ── Types ─────────────────────────────────────────────────────── */
type ToastType = "success" | "error" | "info" | "agent" | "result";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  label?: string;
  href?: string;
  createdAt: number;
  duration: number;
}

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    agent: (label: string, message: string) => void;
    result: (type: string, message: string, href?: string) => void;
  };
}

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 5000;

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx.toast;
}

/* ── Progress bar sub-component ────────────────────────────────── */
function ProgressBar({ duration, onComplete }: { duration: number; onComplete: () => void }) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();
    const frame = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        requestAnimationFrame(frame);
      } else {
        onComplete();
      }
    };
    const id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [duration, onComplete]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04] rounded-b-xl overflow-hidden">
      <div
        className="h-full bg-emerald-500/60 transition-none"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/* ── Provider ──────────────────────────────────────────────────── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType, opts?: { label?: string; href?: string }) => {
      const id = Math.random().toString(36).slice(2);
      const newToast: Toast = {
        id,
        message,
        type,
        label: opts?.label,
        href: opts?.href,
        createdAt: Date.now(),
        duration: DEFAULT_DURATION,
      };
      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Keep only the last MAX_VISIBLE
        return updated.slice(-MAX_VISIBLE);
      });
    },
    []
  );

  const toast = {
    success: (msg: string) => addToast(msg, "success"),
    error: (msg: string) => addToast(msg, "error"),
    info: (msg: string) => addToast(msg, "info"),
    agent: (label: string, msg: string) => addToast(msg, "agent", { label }),
    result: (type: string, msg: string, href?: string) =>
      addToast(msg, "result", { label: type, href }),
  };

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
    error: <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />,
    info: <Info className="w-4 h-4 text-[#00B7FF] shrink-0" />,
    agent: <Bot className="w-4 h-4 text-emerald-400 shrink-0" />,
    result: <ExternalLink className="w-4 h-4 text-[#00B7FF] shrink-0" />,
  };

  const borders: Record<ToastType, string> = {
    success: "border-emerald-500/30 bg-emerald-500/5",
    error: "border-rose-500/30 bg-rose-500/5",
    info: "border-[#00B7FF]/30 bg-[#00B7FF]/5",
    agent: "border-emerald-500/30 bg-emerald-500/5",
    result: "border-[#00B7FF]/30 bg-[#00B7FF]/5",
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast Container -- fixed bottom-right */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none w-[340px]">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              aria-live={t.type === "error" ? "assertive" : "polite"}
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={() => {
                if (t.href) router.push(t.href);
              }}
              className={`pointer-events-auto relative flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden ${
                borders[t.type]
              } ${t.href ? "cursor-pointer hover:border-white/[0.12]" : ""}`}
            >
              {icons[t.type]}
              <div className="flex-1 min-w-0">
                {t.label && (
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-0.5">
                    {t.label}
                  </span>
                )}
                <span className="text-xs font-medium text-white block truncate">
                  {t.message}
                </span>
                {t.href && (
                  <span className="text-[10px] text-[#00B7FF] mt-1 flex items-center gap-1">
                    Click to view <ExternalLink className="w-3 h-3" />
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast(t.id);
                }}
                aria-label="Dismiss notification"
                className="text-neutral-500 hover:text-white transition-colors shrink-0 mt-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B7FF]"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
              <ProgressBar
                duration={t.duration}
                onComplete={() => removeToast(t.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
