"use client";

import { motion } from "framer-motion";
import { Rocket, Shield, Workflow, Server, Brain, Cpu, Route, Layers, BarChart3, Terminal } from "lucide-react";

const CATEGORIES: Record<string, { color: string; bg: string }> = {
  "Agents": { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  "Safety": { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  "Platform": { color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
  "Models": { color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  "Analytics": { color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
};

const ENTRIES = [
  { date: "Mar 28, 2026", title: "API Playground", category: "Platform", icon: Terminal,
    description: "Interactive playground for testing agents without signing up. Pre-filled prompts, syntax-highlighted responses, and 3 free tries for visitors." },
  { date: "Mar 24, 2026", title: "Revenue Attribution Dashboard", category: "Analytics", icon: BarChart3,
    description: "Full-funnel revenue tracking from first touch to closed deal. See exactly which agents drive pipeline and ROI across your entire stack." },
  { date: "Mar 19, 2026", title: "Llama 4 Scout + DeepSeek V3.2", category: "Models", icon: Layers,
    description: "Added Meta Llama 4 Scout and DeepSeek V3.2 to the model registry. Smart Router automatically selects the best model per task." },
  { date: "Mar 14, 2026", title: "119 Agent Routes", category: "Platform", icon: Route,
    description: "Scaled to 119 unique agent API routes spanning lead gen, content, SEO, voice, analytics, and marketplace operations." },
  { date: "Mar 10, 2026", title: "Extended Thinking on 5 Agents", category: "Agents", icon: Brain,
    description: "Enabled extended thinking mode on God Brain, War Room, Market Intel, Blog Gen, and SEO Dominator for deeper multi-step reasoning." },
  { date: "Mar 5, 2026", title: "Cross-Agent Learning Loop", category: "Agents", icon: Cpu,
    description: "Agents now share context and learn from each other. Insights from SEO audits feed into content generation, lead scoring improves from deal outcomes." },
  { date: "Feb 27, 2026", title: "MCP Server — 7 Tools via JSON-RPC", category: "Platform", icon: Server,
    description: "Model Context Protocol server exposing 7 tools for external LLM integration. Connect Claude Desktop, Cursor, or any MCP client." },
  { date: "Feb 20, 2026", title: "Visual Workflow Builder", category: "Platform", icon: Workflow,
    description: "Drag-and-drop workflow canvas for chaining agents into automated pipelines. Conditional branching, parallel execution, and scheduling built in." },
  { date: "Feb 14, 2026", title: "NeMo Guardrails — 5-Layer Safety Pipeline", category: "Safety", icon: Shield,
    description: "Integrated NVIDIA NeMo Guardrails with 5 safety layers: input validation, topic boundaries, output filtering, hallucination detection, and PII redaction." },
  { date: "Feb 8, 2026", title: "Agent Teams — Multi-Agent Debate System", category: "Agents", icon: Rocket,
    description: "War Room powered multi-agent debate where 3+ models argue, challenge, and synthesize answers. Produces higher-quality outputs than any single model." },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono mb-4">
            <Rocket className="w-3 h-3" /> Changelog
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">What&apos;s New</h1>
          <p className="text-neutral-500 max-w-lg mx-auto">Every feature shipped. Follow our velocity.</p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Accent line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500/50 via-emerald-500/20 to-transparent" />

          <div className="space-y-10">
            {ENTRIES.map((entry, i) => {
              const Icon = entry.icon;
              const cat = CATEGORIES[entry.category];
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="relative pl-12">
                  {/* Dot */}
                  <div className="absolute left-[12px] top-1.5 w-[15px] h-[15px] rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>

                  <span className="text-xs font-mono text-neutral-600 mb-2 block">{entry.date}</span>
                  <div className="px-5 py-4 rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl hover:border-emerald-500/20 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                        <h3 className="font-semibold text-white">{entry.title}</h3>
                      </div>
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full border shrink-0 ${cat.bg} ${cat.color}`}>
                        {entry.category}
                      </span>
                    </div>
                    <p className="text-neutral-400 text-sm leading-relaxed">{entry.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
