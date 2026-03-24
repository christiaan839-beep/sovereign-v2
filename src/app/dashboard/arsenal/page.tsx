"use client";

import { motion } from "framer-motion";
import { Download, BrainCircuit, Cpu, Code2, Globe, Database, Network, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

const ANTHROPIC_COOKBOOKS = [
  {
    id: "anthropic-financial",
    title: "Financial Analysis RAG Analyst",
    author: "Anthropic Engineering",
    category: "Data Operations",
    icon: Database,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    description: "A multi-agent swarm designed to ingest 10K/10Q filings, cross-reference historical data using Contextual Retrieval, and output SEC-grade financial briefs.",
    tags: ["Contextual RAG", "PDF Vision", "Multi-Agent Debate"]
  },
  {
    id: "anthropic-cs-triage",
    title: "Customer Support Orchestrator",
    author: "Anthropic Engineering",
    category: "Communication",
    icon: Network,
    color: "text-[#00B7FF]",
    bg: "bg-[#00B7FF]/10",
    border: "border-[#00B7FF]/20",
    description: "Evaluates inbound support tickets, determines user intent via zero-shot classification, and executes API-based refunds via Stripe or assigns to a human fallback.",
    tags: ["Function Calling", "Sentiment Analysis", "Stripe API"]
  },
  {
    id: "anthropic-coder",
    title: "Artifact Rendering Developer",
    author: "Anthropic Engineering",
    category: "Engineering",
    icon: Code2,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    description: "An autonomous software engineer that writes React components, validates them via local tool execution, and renders live UI previews.",
    tags: ["Code Generation", "Bash Execution", "React Preview"]
  },
  {
    id: "anthropic-web-researcher",
    title: "Deep Web Investigator",
    author: "Anthropic Engineering",
    category: "Research",
    icon: Globe,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    description: "Crawls live SERP data without hitting CAPTCHAs, synthesizes multi-site narratives, and completely removes competitor bias via recursive editing prompts.",
    tags: ["Live Web Crawl", "Tavily Integration", "Anti-Hallucination"]
  }
];

export default function SovereignArsenalPage() {
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const toast = useToast();

  const handleDeploy = async (id: string) => {
    const blueprint = ANTHROPIC_COOKBOOKS.find(b => b.id === id);
    if (!blueprint) return;

    setDeployingId(id);
    try {
      const res = await fetch("/api/agents/god-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Deploy the following agent blueprint: "${blueprint.title}" - ${blueprint.description}. Category: ${blueprint.category}. Capabilities: ${blueprint.tags.join(", ")}. Configure and initialize this agent architecture.`,
        }),
      });

      if (!res.ok) {
        throw new Error(`Deployment failed (${res.status})`);
      }

      const data = await res.json();
      toast.success(data.response?.slice(0, 120) || "Blueprint deployed to God-Brain.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Deploy failed: ${message}`);
    } finally {
      setDeployingId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-400 text-xs font-bold uppercase tracking-wider mb-3 shadow-[0_0_20px_rgba(255,255,255,0.02)]">
          <BrainCircuit className="w-3 h-3 text-[#00B7FF]" /> Powered by Anthropic Cookbooks
        </div>
        <h1 className="text-4xl font-bold font-sans tracking-tight mb-4 flex items-center gap-3">
          Sovereign Arsenal <span className="text-[#00B7FF] text-2xl font-mono uppercase tracking-widest">[1-Click Architectures]</span>
        </h1>
        <p className="text-base text-neutral-400 max-w-3xl leading-relaxed">
          The ultimate marketplace of production-ready agent blueprints. Instantly deploy enterprise-grade workflows 
          engineered by the minds behind Claude. Every template utilizes Contextual RAG, Prompt Caching, and rigorous Meta-Prompt constraints automatically.
        </p>
      </div>

      {/* Arsenal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {ANTHROPIC_COOKBOOKS.map((blueprint, i) => (
          <motion.div
            key={blueprint.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`relative p-6 rounded-2xl bg-black/40 border border-white/5 overflow-hidden group hover:border-white/10 transition-colors shadow-[0_0_30px_rgba(0,0,0,0.5)]`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${blueprint.bg} ${blueprint.border} border`}>
                  <blueprint.icon className={`w-6 h-6 ${blueprint.color}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-[#00B7FF] transition-colors">{blueprint.title}</h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 uppercase tracking-widest">
                    <span>{blueprint.category}</span>
                    <span className="w-1 h-1 rounded-full bg-neutral-700" />
                    <span>{blueprint.author}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              {blueprint.description}
            </p>

            {/* Tags & Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-auto">
              <div className="flex flex-wrap gap-2">
                {blueprint.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-neutral-300 uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>

              <button
                onClick={() => handleDeploy(blueprint.id)}
                disabled={deployingId !== null}
                className={`shrink-0 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${
                  deployingId === blueprint.id 
                    ? "bg-[#00B7FF]/20 text-[#00B7FF] border-[#00B7FF]/30" 
                    : "bg-white text-black hover:bg-neutral-200 border-white"
                }`}
              >
                {deployingId === blueprint.id ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin" /> Provisioning...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" /> Deploy Agent
                  </>
                )}
              </button>
            </div>

            {/* Background Accent */}
            <div className={`absolute -bottom-10 -right-10 w-40 h-40 ${blueprint.bg} blur-[60px] opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none`} />
          </motion.div>
        ))}
      </div>

      {/* Meta-Prompt CTA */}
      <div className="mt-12 rounded-2xl bg-[#00B7FF]/5 border border-[#00B7FF]/20 p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 pointer-events-none" />
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B7FF]/20 text-[#00B7FF] text-[10px] font-bold uppercase tracking-widest mb-4">
            <Cpu className="w-3 h-3" /> Core Infrastructure
          </div>
          <h3 className="text-2xl font-bold text-white mb-2 font-serif">Anthropic Meta-Prompt Engine</h3>
          <p className="text-sm text-[#00B7FF]/70">
            Don&apos;t see a playbook for your use-case? Describe your ideal agent in plain English, and the Sovereign Matrix will route your request through Anthropic&apos;s open-source Meta-Prompt architecture to construct a flawless XML-structured system instruction automatically.
          </p>
        </div>
        <button className="relative z-10 whitespace-nowrap px-8 py-4 bg-[#00B7FF] text-black font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-[#00B7FF]/90 transition-colors shadow-[0_0_30px_rgba(0,183,255,0.3)] flex items-center gap-2">
          Launch Prompt Engine <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
