"use client";

import React, { useState } from "react";
import {
  Phone, Mail, Shield, FileSearch, ImageIcon, Mic,
  Cpu, Zap, Play, Loader2, AlertCircle, ChevronRight,
  Lock, Languages, Database, Paintbrush, Clapperboard, BotMessageSquare
} from "lucide-react";

interface Agent {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  icon: React.ElementType;
  color: string;
  category: string;
  nimModel: string;
  inputType: "text" | "company" | "translate" | "none";
  placeholder?: string;
}

const AGENTS: Agent[] = [
  {
    id: "sentinel-dialer",
    name: "KiloClaw Sentinel Dialer",
    description: "Triggers instant outbound Twilio voice calls to leads upon form submission.",
    endpoint: "/api/leads/capture",
    icon: Phone,
    color: "#00ff66",
    category: "Sales",
    nimModel: "Twilio Voice + Polly Neural",
    inputType: "none",
  },
  {
    id: "abm-artillery",
    name: "ABM Artillery Node",
    description: "Researches a company via Tavily, writes a personalized cold email via NIM, fires it via Resend.",
    endpoint: "/api/agents/abm-artillery",
    icon: Mail,
    color: "#FF6B00",
    category: "Sales",
    nimModel: "mistral-nemotron",
    inputType: "company",
    placeholder: "Enter company name (e.g. Tesla, Shoprite)...",
  },
  {
    id: "morpheus-shield",
    name: "Morpheus Shield",
    description: "Un-jailbreakable chatbot with NeMo Guardrails for client-facing defense.",
    endpoint: "/api/nim",
    icon: Shield,
    color: "#FF0055",
    category: "Security",
    nimModel: "content-safety-reasoning-4b",
    inputType: "text",
    placeholder: "Try to jailbreak the shield...",
  },
  {
    id: "ai-gateway",
    name: "Vercel AI Gateway",
    description: "Routes to MiniMax M2.7 Highspeed with automatic NIM failover.",
    endpoint: "/api/agents/ai-gateway",
    icon: Zap,
    color: "#F472B6",
    category: "Intelligence",
    nimModel: "minimax-m2.7-highspeed",
    inputType: "text",
    placeholder: "Send a prompt to MiniMax M2.7...",
  },
  {
    id: "page-builder",
    name: "Stitch Page Builder",
    description: "Generates complete HTML websites from text prompts using Stitch SDK + Devstral 2.",
    endpoint: "/api/agents/page-builder",
    icon: Paintbrush,
    color: "#A855F7",
    category: "Builder",
    nimModel: "devstral-2-123b",
    inputType: "text",
    placeholder: "Describe the page to generate...",
  },
  {
    id: "pii-redactor",
    name: "PII Auto-Redactor",
    description: "Detects and redacts personally identifiable information for GDPR/POPIA compliance.",
    endpoint: "/api/agents/pii-redactor",
    icon: Lock,
    color: "#EF4444",
    category: "Security",
    nimModel: "content-safety-reasoning-4b",
    inputType: "text",
    placeholder: "Paste text containing personal data...",
  },
  {
    id: "translate",
    name: "12-Language Translator",
    description: "Translates outbound marketing content into 12 languages via Riva Translate.",
    endpoint: "/api/agents/translate",
    icon: Languages,
    color: "#06B6D4",
    category: "Outreach",
    nimModel: "riva-translate-4b",
    inputType: "translate",
    placeholder: "Enter text to translate...",
  },
  {
    id: "doc-intel",
    name: "Document Intelligence",
    description: "Full RAG pipeline: embed documents → store in Pinecone → semantic search with reranking.",
    endpoint: "/api/agents/doc-intel",
    icon: Database,
    color: "#FACC15",
    category: "Intelligence",
    nimModel: "nv-embed-v1 + rerank-qa-4b",
    inputType: "text",
    placeholder: "Enter text to embed or a query to search...",
  },
  {
    id: "image-gen",
    name: "Image Generator",
    description: "Generates marketing images and product shots via Stable Diffusion 3 Medium.",
    endpoint: "/api/agents/image-gen",
    icon: ImageIcon,
    color: "#10B981",
    category: "Creative",
    nimModel: "stable-diffusion-3-medium",
    inputType: "text",
    placeholder: "Describe the image to generate...",
  },
  {
    id: "voice-synth",
    name: "Voice Synthesizer",
    description: "Expressive text-to-speech via Magpie TTS for podcasts and calls.",
    endpoint: "/api/agents/voice-synth",
    icon: Mic,
    color: "#FF6B00",
    category: "Creative",
    nimModel: "magpie-tts-flow",
    inputType: "text",
    placeholder: "Enter text to speak...",
  },
  {
    id: "cosmos-video",
    name: "Cosmos Video Predictor",
    description: "Physics-aware video world state generation via Cosmos Predict + Transfer.",
    endpoint: "/api/agents/cosmos-video",
    icon: Clapperboard,
    color: "#00B7FF",
    category: "Creative",
    nimModel: "cosmos-predict1-5b",
    inputType: "text",
    placeholder: "Describe the video scene...",
  },
];

