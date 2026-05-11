"use client";

/**
 * AuditPulseStrip — compact dashboard hero that surfaces the audit
 * chain in 60 pixels of vertical space.
 *
 * What it shows:
 *   - Live receipt count (signed receipts in the caller's chain)
 *   - Truncated Merkle chain root (with copy + "verify" affordance)
 *   - When the root was last computed
 *   - One-click links to the latest receipt + audit-bundle export
 *
 * Why a separate component (not part of StatsPanel):
 *   StatsPanel shows operational throughput — runs, leads, content,
 *   meetings. AuditPulseStrip shows the audit story — receipts,
 *   chain root, evidence pack. Different metaphor, different
 *   surface, kept distinct on purpose.
 *
 * Auth-only — bound to the signed-in user's chain. Errors gracefully:
 *   • 401 → hidden (user not signed in)
 *   • Empty chain → "Run your first agent to start your audit chain"
 *   • Network error → silent
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Copy,
  Check,
  ArrowRight,
  Download,
  FileText,
} from "lucide-react";

interface ChainRootResponse {
  envelope: {
    v: 1;
    root: string;
    count: number;
    computedAt: string;
  };
  canonical: string;
  signature: string;
}

export function AuditPulseStrip() {
  const [data, setData] = useState<ChainRootResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ageLabel, setAgeLabel] = useState<string>("just now");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/audit-root")
      .then(async (r) => {
        if (r.status === 401) throw new Error("unauthorized");
        if (!r.ok) throw new Error(`http ${r.status}`);
        return r.json();
      })
      .then((json: ChainRootResponse) => {
        if (cancelled) return;
        // Compute age in the effect so Date.now() stays out of render.
        const computedMs = new Date(json.envelope.computedAt).getTime();
        const minutes = Math.max(
          0,
          Math.round((Date.now() - computedMs) / 60_000),
        );
        setAgeLabel(
          minutes < 1
            ? "just now"
            : minutes < 60
              ? `${minutes}m ago`
              : `${Math.round(minutes / 60)}h ago`,
        );
        setData(json);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Loading skeleton — same height as the loaded state to prevent CLS.
  if (loading) {
    return (
      <div className="px-6 pt-6 pb-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.02] backdrop-blur-xl px-4 py-3 animate-pulse">
            <div className="h-7 w-7 rounded-full bg-white/[0.04]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 rounded bg-white/[0.04]" />
              <div className="h-2.5 w-64 rounded bg-white/[0.03]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Hide entirely on auth/network errors — surface noise isn't useful here.
  if (error || !data) return null;

  const { envelope } = data;
  const rootTruncated = `${envelope.root.slice(0, 8)}…${envelope.root.slice(-6)}`;
  // ageLabel is computed in the data-fetch effect so Date.now() never
  // runs during render (which the React Compiler flags as impure).
  // Worst-case staleness is bounded by the page-mount lifetime; the
  // chain root is rebuilt every minute by the upstream cron anyway.

  const isEmpty = envelope.count === 0;

  const copyRoot = async () => {
    try {
      await navigator.clipboard.writeText(envelope.root);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* silent */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="px-6 pt-6 pb-2"
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.04] to-transparent backdrop-blur-xl px-4 py-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_18px_rgba(0,183,255,0.18)]"
            aria-hidden="true"
          >
            <Shield className="h-3.5 w-3.5 text-cyan-200" />
          </span>

          <div className="flex-1 min-w-[200px]">
            {isEmpty ? (
              <>
                <p className="text-xs font-medium text-white">
                  Your audit chain starts on your first run
                </p>
                <p className="mt-0.5 text-[10px] text-neutral-500">
                  Every agent execution from here is HMAC-signed and added to a
                  Merkle tree only you control.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-white">
                  <span className="font-mono font-semibold text-cyan-100">
                    {envelope.count.toLocaleString()}
                  </span>{" "}
                  signed receipts ·{" "}
                  <span className="font-mono text-cyan-200">
                    root {rootTruncated}
                  </span>
                </p>
                <p className="mt-0.5 text-[10px] text-neutral-500">
                  Merkle chain · computed {ageLabel} · tamper-evident at O(log
                  N) verification cost
                </p>
              </>
            )}
          </div>

          {!isEmpty && (
            <button
              onClick={copyRoot}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
              aria-label="Copy Merkle chain root"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-300" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Root"}
            </button>
          )}

          <Link
            href="/api/me/audit-bundle"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
            aria-label="Download audit evidence bundle"
          >
            <Download className="h-3 w-3" />
            Bundle
          </Link>

          <Link
            href="/dashboard/audit-trail"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
            aria-label="Open audit trail"
          >
            <FileText className="h-3 w-3" />
            Trail
            <ArrowRight className="h-2.5 w-2.5" />
          </Link>

          {/* Loading dot — fades out after first paint. Kept as a tiny
              affordance so the user sees the strip is freshly fetched
              (not cached forever). */}
          <span className="hidden md:inline-block">
            <span
              className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400/60 shadow-[0_0_6px_rgba(0,183,255,0.6)]"
              aria-hidden="true"
            />
          </span>
        </div>
      </div>
    </motion.div>
  );
}
