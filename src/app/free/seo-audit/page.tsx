"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, ArrowRight, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import Link from "next/link";

/**
 * FREE SEO AUDIT — Public tool page for organic traffic.
 * No signup required for basic audit. Full report requires account.
 * Target keywords: "free seo audit", "seo checker", "website seo analysis"
 */

interface AuditResult {
  domain: string;
  seo_intelligence: {
    domain_authority_estimate?: string | number;
    keyword_gaps?: Array<{ keyword: string; opportunity: string }>;
    technical_issues?: string[];
    content_strategy?: { strengths?: string[]; weaknesses?: string[]; recommended_topics?: string[] };
    dominance_score?: string | number;
  };
  serpDataAvailable: boolean;
}

export default function FreeSeoAuditPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [emailCaptured, setEmailCaptured] = useState(false);

  const runAudit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const domain = url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const res = await fetch("/api/free/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: "seo-dominator",
          email: email.trim() || undefined, // optional — see ADR-0001
          params: { domain, mode: "audit" },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Audit failed. Try again.");
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const captureEmail = () => {
    if (!email.includes("@")) return;
    setEmailCaptured(true);
    // Fire to API for lead capture
    fetch("/api/_misc/email/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "free-seo-audit", domain: url }),
    }).catch(() => {});
  };

  const intel = result?.seo_intelligence;

  return (
    <div className="min-h-screen bg-[#030303]">
      {/* SEO Meta */}
      <title>Free SEO Audit Tool | Sovereign Matrix</title>

      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white">Sovereign Matrix</Link>
          <Link href="/signup" className="text-xs text-emerald-400 hover:text-emerald-300">
            Sign up for full access →
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Free SEO Audit
          </h1>
          <p className="text-neutral-400 max-w-lg mx-auto">
            Enter any URL and get an instant SEO analysis powered by AI.
            Keyword gaps, technical issues, and content strategy — in seconds.
          </p>
        </div>

        {/* Input */}
        <div className="flex flex-col gap-3 mb-2">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAudit()}
                placeholder="Enter a website URL (e.g., competitor.com)"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-emerald-500/30 transition-colors"
              />
            </div>
            <button
              onClick={runAudit}
              disabled={loading || !url.trim()}
              className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Analyzing..." : "Audit"}
            </button>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional — 10 audits/hr instead of 3)"
            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-neutral-300 placeholder-neutral-600 text-xs focus:outline-none focus:border-emerald-500/20 transition-colors"
          />
        </div>
        <div className="mb-8" />

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {result && intel && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Score Card */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">{result.domain}</h2>
                <div className="text-2xl font-bold text-emerald-400">
                  {intel.dominance_score || "—"}<span className="text-sm text-neutral-500">/100</span>
                </div>
              </div>
              {!result.serpDataAvailable && (
                <p className="text-xs text-amber-400/70 mb-3">Live SERP data unavailable — results based on domain analysis</p>
              )}
            </div>

            {/* Keyword Gaps */}
            {intel.keyword_gaps && intel.keyword_gaps.length > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
                <h3 className="text-sm font-semibold text-white mb-3">Keyword Gaps</h3>
                <div className="space-y-2">
                  {intel.keyword_gaps.slice(0, 3).map((gap, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-white font-medium">{gap.keyword}</span>
                        <span className="text-neutral-500 ml-2">{gap.opportunity}</span>
                      </div>
                    </div>
                  ))}
                  {intel.keyword_gaps.length > 3 && (
                    <div className="flex items-center gap-2 text-sm text-neutral-500 pt-2">
                      <Lock className="w-3.5 h-3.5" />
                      +{intel.keyword_gaps.length - 3} more keyword gaps — sign up for full report
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Technical Issues (preview) */}
            {intel.technical_issues && intel.technical_issues.length > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
                <h3 className="text-sm font-semibold text-white mb-3">Technical Issues</h3>
                <div className="space-y-2">
                  {intel.technical_issues.slice(0, 2).map((issue, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-neutral-400">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      {issue}
                    </div>
                  ))}
                  {intel.technical_issues.length > 2 && (
                    <div className="flex items-center gap-2 text-sm text-neutral-500 pt-2">
                      <Lock className="w-3.5 h-3.5" />
                      +{intel.technical_issues.length - 2} more issues — sign up for full report
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Email Capture CTA */}
            {!emailCaptured ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
                <h3 className="text-sm font-semibold text-white mb-2">Get the full report</h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Enter your email to unlock all keyword gaps, content recommendations, and a 30-day action plan.
                </p>
                <div className="flex gap-2 max-w-sm mx-auto">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-emerald-500/30"
                  />
                  <button
                    onClick={captureEmail}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-sm transition-colors"
                  >
                    Unlock
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-white mb-1">Full report sent!</h3>
                <p className="text-xs text-neutral-400 mb-4">Check your inbox. Want even more? Create a free account.</p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-sm transition-colors"
                >
                  Create Free Account <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {/* Social proof footer */}
        <div className="mt-16 text-center">
          <p className="text-xs text-neutral-600">
            Powered by 35+ AI models. Used by 130+ agents. Zero per-token cost.
          </p>
          <Link href="/pricing" className="text-xs text-emerald-500/60 hover:text-emerald-400 transition-colors mt-2 inline-block">
            See pricing →
          </Link>
        </div>
      </div>
    </div>
  );
}
