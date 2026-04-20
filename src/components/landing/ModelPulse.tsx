"use client";

import { motion } from "framer-motion";

/**
 * Model roster — visual signature of our multi-provider platform.
 *
 * Six dots represent the six providers we integrate with (NVIDIA NIM,
 * Anthropic, Google, DeepSeek, Cerebras, Alibaba/Qwen). Copper marks
 * the primary critic (Claude); the rest are generation + synthesis.
 *
 * HONEST CAVEAT: the dots don't ping live — we don't have real-time
 * provider health on the marketing page. The StatusIndicator in the
 * footer polls /api/health/ping (which is real). This is a static
 * roster, not a live telemetry dashboard. Copy reflects that.
 *
 * Purpose: makes the multi-provider positioning legible at a glance.
 * It's not a one-model wrapper — here are the six providers that
 * compose a typical run.
 */

const MODELS = [
  { name: "claude-opus-4.5", family: "anthropic", primary: true },
  { name: "nemotron-ultra-253b-v1", family: "nvidia", primary: false },
  { name: "gemini-3.1-pro", family: "google", primary: false },
  { name: "deepseek-v3.2", family: "deepseek", primary: false },
  { name: "llama-4-maverick", family: "cerebras", primary: false },
  { name: "qwen-3-next-80b", family: "alibaba", primary: false },
];

export function ModelPulse() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.6, duration: 0.8 }}
      className="hidden md:inline-flex items-center gap-3 text-[10px] font-mono text-neutral-600 tracking-tight"
      aria-label="Multi-provider model roster"
    >
      <span className="text-neutral-700">Roster</span>

      {/* Static dot row — one per provider. Copper = Claude (critic) */}
      <div className="flex items-center gap-2">
        {MODELS.map((m) => (
          <span
            key={m.name}
            className={`inline-flex h-1.5 w-1.5 rounded-full ${
              m.primary ? "bg-[#B5532C]" : "bg-neutral-400/50"
            }`}
            title={`${m.name} · ${m.family}`}
          />
        ))}
      </div>

      <span className="text-neutral-700">
        6 providers · 38 models · routed per task
      </span>
    </motion.div>
  );
}
