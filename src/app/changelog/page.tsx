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
  { date: "Apr 8, 2026", title: "Competitive Hub — 5 Comparison Pages", category: "Platform", icon: Route,
    description: "Launched /vs/hubspot, /vs/clay, /vs/zapier, /vs/crewai, /vs/n8n with honest feature comparison tables, pricing breakdowns, and SEO metadata for high-intent search traffic." },
  { date: "Apr 8, 2026", title: "Use Case Pages — Lead Gen, Content Engine, Second Brain", category: "Platform", icon: Layers,
    description: "Three dedicated use case pages showing step-by-step agent workflows: ICP-to-meeting lead pipeline, SEO-first content engine, and persistent AI memory system." },
  { date: "Apr 8, 2026", title: "API Documentation — Stripe-Style Reference", category: "Platform", icon: Terminal,
    description: "Full API docs at /developers/docs with 9 endpoints, code examples, rate limits per plan, error codes, IntersectionObserver sidebar, and copy-to-clipboard." },
  { date: "Apr 8, 2026", title: "Marketplace Honesty Audit", category: "Platform", icon: Shield,
    description: "Removed fake install counts and star ratings. Replaced with honest capability tags and Built-in badges. Added search, category filtering, and Submit Your Agent CTA." },
  { date: "Apr 7, 2026", title: "Project Glasswing Integration", category: "Models", icon: Brain,
    description: "Added Claude Mythos to model registry (SWE-bench Pro 77.8%, CyberGym 83.1%). Security Command Center updated with real zero-day vulnerability findings from Anthropic's Glasswing report." },
  { date: "Apr 7, 2026", title: "Market Pivot — LiveAgentTerminal + StackKiller + Agent OS", category: "Platform", icon: Rocket,
    description: "Three category-defining landing page sections: streaming competitive scan demo, 8-tool stack displacement ($705→$199), and 5-layer Agent OS architecture visualization." },
  { date: "Apr 7, 2026", title: "ROI Calculator + Email Capture", category: "Platform", icon: Workflow,
    description: "Interactive dual-slider ROI calculator showing expected revenue, payback period, and vs-hiring-a-human costs. Email capture with localStorage + API persistence." },
  { date: "Apr 7, 2026", title: "Consensus Engine Visualization", category: "Agents", icon: Brain,
    description: "4-model debate visualization on landing page: Nemotron-Ultra, DeepSeek-V3.2, Gemma-4, Qwen-3. Shows generate→critique→synthesize→verify pipeline with live confidence bars." },
  { date: "Apr 7, 2026", title: "Full Honesty Audit — ZAR→USD + Fake Data Removal", category: "Safety", icon: Shield,
    description: "Removed all fabricated case studies, fake star ratings, ZAR pricing references. Replaced with honest try-it-yourself CTAs and real USD pricing ($19/$49/$199/$499)." },
  { date: "Mar 30, 2026", title: "66+ Models — GLM-5, Claude Mythos, NIM Function Calling", category: "Models", icon: Layers,
    description: "Added GLM-5 (744B MoE), GLM-4.7 (90.6% tool use), MiniMax M2.5, FLUX.1 Pro, Qwen3-Coder, and NIM native function calling. Smart Router now covers 20+ task types." },
  { date: "Mar 29, 2026", title: "Production Security Hardening", category: "Safety", icon: Shield,
    description: "SQL injection protection, encrypted API keys, circuit breakers for all providers, audit logging (SOC 2 prep), PayFast signature verification, and auth on all 124 agent routes." },
  { date: "Mar 29, 2026", title: "Visual Workflow Builder", category: "Platform", icon: Terminal,
    description: "Drag-and-drop agent pipeline builder. Chain agents into sequential workflows, customize prompts per step, and execute the full chain with one click." },
  { date: "Mar 28, 2026", title: "API Playground", category: "Platform", icon: Terminal,
    description: "Interactive playground for testing agents without signing up. Pre-filled prompts, syntax-highlighted responses, and 3 free tries for visitors." },
  { date: "Mar 24, 2026", title: "Revenue Attribution Dashboard", category: "Analytics", icon: BarChart3,
    description: "Full-funnel revenue tracking from first touch to closed deal. See exactly which agents drive pipeline and ROI across your entire stack." },
  { date: "Mar 19, 2026", title: "Llama 4 Scout + DeepSeek V3.2", category: "Models", icon: Layers,
    description: "Added Meta Llama 4 Scout and DeepSeek V3.2 to the model registry. Smart Router automatically selects the best model per task." },
  { date: "Mar 14, 2026", title: "124 Agent Routes", category: "Platform", icon: Route,
    description: "Scaled to 124 unique agent API routes spanning lead gen, content, SEO, voice, analytics, and marketplace operations." },
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
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">What&apos;s New</h1>
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

                  <span className="text-xs font-mono text-neutral-500 mb-2 block">{entry.date}</span>
                  <div className="px-5 py-4 rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl hover:border-emerald-500/20 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                        <h2 className="font-semibold text-white">{entry.title}</h2>
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
