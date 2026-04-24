"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Target, Loader2, ArrowRight, CheckCircle2, Lock, MapPin } from "lucide-react";
import Link from "next/link";

/**
 * FREE LEAD FINDER — Public tool for organic traffic.
 * Shows 3 leads free, full list requires signup.
 * Target keywords: "free lead finder", "b2b lead generation tool", "find business leads"
 */

interface Lead {
  company_name: string;
  industry: string;
  location: string;
  website: string;
  signal: string;
  score: number;
}

export default function FreeLeadFinderPage() {
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [emailCaptured, setEmailCaptured] = useState(false);

  const findLeads = async () => {
    if (!niche.trim()) return;
    setLoading(true);
    setError("");
    setLeads([]);

    try {
      const res = await fetch("/api/free/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: "leads",
          email: email.trim() || undefined, // optional — see ADR-0001
          params: { niche, location: location || "worldwide" },
        }),
      });

      if (!res.ok) {
        setError("Lead search failed. Try again.");
        return;
      }

      const data = await res.json();
      setLeads(data.leads || []);
    } catch {
      setError("Connection error. Please try again.");
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
      body: JSON.stringify({ email, source: "free-lead-finder", niche }),
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-[#030303]">
      <title>Free Lead Finder | Find B2B Prospects | Sovereign Matrix</title>

      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white">Sovereign Matrix</Link>
          <Link href="/signup" className="text-xs hover:text-white transition-colors" style={{ color: "#B5532C" }}>Sign up for full access →</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Free Lead Finder
          </h1>
          <p className="text-neutral-400 max-w-lg mx-auto">
            Enter a niche and location. AI finds real prospects with contact angles and qualification scores.
          </p>
        </div>

        {/* Input */}
        <div className="flex flex-col gap-3 mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Niche (e.g., SaaS, Real Estate, Dental)"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-500 text-sm focus:outline-none focus:outline-none"
              />
            </div>
            <div className="sm:w-48 relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-500 text-sm focus:outline-none focus:outline-none"
              />
            </div>
            <button
              onClick={findLeads}
              disabled={loading || !niche.trim()}
              onKeyDown={(e) => e.key === "Enter" && findLeads()}
              className="px-6 py-3.5 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-opacity flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #B5532C 0%, #E08558 100%)" }}
            >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {loading ? "Finding..." : "Find Leads"}
            </button>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional — 10 searches/hr instead of 3)"
            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-neutral-300 placeholder-neutral-600 text-xs focus:outline-none focus:border-emerald-500/20 transition-colors"
          />
        </div>

        {error && (
          <div className="mb-8 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">{error}</div>
        )}

        {/* Results */}
        {leads.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="text-sm text-neutral-500 mb-2">{leads.length} prospects found</div>

            {/* Show first 3 leads */}
            {leads.slice(0, 3).map((lead, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{lead.company_name}</h3>
                    <p className="text-xs text-neutral-500">{lead.industry} · {lead.location}</p>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                    lead.score >= 8 ? "bg-white/10 text-white" :
                    lead.score >= 5 ? "bg-neutral-700/60 text-neutral-300" :
                    "bg-neutral-800/60 text-neutral-500"
                  }`}>
                    {lead.score}/10
                  </div>
                </div>
                <p className="text-xs text-neutral-400 mb-2">{lead.signal}</p>
                {lead.website && lead.website !== "unknown" && (
                  <p className="text-[10px] text-neutral-600">{lead.website}</p>
                )}
              </motion.div>
            ))}

            {/* Locked leads — visible until email capture */}
            {leads.length > 3 && !emailCaptured && (
              <div className="space-y-3">
                {leads.slice(3).map((_, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 relative overflow-hidden">
                    <div className="absolute inset-0 backdrop-blur-[3px] bg-[#030303]/70 flex items-center justify-center z-10">
                      <Lock className="w-4 h-4 text-neutral-700" />
                    </div>
                    <div className="opacity-10">
                      <div className="h-3 w-32 bg-white/20 rounded mb-2" />
                      <div className="h-2 w-48 bg-white/10 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Revealed leads after email capture */}
            {leads.length > 3 && emailCaptured && (
              <div className="space-y-4">
                {leads.slice(3).map((lead, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{lead.company_name}</h3>
                        <p className="text-xs text-neutral-500">{lead.industry} · {lead.location}</p>
                      </div>
                      <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                        lead.score >= 8 ? "bg-white/10 text-white" :
                        lead.score >= 5 ? "bg-neutral-700/60 text-neutral-300" :
                        "bg-neutral-800/60 text-neutral-500"
                      }`}>{lead.score}/10</div>
                    </div>
                    <p className="text-xs text-neutral-400 mb-2">{lead.signal}</p>
                    {lead.website && lead.website !== "unknown" && (
                      <p className="text-[10px] text-neutral-600">{lead.website}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Email capture gate */}
            {!emailCaptured ? (
              <div className="rounded-xl p-6 text-center"
                style={{ background: "rgba(181,83,44,0.06)", border: "1px solid rgba(181,83,44,0.22)" }}>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Unlock {leads.length - 3} more leads
                </h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Drop your email — we&apos;ll send the full list with contact angles and qualification data.
                </p>
                <div className="flex gap-2 max-w-sm mx-auto">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    onKeyDown={(e) => e.key === "Enter" && captureEmail()}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-neutral-500 focus:outline-none"
                  />
                  <button
                    onClick={captureEmail}
                    className="px-5 py-2.5 text-white font-semibold rounded-lg text-sm transition-opacity hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #B5532C 0%, #E08558 100%)" }}
                  >
                    Unlock
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-6 text-center"
                style={{ background: "rgba(181,83,44,0.06)", border: "1px solid rgba(181,83,44,0.22)" }}>
                <CheckCircle2 className="w-7 h-7 mx-auto mb-3" style={{ color: "#B5532C" }} />
                <h3 className="text-sm font-semibold text-white mb-1">All {leads.length} leads unlocked.</h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Want 223 agents running automated outreach to this entire list?
                </p>
                <Link href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-white font-semibold rounded-lg text-sm transition-opacity hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #B5532C 0%, #E08558 100%)" }}>
                  Start Free <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </motion.div>
        )}

        <div className="mt-16 text-center">
          <p className="text-xs text-neutral-600">AI-powered lead discovery. No credit card required.</p>
          <Link href="/pricing" className="text-xs transition-colors mt-2 inline-block" style={{ color: "rgba(181,83,44,0.6)" }}>See pricing →</Link>
        </div>
      </div>
    </div>
  );
}
