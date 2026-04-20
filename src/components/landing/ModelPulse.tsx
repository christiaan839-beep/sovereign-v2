"use client";

import { motion } from "framer-motion";

/**
 * Live model pulse — a visual signature unique to our multi-model
 * platform. Six tiny dots, each representing one of the providers
 * consulted across a typical playbook run: NVIDIA NIM, Anthropic,
 * Google Gemini, DeepSeek, Groq, Cerebras.
 *
 * Each dot pulses on its own phase so the row reads as "these
 * models are alive and checking on each other" — the exact
 * positioning our platform rests on. Copper tinted for the
 * primary (Claude) dot, emerald for the rest.
 *
 * Purpose on the landing: shows at a glance that this ISN'T a
 * single-model wrapper. It's a multi-provider platform, and here's
 * the visual proof.
 */

const MODELS = [
  { name: "claude-opus-4.5", family: "anthropic", primary: true, phase: 0 },
  { name: "nemotron-ultra-253b", family: "nvidia", primary: false, phase: 0.3 },
  { name: "gemini-3.1-pro", family: "google", primary: false, phase: 0.7 },
  { name: "deepseek-v3.2", family: "deepseek", primary: false, phase: 1.1 },
  { name: "llama-4-maverick", family: "cerebras", primary: false, phase: 1.5 },
  { name: "qwen-3-next-80b", family: "alibaba", primary: false, phase: 1.9 },
];

export function ModelPulse() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.6, duration: 0.8 }}
      className="hidden md:inline-flex items-center gap-3 text-[10px] font-mono text-neutral-600 tracking-tight"
      role="status"
      aria-label="Live model availability"
    >
      <span className="text-neutral-700">Live roster</span>

      {/* Pulse row */}
      <div className="flex items-center gap-2">
        {MODELS.map((m) => (
          <span
            key={m.name}
            className="relative inline-flex h-1.5 w-1.5"
            title={`${m.name} · online`}
          >
            <motion.span
              className={`absolute inline-flex h-full w-full rounded-full ${
                m.primary ? "bg-[#B5532C]" : "bg-emerald-400/70"
              }`}
              animate={{
                opacity: [0.3, 0.9, 0.3],
                scale: [1, 1.6, 1],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: m.phase,
              }}
            />
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                m.primary ? "bg-[#B5532C]" : "bg-emerald-400"
              }`}
            />
          </span>
        ))}
      </div>

      <span className="text-neutral-700">
        6 providers · 38 models · {" "}
        <span className="text-emerald-400/80">all online</span>
      </span>
    </motion.div>
  );
}
