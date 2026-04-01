"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Download, Shield, Database, Users, FileText, Workflow,
  BarChart3, Settings, Brain, Loader2, CheckCircle2, AlertTriangle,
} from "lucide-react";

/* ── Data Categories ── */

const DATA_CATEGORIES = [
  {
    key: "profile",
    label: "User Profile",
    desc: "Your account information from Clerk (name, email, avatar).",
    icon: Users,
    color: "text-blue-400",
  },
  {
    key: "leads",
    label: "Leads Generated",
    desc: "All prospects discovered by the Lead Prospector agent.",
    icon: Database,
    color: "text-emerald-400",
  },
  {
    key: "generations",
    label: "Content Generated",
    desc: "Blog posts, SEO reports, emails, and all AI-generated content.",
    icon: FileText,
    color: "text-amber-400",
  },
  {
    key: "workflows",
    label: "Workflows Saved",
    desc: "Multi-step automation pipelines you have built.",
    icon: Workflow,
    color: "text-purple-400",
  },
  {
    key: "usage",
    label: "Usage History",
    desc: "Token usage, model calls, and metering records.",
    icon: BarChart3,
    color: "text-cyan-400",
  },
  {
    key: "settings",
    label: "Settings & API Keys",
    desc: "Configuration, webhook URLs, and API keys (masked).",
    icon: Settings,
    color: "text-orange-400",
  },
  {
    key: "conversations",
    label: "Conversations",
    desc: "Chat history and messages with the AI assistant.",
    icon: FileText,
    color: "text-pink-400",
  },
  {
    key: "memory",
    label: "Memory Entries",
    desc: "Everything agents have learned about your business.",
    icon: Brain,
    color: "text-indigo-400",
  },
];

/* ── Component ── */

export default function DataExportPage() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/data-export");

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Export failed" }));
        throw new Error(data.error || `Export failed (${res.status})`);
      }

      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sovereign-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Shield className="h-7 w-7 text-emerald-400" />
          Data Export
        </h1>
        <p className="text-neutral-400 mt-1 text-sm">
          Download a complete copy of all your data in JSON format. GDPR Article 20 compliant.
        </p>
      </div>

      {/* GDPR Notice */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10"
      >
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-neutral-300">
            <p className="font-medium text-emerald-400 mb-1">Your Data, Your Rights</p>
            <p className="text-neutral-400">
              Under GDPR and POPIA, you have the right to receive a copy of all personal data
              we process about you. This export contains everything stored in our systems
              associated with your account.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Data Categories */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
          Data Included in Export
        </h2>
        <div className="grid gap-2">
          {DATA_CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5"
            >
              <div className="p-2 rounded-lg bg-white/[0.03]">
                <cat.icon className={`h-4 w-4 ${cat.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-200">{cat.label}</p>
                <p className="text-xs text-neutral-500">{cat.desc}</p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-emerald-500/50 flex-shrink-0" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Export Button */}
      <div className="space-y-3">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold hover:from-emerald-500 hover:to-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {exporting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Preparing Export...
            </>
          ) : (
            <>
              <Download className="h-5 w-5" />
              Export All My Data
            </>
          )}
        </button>

        {/* Success */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4" />
            Export downloaded successfully.
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400"
          >
            <AlertTriangle className="h-4 w-4" />
            {error}
          </motion.div>
        )}
      </div>

      {/* Fine Print */}
      <p className="text-xs text-neutral-500 pt-4">
        Export files are generated in real-time. Large datasets may take a few seconds.
        API keys in the export are masked for security. The exported file is not encrypted
        -- store it securely.
      </p>
    </div>
  );
}
