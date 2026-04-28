"use client";

/**
 * /trust/customers — anonymized live platform stats.
 *
 * Reads /api/health/customers which aggregates agent_stats_daily
 * over 14 days and applies the bucketing config in
 * customer-stats-anonymizer.ts.
 *
 * Honest empty state: when no telemetry exists yet, we show that
 * fact rather than fabricating numbers (Constitution Principle 5).
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Users,
  Cpu,
  Timer,
  EyeOff,
} from "lucide-react";

interface PublishedStats {
  headline: string;
  successRatePct: number | null;
  runVolumeBucket: string;
  userVolumeBucket: string;
  avgLatencySec: number | null;
  distinctAgents: number;
  windowDays: number;
}

interface ApiResponse {
  published: PublishedStats | null;
  note?: string;
}

export default function TrustCustomersPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/health/customers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive) {
          setData(j);
          setLoading(false);
        }
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const stats = data?.published ?? null;

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-5xl px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-xs font-medium text-violet-300">
              <EyeOff className="w-3 h-3" />
              Anonymized — no per-tenant data
            </div>
            <h1 className="mt-6 text-4xl md:text-5xl font-light tracking-tight text-white">
              Customers in numbers,
              <br />
              <span className="bg-gradient-to-r from-violet-200 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
                published not promised.
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-base text-neutral-400 leading-relaxed">
              These figures come from our production database, anonymized
              and bucketed. We never publish per-tenant volumes or
              identifiers. We never fabricate numbers — when telemetry is
              warming up, this page says so honestly.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 rounded-2xl bg-white/[0.02] animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && !stats && (
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-8 text-center">
            <Activity className="w-8 h-8 text-violet-300 mx-auto" />
            <h2 className="mt-4 text-lg font-medium text-white">
              Telemetry warming up
            </h2>
            <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
              {data?.note ?? "No aggregated stats available yet."} The
              platform&apos;s daily-stats rollup runs at 04:00 UTC each
              day; numbers will appear here within 24 hours of the first
              real run.
            </p>
          </div>
        )}

        {!loading && stats && (
          <>
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-4">
              {stats.headline}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<Activity className="w-4 h-4" />}
                label="Agent runs"
                value={stats.runVolumeBucket}
                hint={`across ${stats.windowDays} days`}
              />
              <StatCard
                icon={<Users className="w-4 h-4" />}
                label="Active operators"
                value={stats.userVolumeBucket}
                hint="distinct authenticated users"
              />
              <StatCard
                icon={<CheckCircle2 className="w-4 h-4" />}
                label="Success rate"
                value={
                  stats.successRatePct !== null
                    ? `${stats.successRatePct.toFixed(1)}%`
                    : "—"
                }
                hint="completed without error"
              />
              <StatCard
                icon={<Timer className="w-4 h-4" />}
                label="Avg latency"
                value={
                  stats.avgLatencySec !== null
                    ? `${stats.avgLatencySec.toFixed(1)}s`
                    : "—"
                }
                hint="per agent run"
              />
            </div>
            <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <div className="flex items-start gap-3">
                <Cpu className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white">
                    {stats.distinctAgents} distinct agents ran in this window
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Of the 223 production agents available on the
                    platform, this number reflects how many got at least
                    one real run in the last {stats.windowDays} days.
                    The full catalog is browsable at /agents.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6">
          <h3 className="text-sm font-medium text-white">
            Why ranges instead of exact numbers
          </h3>
          <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
            At early-stage scale, exact numbers can let competitors
            estimate ARR and target individual customers. We bucket
            counts to ranges that are still procurement-friendly but
            don&apos;t leak business-sensitive precision. The bucketing
            config lives in source ({" "}
            <code className="text-xs text-neutral-300">
              src/lib/customer-stats-anonymizer.ts
            </code>
            ) — auditable like everything else.
          </p>
          <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
            The success rate, latency, and distinct-agents count are
            already aggregates that can&apos;t be reverse-engineered
            into per-tenant info, so those are reported exactly.
          </p>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-5"
    >
      <div className="flex items-center gap-2 text-neutral-400 text-sm">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-2xl md:text-3xl font-light text-white tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-neutral-500">{hint}</div>
    </motion.div>
  );
}
