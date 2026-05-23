"use client";

/**
 * SOVEREIGN MATRIX — /dashboard/admin/sessions (Wave 128).
 *
 * Admin-only persistent-session viewer. Renders rows from the
 * agent_sessions table (Wave 126) — opt-in resumable state for
 * long-running agent runs.
 *
 * Surfaces:
 *   - Status tiles (active / done / failed / abandoned counts)
 *   - Filterable table — by agentName, by status
 *   - Inline last-step label + state preview
 *
 * Operator wins from this page: detect stuck runs (status=active +
 * lastTouchedAt > 10min), spot which agents are accumulating session
 * state, find specific user/agent combos when triaging a bug.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Crown,
  ArrowLeft,
  Activity,
  CheckCircle2,
  XCircle,
  Pause,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import { bucketFreshness } from "@/lib/admin-sessions-helpers";

interface SessionSummary {
  id: string;
  userId: string;
  agentName: string;
  status: string;
  stepCount: number;
  createdAt: string;
  lastTouchedAt: string;
  expiresAt: string | null;
  lastStepLabel: string | null;
  statePreview: string;
}

interface SessionsResponse {
  generatedAt: string;
  count: number;
  limit: number;
  filters: { agentName: string | null; status: string | null };
  sessions: SessionSummary[];
  warning?: string;
}

const STATUS_OPTIONS = [
  "all",
  "active",
  "done",
  "failed",
  "abandoned",
] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function short(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    if (
      d.getUTCFullYear() === today.getUTCFullYear() &&
      d.getUTCMonth() === today.getUTCMonth() &&
      d.getUTCDate() === today.getUTCDate()
    ) {
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
    }
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function ageMinutes(iso: string): number {
  try {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  } catch {
    return 0;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Render a state JSON blob as a compact list of top-level keys for
 * scanning. Falls back to the raw string if parsing fails.
 *
 * Examples:
 *   "{}" → "—"
 *   '{"phase":"plan","step":3}' → "phase=plan · step=3"
 *   "garbage" → "garbage"
 */
function prettyStatePreview(raw: string): string {
  if (!raw || raw === "{}" || raw === "null") return "—";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return truncate(raw, 80);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return truncate(String(parsed), 80);
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) return "—";
  return entries
    .slice(0, 4)
    .map(([k, v]) => {
      const value =
        typeof v === "object" && v !== null
          ? Array.isArray(v)
            ? `[${v.length}]`
            : "{…}"
          : String(v);
      return `${k}=${truncate(value, 24)}`;
    })
    .join(" · ");
}

const FRESHNESS_TEXT_COLOR: Record<
  ReturnType<typeof bucketFreshness>,
  string
> = {
  fresh: "text-neutral-400",
  cooling: "text-amber-300/80",
  stuck: "text-amber-300",
};

