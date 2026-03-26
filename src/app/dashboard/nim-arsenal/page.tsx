"use client";

import React, { useState } from "react";
import { Shield, Cpu, Eye, Mic, Code, Database, Sparkles, Zap, ChevronDown } from "lucide-react";

const TIER_CONFIG: Record<number, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  1: { label: "Core Reasoning", color: "#00ff66", icon: Cpu },
  2: { label: "Vision & Video", color: "#00B7FF", icon: Eye },
  3: { label: "Voice & TTS", color: "#FF6B00", icon: Mic },
  4: { label: "Security", color: "#FF0055", icon: Shield },
  5: { label: "Code Generation", color: "#A855F7", icon: Code },
  6: { label: "RAG & Embeddings", color: "#FACC15", icon: Database },
  7: { label: "Specialized", color: "#06B6D4", icon: Sparkles },
  8: { label: "Frontier Free", color: "#F472B6", icon: Zap },
};

const MODELS = [
  { key: "deepseek-v3.2", name: "DeepSeek V3.2 (685B)", tier: 1, desc: "685B reasoning LLM with sparse attention and agentic tools" },
  { key: "qwen3.5-122b", name: "Qwen3.5 122B MoE", tier: 1, desc: "122B MoE (10B active) for coding, reasoning, multimodal" },
  { key: "mistral-nemotron", name: "Mistral-Nemotron", tier: 1, desc: "Agentic function calling and instruction following" },
  { key: "mistral-large-3", name: "Mistral Large 3 (675B)", tier: 1, desc: "General purpose MoE VLM for enterprise" },
  { key: "deepseek-v3.1-terminus", name: "DeepSeek V3.1 Terminus", tier: 1, desc: "Hybrid inference with strict function calling" },
  { key: "minimax-m2.1", name: "MiniMax M2.1", tier: 1, desc: "Multi-language coding and agent integration" },
  { key: "cosmos-transfer-2.5", name: "Cosmos Transfer 2.5", tier: 2, desc: "Physics-aware video world state generation" },
  { key: "cosmos-predict-1", name: "Cosmos Predict 1 (5B)", tier: 2, desc: "Future frame prediction from image/video" },
  { key: "cosmos-vlm", name: "Cosmos Nemotron 34B", tier: 2, desc: "Multi-modal VLM for text/img/video understanding" },
  { key: "gemma-3-27b", name: "Gemma 3 27B IT", tier: 2, desc: "Multimodal reasoning from images" },
  { key: "stable-diffusion-3", name: "Stable Diffusion 3", tier: 2, desc: "Advanced text-to-image generation" },
  { key: "nemotron-voicechat", name: "Nemotron Voicechat", tier: 3, desc: "Real-time voice conversation" },
  { key: "magpie-tts-flow", name: "Magpie TTS Flow", tier: 3, desc: "Expressive text-to-speech synthesis" },
  { key: "magpie-tts-zeroshot", name: "Magpie TTS Zeroshot", tier: 3, desc: "Voice cloning from 10s audio sample" },
  { key: "content-safety", name: "Content Safety 4B", tier: 4, desc: "Context-aware policy enforcement" },
  { key: "llama-guard-4", name: "Llama Guard 4 (12B)", tier: 4, desc: "Multi-modal safety classification" },
  { key: "granite-guardian", name: "Granite Guardian 3.0", tier: 4, desc: "Bias, violence, profanity detection" },
  { key: "shieldgemma", name: "ShieldGemma 9B", tier: 4, desc: "Response safety guardrails" },
  { key: "nemotron-safety-guard", name: "Nemotron Safety Guard V3", tier: 4, desc: "Multilingual content moderation" },
  { key: "devstral-2", name: "Devstral 2 (123B)", tier: 5, desc: "Deep reasoning code with 256k context" },
  { key: "qwen3-coder", name: "Qwen3 Coder (480B)", tier: 5, desc: "Agentic coding and browser use" },
  { key: "qwen2.5-coder", name: "Qwen 2.5 Coder 7B", tier: 5, desc: "Fast inline code completion" },
  { key: "nv-embed", name: "NV-Embed V1", tier: 6, desc: "High-quality text embeddings for RAG" },
  { key: "nv-embedcode", name: "NV-EmbedCode 7B", tier: 6, desc: "Code retrieval embeddings" },
  { key: "rerank-qa", name: "Rerank QA Mistral 4B", tier: 6, desc: "Search result quality scoring" },
  { key: "nemo-retriever", name: "NeMo Retriever 300M", tier: 6, desc: "26-language cross-lingual embeddings" },
  { key: "riva-translate", name: "Riva Translate 4B", tier: 7, desc: "12-language translation" },
  { key: "gliner-pii", name: "GLiNER PII Detector", tier: 7, desc: "Personally identifiable data detection" },
  { key: "usdcode", name: "USD Code", tier: 7, desc: "3D scene generation via OpenUSD" },
  { key: "nv-dinov2", name: "NV-DINOv2", tier: 7, desc: "Visual embeddings for image search" },
  { key: "grounding-dino", name: "Grounding DINO", tier: 7, desc: "Zero-shot object detection" },
  { key: "glm-4.7", name: "GLM-4.7", tier: 8, desc: "#1 ranked multilingual agentic coding model" },
  { key: "step-3.5-flash", name: "Step 3.5 Flash (200B)", tier: 8, desc: "200B reasoning engine with sparse MoE" },
  { key: "kimi-k2", name: "Kimi K2 Instruct", tier: 8, desc: "Strong reasoning, coding, 256k context" },
  { key: "qwq-32b", name: "QwQ-32B Reasoning", tier: 8, desc: "Powerful reasoning for hard problems" },
  { key: "phi-4-multimodal", name: "Phi-4 Multimodal", tier: 8, desc: "Multimodal reasoning from image + audio" },
  { key: "seed-oss-36b", name: "ByteDance SEED 36B", tier: 8, desc: "Long-context agentic intelligence" },
  { key: "magistral-small", name: "Magistral Small", tier: 8, desc: "Efficient reasoning for edge deployment" },
];

