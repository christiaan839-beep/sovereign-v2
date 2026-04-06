"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2, CheckCircle2, Copy, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

/**
 * EMBEDDED DEMO — Runs a real agent on the landing page without signup.
 * Uses the /api/free/run proxy (rate-limited to 3/hour/IP).
 * Shows streaming-style progressive output.
 */

const DEMO_PROMPTS = [
  { label: "Find SaaS leads in Austin", agent: "leads", params: { niche: "SaaS", location: "Austin, TX" } },
  { label: "Audit SEO for stripe.com", agent: "seo-dominator", params: { domain: "stripe.com", mode: "audit" } },
  { label: "Scan competitor: hubspot.com", agent: "competitor-scan", params: { target: "hubspot.com" } },
];

export function EmbeddedDemo() {
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const runDemo = async (index: number) => {
    const demo = DEMO_PROMPTS[index];
    setSelected(index);
    setLoading(true);
    setResult("");
    setDone(false);
    setError("");

    try {
      const res = await fetch("/api/free/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: demo.agent, params: demo.params }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Demo temporarily unavailable");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const fullText = JSON.stringify(data, null, 2)
        .replace(/"_meta":\s*\{[^}]+\}/g, "") // Remove meta
        .replace(/"_free":\s*\{[^}]+\}/g, "") // Remove free tier info
        .trim();

      // Progressive reveal (simulate streaming)
      const words = fullText.split(/(\s+)/);
      let displayed = "";
      for (let i = 0; i < words.length; i += 3) {
        displayed += words.slice(i, i + 3).join("");
        setResult(displayed);
        await new Promise(r => setTimeout(r, 15));
      }
      setResult(fullText);
      setDone(true);
    } catch {
      setError("Connection error. Try again.");
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#060606] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white">Live Demo</span>
          <span className="text-[9px] text-neutral-600">— no signup required</span>
        </div>
        {done && (
          <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-white transition-colors">
            {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      {/* Demo Buttons */}
      <div className="px-5 py-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {DEMO_PROMPTS.map((demo, i) => (
            <button
              key={i}
              onClick={() => runDemo(i)}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selected === i
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-white/[0.04] text-neutral-400 border border-white/[0.06] hover:border-white/[0.12] hover:text-white"
              } disabled:opacity-50`}
            >
              {loading && selected === i ? (
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Running...</span>
              ) : (
                <span className="flex items-center gap-1"><Play className="w-3 h-3" /> {demo.label}</span>
              )}
            </button>
          ))}
        </div>

        {/* Output */}
        <div className="min-h-[120px] max-h-[300px] overflow-y-auto rounded-lg bg-[#0A0A0A] border border-white/[0.04] p-4">
          {!result && !error && !loading && (
            <p className="text-xs text-neutral-600 text-center py-8">
              Click a demo above to run a real AI agent — no signup needed
            </p>
          )}

          {loading && !result && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              Running agent...
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 text-center py-8">{error}</p>
          )}

          <AnimatePresence>
            {result && (
              <motion.pre
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[11px] text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed"
              >
                {result}
                {loading && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6 }}
                    className="inline-block w-1.5 h-3.5 bg-emerald-400 ml-0.5 align-middle"
                  />
                )}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>

        {/* CTA */}
        {done && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-sm transition-colors"
            >
              Get Full Access — 129 Agents <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[10px] text-neutral-600 mt-2">Free tier: 50 runs/month. No credit card.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
