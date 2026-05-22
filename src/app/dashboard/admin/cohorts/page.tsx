"use client";

/**
 * SOVEREIGN MATRIX — /dashboard/admin/cohorts (Wave 127).
 *
 * Admin-only per-tenant cohort dashboard. Renders the report from
 * /api/admin/cohorts: weekly new-user buckets, retention rates,
 * runs-per-user percentiles, super-user count, top-25 by volume.
 *
 * The page tells the operator + (in an exported screenshot) investor
 * diligence: who's accumulating receipts, who's churning, where the
 * power curve sits.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Users,
  TrendingUp,
  Activity,
  Crown,
  ArrowLeft,
} from "lucide-react";
import { motion } from "framer-motion";

interface CohortBucket {
  week: string;
  newUsers: number;
  totalRuns: number;
  activeInLastWeek: number;
  retention: number;
}

interface UserCohortRow {
  userId: string;
  firstRunAt: string;
  lastRunAt: string;
  totalRuns: number;
  ageDays: number;
  retentionScore: number;
}

interface CohortReport {
  generatedAt: string;
  windowDays: number;
  totalUsers: number;
  totalRuns: number;
  medianRunsPerUser: number;
  p90RunsPerUser: number;
  superUsers: number;
  weeklyCohorts: CohortBucket[];
  topUsers: UserCohortRow[];
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function AdminCohortsPage() {
  const [windowDays, setWindowDays] = useState<number>(90);
  const [report, setReport] = useState<CohortReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cohorts?windowDays=${windowDays}`);
      if (res.status === 403) {
        setError("Admin-only — your Clerk session is not authorised.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CohortReport = await res.json();
      setReport(data);
      setError(null);
      setLastFetch(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    void fetchReport();
    const id = setInterval(() => void fetchReport(), 60_000);
    return () => clearInterval(id);
  }, [fetchReport]);

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
                Admin-only · cohort intel
              </div>
              <h1 className="font-serif text-[clamp(1.8rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
                Per-tenant cohorts
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-400">
                Aggregated from the agent_runs receipt fabric. Use to screen for
                retention pockets, identify super-user accounts to nurture, and
                surface which week's onboarding cohort is still firing.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 backdrop-blur-xl">
                {[7, 30, 90, 180, 365].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWindowDays(w)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
                      windowDays === w
                        ? "bg-white/[0.08] text-white"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {w}d
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={fetchReport}
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

        {report && !error && (
          <>
            <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HeroTile
                icon={<Users className="h-4 w-4" />}
                label="Active users"
                value={fmtNum(report.totalUsers)}
                sub={`in last ${report.windowDays}d`}
              />
              <HeroTile
                icon={<Activity className="h-4 w-4" />}
                label="Total runs"
                value={fmtNum(report.totalRuns)}
                sub="signed receipts produced"
              />
              <HeroTile
                icon={<TrendingUp className="h-4 w-4" />}
                label="Median / p90 runs"
                value={`${fmtNum(report.medianRunsPerUser)} / ${fmtNum(report.p90RunsPerUser)}`}
                sub="per-user distribution"
              />
              <HeroTile
                icon={<Crown className="h-4 w-4" />}
                label="Super users"
                value={fmtNum(report.superUsers)}
                sub="≥100 runs · the moat"
                accent="copper"
              />
            </div>

            <Section title="Weekly cohorts (first-run week)">
              <Table
                cols={[
                  "Week",
                  "New users",
                  "Total runs",
                  "Active · 7d",
                  "Retention",
                ]}
                rows={report.weeklyCohorts.map((c) => [
                  c.week,
                  fmtNum(c.newUsers),
                  fmtNum(c.totalRuns),
                  fmtNum(c.activeInLastWeek),
                  fmtPct(c.retention),
                ])}
              />
            </Section>

            <Section title="Top users by volume (last window)">
              <Table
                cols={[
                  "User ID",
                  "First run",
                  "Last run",
                  "Runs",
                  "Age (d)",
                  "Retention score",
                ]}
                rows={report.topUsers.map((u) => [
                  truncate(u.userId, 18),
                  short(u.firstRunAt),
                  short(u.lastRunAt),
                  fmtNum(u.totalRuns),
                  u.ageDays.toFixed(1),
                  u.retentionScore.toFixed(3),
                ])}
              />
            </Section>
          </>
        )}

        <div className="mt-16 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {lastFetch
              ? `updated ${lastFetch.toLocaleTimeString()} · 60s poll`
              : "loading…"}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/api/admin/cohorts"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              raw JSON
            </Link>
            <Link
              href="/metrics"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              public metrics →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function HeroTile({
  icon,
  label,
  value,
  sub,
  accent = "cyan",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: "cyan" | "copper";
}) {
  const text = accent === "cyan" ? "text-cyan-300" : "text-amber-300";
  const bg =
    accent === "cyan"
      ? "from-cyan-500/[0.08] via-cyan-500/[0.02] to-transparent"
      : "from-amber-500/[0.08] via-amber-500/[0.02] to-transparent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
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
      <div className="mt-2 text-[11px] leading-relaxed text-neutral-500">
        {sub}
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

function Table({ cols, rows }: { cols: string[]; rows: Array<Array<string>> }) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-xs text-neutral-500">
        No data in this window.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[12px]">
        <thead>
          <tr className="border-b border-white/[0.04] bg-white/[0.01]">
            {cols.map((c) => (
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
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-5 py-3 font-mono ${
                    j === 0 ? "text-white" : "text-neutral-300"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
function short(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}
