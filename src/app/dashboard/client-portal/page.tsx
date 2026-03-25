"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  Palette,
  Users,
  FileText,
  Activity,
  Link2,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Shield,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────

interface WhitelabelConfig {
  agencyName: string;
  logoUrl: string | null;
  primaryColor: string;
  supportEmail: string | null;
}

// ─── Demo Data ──────────────────────────────────────────────

const DEMO_LEADS = {
  hot: 12,
  warm: 34,
  cold: 18,
  total: 64,
};

const DEMO_CONTENT = [
  { title: "Q1 SEO Audit Report", type: "Report", date: "2 days ago" },
  { title: "Landing Page — Spring Campaign", type: "Page", date: "4 days ago" },
  { title: "Email Sequence: Welcome Drip", type: "Email", date: "1 week ago" },
  { title: "Blog: 5 AI Marketing Trends", type: "Blog", date: "1 week ago" },
];

const DEMO_ACTIVITY = [
  { action: "Lead scored", detail: "Sarah Chen moved to HOT tier", time: "2h ago", icon: TrendingUp },
  { action: "Content generated", detail: "Blog post: AI marketing trends", time: "5h ago", icon: FileText },
  { action: "Agent deployed", detail: "SEO Dominator ran audit", time: "1d ago", icon: Sparkles },
  { action: "Lead captured", detail: "New inbound from website form", time: "1d ago", icon: Users },
  { action: "Page published", detail: "Spring campaign landing page", time: "2d ago", icon: ExternalLink },
];

// ─── Component ──────────────────────────────────────────────

export default function ClientPortalPage() {
  const [config, setConfig] = useState<WhitelabelConfig | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to fetch whitelabel config
    fetch("/api/settings/whitelabel")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.agencyName) {
          setConfig(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopyLink = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const accentColor = config?.primaryColor || "#00B7FF";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold uppercase tracking-wider mb-3">
            <Eye className="w-3 h-3" /> Preview Mode
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            Client Portal Preview
            <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
              White-Label Ready
            </span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Preview what your clients see. Customize branding, then share access.
          </p>
        </div>
      </div>

      {/* Agency Branding Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-6"
      >
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4" style={{ color: accentColor }} /> Agency Branding
        </h2>
        {loading ? (
          <div className="h-20 flex items-center justify-center text-neutral-600 text-xs">Loading configuration...</div>
        ) : config ? (
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-4">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-white/[0.05] p-1" />
              ) : (
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-black text-white"
                  style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40` }}
                >
                  {config.agencyName.charAt(0)}
                </div>
              )}
              <div>
                <p className="text-white font-bold">{config.agencyName}</p>
                <p className="text-[10px] text-neutral-500">
                  {config.supportEmail || "No support email configured"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border border-white/10" style={{ background: accentColor }} />
                <span className="text-[10px] text-neutral-500 font-mono">{accentColor}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/15 rounded-lg">
            <div>
              <p className="text-sm text-amber-400 font-medium">No white-label branding configured</p>
              <p className="text-[10px] text-neutral-500 mt-1">
                Set up your agency brand to customize the client experience.
              </p>
            </div>
            <a
              href="/dashboard/settings/whitelabel"
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 hover:bg-amber-500/20 transition-all"
            >
              Set up your brand <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        )}
      </motion.div>

      {/* Client Dashboard Preview */}
      <div className="relative">
        {/* Browser chrome mockup */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 bg-white/[0.02]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-1.5 text-[10px] text-neutral-500 font-mono">
                {config ? `${config.agencyName.toLowerCase().replace(/\s+/g, "")}.sovereign.ai/portal` : "youragency.sovereign.ai/portal"}
              </div>
            </div>
            <Shield className="w-3.5 h-3.5 text-emerald-500/50" />
          </div>

          {/* Inner portal content */}
          <div className="p-6 space-y-6 bg-[#050505]">
            {/* Portal header */}
            <div className="text-center pb-6 border-b border-white/[0.06]">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-3"
                style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}25`, color: accentColor }}
              >
                <Sparkles className="w-3 h-3" /> {config?.agencyName || "Your Agency"} Dashboard
              </div>
              <h2 className="text-xl font-bold text-white">Your AI-Powered Results</h2>
              <p className="text-xs text-neutral-500 mt-1">Real-time overview of your marketing performance</p>
            </div>

            {/* Portal KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Leads Card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Leads</span>
                </div>
                <p className="text-3xl font-black text-white mb-3">{DEMO_LEADS.total}</p>
                <div className="flex gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold">
                    {DEMO_LEADS.hot} Hot
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold">
                    {DEMO_LEADS.warm} Warm
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-500/10 border border-neutral-500/20 text-neutral-400 font-bold">
                    {DEMO_LEADS.cold} Cold
                  </span>
                </div>
              </motion.div>

              {/* Content Card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Content</span>
                </div>
                <p className="text-3xl font-black text-white mb-3">{DEMO_CONTENT.length}</p>
                <div className="space-y-1.5">
                  {DEMO_CONTENT.slice(0, 2).map((c) => (
                    <div key={c.title} className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-400 truncate max-w-[70%]">{c.title}</span>
                      <span className="text-[10px] text-neutral-600">{c.date}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Activity Card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <Activity className="w-5 h-5" style={{ color: accentColor }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Activity</span>
                </div>
                <p className="text-3xl font-black text-white mb-3">{DEMO_ACTIVITY.length}</p>
                <div className="space-y-1.5">
                  {DEMO_ACTIVITY.slice(0, 2).map((a) => (
                    <div key={a.detail} className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-400 truncate max-w-[70%]">{a.action}</span>
                      <span className="text-[10px] text-neutral-600">{a.time}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" style={{ color: accentColor }} /> Recent Agent Actions
                </h3>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {DEMO_ACTIVITY.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className="px-5 py-3 flex items-center gap-4"
                    >
                      <div className="w-7 h-7 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-neutral-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-neutral-300">{a.detail}</p>
                        <p className="text-[10px] text-neutral-600">{a.action}</p>
                      </div>
                      <span className="text-[10px] text-neutral-600 shrink-0">{a.time}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Link Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-6"
      >
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Link2 className="w-4 h-4" style={{ color: accentColor }} /> Client Access Link
        </h2>
        <p className="text-xs text-neutral-500 mb-4">
          Generate a secure, branded link for your clients to view their dashboard.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              background: `${accentColor}15`,
              border: `1px solid ${accentColor}30`,
              color: accentColor,
            }}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" /> Coming in next update
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Generate Client Access Link
              </>
            )}
          </button>
        </div>
        <p className="text-[10px] text-neutral-600 mt-3">
          Authenticated client portal with granular permissions is shipping in Phase 3 (Enterprise Features).
        </p>
      </motion.div>
    </div>
  );
}
