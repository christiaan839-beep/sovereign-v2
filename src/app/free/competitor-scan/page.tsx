"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Loader2, ArrowRight, CheckCircle2, AlertTriangle, Lock, Zap, Shield, TrendingUp, Crosshair, Eye } from "lucide-react";
import Link from "next/link";
import { TOTAL_MODELS } from "@/lib/platform-stats";

/**
 * FREE COMPETITOR SCANNER — The viral free tool.
 *
 * Paste a competitor's URL → get instant competitive intelligence.
 * Shows a teaser (3 weaknesses), locks the rest behind email capture.
 *
 * Target keywords: "competitor analysis tool", "competitive intelligence free",
 * "analyze competitor website", "competitor weakness finder"
 */

interface CompetitorResult {
  competitorProfile: {
    name: string;
    estimatedSize?: string;
    targetMarket?: string;
    pricingModel?: string;
  };
  strengths: string[];
  weaknesses: Array<{ weakness: string; howToExploit: string; urgency: string }>;
  marketGaps: Array<{ gap: string; opportunity: string; estimatedValue?: string }>;
  messagingAnalysis: {
    theirPositioning?: string;
    vulnerabilities?: string[];
    superiorPositioning?: string;
  };
  battlePlan: {
    immediate: string[];
    shortTerm?: string[];
    longTerm?: string[];
  };
}