const CATEGORIES = ["All", ...Array.from(new Set(AGENTS.map(a => a.category)))];
const TRANSLATE_LANGS = ["es", "fr", "de", "pt", "zh", "ja", "ko", "ar", "hi", "ru", "it"];

export default function AgentCommandCenter() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [targetLang, setTargetLang] = useState("es");
  const [results, setResults] = useState<Record<string, { loading: boolean; data: unknown; error?: string }>>({});

  const [showMetaPrompt, setShowMetaPrompt] = useState(false);
  const [metaPromptInput, setMetaPromptInput] = useState("");
  const [metaPromptResult, setMetaPromptResult] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const generateMetaPrompt = async () => {
    if (!metaPromptInput) return;
    setIsGeneratingPrompt(true);
    setMetaPromptResult("");
    try {
      const res = await fetch("/api/agents/meta-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: metaPromptInput })
      });
      const data = await res.json();
      setMetaPromptResult(data.prompt);
    } catch {
      setMetaPromptResult("Error generating prompt. Ensure LLM routes are active.");
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const filteredAgents = activeCategory === "All" ? AGENTS : AGENTS.filter(a => a.category === activeCategory);

  const executeAgent = async (agent: Agent) => {
    const input = inputs[agent.id] || "";
    setResults(prev => ({ ...prev, [agent.id]: { loading: true, data: null } }));

    try {
      let body: Record<string, unknown> = {};

      if (agent.id === "abm-artillery") {
        body = { companyName: input };
      } else if (agent.id === "morpheus-shield") {
        body = { model: "content-safety", messages: [{ role: "user", content: input }] };
      } else if (agent.id === "ai-gateway") {
        body = { messages: [{ role: "user", content: input }] };
      } else if (agent.id === "page-builder") {
        body = { prompt: input };
      } else if (agent.id === "pii-redactor") {
        body = { text: input };
      } else if (agent.id === "translate") {
        body = { text: input, target_lang: targetLang };
      } else if (agent.id === "doc-intel") {
        body = { action: "embed", text: input };
      } else if (agent.id === "image-gen") {
        body = { prompt: input };
      } else if (agent.id === "cosmos-video") {
        body = { prompt: input };
      } else {
        body = { text: input };
      }

      const res = await fetch(agent.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setResults(prev => ({ ...prev, [agent.id]: { loading: false, data } }));
    } catch (err) {
      setResults(prev => ({ ...prev, [agent.id]: { loading: false, data: null, error: String(err) } }));
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-8 font-mono">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center">
              <BotMessageSquare className="w-5 h-5 text-[#00ff66]" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-[0.2em]">Agent Command Center</h1>
              <p className="text-neutral-500 text-xs uppercase tracking-widest">{AGENTS.length} Autonomous Agents · All Systems Operational</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowMetaPrompt(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00B7FF]/10 text-[#00B7FF] border border-[#00B7FF]/30 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#00B7FF]/20 transition-colors"
          >
            <Cpu className="w-4 h-4" /> Anthropic Meta-Prompt Engine
          </button>
        </header>

        {showMetaPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#0A0A0A] border border-white/10 w-full max-w-2xl p-6 relative">
              <button onClick={() => setShowMetaPrompt(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">Close</button>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Cpu className="text-[#00B7FF] w-5 h-5" /> God-Brain Auto-Orchestrator</h2>
              <p className="text-xs text-neutral-400 mb-6">Describe an AI agent&apos;s purpose. The system will use Anthropic&apos;s open-source Meta-Prompt methodology to generate a flawless XML-structured system instruction.</p>
              
              <textarea
                value={metaPromptInput}
                onChange={e => setMetaPromptInput(e.target.value)}
                placeholder="e.g. I need an agent that reviews Python code for security vulnerabilities and outputs strict JSON..."
                className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white mb-4 focus:outline-none focus:border-[#00B7FF]/50 min-h-[100px]"
              />
              
              <button 
                onClick={generateMetaPrompt}
                disabled={isGeneratingPrompt || !metaPromptInput}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black font-bold text-xs uppercase tracking-widest hover:bg-neutral-200 transition-colors mb-4 disabled:opacity-50"
              >
                {isGeneratingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Generate Enterprise Prompt
              </button>

              {metaPromptResult && (
                <div className="mt-4 border border-white/10 bg-black p-4 rounded-lg max-h-[300px] overflow-y-auto custom-scrollbar">
                  <pre className="text-[10px] text-[#00ff66] font-mono whitespace-pre-wrap">{metaPromptResult}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-950 border border-neutral-800 p-4 text-center">
            <p className="text-2xl font-black text-[#00ff66]">{AGENTS.length}</p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Active Agents</p>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 p-4 text-center">
            <p className="text-2xl font-black text-[#00B7FF]">38</p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">NIM Models</p>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 p-4 text-center">
            <p className="text-2xl font-black text-[#A855F7]">8</p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Operational Tiers</p>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 p-4 text-center">
            <p className="text-2xl font-black text-[#FF0055]">$0</p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Infrastructure Cost</p>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                activeCategory === cat
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-neutral-500 border-neutral-800 hover:border-neutral-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Agent Grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAgents.map(agent => {
            const isExpanded = expandedAgent === agent.id;
            const result = results[agent.id];
            const Icon = agent.icon;

            return (
              <div
                key={agent.id}
                className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-all overflow-hidden group"
              >
                {/* Accent bar */}
                <div className="h-[2px]" style={{ backgroundColor: agent.color }} />

                <div className="p-5">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}30` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: agent.color }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                        <span className="text-[9px] uppercase tracking-widest" style={{ color: agent.color }}>{agent.category}</span>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-[9px] text-[#00ff66] font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66] animate-pulse" /> Live
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-500 leading-relaxed mb-3">{agent.description}</p>

                  {/* Model Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <code className="text-[9px] text-neutral-600 bg-neutral-900 px-2 py-1 rounded">{agent.nimModel}</code>
                    <button
                      onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                      className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors hover:text-white"
                      style={{ color: agent.color }}
                    >
                      {isExpanded ? "Close" : "Execute"} <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                  </div>

                  {/* Expanded Execute Panel */}
                  {isExpanded && agent.inputType !== "none" && (
                    <div className="border-t border-neutral-800 pt-4 space-y-3 animate-in fade-in duration-200">
                      {agent.inputType === "translate" && (
                        <select
                          value={targetLang}
                          onChange={e => setTargetLang(e.target.value)}
                          className="w-full bg-black border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none"
                        >
                          {TRANSLATE_LANGS.map(l => (
                            <option key={l} value={l}>{l.toUpperCase()}</option>
                          ))}
                        </select>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inputs[agent.id] || ""}
                          onChange={e => setInputs(prev => ({ ...prev, [agent.id]: e.target.value }))}
                          placeholder={agent.placeholder}
                          className="flex-1 bg-black border border-neutral-800 px-3 py-2.5 text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600"
                          onKeyDown={e => e.key === "Enter" && executeAgent(agent)}
                        />
                        <button
                          onClick={() => executeAgent(agent)}
                          disabled={result?.loading}
                          className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                          style={{ backgroundColor: `${agent.color}20`, color: agent.color, border: `1px solid ${agent.color}40` }}
                        >
                          {result?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        </button>
                      </div>

                      {/* Result Display */}
                      {result && !result.loading && result.data && (
                        <div className="bg-black border border-neutral-800 p-3 max-h-48 overflow-y-auto">
                          <pre className="text-[10px] text-neutral-400 whitespace-pre-wrap font-mono">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </div>
                      )}
                      {result?.error && (
                        <div className="flex items-center gap-2 text-red-500 text-[10px]">
                          <AlertCircle className="w-3 h-3" /> {result.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="border-t border-neutral-800 pt-6 text-center">
          <p className="text-[10px] text-neutral-600 uppercase tracking-widest">
            Sovereign Matrix · Agent Command Center · Powered by 38 NVIDIA NIM Models · $0 Infrastructure Cost
          </p>
        </footer>
      </div>
    </div>
  );
}
