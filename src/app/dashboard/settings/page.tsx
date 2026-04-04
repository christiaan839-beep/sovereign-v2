"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Settings, Key, Eye, EyeOff, Save, CheckCircle2,
  AlertTriangle, Loader2, Shield, Cpu, Search, Database, Bot,
  RefreshCw, CreditCard, Zap, Globe,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

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
    key: "openai",
    label: "OpenAI API Key",
    desc: "GPT models for text generation and embeddings (optional)",
    icon: Zap,
    color: "text-green-400",
    placeholder: "sk-...",
  },
  {
    key: "nvidia_nim",
    label: "NVIDIA NIM API Key",
    desc: "Access NIM models for inference, embeddings, and reranking",
    icon: Cpu,
    color: "text-lime-400",
    placeholder: "nvapi-...",
  },
  {
    key: "groq",
    label: "Groq API Key",
    desc: "Ultra-fast inference for Llama, Mixtral, and Gemma models",
    icon: Zap,
    color: "text-cyan-400",
    placeholder: "gsk_...",
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load" }),
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      if (data.success) {
        setMasked(data.masked || {});
        setStatus(data.status || {});
      } else {
        throw new Error("Failed to load settings");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load settings";
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
        // Reload to get fresh masked values
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

  /* ── Loading Skeleton ── */
  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6" aria-busy="true" aria-label="Loading settings">
        <div className="space-y-3 mb-8">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton variant="circle" className="w-4 h-4" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  /* ── Error State ── */
  if (loadError) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">
            Could not load settings
          </h2>
          <p className="text-sm text-neutral-400 mb-6 max-w-md">
            {loadError}. This might be a temporary issue.
          </p>
          <button
            onClick={loadSettings}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black font-semibold rounded-xl text-sm hover:bg-neutral-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto" role="region" aria-label="API keys and configuration settings">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-[#00B7FF] text-xs font-bold uppercase tracking-wider mb-3">
          <Shield className="w-3 h-3" /> Secure Settings
        </div>
        <h1 className="text-3xl font-bold font-mono text-white tracking-tight">
          API Keys &amp; Configuration
        </h1>
        <p className="text-sm text-neutral-400 mt-2 font-mono uppercase tracking-widest">
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
          <h3 className="text-sm font-bold text-emerald-400 mb-1">
            Your keys are safe
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Keys are stored per-user in Neon Postgres, masked on display (first
            4 + last 4 chars only), and never logged. Used server-side only —
            never exposed to the browser. SOVEREIGN uses platform defaults if you
            don&apos;t set your own.
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
                    <h3 className="text-sm font-bold text-white">
                      {field.label}
                    </h3>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {field.desc}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {fieldStatus === "saved" || fieldStatus === "active" ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" /> Configured
                    </span>
                  ) : fieldStatus === "new" ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      <Key className="w-3 h-3" /> Unsaved
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                      <AlertTriangle className="w-3 h-3" /> Not Configured
                    </span>
                  )}
                </div>
              </div>

              <div className="relative">
                <input
                  type={showKeys.has(field.key) ? "text" : "password"}
                  value={keys[field.key] || ""}
                  onChange={(e) =>
                    setKeys((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={masked[field.key] || field.placeholder}
                  aria-label={field.label}
                  className="w-full bg-black/60 border border-[#00B7FF]/10 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-neutral-500 focus:outline-none focus:border-[#00B7FF]/30 focus:ring-1 focus:ring-[#00B7FF]/20 transition-gpu pr-10"
                />
                <button
                  onClick={() => toggleShow(field.key)}
                  aria-label={
                    showKeys.has(field.key)
                      ? `Hide ${field.label}`
                      : `Show ${field.label}`
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
                >
                  {showKeys.has(field.key) ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
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
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : "Save API Keys"}
        </button>

        {saveStatus === "success" && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1 text-xs text-emerald-400 font-bold"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="w-4 h-4" /> Saved securely
          </motion.span>
        )}
        {saveStatus === "error" && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1 text-xs text-rose-400 font-bold"
            role="alert"
            aria-live="polite"
          >
            <AlertTriangle className="w-4 h-4" /> Failed to save — please try
            again
          </motion.span>
        )}
      </motion.div>

      {/* Empty state: no keys configured at all */}
      {API_KEY_FIELDS.every((f) => getFieldStatus(f.key) === "empty") && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center py-8 rounded-xl border border-white/5 bg-white/[0.01]"
        >
          <Key className="w-6 h-6 text-neutral-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">
            No API keys configured
          </h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Sovereign uses shared platform keys by default. Add your own keys
            above for higher rate limits and custom model access.
          </p>
        </motion.div>
      )}

      <div className="mt-8 p-4 rounded-xl bg-white/[0.02] border border-white/5">
        <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
          <Settings className="w-3 h-3 inline mr-1" /> How it works
        </h4>
        <ul className="space-y-1 text-xs text-neutral-400">
          <li>
            Your keys override the platform defaults for your account only
          </li>
          <li>
            If you don&apos;t set a key, SOVEREIGN uses its shared platform keys
          </li>
          <li>Keys are stored in Neon Postgres, encrypted at rest</li>
          <li>You can remove a key by saving an empty value</li>
        </ul>
      </div>

      {/* Provider Status Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-6 p-5 rounded-2xl border border-white/5 bg-white/[0.02]"
      >
        <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
          <Globe className="w-3 h-3 inline mr-1" /> Provider Summary
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {API_KEY_FIELDS.filter((f) => f.key !== "pinecone_index").map((field) => {
            const s = getFieldStatus(field.key);
            const configured = s === "saved" || s === "active";
            return (
              <div
                key={field.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  configured
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-white/5 bg-white/[0.01]"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    configured ? "bg-emerald-500" : "bg-neutral-600"
                  }`}
                />
                <span className="text-[11px] text-neutral-300 truncate">
                  {field.label.replace(" API Key", "").replace(" Name", "")}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Billing & Payment Link */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6 mb-8"
      >
        <Link
          href="/dashboard/billing"
          className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.03] transition-gpu group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                Billing & Payments
              </h4>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                Manage your subscription, view usage, and update payment methods
              </p>
            </div>
          </div>
          <span className="text-xs text-neutral-500 group-hover:text-neutral-300 transition-colors">
            Manage →
          </span>
        </Link>
      </motion.div>
    </div>
  );
}