function UrgencyBadge({ level }: { level: string }) {
  const colors = {
    HIGH: "bg-red-500/10 text-red-400 border-red-500/20",
    MEDIUM: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    LOW: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${colors[level as keyof typeof colors] || colors.MEDIUM}`}>
      {level}
    </span>
  );
}

export default function FreeCompetitorScanPage() {
  const [url, setUrl] = useState("");
  const [yourBiz, setYourBiz] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompetitorResult | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [step, setStep] = useState(0); // 0=input, 1=analyzing, 2=results

  const scanCompetitor = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setStep(1);

    try {
      const res = await fetch("/api/free/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: "competitor",
          // Optional email — if provided, unlocks 10/hr instead of 3/hr.
          // See ADR-0001.
          email: email.trim() || undefined,
          params: {
            competitorUrl: url.trim(),
            competitorName: url.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
            yourBusiness: yourBiz || "My business",
            industry: "Technology",
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Analysis failed. Try again.");
        setStep(0);
        return;
      }

      const data = await res.json();
      // The competitor agent returns { success, intel }
      const intel = data.intel || data;
      setResult(intel);
      setStep(2);
    } catch {
      setError("Connection error. Please try again.");
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  const captureEmail = () => {
    if (!email.includes("@")) return;
    setEmailCaptured(true);
    fetch("/api/_misc/email/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "free-competitor-scan", competitorUrl: url }),
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-[#030303]">
      <title>Free Competitor Analysis Tool | AI-Powered | Sovereign Matrix</title>
      <meta name="description" content="Paste any competitor URL and get instant AI-powered competitive intelligence. Find weaknesses, market gaps, and battle plans in 30 seconds." />

      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white">Sovereign Matrix</Link>
          <Link href="/signup" className="text-xs text-emerald-400 hover:text-emerald-300">
            Sign up free →
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[11px] font-medium uppercase tracking-wider mb-6">
            <Zap className="w-3 h-3" /> Free — No signup required
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            AI Competitor Scanner
          </h1>
          <p className="text-neutral-400 max-w-lg mx-auto">
            Paste any competitor&apos;s URL. Get their weaknesses, your opportunities,
            and a battle plan — in 30 seconds. Powered by 4 AI models working together.
          </p>
        </div>

        {/* Input Section */}
        <div className="space-y-3 mb-8">
          <div className="relative">
            <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && scanCompetitor()}
              placeholder="Competitor URL (e.g., competitor.com)"
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-emerald-500/30 transition-colors"
            />
          </div>
          <div className="relative">
            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={yourBiz}
              onChange={(e) => setYourBiz(e.target.value)}
              placeholder="Your business (optional — improves positioning advice)"
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-emerald-500/30 transition-colors"
            />
          </div>
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional — 10 scans/hr instead of 3)"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-neutral-300 placeholder-neutral-600 text-xs focus:outline-none focus:border-emerald-500/20 transition-colors"
            />
          </div>
          <button
            onClick={scanCompetitor}
            disabled={loading || !url.trim()}
            className="w-full px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            {loading ? "Analyzing with 4 AI models..." : "Scan Competitor"}
          </button>
        </div>

        {/* Loading State */}
        <AnimatePresence>
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center mb-8"
            >
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                  <Eye className="absolute inset-0 m-auto w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <p className="text-white font-medium mb-1">Analyzing competitor...</p>
              <p className="text-xs text-neutral-500">
                Running competitive intelligence through Porter&apos;s Five Forces + Blue Ocean Strategy
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {result && step === 2 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Competitor Profile */}
            {result.competitorProfile && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{result.competitorProfile.name}</h2>
                    <p className="text-xs text-neutral-500">{result.competitorProfile.targetMarket || "Market analysis"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {result.competitorProfile.estimatedSize && (
                    <div>
                      <span className="text-neutral-500 text-xs">Size</span>
                      <p className="text-white">{result.competitorProfile.estimatedSize}</p>
                    </div>
                  )}
                  {result.competitorProfile.pricingModel && (
                    <div>
                      <span className="text-neutral-500 text-xs">Pricing</span>
                      <p className="text-white">{result.competitorProfile.pricingModel}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Weaknesses (show 3 free, lock the rest) */}
            {result.weaknesses && result.weaknesses.length > 0 && (
              <div className="rounded-xl border border-red-500/10 bg-red-500/[0.02] p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-red-400" /> Exploitable Weaknesses
                </h3>
                <div className="space-y-4">
                  {result.weaknesses.slice(0, 3).map((w, i) => (
                    <div key={i} className="border-l-2 border-red-500/30 pl-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-medium">{w.weakness}</span>
                        <UrgencyBadge level={w.urgency} />
                      </div>
                      <p className="text-xs text-neutral-400">{w.howToExploit}</p>
                    </div>
                  ))}
                  {result.weaknesses.length > 3 && !emailCaptured && (
                    <div className="flex items-center gap-2 text-sm text-neutral-500 pt-2 border-t border-white/5">
                      <Lock className="w-3.5 h-3.5" />
                      +{result.weaknesses.length - 3} more weaknesses found — enter email to unlock
                    </div>
                  )}
                  {emailCaptured && result.weaknesses.slice(3).map((w, i) => (
                    <motion.div key={i + 3} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="border-l-2 border-red-500/30 pl-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-medium">{w.weakness}</span>
                        <UrgencyBadge level={w.urgency} />
                      </div>
                      <p className="text-xs text-neutral-400">{w.howToExploit}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Market Gaps (free) */}
            {result.marketGaps && result.marketGaps.length > 0 && (
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Market Gaps You Can Fill
                </h3>
                <div className="space-y-3">
                  {result.marketGaps.slice(0, emailCaptured ? undefined : 2).map((g, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-white font-medium">{g.gap}</span>
                        <p className="text-xs text-neutral-400 mt-0.5">{g.opportunity}</p>
                      </div>
                    </div>
                  ))}
                  {!emailCaptured && result.marketGaps.length > 2 && (
                    <div className="flex items-center gap-2 text-sm text-neutral-500 pt-2">
                      <Lock className="w-3.5 h-3.5" />
                      +{result.marketGaps.length - 2} more gaps — unlock below
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Battle Plan (preview) */}
            {result.battlePlan && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Battle Plan — Immediate Actions
                </h3>
                <div className="space-y-2">
                  {(result.battlePlan.immediate || []).slice(0, emailCaptured ? undefined : 2).map((action, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-emerald-400 font-mono text-xs mt-0.5">{i + 1}.</span>
                      <span className="text-neutral-300">{action}</span>
                    </div>
                  ))}
                  {!emailCaptured && (
                    <div className="flex items-center gap-2 text-sm text-neutral-500 pt-2">
                      <Lock className="w-3.5 h-3.5" />
                      Short-term & long-term strategy locked — enter email to unlock
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Email Capture / CTA */}
            {!emailCaptured ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
                <h3 className="text-base font-bold text-white mb-2">Unlock the Full Analysis</h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Get all weaknesses, complete battle plan, messaging vulnerabilities, and pricing intelligence.
                </p>
                <div className="flex gap-2 max-w-sm mx-auto">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && captureEmail()}
                    placeholder="you@company.com"
                    className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-emerald-500/30"
                  />
                  <button
                    onClick={captureEmail}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-sm transition-colors"
                  >
                    Unlock All
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-base font-bold text-white mb-1">Full report unlocked!</h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Want to run this analysis on 10 competitors at once? Create a free account.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-sm transition-colors"
                >
                  Run Full Playbook Free <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {/* How it works */}
        {!result && !loading && (
          <div className="mt-16 grid grid-cols-3 gap-6 text-center">
            {[
              { icon: Target, title: "1. Paste URL", desc: "Enter any competitor website" },
              { icon: Eye, title: "2. AI Analyzes", desc: "4 models run competitive intelligence" },
              { icon: Crosshair, title: "3. Get Intel", desc: "Weaknesses, gaps, and battle plan" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-4">
                <Icon className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="text-xs text-neutral-500">{desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center space-y-2">
          <p className="text-xs text-neutral-600">
            Powered by {TOTAL_MODELS}+ AI models. Zero per-token cost. Your data stays private.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs">
            <Link href="/free/seo-audit" className="text-emerald-500/60 hover:text-emerald-400 transition-colors">
              Free SEO Audit →
            </Link>
            <Link href="/free/lead-finder" className="text-emerald-500/60 hover:text-emerald-400 transition-colors">
              Free Lead Finder →
            </Link>
            <Link href="/pricing" className="text-emerald-500/60 hover:text-emerald-400 transition-colors">
              See Pricing →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
