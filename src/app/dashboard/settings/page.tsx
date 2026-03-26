"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings, Key, Eye, EyeOff, Save, CheckCircle2,
  AlertTriangle, Loader2, Shield, Cpu, Search, Database, Bot,
} from "lucide-react";

const API_KEY_FIELDS = [
  {
    key: "gemini",
    label: "Google Gemini API Key",
    desc: "Powers all AI text generation (get free at ai.google.dev)",
    icon: Cpu,
    color: "text-blue-400",
    placeholder: "AIzaSy...",
  },
  {
    key: "anthropic",
    label: "Anthropic Claude API Key",
    desc: "Advanced reasoning engine (optional, for Claude-powered tools)",
    icon: Bot,
    color: "text-orange-400",
    placeholder: "sk-ant-...",
  },
  {
    key: "tavily",
    label: "Tavily API Key",
    desc: "Live web search for SEO X-Ray & competitor research (tavily.com)",
    icon: Search,
    color: "text-purple-400",
    placeholder: "tvly-...",
  },
  {
    key: "pinecone_key",
    label: "Pinecone API Key",
    desc: "AI memory — stores context across sessions (optional)",
    icon: Database,
    color: "text-emerald-400",
    placeholder: "pcsk_...",
  },
  {
    key: "pinecone_index",
    label: "Pinecone Index Name",
    desc: "Name of your Pinecone index for memory storage",
    icon: Database,
    color: "text-emerald-400",
    placeholder: "sovereign-memory",
  },
];

export default function SettingsPage() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [masked, setMasked] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "load" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMasked(data.masked || {});
          setStatus(data.status || {});
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const keysToSave: Record<string, string> = {};
    for (const [k, v] of Object.entries(keys)) {
      if (v.trim()) keysToSave[k] = v.trim();
    }
    if (Object.keys(keysToSave).length === 0) return;

    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", settings: keysToSave }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus("success");
        const reloadRes = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "load" }),
        });
        const reloadData = await reloadRes.json();
        if (reloadData.success) {
          setMasked(reloadData.masked || {});
          setStatus(reloadData.status || {});
        }
        setKeys({});
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const toggleShow = (key: string) => {
    setShowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getFieldStatus = (key: string) => {
    if (keys[key]?.trim()) return "new";
    if (masked[key]) return "saved";
    if (status[key]) return "active";
    return "empty";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#00B7FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-[#00B7FF] text-xs font-bold uppercase tracking-wider mb-3">
          <Shield className="w-3 h-3" /> Secure Settings
        </div>
        <h1 className="text-3xl font-bold font-mono text-white tracking-tight">
          API Keys &amp; Configuration
        </h1>
        <p className="text-sm text-[#8A95A5] mt-2 font-mono uppercase tracking-widest">
          Your keys are encrypted and stored securely. Only you can access them.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card border border-emerald-500/20 p-4 mb-8 flex items-start gap-3"
      >
        <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-emerald-400 mb-1">Your keys are safe</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Keys are stored per-user in Neon Postgres, masked on display (first 4 + last 4 chars only),
            and never logged. Used server-side only — never exposed to the browser.
            SOVEREIGN uses platform defaults if you don&apos;t set your own.
          </p>
        </div>
      </motion.div>

      <div className="space-y-4">
        {API_KEY_FIELDS.map((field, i) => {
          const fieldStatus = getFieldStatus(field.key);
          return (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card border border-glass-border p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <field.icon className={`w-4 h-4 ${field.color}`} />
                  <div>
                    <h3 className="text-sm font-bold text-white">{field.label}</h3>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{field.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {fieldStatus === "saved" || fieldStatus === "active" ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" /> Connected
                    </span>
                  ) : fieldStatus === "new" ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      <Key className="w-3 h-3" /> Unsaved
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                      <AlertTriangle className="w-3 h-3" /> Not Set
                    </span>
                  )}
                </div>
              </div>

              <div className="relative">
                <input
                  type={showKeys.has(field.key) ? "text" : "password"}
                  value={keys[field.key] || ""}
                  onChange={(e) => setKeys((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={masked[field.key] || field.placeholder}
                  className="w-full bg-black/60 border border-[#00B7FF]/10 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-neutral-600 focus:outline-none focus:border-[#00B7FF]/30 focus:ring-1 focus:ring-[#00B7FF]/20 transition-gpu pr-10"
                />
                <button
                  onClick={() => toggleShow(field.key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                >
                  {showKeys.has(field.key) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 flex items-center gap-4"
      >
        <button
          onClick={handleSave}
          disabled={saving || Object.values(keys).every((v) => !v?.trim())}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00B7FF] to-purple-500 text-white font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-gpu disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save API Keys"}
        </button>

        {saveStatus === "success" && (
          <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4" /> Saved securely
          </motion.span>
        )}
        {saveStatus === "error" && (
          <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1 text-xs text-rose-400 font-bold">
            <AlertTriangle className="w-4 h-4" /> Failed to save
          </motion.span>
        )}
      </motion.div>

      <div className="mt-8 p-4 rounded-xl bg-white/[0.02] border border-white/5">
        <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">
          <Settings className="w-3 h-3 inline mr-1" /> How it works
        </h4>
        <ul className="space-y-1 text-xs text-neutral-500">
          <li>• Your keys override the platform defaults for your account only</li>
          <li>• If you don&apos;t set a key, SOVEREIGN uses its shared platform keys</li>
          <li>• Keys are stored in Neon Postgres, encrypted at rest</li>
          <li>• You can remove a key by saving an empty value</li>
        </ul>
      </div>
    </div>
  );
}
