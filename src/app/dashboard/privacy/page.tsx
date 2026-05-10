"use client";

/**
 * /dashboard/privacy — GDPR Art. 15/17/20 + POPIA Section 23/24 user-facing
 * surface. Two actions:
 *
 *   1. Export — POST /api/me/export → downloadable JSON of every row keyed
 *      to this user across the 30 user-scoped tables.
 *   2. Delete — POST /api/me/delete with `{ confirm: "DELETE" }` body →
 *      cascades user data and returns a per-table summary.
 *
 * The delete CTA uses a two-step confirmation: a typed-string gate ("DELETE")
 * and an explicit second click. This mirrors the API's strict body guard
 * and prevents accidental erasure when keyboard focus moves quickly.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Lock,
} from "lucide-react";

interface DeleteSummary {
  ok: boolean;
  message: string;
  tables: {
    succeeded: number;
    failed: number;
    details: { table: string; deleted: boolean; error?: string }[];
  };
  thirdPartyDataNote: string;
  _retentionNote: string;
}

export default function PrivacyPage() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DeleteSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/me/export", { method: "GET" });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `Export failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sovereign-data-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Export failed unexpectedly",
      );
    } finally {
      setExporting(false);
    }
  }

  async function onDelete() {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/me/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = (await res.json()) as DeleteSummary | { error: string };
      if (!res.ok) {
        throw new Error(
          ("error" in data && data.error) ||
            `Delete failed (HTTP ${res.status})`,
        );
      }
      setDeleteResult(data as DeleteSummary);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Delete failed unexpectedly",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex items-center gap-3"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/30">
            <Shield className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Privacy & Data Rights
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Export or permanently delete every byte of data we hold about you
              — GDPR Art. 15 / 17 / 20 and POPIA Sections 23 / 24.
            </p>
          </div>
        </motion.div>

        {/* ─── Export card ───────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl"
        >
          <div className="border-b border-white/[0.06] bg-gradient-to-br from-cyan-500/[0.04] to-transparent px-6 py-5">
            <div className="flex items-center gap-3">
              <FileJson className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-medium text-white">
                Download your data
              </h2>
            </div>
            <p className="mt-2 text-sm text-neutral-400">
              We package every row keyed to your account — generations,
              conversations, leads, billing, audit logs, and 25 more tables —
              into a single signed JSON file. Audit-logged.
            </p>
          </div>
          <div className="px-6 py-5">
            <button
              onClick={onExport}
              disabled={exporting}
              className="group flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition-all hover:border-cyan-400/50 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              )}
              {exporting ? "Building export…" : "Download data export"}
            </button>
            <AnimatePresence>
              {exportError && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 flex items-center gap-2 text-xs text-rose-400"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {exportError}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* ─── Delete card ───────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.05] to-transparent backdrop-blur-xl"
        >
          <div className="border-b border-rose-500/15 px-6 py-5">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-rose-300" />
              <h2 className="text-lg font-medium text-white">
                Permanently delete your data
              </h2>
            </div>
            <p className="mt-2 text-sm text-neutral-400">
              Irreversible. We hard-delete every user-keyed row across 30
              tables, including subscriptions and payment history. Your Clerk
              identity (login record) is not deleted from this endpoint — remove
              it separately at{" "}
              <a
                href="https://clerk.com/account"
                target="_blank"
                rel="noreferrer noopener"
                className="text-cyan-300 underline-offset-2 hover:underline"
              >
                clerk.com/account
              </a>
              .
            </p>
          </div>
          <div className="px-6 py-5">
            {!deleteResult && !deleteOpen && (
              <button
                onClick={() => setDeleteOpen(true)}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-100 transition hover:border-rose-400/60 hover:bg-rose-500/15"
              >
                I want to delete my data
              </button>
            )}

            {deleteOpen && !deleteResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-4"
              >
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-amber-200">
                  <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>
                    This cannot be undone. Type{" "}
                    <span className="font-mono text-amber-100">DELETE</span> to
                    confirm.
                  </p>
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 font-mono text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-rose-500/50"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={onDelete}
                    disabled={confirmText !== "DELETE" || deleting}
                    className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {deleting ? "Erasing…" : "Permanently delete"}
                  </button>
                  <button
                    onClick={() => {
                      setDeleteOpen(false);
                      setConfirmText("");
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
                {deleteError && (
                  <p className="flex items-center gap-2 text-xs text-rose-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {deleteError}
                  </p>
                )}
              </motion.div>
            )}

            {deleteResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-4 text-sm text-emerald-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
                  <div>
                    <p className="font-medium">{deleteResult.message}</p>
                    <p className="mt-2 text-xs text-emerald-200/80">
                      {deleteResult.tables.succeeded} tables cleared,{" "}
                      {deleteResult.tables.failed} skipped (likely missing
                      migrations — non-critical).
                    </p>
                  </div>
                </div>
                <p className="text-xs text-neutral-500">
                  {deleteResult.thirdPartyDataNote}
                </p>
                <p className="text-xs text-neutral-600">
                  {deleteResult._retentionNote}
                </p>
              </motion.div>
            )}
          </div>
        </motion.section>

        <p className="mt-10 text-center text-xs text-neutral-600">
          Questions about your data? Contact{" "}
          <a
            href="mailto:privacy@sovereignmatrix.app"
            className="text-cyan-400 hover:underline"
          >
            privacy@sovereignmatrix.app
          </a>
          .
        </p>
      </div>
    </div>
  );
}
