"use client";

/**
 * /dashboard/admin/approvals/[requestId] — multi-stage HITL review.
 *
 * Renders the request + every stage with approve/reject controls
 * scoped to whichever stage is currently pending.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Hash,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface StageState {
  id: string;
  sequencePosition: number;
  role: string;
  status: "pending" | "approved" | "rejected" | "skipped" | "expired";
  approver: string | null;
  decidedAt: string | null;
  reason: string | null;
  timeoutAt: string | null;
}

interface RequestData {
  request: {
    id: string;
    status: "pending" | "approved" | "denied" | "timeout";
    stageCount: number;
    currentStage: number;
    description: string;
    routingContext: Record<string, unknown>;
    vetoAtStage: number | null;
    vetoRole: string | null;
    retryOf: string | null;
    retryCount: number;
    createdAt: string;
    expiresAt: string;
  };
  stages: StageState[];
}

function statusIcon(s: StageState["status"]) {
  if (s === "approved") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (s === "rejected") return <XCircle className="w-4 h-4 text-red-400" />;
  if (s === "expired") return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
  if (s === "skipped") return <ShieldCheck className="w-4 h-4 text-neutral-500" />;
  return <Clock className="w-4 h-4 text-cyan-400" />;
}

export default function ApprovalReviewPage() {
  const params = useParams<{ requestId: string }>();
  const [data, setData] = useState<RequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!params?.requestId) return;
    try {
      const res = await fetch(
        `/api/admin/hitl/${encodeURIComponent(params.requestId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setErr(`HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const json = (await res.json()) as RequestData;
      setData(json);
      setErr(null);
      setLoading(false);
    } catch (e) {
      setErr(String(e));
      setLoading(false);
    }
  }, [params?.requestId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecision = async (decision: "approve" | "reject") => {
    const reason = window.prompt(
      `${decision === "approve" ? "Approve" : "Reject"} reason (audit-logged):`,
    );
    if (reason === null) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/hitl/${encodeURIComponent(params!.requestId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, reason: reason || "(no reason)" }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        alert(`Failed: ${txt}`);
      } else {
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const currentStage = data?.stages.find(
    (s) => s.sequencePosition === data.request.currentStage,
  );
  const canAct =
    data?.request.status === "pending" && currentStage?.status === "pending";

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
          Approval review
        </h1>
        <p className="mt-2 text-sm text-neutral-400 max-w-3xl">
          Multi-stage HITL review. Each stage is hash-chained in the
          audit log; veto at any stage halts the chain.
        </p>

        {loading && (
          <div className="mt-8 space-y-2">
            {[0, 1, 2].map((i) => (
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
          </div>
        )}

        {!loading && !err && data && (
          <>
            <div className="mt-8 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-white">{data.request.description}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
                    <span>
                      <Hash className="inline w-3 h-3 mr-1" />
                      {data.request.id}
                    </span>
                    <span>
                      Stage {data.request.currentStage + 1} / {data.request.stageCount}
                    </span>
                    <span>
                      Created {new Date(data.request.createdAt).toLocaleString()}
                    </span>
                    {data.request.retryCount > 0 && (
                      <span>Retry #{data.request.retryCount}</span>
                    )}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                    data.request.status === "approved"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : data.request.status === "denied"
                        ? "border-red-500/30 bg-red-500/10 text-red-300"
                        : data.request.status === "timeout"
                          ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                          : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                  }`}
                >
                  {data.request.status}
                </span>
              </div>

              {data.request.vetoAtStage !== null && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs">
                  <strong className="text-red-300">Vetoed at stage {data.request.vetoAtStage + 1}</strong>
                  {data.request.vetoRole && ` by ${data.request.vetoRole}`}
                </div>
              )}

              <div className="mt-4 text-xs text-neutral-400">
                <strong className="text-neutral-300">Routing context:</strong>{" "}
                <code className="font-mono">
                  {JSON.stringify(data.request.routingContext)}
                </code>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-2">
                Stages
              </h2>
              {data.stages.map((stage, idx) => {
                const isCurrent = idx === data.request.currentStage;
                return (
                  <motion.div
                    key={stage.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`rounded-xl border bg-white/[0.02] backdrop-blur-xl px-5 py-4 ${
                      isCurrent && stage.status === "pending"
                        ? "border-cyan-500/30 bg-cyan-500/[0.04]"
                        : "border-white/5"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/[0.04] flex items-center justify-center text-xs font-mono text-neutral-400">
                        {stage.sequencePosition + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            {statusIcon(stage.status)}
                            <span className="text-sm text-white capitalize">
                              {stage.role}
                            </span>
                          </div>
                          <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                            {stage.status}
                          </span>
                        </div>
                        {stage.approver && (
                          <p className="mt-1 text-xs text-neutral-500">
                            <code className="font-mono">{stage.approver}</code>
                            {stage.decidedAt &&
                              ` · ${new Date(stage.decidedAt).toLocaleString()}`}
                          </p>
                        )}
                        {stage.reason && (
                          <p className="mt-1 text-xs text-neutral-300 italic">
                            &ldquo;{stage.reason}&rdquo;
                          </p>
                        )}
                        {stage.timeoutAt && stage.status === "pending" && (
                          <p className="mt-1 text-[10px] text-neutral-600">
                            Timeout {new Date(stage.timeoutAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {canAct && currentStage && (
              <div className="mt-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                <p className="text-sm text-white">
                  Your decision on the <strong className="capitalize">{currentStage.role}</strong> stage:
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => handleDecision("approve")}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecision("reject")}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject (vetoes the entire chain)
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
