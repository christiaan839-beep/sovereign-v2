"use client";

import React, { useState, useEffect } from "react";
import { Key, Save, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState({
    nvidia: "",
    gemini: "",
    anthropic: "",
    grok: "",
    groq: "",
    tavily: "",
    stripe: "",
    ollama: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  useEffect(() => {
    async function loadKeys() {
      try {
        const res = await fetch("/api/settings/api-keys");
        const data = await res.json();
        if (data.apiKeys) {
          try {
            const parsed = JSON.parse(data.apiKeys);
            setKeys(prev => ({ ...prev, ...parsed }));
          } catch (e) {}
        }
      } catch (err) {
      } finally {
        setIsLoading(false);
      }
    }
    loadKeys();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keys),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "API Keys saved successfully. The Swarm is now using your keys." });
      } else {
        throw new Error("Failed to save");
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save API keys." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-rose-500/10 to-rose-600/5 border border-rose-500/20 glass-panel">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Key className="w-6 h-6 text-rose-400" /> Bring Your Own Key (BYOK)
        </h1>
        <p className="text-neutral-400">
          Enter your own API keys to bypass SOVEREIGN&apos;s global rate limits. If you provide a key here, the Swarm will use it instead of our master keys.
          <strong className="text-white ml-1">Your keys are encrypted at rest.</strong>
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
            <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2 flex items-center gap-2">
              NVIDIA NIM API Key <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase tracking-wider">FREE — 10+ Open-Source Models</span>
            </label>
            <p className="text-xs text-neutral-500 mb-4">Powers all NemoClaw agents, Nemotron reasoning, VoiceChat, PII Redactor, and the Collab Room. Get your free key at <a href="https://build.nvidia.com" target="_blank" className="text-emerald-400 underline">build.nvidia.com</a></p>
            <input 
              type="password"
              value={keys.nvidia}
              onChange={(e) => setKeys({...keys, nvidia: e.target.value})}
              placeholder="nvapi-..."
              className="w-full bg-black/40 border border-emerald-500/20 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50 font-mono transition-colors"
            />
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40">
            <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">Google Gemini API Key</label>
            <p className="text-xs text-neutral-500 mb-4">Fallback for content generation and strategy synthesis. (Gemini 2.0 Flash — free tier)</p>
            <input 
              type="password"
              value={keys.gemini}
              onChange={(e) => setKeys({...keys, gemini: e.target.value})}
              placeholder="AIzaSy..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500/50 font-mono transition-colors"
            />
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40">
            <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">Tavily Search API Key</label>
            <p className="text-xs text-neutral-500 mb-4">Required for real-time web scraping, competitor reconnaissance, and SEO audits.</p>
            <input 
              type="password"
              value={keys.tavily}
              onChange={(e) => setKeys({...keys, tavily: e.target.value})}
              placeholder="tvly-..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500/50 font-mono transition-colors"
            />
          </div>



          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40">
            <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">Anthropic (Claude) API Key</label>
            <p className="text-xs text-neutral-500 mb-4">Link Claude 3.5 Sonnet for elite coding and structural analysis tasks.</p>
            <input 
              type="password"
              value={keys.anthropic}
              onChange={(e) => setKeys({...keys, anthropic: e.target.value})}
              placeholder="sk-ant-..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500/50 font-mono transition-colors"
            />
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40">
            <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">xAI (Grok) API Key</label>
            <p className="text-xs text-neutral-500 mb-4">Plug into Grok specifically for real-time Twitter/X sentiment and scraping synthesis.</p>
            <input 
              type="password"
              value={keys.grok}
              onChange={(e) => setKeys({...keys, grok: e.target.value})}
              placeholder="xai-..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500/50 font-mono transition-colors"
            />
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-electric/20 bg-electric/5">
            <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2 flex items-center gap-2">
              Ollama Local Node <span className="text-[10px] bg-electric/20 text-electric px-2 py-0.5 rounded uppercase tracking-wider">Zero-Cost AI</span>
            </label>
            <p className="text-xs text-neutral-500 mb-4">Run the SOVEREIGN Swarm entirely offline using your own GPU. Enter your local endpoint (e.g. http://localhost:11434). If provided, this overrides Gemini.</p>
            <input 
              type="url"
              value={keys.ollama || ""}
              onChange={(e) => setKeys({...keys, ollama: e.target.value})}
              placeholder="http://localhost:11434"
              className="w-full bg-black/40 border border-electric/20 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-electric/50 font-mono transition-colors"
            />
          </div>

          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
                message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              {message.text}
            </motion.div>
          )}

          <div className="flex justify-end pt-4">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold uppercase tracking-widest text-sm hover:shadow-[0_0_30px_rgba(244,63,94,0.3)] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Keys</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
