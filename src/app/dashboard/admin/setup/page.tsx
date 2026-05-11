"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Lock,
  Shield,
} from "lucide-react";
import Link from "next/link";

/**
 * /dashboard/admin/setup — Setup readiness console
 *
 * Reads /api/admin/setup-checklist (admin-only) and renders the platform
 * readiness state as green/red ticks grouped by category. Designed to
 * answer one question fast: "what's still preventing this from being
 * fully operational?"
 *
 * Refresh button re-runs every check on demand.
 */

type Status = "ok" | "missing" | "error";

interface CheckItem {
  label: string;
  status: Status;
  hint?: string;
}

interface CheckCategory {
  name: string;
  items: CheckItem[];
}

interface ChecklistResponse {
  categories: CheckCategory[];
  summary: { total: number; ok: number; missing: number; errors: number };
  generatedAt: string;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "ok")
    return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (status === "missing")
    return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
  return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
}

export default function SetupChecklistPage() {
  const [data, setData] = useState<ChecklistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/setup-checklist", {
        cache: "no-store",
      });
      if (res.status === 401) {
        setError("You need to sign in to view this page.");
        return;
      }
      if (res.status === 404) {
        setError(
          "Admin access required. Add your Clerk user ID to ADMIN_USER_IDS.",
        );
        return;
      }
      if (!res.ok) {
        setError(`Failed to load checklist (HTTP ${res.status})`);
        return;
      }
      const json = (await res.json()) as ChecklistResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <title>Setup Checklist | Sovereign Matrix</title>

      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-emerald-400" />
            <Link href="/" className="text-sm font-bold">
              Sovereign Matrix
            </Link>
            <span className="text-neutral-600 text-xs">/</span>
            <Link
              href="/dashboard/admin"
              className="text-xs text-neutral-400 hover:text-white"
            >
              Admin
            </Link>
            <span className="text-neutral-600 text-xs">/</span>
            <span className="text-xs text-white">Setup</span>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 text-xs text-neutral-300 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            Setup readiness
          </h1>
          <p className="text-sm text-neutral-400 max-w-2xl">
            Every check below either green-ticks or tells you exactly what to do
            to fix it. Use this page after every deploy, after rotating secrets,
            and before opening the platform to a new customer.
          </p>
        </motion.header>

        {error && (
          <div className="mb-8 px-5 py-4 rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] flex items-start gap-3">
            <Lock className="w-4 h-4 text-rose-400 mt-0.5" />
            <div>
              <p className="text-sm text-white font-semibold">{error}</p>
              <p className="text-xs text-neutral-400 mt-1">
                Need admin access? Add your Clerk user ID to{" "}
                <code className="px-1.5 py-0.5 rounded bg-white/5">
                  ADMIN_USER_IDS
                </code>{" "}
                in your Vercel env vars.
              </p>
            </div>
          </div>
        )}

        {data && <Summary data={data} />}

        {loading && !data && (
          <div className="grid gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse"
              />
            ))}
          </div>
        )}

        {data && (
          <div className="grid gap-5">
            {data.categories.map((cat, i) => (
              <CategoryCard key={cat.name} category={cat} delay={0.05 * i} />
            ))}
          </div>
        )}

        {data && (
          <p className="mt-8 text-[11px] text-neutral-600">
            Last checked {new Date(data.generatedAt).toLocaleString()}.
            Re-running this page rechecks every item live — there is no cache.
          </p>
        )}
      </main>
    </div>
  );
}

function Summary({ data }: { data: ChecklistResponse }) {
  const { ok, missing, errors, total } = data.summary;
  const ready = missing === 0 && errors === 0;
  const pct = Math.round((ok / total) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="mb-8 px-6 py-5 rounded-2xl border border-white/[0.08] bg-white/[0.02]"
    >
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-1">
            Overall
          </div>
          <div className="text-2xl font-black">
            {ready ? (
              <span className="text-emerald-400">Ready to ship</span>
            ) : (
              <span className="text-amber-400">
                {missing + errors} item{missing + errors === 1 ? "" : "s"} need
                attention
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat label="OK" value={ok} tone="emerald" />
          <Stat label="Missing" value={missing} tone="rose" />
          <Stat label="Errors" value={errors} tone="amber" />
          <Stat label="Total" value={total} tone="neutral" />
        </div>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`}
        />
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose" | "amber" | "neutral";
}) {
  const toneColor = {
    emerald: "text-emerald-400",
    rose: "text-rose-400",
    amber: "text-amber-400",
    neutral: "text-neutral-300",
  }[tone];
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </div>
      <div className={`text-xl font-bold ${toneColor}`}>{value}</div>
    </div>
  );
}

function CategoryCard({
  category,
  delay,
}: {
  category: CheckCategory;
  delay: number;
}) {
  const allOk = category.items.every((i) => i.status === "ok");
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-2xl border ${
        allOk
          ? "border-white/[0.06] bg-white/[0.015]"
          : "border-amber-500/20 bg-amber-500/[0.02]"
      }`}
    >
      <header className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
        <h2 className="text-sm font-semibold">{category.name}</h2>
        <span
          className={`text-[10px] uppercase tracking-wider ${
            allOk ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          {category.items.filter((i) => i.status === "ok").length}/
          {category.items.length}
        </span>
      </header>
      <ul className="divide-y divide-white/[0.04]">
        {category.items.map((item) => (
          <li
            key={item.label}
            className="px-5 py-3 flex items-start gap-3 text-sm"
          >
            <StatusIcon status={item.status} />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-neutral-200">
                {item.label}
              </div>
              {item.hint && (
                <div className="text-[11px] text-neutral-500 mt-1">
                  {item.hint}
                </div>
              )}
            </div>
            {item.status === "missing" && (
              <span className="text-[10px] uppercase tracking-wider text-rose-300/70">
                Set this
              </span>
            )}
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
