"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Layout,
  Smartphone,
  Loader2,
  Copy,
  CheckCircle2,
  Zap,
  Sparkles,
} from "lucide-react";
import { useUsage } from "@/hooks/useUsage";

type DesignAction = "landing-page" | "brand-identity" | "ui-spec";

const ACTIONS: {
  id: DesignAction;
  label: string;
  description: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  fields: { name: string; label: string; placeholder: string }[];
}[] = [
  {
    id: "landing-page",
    label: "Landing Page Brief",
    description: "Generate a full wireframe spec with sections, copy hierarchy, CTAs, and design system. Swarm-refined.",
    icon: Layout,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    fields: [
      { name: "product", label: "Product / Service", placeholder: "AI-powered marketing automation platform" },
      { name: "audience", label: "Target Audience", placeholder: "SaaS founders, agency owners, solo marketers" },
      { name: "goal", label: "Primary Goal", placeholder: "conversions, signups, bookings" },
    ],
  },
  {
    id: "brand-identity",
    label: "Brand Identity",
    description: "Create a complete brand system: colors, typography, tone of voice, imagery guidelines. Swarm-refined.",
    icon: Palette,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    fields: [
      { name: "businessName", label: "Business Name", placeholder: "The Clarity Protocol" },
      { name: "industry", label: "Industry", placeholder: "Health & biohacking coaching" },
      { name: "personality", label: "Brand Personality", placeholder: "elite, minimalist, scientific, authoritative" },
      { name: "targetAudience", label: "Target Audience (optional)", placeholder: "High-achievers, 25-45, urban professionals" },
    ],
  },
  {
    id: "ui-spec",
    label: "UI/UX Spec",
    description: "Generate detailed screen-by-screen specifications with component hierarchies and interaction patterns.",
    icon: Smartphone,
    color: "text-[#00B7FF]",
    bg: "bg-[#00B7FF]/10",
    border: "border-[#00B7FF]/20",
    fields: [
      { name: "appDescription", label: "App Description", placeholder: "Autonomous marketing dashboard with live swarm feeds and client management" },
      { name: "screens", label: "Screens (comma-separated)", placeholder: "Dashboard, Client Portal, Analytics, Settings" },
      { name: "style", label: "Design Style", placeholder: "dark glassmorphic, minimalist, vibrant" },
    ],
  },
];

export default function DesignerPage() {
  const [activeAction, setActiveAction] = useState<DesignAction | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { canGenerate, refresh: refreshUsage } = useUsage();

  const handleExecute = async () => {
    if (!activeAction || !canGenerate) return;
    setLoading(true);
    setResult(null);

    const action = ACTIONS.find((a) => a.id === activeAction)!;
    const params: Record<string, any> = {};

    for (const field of action.fields) {
      const val = formData[field.name] || "";
      if (field.name === "screens") {
        params[field.name] = val.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        params[field.name] = val;
      }
    }

    try {
      const res = await fetch("/api/agents/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: activeAction, params }),
      });
      const data = await res.json();
      const output = data.output || data.error || JSON.stringify(data, null, 2);
      setResult(output);
      // Auto-save to library
      fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          tool: "designer",
          toolAction: activeAction,
          inputSummary: `${activeAction}: ${formData[action.fields[0]?.name] || ""}`.slice(0, 200),
          output,
        }),
      }).catch(() => {});
      refreshUsage();
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 relative z-10 p-4 lg:p-8" role="main" aria-label="Design agency tools">
      {/* Header */}
      <div className="border-b border-violet-500/20 pb-6 backdrop-blur-3xl bg-black/40 p-6 rounded-2xl shadow-[0_0_50px_rgba(139,92,246,0.05)] border-t border-violet-500/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-2xl font-light text-white tracking-widest font-mono">
              DESIGN AGENCY
            </h2>
            <p className="text-neutral-400 text-xs tracking-widest uppercase">
              AI-powered brand identity, wireframes & UI/UX specification
            </p>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ACTIONS.map((action) => (
          <motion.button
            key={action.id}
            onClick={() => {
              setActiveAction(action.id);
              setResult(null);
              setFormData({});
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`text-left p-6 rounded-2xl border transition-gpu ${
              activeAction === action.id
                ? `${action.bg} ${action.border} border shadow-[0_0_30px_rgba(0,0,0,0.5)]`
                : "bg-black/40 border-[#00B7FF]/10 hover:border-[#00B7FF]/30"
            } backdrop-blur-2xl`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-lg ${action.bg} border ${action.border} flex items-center justify-center`}>
                <action.icon className={`w-4 h-4 ${action.color}`} />
              </div>
              <h3 className="text-sm font-bold text-white tracking-wider uppercase">
                {action.label}
              </h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {action.description}
            </p>
          </motion.button>
        ))}
      </div>

      {/* Active Action Panel */}
      <AnimatePresence mode="wait">
        {activeAction && (
          <motion.div
            key={activeAction}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-black/60 backdrop-blur-3xl border border-violet-500/20 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-4 h-4 text-violet-400" />
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-violet-400 font-bold">
                {ACTIONS.find((a) => a.id === activeAction)?.label} — Configure
              </h3>
            </div>

            <div className="space-y-4 mb-6">
              {ACTIONS.find((a) => a.id === activeAction)?.fields.map((field) => (
                <div key={field.name}>
                  <label className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-2 block">
                    {field.label}
                  </label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={formData[field.name] || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    className="w-full bg-black/60 border border-violet-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-violet-500/50 transition-colors font-mono"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleExecute}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-bold text-xs uppercase tracking-widest hover:from-violet-500 hover:to-pink-400 transition-gpu disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(139,92,246,0.3)]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Generate
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Panel */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/60 backdrop-blur-3xl border border-violet-500/20 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            aria-live="polite"
          >
            <div className="bg-[#0a0a0a]/80 border-b border-violet-500/20 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-violet-400" />
                <span className="text-[9px] uppercase tracking-[0.3em] text-violet-400 font-mono">
                  Design Output
                </span>
              </div>
              <button
                onClick={handleCopy}
                aria-label={copied ? "Copied to clipboard" : "Copy design output"}
                className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
              >
                {copied ? (
                  <CheckCircle2 className="w-3 h-3 text-violet-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="p-6 max-h-[600px] overflow-y-auto">
              <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">
                {result}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
