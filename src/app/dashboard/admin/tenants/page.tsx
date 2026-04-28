"use client";

/**
 * /dashboard/admin/tenants — operator ops dashboard for the
 * R27 cost-runaway ledger.
 *
 * Shows every tenant's today-state from `tenant_cost_ledger`:
 *   - spend today
 *   - cap (per-plan)
 *   - paused status + reason
 *   - 14-day trend (cents, runs, active days)
 *   - one-click unpause
 *
 * Admin-only via the API gate (404 to non-admins).
 */

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Pause,
  PlayCircle,
  TrendingUp,
} from "lucide-react";

interface TrendRow {
  totalCents: number;
  totalRuns: number;
  activeDays: number;
}

interface Tenant {
  userId: string;
  costCents: number;
  runCount: number;
  pausedAt: string | null;
  pauseReason: string | null;
  updatedAt: string;
  last14d: TrendRow | null;
}

interface ApiResponse {
  rows: Tenant[];
  day: string;
  generatedAt: string;
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

export default function AdminTenantsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [unpausing, setUnpausing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "paused" | "high-spend">("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/tenants", { cache: "no-store" });
      if (!res.ok) {
        setErr(`HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setErr(null);
      setLoading(false);
    } catch (e) {
      setErr(String(e));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnpause = async (userId: string) => {
    const reason = window.prompt(
      `Why are you un-pausing ${userId}? (will be audit-logged)`,
    );
    if (reason === null) return; // user cancelled
    setUnpausing(userId);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason: reason || "(no reason)" }),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(`Unpause failed: ${txt}`);
      } else {
        await load();
      }
    } finally {
      setUnpausing(null);
    }
  };

  const filtered =
    data?.rows.filter((r) => {
      if (filter === "paused") return r.pausedAt !== null;
      if (filter === "high-spend") return r.costCents >= 1_000; // $10+
      return true;
    }) ?? [];

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200 p-6 md:p-10">
      <header className="max-w-7xl mx-auto">
        <div className="flex items-baseline justify-between flex-wrap gap-4 mb-2">
          <h1 className="text-2xl md:text-3xl font-light text-white tracking-tight">
            Tenant cost ledger
          </h1>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
        <p className="text-sm text-neutral-400 max-w-2xl">
          Per-tenant per-day spend ledger from{" "}
          <code className="text-xs">tenant_cost_ledger</code>. Crossing
          the per-plan cap auto-pauses; un-pause requires a reason
          (audit-logged via the hash chain).
        </p>
        {data && (
          <p className="mt-1 text-xs text-neutral-500 font-mono">
            {data.day} UTC · {data.rows.length} tenants active today
          </p>
        )}
      </header>

      <div className="max-w-7xl mx-auto mt-8 flex flex-wrap gap-2">
        {(["all", "paused", "high-spend"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border border-white/10 bg-white/[0.02] text-neutral-400 hover:bg-white/[0.04]"
            }`}
          >
            {f === "all"
              ? `All (${data?.rows.length ?? 0})`
              : f === "paused"
              ? `Paused (${data?.rows.filter((r) => r.pausedAt).length ?? 0})`
              : `High-spend (${data?.rows.filter((r) => r.costCents >= 1000).length ?? 0})`}
          </button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto mt-6">
        {err && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 mb-4">
            <p className="text-sm text-red-300">Failed to load: {err}</p>
            <p className="mt-1 text-xs text-neutral-400">
              You may not have admin permissions, or the database is
              unreachable.
            </p>
          </div>
        )}

        {!loading && !err && filtered.length === 0 && (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="mt-3 text-sm text-neutral-400">
              {filter === "paused"
                ? "No tenants are currently paused. The cost guard is quiet — that's the goal."
                : filter === "high-spend"
                ? "No high-spend tenants today."
                : "No tenant activity recorded today yet."}
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02]">
                <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium text-right">Today</th>
                  <th className="px-4 py-3 font-medium text-right">Runs</th>
                  <th className="px-4 py-3 font-medium text-right">14-day</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((t) => (
                  <motion.tr
                    key={t.userId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-neutral-300">
                        {t.userId}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-200">
                      {fmtUsd(t.costCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-400">
                      {t.runCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-400">
                      {t.last14d ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <TrendingUp className="w-3 h-3" />
                          {fmtUsd(t.last14d.totalCents)} ·{" "}
                          {t.last14d.totalRuns} runs ·{" "}
                          {t.last14d.activeDays}d
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.pausedAt ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 text-xs text-yellow-300">
                            <Pause className="w-3 h-3" />
                            paused
                          </span>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            {fmtRelative(t.pausedAt)}
                          </div>
                          {t.pauseReason && (
                            <div className="text-[10px] text-neutral-500 mt-0.5 max-w-[240px] truncate">
                              {t.pauseReason}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.pausedAt && (
                        <button
                          onClick={() => handleUnpause(t.userId)}
                          disabled={unpausing === t.userId}
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          <PlayCircle className="w-3 h-3" />
                          {unpausing === t.userId ? "…" : "Unpause"}
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto mt-12 rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white">Auto-unpause at UTC midnight</p>
            <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
              A paused tenant naturally un-pauses at the next UTC
              midnight (the day rolls over to a new ledger row).
              Manual un-pause is for early-rescue when an operator has
              confirmed legitimate use. Every manual un-pause is
              audit-logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
