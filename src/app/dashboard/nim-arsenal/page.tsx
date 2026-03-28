"use client";

import { motion } from "framer-motion";
import { Cpu, Zap, ArrowRight, Globe, Mic, Code, Brain, BookOpen, Shield, ChevronRight } from "lucide-react";

const MODELS = [
  { name: "Nemotron Ultra 253B", params: "253B", tag: "Reasoning", provider: "NIM", color: "#00ff66" },
  { name: "DeepSeek V3.2", params: "671B", tag: "Reasoning", provider: "NIM", color: "#00ff66" },
  { name: "Llama 4 Scout 17B", params: "17B", tag: "Long Context (10M)", provider: "NIM", color: "#06B6D4" },
  { name: "Qwen 3 235B", params: "235B", tag: "Multilingual", provider: "NIM", color: "#FACC15" },
  { name: "Mistral Small 3.1 24B", params: "24B", tag: "Function Calling", provider: "NIM", color: "#A855F7" },
  { name: "Claude Sonnet 4.6", params: "—", tag: "Tool Use", provider: "Anthropic", color: "#FF6B00" },
  { name: "Gemini 2.5 Flash", params: "—", tag: "General", provider: "Google", color: "#4285F4" },
  { name: "Kokoro 82M", params: "82M", tag: "Text-to-Speech", provider: "Self-hosted", color: "#F472B6" },
  { name: "Chatterbox", params: "—", tag: "Voice Cloning", provider: "Self-hosted", color: "#F472B6" },
];

const TASK_ROUTES: { task: string; model: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { task: "code", model: "Qwen 2.5 Coder", icon: Code },
  { task: "reasoning", model: "DeepSeek V3.2", icon: Brain },
  { task: "multilingual", model: "Qwen 3 235B", icon: Globe },
  { task: "long_context", model: "Llama 4 Scout", icon: BookOpen },
  { task: "vision", model: "Gemma 3 27B", icon: Cpu },
  { task: "general", model: "Nemotron Ultra", icon: Zap },
  { task: "safety", model: "LlamaGuard 3 8B", icon: Shield },
];

const FAILOVER = [
  "Nemotron Ultra 253B",
  "DeepSeek V3.2 671B",
  "Llama 4 Scout 17B",
  "Qwen 3 235B",
  "Mistral Small 3.1 24B",
  "Mistral-Nemotron",
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const cardAnim = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function NimArsenalPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div className="flex items-center gap-3">
            <Zap className="w-7 h-7 text-[#00ff66]" />
            <h1 className="text-2xl font-bold tracking-tight">NIM Arsenal</h1>
          </div>
          <p className="text-sm text-neutral-500">Model registry, task router, and failover chain</p>
        </motion.header>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { val: "51+", label: "Available Models", color: "#00ff66" },
            { val: "100%", label: "Free / Open-Source", color: "#06B6D4" },
            { val: "8", label: "Task Types", color: "#A855F7" },
            { val: "6", label: "Failover Depth", color: "#FF6B00" },
          ].map((s) => (
            <div key={s.label} className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
              <p className="text-[11px] text-neutral-500 mt-1 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Model Registry Grid */}
        <section>
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Model Registry</h2>
          <motion.div variants={stagger} initial="hidden" animate="show"
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODELS.map((m) => (
              <motion.div key={m.name} variants={cardAnim}
                className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-[2px]" style={{ backgroundColor: m.color }} />
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ color: m.color, backgroundColor: `${m.color}15` }}>{m.tag}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1" title="Available" />
                </div>
                <h3 className="text-sm font-semibold text-white group-hover:text-[#00ff66] transition-colors">{m.name}</h3>
                <div className="mt-3 flex items-center justify-between text-[10px] text-neutral-500">
                  <span>{m.params !== "—" ? `${m.params} params` : "Proprietary"}</span>
                  <span className="uppercase tracking-wider">{m.provider}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Task Router */}
        <section>
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Task Router</h2>
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {TASK_ROUTES.map((r) => (
              <motion.div key={r.task} variants={cardAnim}
                className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02] flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-white/[0.06] flex items-center justify-center shrink-0">
                  <r.icon className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <code className="text-xs text-[#00ff66] font-mono">{r.task}</code>
                  <ArrowRight className="w-3 h-3 text-neutral-600 shrink-0" />
                  <span className="text-xs text-neutral-300 truncate">{r.model}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Failover Chain */}
        <section>
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Failover Chain</h2>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="border border-white/[0.06] rounded-lg p-5 bg-white/[0.02] flex flex-wrap items-center gap-2">
            {FAILOVER.map((name, i) => (
              <div key={name} className="flex items-center gap-2">
                <span className={`text-xs font-mono px-3 py-1.5 rounded border ${i === 0 ? "border-[#00ff66]/30 text-[#00ff66] bg-[#00ff66]/5" : "border-white/[0.06] text-neutral-400 bg-white/[0.02]"}`}>
                  {name}
                </span>
                {i < FAILOVER.length - 1 && <ChevronRight className="w-3 h-3 text-neutral-600" />}
              </div>
            ))}
          </motion.div>
          <p className="text-[11px] text-neutral-600 mt-2">If the primary model fails, requests cascade through the chain automatically.</p>
        </section>

      </div>
    </div>
  );
}
