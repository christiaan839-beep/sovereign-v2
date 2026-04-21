"use client";

import { motion } from "framer-motion";

/**
 * VoiceStatusBar — 4-state indicator next to the mic button.
 *
 *   idle       gray dot, "Ready"
 *   listening  copper pulse, "Listening"
 *   thinking   cyan pulse, "Thinking"
 *   speaking   emerald breathe, "Speaking"
 *
 * Pure-presentational; status is controlled by the parent (VoiceAgent).
 */

export type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

interface Props {
  status: VoiceStatus;
  message?: string;
}

const CONFIG: Record<VoiceStatus, { label: string; color: string; pulse: boolean }> = {
  idle: { label: "Ready", color: "rgb(82, 82, 82)", pulse: false },
  connecting: { label: "Connecting", color: "rgb(181, 83, 44)", pulse: true },
  listening: { label: "Listening", color: "rgb(181, 83, 44)", pulse: true },
  thinking: { label: "Thinking", color: "rgb(34, 211, 238)", pulse: true },
  speaking: { label: "Speaking", color: "rgb(52, 211, 153)", pulse: true },
  error: { label: "Error", color: "rgb(239, 68, 68)", pulse: false },
};

export function VoiceStatusBar({ status, message }: Props) {
  const config = CONFIG[status];
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[4px] border border-white/[0.06] bg-white/[0.02]">
      <motion.span
        className="relative inline-flex h-1.5 w-1.5 rounded-full"
        style={{ background: config.color }}
        aria-hidden="true"
      >
        {config.pulse && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: config.color }}
            animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </motion.span>
      <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-neutral-400">
        {config.label}
      </span>
      {message && (
        <span className="font-mono text-[11px] text-neutral-500 tracking-tight">
          · {message}
        </span>
      )}
    </div>
  );
}
