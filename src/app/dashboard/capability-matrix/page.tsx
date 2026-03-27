"use client";

import React from "react";
import { Cpu, Zap, Shield, Brain, Eye, Mic, Code, PenTool, FileText, Search, Users, BarChart3 } from "lucide-react";

interface ModelInfo {
  name: string;
  id: string;
  provider: string;
  capabilities: string[];
  agents_using: string[];
  license: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}

const MODELS: ModelInfo[] = [
  { name: "Nemotron 3 Super 120B", id: "nvidia/nemotron-3-super-120b-a12b", provider: "NVIDIA", capabilities: ["Reasoning", "Analysis", "Strategy", "1M Context"], agents_using: ["nemotron3-super", "flywheel"], license: "NVIDIA Open Model License", icon: Brain, color: "#76B900" },
  { name: "Nemotron Ultra 253B", id: "nvidia/llama-3.1-nemotron-ultra-253b", provider: "NVIDIA", capabilities: ["Complex Reasoning", "Synthesis", "Debate"], agents_using: ["reasoning-chain"], license: "Llama License", icon: Brain, color: "#76B900" },
  { name: "Nemotron 3 Nano 30B", id: "nvidia/nemotron-3-nano-30b-a3b", provider: "NVIDIA", capabilities: ["Tool-Calling", "262K Context", "Document Analysis"], agents_using: ["doc-analyst"], license: "NVIDIA Open Model License", icon: FileText, color: "#76B900" },
  { name: "DeepSeek V3.2", id: "deepseek-ai/deepseek-v3.2", provider: "DeepSeek", capabilities: ["Reasoning", "Code", "Writing", "Analysis"], agents_using: ["blog-gen", "case-study", "swarm", "collab-room", "feedback"], license: "DeepSeek License", icon: Search, color: "#4F46E5" },
  { name: "DeepSeek R1 Distill", id: "deepseek-ai/deepseek-r1-distill-qwen-32b", provider: "DeepSeek", capabilities: ["Chain-of-Thought", "Math", "Science", "Logic"], agents_using: ["deepseek-r1"], license: "DeepSeek License", icon: Search, color: "#4F46E5" },
  { name: "Mistral Nemotron", id: "mistralai/mistral-nemotron", provider: "Mistral", capabilities: ["Chat", "Email", "Summarization", "Outreach"], agents_using: ["auto-heal", "memory", "abm-artillery"], license: "Apache 2.0", icon: Zap, color: "#FF7000" },
  { name: "GLM-5", id: "z-ai/glm5", provider: "Z.AI", capabilities: ["Agentic", "Tool-Calling", "Autonomous Planning"], agents_using: ["agentic-planner"], license: "GLM License", icon: Users, color: "#10B981" },
  { name: "Kimi K2.5", id: "moonshotai/kimi-k2.5", provider: "Moonshot", capabilities: ["Creative Writing", "Ad Copy", "Storytelling"], agents_using: ["creative-director"], license: "Apache 2.0", icon: PenTool, color: "#EC4899" },
  { name: "MiniMax M2.5", id: "minimaxai/minimax-m2.5", provider: "MiniMax", capabilities: ["Code Generation", "Debugging", "Refactoring"], agents_using: ["code-agent"], license: "MiniMax Open", icon: Code, color: "#06B6D4" },
  { name: "Qwen 3.5 VLM", id: "qwen/qwen-3.5-vlm", provider: "Qwen", capabilities: ["Vision", "Image Understanding", "OCR", "Chart Reading"], agents_using: ["vision"], license: "Apache 2.0", icon: Eye, color: "#8B5CF6" },
  { name: "Nemotron Voicechat", id: "nvidia/nemotron-voicechat", provider: "NVIDIA", capabilities: ["Voice Calls", "Real-Time Conversation"], agents_using: ["voicechat"], license: "NVIDIA Open Model License", icon: Mic, color: "#76B900" },
  { name: "Content Safety 4B", id: "nvidia/nemotron-content-safety-reasoning-4b", provider: "NVIDIA", capabilities: ["PII Detection", "Safety", "Guardrails"], agents_using: ["pii-redactor", "content-safety"], license: "NVIDIA Open Model License", icon: Shield, color: "#EF4444" },
];

