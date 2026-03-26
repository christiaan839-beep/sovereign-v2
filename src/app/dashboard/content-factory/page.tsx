"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
  FileText,
  Mail,
  Share2,
  Video,
  Loader2,
  CheckCircle2,
  Zap,
  Factory,
  AlertTriangle,
} from "lucide-react";
import { useUsage } from "@/hooks/useUsage";

type ContentAction = "blog" | "email" | "social" | "video";

const TABS: {
  id: ContentAction;
  label: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  fields: { name: string; label: string; placeholder: string }[];
}[] = [
  {
    id: "blog",
    label: "Blog Post",
    icon: FileText,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    fields: [
      { name: "topic", label: "Topic", placeholder: "The Complete Guide to Cold Plunge Recovery" },
      { name: "keywords", label: "Keywords (comma-separated)", placeholder: "cold plunge benefits, ice bath recovery, cold therapy" },
      { name: "tone", label: "Tone", placeholder: "authoritative, conversational, scientific" },
    ],
  },
  {
    id: "email",
    label: "Email Sequence",
    icon: Mail,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    fields: [
      { name: "product", label: "Product / Offer", placeholder: "The Clarity Protocol — 12-week biohacking coaching" },
      { name: "audience", label: "Target Audience", placeholder: "High-achievers, 25-45, seeking peak performance" },
      { name: "steps", label: "Number of Emails", placeholder: "5" },
    ],
  },
  {
    id: "social",
    label: "Social Pack",
    icon: Share2,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    fields: [
      { name: "topic", label: "Topic / Theme", placeholder: "Morning biohacking routine for entrepreneurs" },
      { name: "platforms", label: "Platforms (comma-separated)", placeholder: "instagram, linkedin, twitter, tiktok" },
    ],
  },
  {
    id: "video",
    label: "Video Script",
    icon: Video,
    color: "text-[#00B7FF]",
    bg: "bg-[#00B7FF]/10",
    border: "border-[#00B7FF]/20",
    fields: [
      { name: "topic", label: "Video Topic", placeholder: "Why 90% of people quit cold plunges wrong" },
      { name: "duration", label: "Duration", placeholder: "60 seconds, 3 minutes, 10 minutes" },
      { name: "style", label: "Style", placeholder: "educational, motivational, behind-the-scenes" },
    ],
  },
];

export default function ContentFactoryPage() {
  const [activeTab, setActiveTab] = useState<ContentAction>("blog");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { canGenerate, refresh: refreshUsage } = useUsage();

  const handleExecute = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    if (!canGenerate) {
      setError("Daily limit reached (20/day). Upgrade to Pro for unlimited.");
      setLoading(false);
      return;
    }

    const tab = TABS.find((t) => t.id === activeTab)!;
    const params: Record<string, string | string[] | number> = {};

    for (const field of tab.fields) {
      const val = formData[field.name] || "";
      if (!val.trim()) {
        setError(`Please fill in "${field.label}"`);
        setLoading(false);
        return;
      }
      if (field.name === "keywords" || field.name === "platforms") {
        params[field.name] = val.split(",").map((s) => s.trim()).filter(Boolean);
      } else if (field.name === "steps") {
        params[field.name] = parseInt(val) || 5;
      } else {
        params[field.name] = val;
      }
    }

    try {
      const res = await fetch("/api/agents/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: activeTab, params }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `Request failed (${res.status})`);
      } else {
        const output = data.output || JSON.stringify(data, null, 2);
        setResult(output);
        // Auto-save to library
        fetch("/api/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save",
            tool: "content-factory",
            toolAction: activeTab,
            inputSummary: `${activeTab}: ${formData[tab.fields[0]?.name] || ""}`.slice(0, 200),
            output,
          }),
        }).catch(() => {}); // Silent
        refreshUsage();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(`Connection failed: ${msg}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 relative z-10 p-4 lg:p-8">
      {/* Header */}
      <div className="border-b border-[#00B7FF]/20 pb-6 backdrop-blur-3xl bg-black/40 p-6 rounded-2xl shadow-[0_0_50px_rgba(0,183,255,0.05)] border-t border-[#00B7FF]/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#00B7FF]/10 border border-[#00B7FF]/30 flex items-center justify-center">
            <Factory className="w-5 h-5 text-[#00B7FF]" />
          </div>
          <div>
            <h2 className="text-2xl font-light text-white tracking-widest font-mono">
              CONTENT FACTORY
            </h2>
            <p className="text-neutral-400 text-xs tracking-widest uppercase">
              AI-powered content production at infinite scale
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-[#00B7FF]/10 backdrop-blur-xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setResult(null);
              setFormData({});
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-gpu flex-1 justify-center ${
              activeTab === tab.id
                ? `${tab.bg} ${tab.color} ${tab.border} border`
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-black/60 backdrop-blur-3xl border border-[#00B7FF]/20 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-4 h-4 text-[#00B7FF]" />
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#00B7FF] font-bold">
              {TABS.find((t) => t.id === activeTab)?.label} Generator
            </h3>
          </div>

          <div className="space-y-4 mb-6">
            {TABS.find((t) => t.id === activeTab)?.fields.map((field) => (
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
                  className="w-full bg-black/60 border border-[#00B7FF]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#00B7FF]/50 transition-colors font-mono"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleExecute}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00B7FF] to-[#0090CC] text-white font-bold text-xs uppercase tracking-widest hover:from-[#00B7FF]/90 hover:to-[#0090CC]/90 transition-gpu disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(0,183,255,0.3)]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Producing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" /> Produce Content
              </>
            )}
          </button>
        </motion.div>
      </AnimatePresence>


      {/* Error State */}
      <AnimatePresence>
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-black/60 backdrop-blur-3xl border border-rose-500/20 rounded-2xl overflow-hidden p-6 text-center"
          >
            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Something went wrong</h3>
            <p className="text-xs text-neutral-400 mb-4 max-w-sm mx-auto">{error}</p>
            <button
              onClick={() => { setError(null); handleExecute(); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider hover:bg-rose-500/20 transition-gpu"
            >
              Try Again
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
            className="bg-black/60 backdrop-blur-3xl border border-[#00B7FF]/20 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            <div className="bg-[#0a0a0a]/80 border-b border-[#00B7FF]/20 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-[#00B7FF]" />
                <span className="text-[9px] uppercase tracking-[0.3em] text-[#00B7FF] font-mono">
                  Content Output
                </span>
              </div>
              <ExportButtons content={result || ""} filename="umbra-content" />
            </div>
            <div className="p-6 max-h-[600px] overflow-y-auto custom-scrollbar">
              <MarkdownRenderer content={result || ""} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!result && !error && !loading && (
        <div className="text-center py-16">
          <Factory className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">Select a content type above to get started</p>
          <p className="text-[10px] text-neutral-600 mt-1">Blog posts, email sequences, social packs, or video scripts</p>
        </div>
      )}
    </div>
  );
}
