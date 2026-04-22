"use client";

/**
 * AdminReviewClient — interactive table for the review dashboard.
 *
 * Renders the list server-side (via prop), then handles per-row
 * actions on the client. Each row can be expanded to reveal the full
 * SAM manifest; actions are a button row that POSTs to the admin API.
 *
 * State machine per row:
 *   idle         → user hasn't clicked yet
 *   approving    → POST /approve in flight
 *   rejecting    → reason modal open
 *   rejecting-sending → POST /reject in flight
 *   done         → mutation succeeded; row disabled (waits for refresh)
 *   error        → mutation failed; show message, keep buttons enabled
 *
 * After a successful action the router refresh() triggers a fresh
 * server render so the list re-pulls with the new status.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminSubmissionRow } from "@/lib/admin-submissions";

type RowPhase = "idle" | "approving" | "rejecting" | "rejecting-sending" | "done" | "error";

interface Props {
  rows: AdminSubmissionRow[];
  status: string;
}

export function AdminReviewClient({ rows, status }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [phase, setPhase] = useState<Record<string, RowPhase>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  function setRowPhase(id: string, p: RowPhase) {
    setPhase((prev) => ({ ...prev, [id]: p }));
  }

  function setRowError(id: string, msg: string) {
    setErrors((prev) => ({ ...prev, [id]: msg }));
  }

  async function onApprove(row: AdminSubmissionRow) {
    setRowPhase(row.id, "approving");
    setRowError(row.id, "");
    try {
      const res = await fetch(`/api/admin/creator-submissions/${row.id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const body = await res.json();
      if (!res.ok) {
        setRowError(row.id, body.error ?? `HTTP ${res.status}`);
        setRowPhase(row.id, "error");
        return;
      }
      setRowPhase(row.id, "done");
      router.refresh();
    } catch {
      setRowError(row.id, "network_error");
      setRowPhase(row.id, "error");
    }
  }

  async function onReject(row: AdminSubmissionRow) {
    const reason = (rejectReason[row.id] ?? "").trim();
    if (reason.length === 0) {
      setRowError(row.id, "reason_required");
      return;
    }
    setRowPhase(row.id, "rejecting-sending");
    setRowError(row.id, "");
    try {
      const res = await fetch(`/api/admin/creator-submissions/${row.id}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json();
      if (!res.ok) {
        setRowError(row.id, body.error ?? `HTTP ${res.status}`);
        setRowPhase(row.id, "error");
        return;
      }
      setRowPhase(row.id, "done");
      router.refresh();
    } catch {
      setRowError(row.id, "network_error");
      setRowPhase(row.id, "error");
    }
  }

  if (rows.length === 0) {
    return (
      <div
        className="p-10 ed-body text-center"
        style={{
          border: "1px solid var(--ed-rule)",
          background: "var(--ed-bg-raised)",
          color: "var(--ed-ink-soft)",
          borderRadius: "2px",
        }}
      >
        Empty queue. New submissions with status “{status}” appear here.
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
      {/* Header */}
      <div
        className="grid grid-cols-[1.4fr_2fr_1fr_1fr_1.8fr] gap-4 px-5 py-4 ed-label"
        style={{
          borderBottom: "1px solid var(--ed-rule)",
          background: "var(--ed-bg-raised)",
          color: "var(--ed-ink-soft)",
        }}
      >
        <span>Slug</span>
        <span>Name</span>
        <span>Policy</span>
        <span>Price</span>
        <span className="text-right">Actions</span>
      </div>

      {rows.map((row) => {
        const rowPhase = phase[row.id] ?? "idle";
        const rowError = errors[row.id];
        const isExpanded = expanded === row.id;
        const isTerminal = rowPhase === "done" || row.verificationStatus !== "pending";

        return (
          <div
            key={row.id}
            style={{ borderBottom: "1px solid var(--ed-rule)" }}
            className={rowPhase === "done" ? "opacity-50" : ""}
          >
            {/* Main row */}
            <div className="grid grid-cols-[1.4fr_2fr_1fr_1fr_1.8fr] gap-4 px-5 py-4 items-baseline">
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : row.id)}
                className="text-left ed-mono text-sm transition-colors hover:text-[var(--ed-copper)]"
                style={{ color: "var(--ed-ink)" }}
              >
                {row.slug ?? "(no slug)"}
              </button>
              <span className="ed-body text-sm" style={{ color: "var(--ed-ink)" }}>
                {row.name}
              </span>
              <span className="ed-caption">{row.submissionPolicy ?? "—"}</span>
              <span className="ed-mono text-sm" style={{ color: "var(--ed-ink-soft)" }}>
                {row.pricingCents === 0
                  ? "Free"
                  : row.pricingCents < 100
                  ? `${row.pricingCents}¢`
                  : `$${(row.pricingCents / 100).toFixed(2)}`}
              </span>
              <div className="flex justify-end items-baseline gap-3">
                {rowPhase === "rejecting" ? (
                  <>
                    <input
                      type="text"
                      value={rejectReason[row.id] ?? ""}
                      onChange={(e) =>
                        setRejectReason((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      placeholder="Reason (visible to creator)"
                      className="flex-1 ed-mono text-xs px-2 py-1 bg-transparent outline-none"
                      style={{
                        border: "1px solid var(--ed-copper)",
                        color: "var(--ed-ink)",
                        borderRadius: "2px",
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => onReject(row)}
                      className="ed-mono text-xs px-3 py-1 transition-opacity hover:opacity-80"
                      style={{
                        background: "var(--ed-copper)",
                        color: "var(--ed-bg)",
                        borderRadius: "2px",
                      }}
                    >
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => setRowPhase(row.id, "idle")}
                      className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isTerminal || rowPhase === "approving"}
                      onClick={() => onApprove(row)}
                      className="ed-mono text-xs px-3 py-1 transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        background: "var(--ed-copper)",
                        color: "var(--ed-bg)",
                        borderRadius: "2px",
                      }}
                    >
                      {rowPhase === "approving" ? "…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={isTerminal}
                      onClick={() => setRowPhase(row.id, "rejecting")}
                      className="ed-mono text-xs px-3 py-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        border: "1px solid var(--ed-rule)",
                        color: "var(--ed-ink-soft)",
                        borderRadius: "2px",
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Error line */}
            {rowError && (
              <p className="px-5 pb-3 ed-caption" style={{ color: "var(--ed-copper)" }}>
                Error: <span className="ed-mono">{rowError}</span>
              </p>
            )}

            {/* Expanded detail */}
            {isExpanded && (
              <div
                className="px-5 py-5"
                style={{
                  borderTop: "1px solid var(--ed-rule)",
                  background: "var(--ed-bg-raised)",
                }}
              >
                <dl className="flex flex-wrap gap-x-10 gap-y-3 mb-4 ed-caption">
                  <div>
                    <dt className="ed-label">Author</dt>
                    <dd className="ed-mono text-xs mt-1" style={{ color: "var(--ed-ink)" }}>
                      {row.authorEmail}
                    </dd>
                  </div>
                  <div>
                    <dt className="ed-label">Reference</dt>
                    <dd className="ed-mono text-xs mt-1" style={{ color: "var(--ed-copper)" }}>
                      {row.referenceId ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="ed-label">Decision reason</dt>
                    <dd className="mt-1" style={{ color: "var(--ed-ink-soft)" }}>
                      {row.submissionReason ?? "—"}
                    </dd>
                  </div>
                </dl>
                <pre
                  className="p-4 ed-mono text-[11px] overflow-auto"
                  style={{
                    border: "1px solid var(--ed-rule)",
                    background: "var(--ed-bg)",
                    color: "var(--ed-ink-soft)",
                    borderRadius: "2px",
                    maxHeight: "320px",
                  }}
                >
                  {JSON.stringify(row.manifestRaw ?? {}, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