const CATEGORIES = [
  { name: "Text Intelligence", count: 15, agents: ["translate", "blog-gen", "case-study", "smart-router", "swarm", "collab-room", "reasoning-chain", "creative-director", "research", "abm-artillery"] },
  { name: "Visual Intelligence", count: 5, agents: ["image-gen", "vision", "florence-ocr", "cosmos-video", "deepfake"] },
  { name: "Voice Intelligence", count: 4, agents: ["voice-synth", "voicechat", "multilingual-voice", "magpie-tts"] },
  { name: "Code Intelligence", count: 3, agents: ["code-agent", "page-builder", "devstral"] },
  { name: "Reasoning & Analysis", count: 4, agents: ["nemotron3-super", "deepseek-r1", "reasoning-chain", "doc-analyst"] },
  { name: "Security & Compliance", count: 5, agents: ["pii-redactor", "gliner-pii", "content-safety", "guardrails", "morpheus-shield"] },
  { name: "Autonomous Orchestration", count: 6, agents: ["agentic-planner", "auto-heal", "pipeline", "scheduler", "comms", "nemoclaw"] },
  { name: "Revenue & Growth", count: 5, agents: ["billing", "auto-onboard", "marketplace", "verticals", "whitelabel"] },
];

export default function CapabilityMatrixPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-8 font-mono">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="border-b border-[#76B900]/20 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#76B900]/10 border border-[#76B900]/30 flex items-center justify-center">
              <Cpu className="w-6 h-6 text-[#76B900]" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-[0.2em]">Agent Capability Matrix</h1>
              <p className="text-[#76B900]/60 text-xs uppercase tracking-widest">{MODELS.length} Models · {CATEGORIES.reduce((s, c) => s + c.count, 0)} Agents · All Free · All Legal</p>
            </div>
          </div>
        </header>

        {/* Legal Status */}
        <div className="bg-[#00B7FF]/5 border border-[#00B7FF]/20 p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#00B7FF] mb-3">⚖️ Legal Compliance</h2>
          <div className="grid md:grid-cols-2 gap-4 text-xs text-neutral-400">
            <div><span className="text-white font-bold">All models used via official NVIDIA NIM API.</span> This is the intended commercial use case explicitly provided by NVIDIA.</div>
            <div><span className="text-white font-bold">Licenses verified:</span> NVIDIA Open Model License, Apache 2.0, DeepSeek License, GLM License, MiniMax Open — all permit commercial use.</div>
            <div><span className="text-white font-bold">No scraping, no reverse engineering.</span> All API calls use authenticated endpoints with your own API key.</div>
            <div><span className="text-white font-bold">POPIA/GDPR compliant.</span> PII redaction, content safety, and guardrails agents enforce data protection.</div>
          </div>
        </div>

        {/* Model Registry */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500 mb-4">Model Registry</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODELS.map(m => (
              <div key={m.id} className="bg-neutral-950 border border-neutral-800 p-4 hover:border-neutral-600 transition-gpu">
                <div className="flex items-center gap-3 mb-3">
                  {React.createElement(m.icon, { className: "w-4 h-4", style: { color: m.color } })}
                  <span className="text-xs font-bold text-white">{m.name}</span>
                </div>
                <p className="text-[9px] text-neutral-600 mb-2">{m.provider} · {m.license}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {m.capabilities.map(c => (
                    <span key={c} className="text-[8px] px-1.5 py-0.5 bg-white/5 text-neutral-500 border border-neutral-800">{c}</span>
                  ))}
                </div>
                <p className="text-[8px] text-neutral-700">Used by: {m.agents_using.join(", ")}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500 mb-4">Capability Categories</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {CATEGORIES.map(cat => (
              <div key={cat.name} className="bg-neutral-950 border border-neutral-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-white">{cat.name}</h3>
                  <span className="text-lg font-black text-[#76B900]">{cat.count}</span>
                </div>
                <p className="text-[8px] text-neutral-600 leading-relaxed">{cat.agents.join(" · ")}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Agent APIs", value: "72+", color: "#00B7FF" },
            { label: "NIM Models", value: "51+", color: "#76B900" },
            { label: "Dashboard Pages", value: "43", color: "#00B7FF" },
            { label: "Industry Verticals", value: "6", color: "#A855F7" },
            { label: "Cost", value: "$0", color: "#FFD700" },
          ].map(stat => (
            <div key={stat.label} className="bg-neutral-950 border border-neutral-800 p-4 text-center">
              <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-[8px] text-neutral-600 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