export default function AdminSessionsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [agentFilter, setAgentFilter] = useState<string>("");
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (agentFilter.trim()) params.set("agentName", agentFilter.trim());
      const res = await fetch(`/api/admin/sessions?${params.toString()}`);
      if (res.status === 403) {
        setError("Admin-only — your Clerk session is not authorised.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SessionsResponse = await res.json();
      setData(json);
      setError(null);
      setLastFetch(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, agentFilter]);

  useEffect(() => {
    void fetchSessions();
    const id = setInterval(() => void fetchSessions(), 30_000);
    return () => clearInterval(id);
  }, [fetchSessions]);

  const controlSession = async (
    sessionId: string,
    sessionUserId: string,
    action: "abandon" | "fail" | "extend",
    onDone: () => void | Promise<void>,
  ) => {
    if (
      action === "abandon" &&
      !confirm(`Mark session ${sessionId.slice(0, 8)}… abandoned?`)
    ) {
      return;
    }
    try {
      const body: Record<string, unknown> = {
        sessionId,
        userId: sessionUserId,
        action,
      };
      if (action === "extend") body.addMinutes = 60;
      const res = await fetch("/api/admin/sessions/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        affected?: number;
        error?: string;
      };
      if (!res.ok) {
        alert(`${action} failed: ${json.error ?? `HTTP ${res.status}`}`);
        return;
      }
      await onDone();
    } catch (err) {
      alert(`${action} failed: ${err instanceof Error ? err.message : "err"}`);
    }
  };

  const sweepStale = useCallback(async () => {
    if (
      !confirm(
        "Mark all active sessions idle > 30 minutes as 'abandoned'? This cannot be undone.",
      )
    )
      return;
    try {
      const res = await fetch("/api/admin/sessions/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup", staleAfterMinutes: 30 }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        flipped?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        alert(`Sweep failed: ${json.error ?? `HTTP ${res.status}`}`);
        return;
      }
      alert(`Flipped ${json.flipped ?? 0} stale sessions to 'abandoned'.`);
      void fetchSessions();
    } catch (err) {
      alert(`Sweep failed: ${err instanceof Error ? err.message : "err"}`);
    }
  }, [fetchSessions]);

  const tallies = useMemo(() => {
    const t = { active: 0, done: 0, failed: 0, abandoned: 0, stuck: 0 };
    if (!data) return t;
    for (const s of data.sessions) {
      if (s.status === "active") t.active++;
      else if (s.status === "done") t.done++;
      else if (s.status === "failed") t.failed++;
      else if (s.status === "abandoned") t.abandoned++;
      if (
        s.status === "active" &&
        bucketFreshness(ageMinutes(s.lastTouchedAt)) === "stuck"
      ) {
        t.stuck++;
      }
    }
    return t;
  }, [data]);

  return (
    <main className="relative min-h-screen bg-[#030303] text-neutral-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
        <div className="mb-10">
          <Link
            href="/dashboard/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-neutral-300"
          >
            <ArrowLeft className="h-3 w-3" /> back to admin
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-300">
                <Crown className="h-3 w-3" />
                Admin-only · agent sessions
              </div>
              <h1 className="font-serif text-[clamp(1.8rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
                Resumable agent state
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-400">
                Persistent state for long-running agent chains. Use to detect
                stuck runs (active &gt; 10min idle), inspect step history,
                triage abandoned sessions. State blobs may contain PII —
                operator-only by design.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={sweepStale}
                className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-1.5 text-[11px] font-medium text-amber-300 transition hover:bg-amber-500/[0.12]"
                title="Mark all active sessions idle > 30 minutes as 'abandoned'"
              >
                Sweep stale ≥30m
              </button>
              <button
                type="button"
                onClick={fetchSessions}
                disabled={loading}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 text-neutral-400 backdrop-blur-xl transition hover:text-neutral-200 disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {data?.warning && !error && (
          <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-300">
            {data.warning}
          </div>
        )}

        {data && !error && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile
                icon={<Activity className="h-4 w-4" />}
                label="Active"
                value={fmtNum(tallies.active)}
                accent="cyan"
              />
              <StatTile
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Done"
                value={fmtNum(tallies.done)}
                accent="emerald"
              />
              <StatTile
                icon={<XCircle className="h-4 w-4" />}
                label="Failed"
                value={fmtNum(tallies.failed)}
                accent="red"
              />
              <StatTile
                icon={<Pause className="h-4 w-4" />}
                label="Abandoned"
                value={fmtNum(tallies.abandoned)}
                accent="neutral"
              />
              <StatTile
                icon={<Clock className="h-4 w-4" />}
                label="Stuck > 10m"
                value={fmtNum(tallies.stuck)}
                accent="amber"
              />
            </div>

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setStatusFilter(opt)}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
                      statusFilter === opt
                        ? "border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-300"
                        : "border-white/[0.08] bg-white/[0.03] text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                placeholder="filter by agent name…"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 sm:w-72"
              />
            </div>

            <Section title={`Sessions (${data.sessions.length})`}>
              {data.sessions.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-neutral-500">
                  No sessions match these filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                        {[
                          "Agent",
                          "User",
                          "Status",
                          "Steps",
                          "Last step",
                          "Touched",
                          "Age",
                          "State preview",
                          "Actions",
                        ].map((c) => (
                          <th
                            key={c}
                            className="px-5 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.sessions.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]"
                        >
                          <td className="px-5 py-3 font-mono text-white">
                            {s.agentName}
                          </td>
                          <td className="px-5 py-3 font-mono text-neutral-300">
                            {truncate(s.userId, 18)}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={s.status} />
                          </td>
                          <td className="px-5 py-3 font-mono text-neutral-300">
                            {fmtNum(s.stepCount)}
                          </td>
                          <td className="px-5 py-3 font-mono text-neutral-300">
                            {s.lastStepLabel ?? "—"}
                          </td>
                          <td className="px-5 py-3 font-mono text-neutral-300">
                            {short(s.lastTouchedAt)}
                          </td>
                          <td
                            className={`px-5 py-3 font-mono ${
                              s.status === "active"
                                ? FRESHNESS_TEXT_COLOR[
                                    bucketFreshness(ageMinutes(s.lastTouchedAt))
                                  ]
                                : "text-neutral-500"
                            }`}
                            title={
                              s.status === "active"
                                ? bucketFreshness(ageMinutes(s.lastTouchedAt))
                                : undefined
                            }
                          >
                            {ageMinutes(s.lastTouchedAt)}m
                          </td>
                          <td
                            className="px-5 py-3 font-mono text-neutral-500"
                            title={s.statePreview}
                          >
                            {prettyStatePreview(s.statePreview)}
                          </td>
                          <td className="px-5 py-3">
                            {s.status === "active" ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    controlSession(
                                      s.id,
                                      s.userId,
                                      "abandon",
                                      fetchSessions,
                                    )
                                  }
                                  className="rounded-md border border-neutral-500/30 bg-neutral-500/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-300 hover:bg-neutral-500/[0.12] hover:text-white"
                                  title="Mark abandoned"
                                >
                                  abandon
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    controlSession(
                                      s.id,
                                      s.userId,
                                      "extend",
                                      fetchSessions,
                                    )
                                  }
                                  className="rounded-md border border-cyan-500/30 bg-cyan-500/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/[0.12]"
                                  title="Extend TTL +60m"
                                >
                                  +60m
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-neutral-600">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </>
        )}

        <div className="mt-16 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {lastFetch
              ? `updated ${lastFetch.toLocaleTimeString()} · 30s poll`
              : "loading…"}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/api/admin/sessions"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              raw JSON
            </Link>
            <Link
              href="/dashboard/admin/cohorts"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              cohorts →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "cyan" | "emerald" | "red" | "neutral" | "amber";
}) {
  const text =
    accent === "cyan"
      ? "text-cyan-300"
      : accent === "emerald"
        ? "text-emerald-300"
        : accent === "red"
          ? "text-red-300"
          : accent === "amber"
            ? "text-amber-300"
            : "text-neutral-400";
  const bg =
    accent === "cyan"
      ? "from-cyan-500/[0.08] via-cyan-500/[0.02] to-transparent"
      : accent === "emerald"
        ? "from-emerald-500/[0.08] via-emerald-500/[0.02] to-transparent"
        : accent === "red"
          ? "from-red-500/[0.08] via-red-500/[0.02] to-transparent"
          : accent === "amber"
            ? "from-amber-500/[0.08] via-amber-500/[0.02] to-transparent"
            : "from-white/[0.04] via-white/[0.01] to-transparent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${bg} p-5 backdrop-blur-xl`}
    >
      <div className={`mb-3 inline-flex items-center gap-1.5 ${text}`}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="font-mono text-2xl font-bold leading-none text-white">
        {value}
      </div>
    </motion.div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-white">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        {children}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "active"
      ? "border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-300"
      : status === "done"
        ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300"
        : status === "failed"
          ? "border-red-500/30 bg-red-500/[0.08] text-red-300"
          : "border-neutral-500/30 bg-neutral-500/[0.08] text-neutral-400";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${style}`}
    >
      {status}
    </span>
  );
}
