"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Save, Loader2, CheckCircle2, AlertTriangle, Copy,
  RefreshCw, ExternalLink, ShieldCheck, XCircle, Clock,
} from "lucide-react";

type VerifyStatus = "idle" | "pending" | "verified" | "failed";

export default function CustomDomainPage() {
  const [currentDomain, setCurrentDomain] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/settings/whitelabel");
        const data = await res.json();
        if (data.config?.domain) {
          setCurrentDomain(data.config.domain);
          setNewDomain(data.config.domain);
          setVerifyStatus("verified");
        }
      } catch {
        // silently ignore load errors
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleVerify = async () => {
    if (!newDomain.trim()) return;
    setIsVerifying(true);
    setVerifyStatus("pending");
    setMessage(null);
    try {
      // DNS lookup via a lightweight check — attempt to resolve the CNAME
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(newDomain)}&type=CNAME`);
      const data = await res.json();
      const answers: Array<{ data: string }> = data.Answer || [];
      const hasVercelCname = answers.some(
        (a: { data: string }) =>
          a.data.includes("vercel-dns.com") || a.data.includes("cname.vercel-dns.com")
      );
      if (hasVercelCname) {
        setVerifyStatus("verified");
        setMessage({ type: "success", text: "DNS verified. CNAME record is correctly pointing to Vercel." });
      } else {
        setVerifyStatus("failed");
        setMessage({ type: "error", text: "CNAME record not found. Make sure it points to cname.vercel-dns.com and wait for DNS propagation." });
      }
    } catch {
      setVerifyStatus("failed");
      setMessage({ type: "error", text: "Could not verify DNS. Check your domain configuration and try again." });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!newDomain.trim()) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/whitelabel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim().toLowerCase() }),
      });
      if (res.ok) {
        setCurrentDomain(newDomain.trim().toLowerCase());
        setMessage({ type: "success", text: "Custom domain saved successfully." });
      } else {
        throw new Error("Failed to save");
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save domain configuration." });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig: Record<VerifyStatus, { icon: React.ElementType; label: string; color: string }> = {
    idle: { icon: Clock, label: "Not Configured", color: "text-neutral-500 bg-neutral-500/10 border-neutral-500/20" },
    pending: { icon: Loader2, label: "Checking...", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    verified: { icon: ShieldCheck, label: "Verified", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    failed: { icon: XCircle, label: "Not Verified", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  };

  const StatusIcon = statusConfig[verifyStatus].icon;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-600/5 border border-emerald-500/20 backdrop-blur-xl"
      >
        <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
          <Globe className="w-6 h-6 text-emerald-400" />
          Custom Domain
        </h1>
        <p className="text-neutral-400 text-sm">
          Point your own domain to your white-labeled portal. Enterprise feature for full brand ownership.
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Current Status */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Current Domain</h2>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border ${statusConfig[verifyStatus].color}`}>
                <StatusIcon className={`w-3.5 h-3.5 ${verifyStatus === "pending" ? "animate-spin" : ""}`} />
                {statusConfig[verifyStatus].label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 font-mono text-sm text-neutral-300">
                {currentDomain || "No domain configured"}
              </div>
              {currentDomain && (
                <a
                  href={`https://${currentDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-white/5 border border-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </motion.div>

          {/* Configure Domain */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-6 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl space-y-5"
          >
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Configure Domain</h2>

            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-widest font-semibold mb-2">
                Domain Name
              </label>
              <input
                type="text"
                value={newDomain}
                onChange={(e) => {
                  setNewDomain(e.target.value);
                  if (verifyStatus !== "idle") setVerifyStatus("idle");
                }}
                placeholder="app.youragency.com"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-neutral-600 font-mono text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                Use a subdomain like app.youragency.com or portal.yourdomain.com
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleVerify}
                disabled={!newDomain.trim() || isVerifying}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Verify Domain
              </button>
              <button
                onClick={handleSave}
                disabled={!newDomain.trim() || isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Domain
              </button>
            </div>
          </motion.div>

          {/* DNS Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl space-y-5"
          >
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">DNS Configuration</h2>
            <p className="text-sm text-neutral-400">
              Add the following CNAME record in your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.):
            </p>

            <div className="rounded-xl border border-white/10 bg-black/60 overflow-hidden">
              <div className="grid grid-cols-3 gap-px border-b border-white/5">
                <div className="px-4 py-2.5 text-xs text-neutral-500 uppercase tracking-widest font-semibold bg-white/[0.02]">Type</div>
                <div className="px-4 py-2.5 text-xs text-neutral-500 uppercase tracking-widest font-semibold bg-white/[0.02]">Name</div>
                <div className="px-4 py-2.5 text-xs text-neutral-500 uppercase tracking-widest font-semibold bg-white/[0.02]">Value</div>
              </div>
              <div className="grid grid-cols-3 gap-px">
                <div className="px-4 py-3 text-sm font-mono text-emerald-400">CNAME</div>
                <div className="px-4 py-3 text-sm font-mono text-neutral-300">
                  {newDomain ? newDomain.split(".")[0] : "app"}
                </div>
                <div className="px-4 py-3 text-sm font-mono text-neutral-300 flex items-center gap-2">
                  <span>cname.vercel-dns.com</span>
                  <button
                    onClick={() => copyToClipboard("cname.vercel-dns.com")}
                    className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-all"
                    title="Copy value"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-neutral-400 space-y-1">
                <p className="text-amber-400 font-semibold">Important Notes</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>DNS changes can take up to 48 hours to propagate globally.</li>
                  <li>If using Cloudflare, set the proxy status to DNS Only (grey cloud) initially.</li>
                  <li>SSL certificates are provisioned automatically after DNS verification.</li>
                  <li>Do not use an apex domain (e.g., youragency.com) - use a subdomain instead.</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Status Message */}
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-xl flex items-center gap-3 border ${
                  message.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >
                {message.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span className="text-sm">{message.text}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