export default function NimArsenalPage() {
  const [activeTier, setActiveTier] = useState<number | null>(null);

  const filteredModels = activeTier ? MODELS.filter(m => m.tier === activeTier) : MODELS;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-mono">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* Header */}
        <header className="border-b border-white/10 pb-8">
          <div className="flex items-center gap-4 mb-2">
            <Zap className="w-8 h-8 text-[#00B7FF]" />
            <h1 className="text-3xl font-black uppercase tracking-[0.2em]">NIM Arsenal</h1>
          </div>
          <p className="text-neutral-500 text-sm uppercase tracking-widest">
            {MODELS.length} NVIDIA Inference Microservices · 7 Operational Tiers · Zero Latency
          </p>
        </header>

        {/* Tier Filter Chips */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTier(null)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-gpu ${!activeTier ? "bg-white text-black border-white" : "bg-transparent text-neutral-500 border-neutral-800 hover:border-neutral-600"}`}
          >
            All ({MODELS.length})
          </button>
          {Object.entries(TIER_CONFIG).map(([tier, config]) => {
            const count = MODELS.filter(m => m.tier === Number(tier)).length;
            return (
              <button
                key={tier}
                onClick={() => setActiveTier(activeTier === Number(tier) ? null : Number(tier))}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-gpu flex items-center gap-2 ${activeTier === Number(tier) ? `text-black border-transparent` : `text-neutral-500 border-neutral-800 hover:border-neutral-600`}`}
                style={activeTier === Number(tier) ? { backgroundColor: config.color } : {}}
              >
                {React.createElement(config.icon, { className: "w-3 h-3" })}
                {config.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Model Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredModels.map((model) => {
            const tierConf = TIER_CONFIG[model.tier];
            return (
              <div
                key={model.key}
                className="bg-neutral-950 border border-neutral-800 p-5 hover:border-neutral-600 transition-gpu group relative overflow-hidden"
              >
                {/* Tier accent bar */}
                <div className="absolute top-0 left-0 w-full h-[2px]" style={{ backgroundColor: tierConf.color }} />

                <div className="flex items-start justify-between mb-3">
                  <span
                    className="text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5"
                    style={{ color: tierConf.color, backgroundColor: `${tierConf.color}15` }}
                  >
                    {tierConf.label}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#00B7FF]" title="Available" />
                </div>

                <h3 className="text-sm font-bold text-white mb-2 group-hover:text-[#00B7FF] transition-colors">
                  {model.name}
                </h3>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  {model.desc}
                </p>

                <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
                  <code className="text-[9px] text-neutral-600 font-mono">{model.key}</code>
                  <span className="text-[9px] text-[#00B7FF] font-bold uppercase tracking-wider">Available</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Stats */}
        <footer className="border-t border-neutral-800 pt-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-3xl font-black text-[#00B7FF]">{MODELS.length}</p>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Available Models</p>
          </div>
          <div>
            <p className="text-3xl font-black text-[#00B7FF]">7</p>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Operational Tiers</p>
          </div>
          <div>
            <p className="text-3xl font-black text-[#A855F7]">&lt;100ms</p>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Avg Latency</p>
          </div>
          <div>
            <p className="text-3xl font-black text-[#FF0055]">5</p>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Security Layers</p>
          </div>
        </footer>

      </div>
    </div>
  );
}
