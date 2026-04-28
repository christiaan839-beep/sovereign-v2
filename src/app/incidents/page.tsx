"use client";

/**
 * /incidents — public, tamper-evident events feed.
 *
 * Reads /api/health/incidents which queries audit_logs filtered to
 * public-safe AuditAction variants. Every entry is part of the
 * SHA-256 hash chain — tampering is detected by /api/cron/verify-audit-chain
 * every 6 hours.
 *
 * What's NOT shown:
 *   - per-user agent runs (privacy)
 *   - API key events (operational secrets)
 *   - login/logout events (identity)
 *   - data export/delete (per-tenant)
 *
 * What IS shown:
 *   - cost.cap_hit (capacity / abuse defence triggered)
 *   - admin.submission_approve|reject (marketplace governance)
 *
 * Honest empty state: when there are no incidents, we show
 * "no public events recently" — Constitution Principle 5.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Hash, Info } from "lucide-react";

interface Incident {
  id: string;
  action: string;
  createdAt: string;
  severity: "info" | "warning" | "incident";
  title: string;
}

interface IncidentsDoc {
  total: number;
  incidents: Incident[];
  generatedAt: string;
  note: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function severityIcon(s: Incident["severity"]) {
  if (s === "warning")
    return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
  if (s === "incident")
    return <AlertTriangle className="w-4 h-4 text-red-400" />;
  return <Info className="w-4 h-4 text-cyan-400" />;
}

function severityLabel(s: Incident["severity"]) {
  return s.toUpperCase();
}

export default function IncidentsPage() {
  const [data, setData] = useState<IncidentsDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/health/incidents", {
          cache: "no-store",
        });
        if (!alive) return;
        if (!res.ok) {
          setErr(`HTTP ${res.status}`);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as IncidentsDoc;
        setData(json);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setErr(String(e));
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-5xl px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-xs font-medium text-cyan-300">
              <Hash className="w-3 h-3" />
              Hash-chained — tampering is detectable
            </div>
            <h1 className="mt-6 text-4xl md:text-5xl font-light tracking-tight text-white">
              Public incidents feed
            </h1>
            <p className="mt-4 max-w-2xl text-base text-neutral-400 leading-relaxed">
              Every entry below is a row in our SHA-256 hash-chained audit
              log. Modifying any past row breaks the chain — and the
              verification cron detects the break within 6 hours. Most
              status pages are vendor-controlled marketing surfaces; this
              one is a derivative of the audit trail itself.
            </p>
            {data?.note && (
              <p className="mt-3 text-xs text-neutral-500 font-mono">
                {data.note}
              </p>
            )}
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-white/[0.02] animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && err && (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <p className="text-sm text-yellow-300">
              Could not load incidents: {err}
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              The hash chain remains intact regardless. Check the raw
              feed at{" "}
              <code className="text-yellow-300 text-[11px]">
                /api/health/incidents
              </code>{" "}
              directly.
            </p>
          </div>
        )}

        {!loading && !err && data?.incidents.length === 0 && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h2 className="mt-4 text-lg font-medium text-white">
              No public events recently
            </h2>
            <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
              No cost-cap saves, marketplace approvals, or other
              public-safe events have been recorded. Operational events
              (logins, agent runs, API key activity) are not public —
              that&apos;s by design.
            </p>
          </div>
        )}

        {!loading && !err && data && data.incidents.length > 0 && (
          <div className="space-y-2">
            {data.incidents.map((inc, idx) => (
              <motion.div
                key={inc.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.02 }}
                className="rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors px-5 py-4"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex-shrink-0">
                    {severityIcon(inc.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <p className="text-sm text-white">{inc.title}</p>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                        {severityLabel(inc.severity)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-neutral-500">
                      <span className="font-mono">{inc.action}</span>
                      <span>·</span>
                      <span>{formatTime(inc.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6">
          <h3 className="text-sm font-medium text-white">
            Why this page exists
          </h3>
          <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
            Most status pages are designed to look green. This one is
            designed to be honest. The hash-chained audit log means we
            literally cannot delete a past incident without an alarm
            firing on the next verification cron. Customer disputes get
            settled by the immutable record, not by Slack screenshots.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <code className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-neutral-200">
              GET /api/health/incidents
            </code>
            <Link
              href="/reliability"
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            >
              Full reliability surface →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
