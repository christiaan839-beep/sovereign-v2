"use client";

/**
 * /dashboard/admin/replay/[auditId] — operator replay viewer.
 *
 * Renders the full execution_audit_log row for a given audit ID
 * as a step-by-step timeline. Admin-only. Useful for:
 *   - "Why did agent X reject this?" — see which safety stage failed
 *   - "How long did each phase take?" — model latency vs total
 *   - "Did this access external APIs?" — externalApisAccessed[]
 *   - Customer-dispute resolution — the row is the immutable record
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Cpu,
  Shield,
  Database,
  Globe,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface AuditRow {
  id: string;
  tenantId: string;
  agentName: string;
  modelUsed: string;
  executionTimeMs: number;
  chainDepth: number;
  trustLevel: number;
  approvalRequired: boolean;
  approvalStatus: string;
  externalApisAccessed: string[];
  dataExported: boolean;
  inputTruncated: string;
  outputTruncated: string;
  createdAt: string;
}

interface TimelineStep {
  step: number;
  stage: string;
  result: string;
  detail?: string;
}

interface ReplayResponse {
  audit: AuditRow;
  timeline: TimelineStep[];
}

function resultIcon(result: string) {
  const r = result.toLowerCase();
  if (r === "passed" || r === "auto-approved" || r === "completed" || r === "approved") {
    return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  }
  if (r === "failed" || r === "rejected" || r === "blocked") {
    return <XCircle className="w-4 h-4 text-red-400" />;
  }
  if (r === "skipped" || r === "pending") {
    return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
  }
  // Quality score "85/100" etc — green if ≥80, yellow if ≥60, red below
  const numMatch = result.match(/^(\d+)\/100/);
  if (numMatch) {
    const score = parseInt(numMatch[1], 10);
    if (score >= 80) return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (score >= 60) return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    return <XCircle className="w-4 h-4 text-red-400" />;
  }
  return <CheckCircle2 className="w-4 h-4 text-neutral-400" />;
}

export default function ReplayPage() {
  const params = useParams<{ auditId: string }>();
  const [data, setData] = useState<ReplayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.auditId) return;
    fetch(`/api/admin/replay/${encodeURIComponent(params.auditId)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) {
          setErr(`HTTP ${r.status}`);
          setLoading(false);
          return;
        }
        const json = (await r.json()) as ReplayResponse;
        setData(json);
        setLoading(false);
      })
      .catch((e) => {
        setErr(String(e));
        setLoading(false);
      });
  }, [params?.auditId]);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/dashboard/admin/tenants"
          className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to tenants
        </Link>

        <h1 className="text-2xl md:text-3xl font-light text-white tracking-tight">
          Run replay
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Step-by-step view of execution_audit_log row{" "}
          <code className="text-xs">{params?.auditId}</code>
        </p>

        {loading && (
          <div className="mt-8 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 rounded-lg bg-white/[0.02] animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && err && (
          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <p className="text-sm text-red-300">Failed to load: {err}</p>
            <p className="mt-2 text-xs text-neutral-400">
              You may not have admin permissions, or the audit ID
              doesn&apos;t exist.
            </p>
          </div>
        )}

        {!loading && !err && data && (
          <>
            {/* Run summary — top-level facts */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryStat
                icon={<Cpu className="w-4 h-4" />}
                label="Agent"
                value={data.audit.agentName}
              />
              <SummaryStat
                icon={<Database className="w-4 h-4" />}
                label="Model"
                value={data.audit.modelUsed}
              />
              <SummaryStat
                icon={<Clock className="w-4 h-4" />}
                label="Duration"
                value={
                  data.audit.executionTimeMs < 1000
                    ? `${data.audit.executionTimeMs}ms`
                    : `${(data.audit.executionTimeMs / 1000).toFixed(1)}s`
                }
              />
              <SummaryStat
                icon={<Shield className="w-4 h-4" />}
                label="Trust level"
                value={`L${data.audit.trustLevel}`}
              />
            </div>

            {/* Timeline */}
            <div className="mt-8">
              <h2 className="text-lg font-medium text-white">
                Safety pipeline timeline
              </h2>
              <div className="mt-4 space-y-2">
                {data.timeline.map((step) => (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: step.step * 0.04 }}
                    className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 flex items-center gap-4"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/[0.04] flex items-center justify-center text-xs font-mono text-neutral-400">
                      {step.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-white">{step.stage}</span>
                        <div className="flex items-center gap-2">
                          {resultIcon(step.result)}
                          <span className="text-xs font-mono text-neutral-300">
                            {step.result}
                          </span>
                        </div>
                      </div>
                      {step.detail && (
                        <p className="mt-1 text-xs text-neutral-500">
                          {step.detail}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* External access audit */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  External APIs accessed
                </div>
                {data.audit.externalApisAccessed.length === 0 ? (
                  <p className="mt-2 text-xs text-neutral-500">
                    None — agent ran with no external network calls.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {data.audit.externalApisAccessed.map((api) => (
                      <li key={api} className="text-xs font-mono text-neutral-400">
                        · {api}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <Database className="w-4 h-4 text-violet-400" />
                  Data export
                </div>
                <p className="mt-2 text-xs text-neutral-400">
                  {data.audit.dataExported
                    ? "Yes — agent wrote data outside its tenant scope. Verify approval log."
                    : "No — agent did not export data outside scope."}
                </p>
              </div>
            </div>

            {/* Input / output snippets — TRUNCATED for privacy.
                The full payloads are not stored; only a snippet for
                forensics + a hash for verification. */}
            <div className="mt-8">
              <h2 className="text-lg font-medium text-white">
                Input / output snippets
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Truncated for privacy. Full payloads are not retained.
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wider text-neutral-500">
                    Input
                  </div>
                  <pre className="mt-2 text-[11px] font-mono text-neutral-300 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                    {data.audit.inputTruncated || "(empty)"}
                  </pre>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wider text-neutral-500">
                    Output
                  </div>
                  <pre className="mt-2 text-[11px] font-mono text-neutral-300 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                    {data.audit.outputTruncated || "(empty)"}
                  </pre>
                </div>
              </div>
            </div>

            <div className="mt-8 text-xs text-neutral-500 font-mono">
              Captured: {new Date(data.audit.createdAt).toISOString()} ·
              Tenant: {data.audit.tenantId} ·
              Chain depth: {data.audit.chainDepth}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-sm font-medium text-white truncate">
        {value}
      </div>
    </div>
  );
}
