"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
  Search,
  Target,
  Code2,
  MapPin,
  Loader2,
  CheckCircle2,
  Crosshair,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { useUsage } from "@/hooks/useUsage";

type SEOAction = "xray" | "gap" | "schema" | "gbp";

const ACTIONS: {
  id: SEOAction;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
  fields: { name: string; label: string; placeholder: string; type?: string }[];
}[] = [
  {
    id: "xray",
    label: "Competitor X-Ray",
    description: "Deep-scan competitor websites for SEO weaknesses and ranking signals.",
    icon: Crosshair,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    fields: [
      { name: "urls", label: "Competitor URLs (comma-separated)", placeholder: "https://competitor1.com, https://competitor2.com" },
      { name: "business", label: "Your Business Description", placeholder: "AI-powered marketing automation platform" },
    ],
  },
  {
    id: "gap",
    label: "Content Gap Killer",
    description: "Find keywords your competitors rank for that you don't — then dominate them.",
    icon: Target,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    fields: [
      { name: "domain", label: "Your Domain", placeholder: "yourdomain.com" },
      { name: "competitors", label: "Competitor Domains (comma-separated)", placeholder: "competitor1.com, competitor2.com" },
      { name: "niche", label: "Your Niche", placeholder: "biohacking, functional fitness" },
    ],
  },
  {
    id: "schema",
    label: "Schema Audit",
    description: "Generate missing JSON-LD structured data to unlock rich search results.",
    icon: Code2,
    color: "text-[#00B7FF]",
    bg: "bg-[#00B7FF]/10",
    border: "border-[#00B7FF]/20",
    fields: [
      { name: "url", label: "Website URL", placeholder: "https://yoursite.com" },
      { name: "businessType", label: "Business Type", placeholder: "SaaS, LocalBusiness, E-commerce, Agency" },
    ],
  },
  {
    id: "gbp",
    label: "GBP Hijack",
    description: "Generate 10 buyer-intent Google Business Profile posts for local domination.",
    icon: MapPin,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    fields: [
      { name: "business", label: "Business Name", placeholder: "The Clarity Protocol" },
      { name: "location", label: "City / Area", placeholder: "Cape Town, Durbanville" },
      { name: "services", label: "Core Services", placeholder: "biohacking coaching, functional fitness, cold plunge therapy" },
    ],
  },
];

export default function SEODominatorPage() {
  const [activeAction, setActiveAction] = useState<SEOAction | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { canGenerate, refresh: refreshUsage } = useUsage();

  const handleExecute = async () => {
    if (!activeAction) return;
    if (!canGenerate) return;
    setLoading(true);
    setResult(null);
    setError(null);

    const action = ACTIONS.find((a) => a.id === activeAction)!;
    const params: Record<string, string | string[]> = {};

    for (const field of action.fields) {
      const val = formData[field.name] || "";
      if (!val.trim()) {
        setError(`Please fill in "${field.label}"`);
        setLoading(false);
        return;
      }
      if (field.name === "urls" || field.name === "competitors") {
        params[field.name] = val.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        params[field.name] = val;
      }
    }

    try {
      const res = await fetch("/api/agents/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: activeAction, params }),
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
            tool: "seo-dominator",
            toolAction: activeAction,
            inputSummary: `${activeAction}: ${formData[action.fields[0]?.name] || ""}`.slice(0, 200),
            output,
          }),
        }).catch(() => {}); // Silent — don't block UI
        refreshUsage(); // Update usage counter
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(`Connection failed: ${msg}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 relative z-10 p-4 lg:p-8" role="main" aria-label="SEO domination tools">
      {/* Header */}
      <div className="border-b border-rose-500/20 pb-6 backdrop-blur-3xl bg-black/40 p-6 rounded-2xl shadow-[0_0_50px_rgba(244,63,94,0.05)] border-t border-rose-500/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <Search className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-2xl font-light text-white tracking-widest font-mono">
              SEO DOMINATION
            </h2>
            <p className="text-neutral-400 text-xs tracking-widest uppercase">
              Autonomous search engine intelligence & exploitation
            </p>
          </div>
        </div>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            className="bg-black/60 backdrop-blur-3xl border border-[#00B7FF]/20 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-4 h-4 text-[#00B7FF]" />
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#00B7FF] font-bold">
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
                    type={field.type || "text"}
                    placeholder={field.placeholder}
                    value={formData[field.name] || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    className="w-full bg-black/60 border border-[#00B7FF]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#00B7FF]/50 transition-colors font-mono"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleExecute}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-bold text-xs uppercase tracking-widest hover:from-rose-500 hover:to-rose-400 transition-gpu disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(244,63,94,0.3)]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Executing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> Execute
                </>
              )}
            </button>
          </motion.div>
        )}
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
            className="bg-black/60 backdrop-blur-3xl border border-emerald-500/20 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            aria-live="polite"
          >
            <div className="bg-[#0a0a0a]/80 border-b border-emerald-500/20 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] uppercase tracking-[0.3em] text-emerald-400 font-mono">
                  Intelligence Report
                </span>
              </div>
              <ExportButtons content={result || ""} filename="umbra-seo-report" />
            </div>
            <div className="p-6 max-h-[600px] overflow-y-auto custom-scrollbar">
              <MarkdownRenderer content={result || ""} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!result && !error && !loading && !activeAction && (
        <div className="text-center py-16">
          <Search className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">Select a tool above to get started</p>
          <p className="text-[10px] text-neutral-500 mt-1">Choose X-Ray, Gap Killer, Schema Audit, or GBP Hijack</p>
        </div>
      )}
    </div>
  );
}
