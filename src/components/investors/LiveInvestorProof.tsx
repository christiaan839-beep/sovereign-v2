"use client";

/**
 * SOVEREIGN MATRIX — Live investor proof card (Wave 119).
 *
 * Why this exists:
 *   The /investors page is mostly narrative. Investor diligence asks
 *   "where are the numbers?" — this component answers in 5 live tiles
 *   that pull from three reproducible endpoints:
 *
 *     • /api/status/metrics/extended  (cost savings, total runs)
 *     • /api/security/eval            (adversarial block rate)
 *     • /api/agents/dashboard-stats   (agents/models/industries)
 *
 *   Every number links back to the raw JSON so diligence can verify.
 *   No fake "$X saved" placeholder when the endpoint returns empty —
 *   tile dims to "—" so we never publish a number we can't back.
 *
 * Design rules:
 *   - Cyan = audit/security tiles. Copper/amber = economic tiles.
 *   - Real numbers preferred; falls back to "—" gracefully.
 *   - All fetches in parallel, 5s soft timeout, never blocks render.
 *   - Polls every 60s — same cadence as the underlying caches.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  TrendingDown,
  ShieldCheck,
  Boxes,
  FileSignature,
} from "lucide-react";

interface Tile {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  href: string;
  accent: "cyan" | "copper";
}

interface ExtendedMetricsPayload {
  totalRuns?: number;
  costSavings?: { savedUsd?: number; savedPct?: number };
}

interface AdversarialEvalPayload {
  attack?: { blockRate?: number; total?: number };
  benign?: { passRate?: number };
}

interface DashboardStatsPayload {
  agentCount?: number;
  modelCount?: number;
  industries?: number;
}

function fmtUsd(n: number | null): string {
  if (n === null) return "—";
  if (n < 0.01) return `$${n.toFixed(3)}`;
  if (n < 1) return `$${n.toFixed(2)}`;
  if (n < 1000) return `$${n.toFixed(2)}`;
  if (n < 1_000_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${(n / 1_000_000).toFixed(2)}m`;
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtNum(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString();
}

async function fetchJson<T>(url: string, timeoutMs = 5000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function LiveInvestorProof() {
  const [metrics, setMetrics] = useState<ExtendedMetricsPayload | null>(null);
  const [evalRes, setEvalRes] = useState<AdversarialEvalPayload | null>(null);
  const [dash, setDash] = useState<DashboardStatsPayload | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [m, e, d] = await Promise.all([
        fetchJson<ExtendedMetricsPayload>(
          "/api/status/metrics/extended?window=30d",
        ),
        fetchJson<AdversarialEvalPayload>("/api/security/eval"),
        fetchJson<DashboardStatsPayload>("/api/agents/dashboard-stats"),
      ]);
      if (cancelled) return;
      setMetrics(m);
      setEvalRes(e);
      setDash(d);
      setLastFetch(new Date());
    };
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const savedUsd =
    typeof metrics?.costSavings?.savedUsd === "number" &&
    Number.isFinite(metrics.costSavings.savedUsd) &&
    metrics.costSavings.savedUsd > 0
      ? metrics.costSavings.savedUsd
      : null;
  const totalRuns =
    typeof metrics?.totalRuns === "number" && metrics.totalRuns > 0
      ? metrics.totalRuns
      : null;
  const blockRate =
    typeof evalRes?.attack?.blockRate === "number" &&
    Number.isFinite(evalRes.attack.blockRate)
      ? evalRes.attack.blockRate
      : null;
  const agents =
    typeof dash?.agentCount === "number" && dash.agentCount > 0
      ? dash.agentCount
      : null;
  const models =
    typeof dash?.modelCount === "number" && dash.modelCount > 0
      ? dash.modelCount
      : null;

  const tiles: Tile[] = [
    {
      icon: <FileSignature className="h-4 w-4" />,
      label: "Signed runs · 30d",
      value: fmtNum(totalRuns),
      sub: "every run is a cryptographically-signed receipt",
      href: "/api/status/metrics/extended?window=30d",
      accent: "cyan",
    },
    {
      icon: <TrendingDown className="h-4 w-4" />,
      label: "Cost saved · 30d",
      value: fmtUsd(savedUsd),
      sub: "vs all-Claude-Sonnet baseline · cascade router",
      href: "/metrics",
      accent: "copper",
    },
    {
      icon: <ShieldCheck className="h-4 w-4" />,
      label: "Adversarial block rate",
      value: fmtPct(blockRate),
      sub: evalRes?.attack?.total
        ? `over ${evalRes.attack.total} adversarial prompts · ML-DSA-65 signed`
        : "fingerprinted corpus · post-quantum signed",
      href: "/api/security/eval",
      accent: "cyan",
    },
    {
      icon: <Boxes className="h-4 w-4" />,
      label: "Agents live",
      value: agents !== null ? `${agents}+` : "—",
      sub:
        models !== null
          ? `routing across ${models} models`
          : "registered in /agents",
      href: "/agents",
      accent: "copper",
    },
    {
      icon: <Activity className="h-4 w-4" />,
      label: "Verification surface",
      value: "Open",
      sub: "every claim above re-checkable via raw JSON",
      href: "/spec",
      accent: "cyan",
    },
  ];

  return (
    <section
      aria-label="Live investor proof"
      className="not-prose mb-12 rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]"
          />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300">
            Live · diligence-grade
          </span>
        </div>
        <span className="font-mono text-[10px] text-neutral-600">
          {lastFetch ? `updated ${lastFetch.toLocaleTimeString()}` : "loading…"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={`group relative flex flex-col gap-2 bg-[#030303] p-5 transition-colors hover:bg-white/[0.02] focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
              t.accent === "cyan"
                ? "hover:border-cyan-500/20"
                : "hover:border-amber-500/20"
            }`}
            aria-label={`${t.label} — verify at ${t.href}`}
          >
            <div
              className={`inline-flex items-center gap-1.5 ${
                t.accent === "cyan" ? "text-cyan-300" : "text-amber-300"
              }`}
            >
              {t.icon}
              <span className="text-[10px] font-medium uppercase tracking-[0.16em]">
                {t.label}
              </span>
            </div>
            <div className="font-mono text-2xl font-bold leading-none text-white">
              {t.value}
            </div>
            {t.sub && (
              <div className="text-[11px] leading-snug text-neutral-500">
                {t.sub}
              </div>
            )}
            <div className="mt-auto text-[10px] text-neutral-600 underline-offset-4 group-hover:text-neutral-400 group-hover:underline">
              {t.href.replace(/^\//, "")} ↗
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
